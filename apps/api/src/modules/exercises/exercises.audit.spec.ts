import type { AuditAnswerInput, SubmissionOutcome } from "@codeai/shared";
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { ProgressService } from "../progress/progress.service";
import { MockSandboxService } from "../sandbox/mock-sandbox.service";
import type { CreateSubmissionInput, ExerciseRow, SubmissionRow } from "./exercises.repository";
import type { HintRequestRepository } from "./hint-requests.repository";
import { InMemoryExercisesRepository } from "./in-memory-exercises.repository";
import type { ReviewScheduler } from "./exercises.service";
import { ExercisesService } from "./exercises.service";

interface ScheduledCall {
  outcome: SubmissionOutcome;
  score: number;
  hintsUsed: number;
}

const noHints: HintRequestRepository = {
  findUsedLevels: () => Promise.resolve([]),
  findLevelsRequestedSince: () => Promise.resolve([]),
  recordRequest: () => Promise.resolve(),
};

function base(overrides: Partial<ExerciseRow>): ExerciseRow {
  return {
    id: "ex",
    unitId: "unit_1",
    unitCode: "U0.1.1",
    slug: "ejercicio",
    type: "QUIZ",
    title: "Título",
    statement: "Enunciado",
    config: {},
    solution: null,
    ladder: "GUIDED",
    difficulty: 3,
    competencies: ["C1"],
    estimatedMin: 6,
    language: null,
    hintLevels: [],
    tests: [],
    ...overrides,
  };
}

/**
 * Auditoría sembrada como la deja T10b: `config` es exactamente lo que ve el
 * estudiante (`artifact` y `candidates` sin veredicto) y `solution` lo que sólo
 * conoce el servidor. Dos defectos reales y una trampa que parece sospechosa.
 */
const AUDIT = base({
  id: "audit_1",
  type: "AUDIT",
  config: {
    artifact: {
      language: "typescript",
      content: "await db.query(`DELETE FROM orders`);",
    },
    candidates: [
      { id: "f1", lines: [1, 1], label: "Línea 1: DELETE sin filtro" },
      { id: "f2", lines: [1, 1], label: "Línea 1: la conexión no se cierra" },
      { id: "f3", lines: [1, 1], label: "Línea 1: registro del error" },
    ],
  },
  solution: {
    findings: [
      { id: "f1", isDefect: true, severity: "critical", explanation: "Borra la tabla entera." },
      { id: "f2", isDefect: true, severity: "medium", explanation: "La conexión queda abierta." },
      {
        id: "f3",
        isDefect: false,
        severity: null,
        explanation: "El registro del error es correcto.",
      },
    ],
    verdict: "fix",
  },
});

/** Marca los dos defectos con su severidad exacta y acierta la decisión: 100. */
const PERFECT: AuditAnswerInput = {
  marks: [
    { findingId: "f1", severity: "critical" },
    { findingId: "f2", severity: "medium" },
  ],
  decision: "fix",
};

/** La misma respuesta más un no-defecto marcado: 0.8 + 0.2 − 0.15 = 85. */
const WITH_FALSE_POSITIVE: AuditAnswerInput = {
  marks: [...PERFECT.marks, { findingId: "f3", severity: "low" }],
  decision: "fix",
};

class RecordingRepository extends InMemoryExercisesRepository {
  readonly created: CreateSubmissionInput[] = [];

  override async createSubmission(input: CreateSubmissionInput): Promise<SubmissionRow> {
    this.created.push(input);

    return super.createSubmission(input);
  }
}

function setup(exercises: readonly ExerciseRow[] = [AUDIT]) {
  const calls: ScheduledCall[] = [];
  const reviews: ReviewScheduler = {
    scheduleFromSubmission: (params) => {
      calls.push({ outcome: params.outcome, score: params.score, hintsUsed: params.hintsUsed });

      return Promise.resolve(true);
    },
  };
  const progress: string[] = [];
  const progressService = {
    recordExerciseActivity: (userId: string, unitCode: string) => {
      progress.push(`${userId}:${unitCode}`);

      return Promise.resolve();
    },
  } as unknown as ProgressService;
  const repository = new RecordingRepository({ exercises, submissions: [] });
  const service = new ExercisesService(
    repository,
    new MockSandboxService(),
    noHints,
    reviews,
    progressService,
  );

  return { service, repository, calls, progress };
}

describe("ExercisesService.answerAudit", () => {
  it("un acierto total registra un envío PASSED con 100, acredita nivel 3 y programa el repaso", async () => {
    const { service, repository, calls, progress } = setup();

    const { result } = await service.answerAudit("user_a", "audit_1", PERFECT);

    expect(result).toMatchObject({
      score: 100,
      outcome: "PASSED",
      detectedDefects: 2,
      totalDefects: 2,
      falsePositives: 0,
      decisionCorrect: true,
      verdict: "fix",
    });
    expect(result.findings).toHaveLength(3);
    expect(repository.created).toEqual([
      {
        userId: "user_a",
        exerciseId: "audit_1",
        code: '{"marks":[{"findingId":"f1","severity":"critical"},{"findingId":"f2","severity":"medium"}],"decision":"fix"}',
        outcome: "PASSED",
        score: 100,
        achievedLevel: 3,
        hintsUsed: 0,
        durationMs: 0,
        results: [],
      },
    ]);
    expect(calls).toEqual([
      { outcome: "PASSED", score: 100, hintsUsed: 0 },
    ]);
    expect(progress).toEqual(["user_a:U0.1.1"]);
  });

  it("un falso positivo baja la nota por debajo del mismo caso sin él", async () => {
    const clean = setup();
    const dirty = setup();

    const without = await clean.service.answerAudit("user_a", "audit_1", PERFECT);
    const withFalsePositive = await dirty.service.answerAudit(
      "user_a",
      "audit_1",
      WITH_FALSE_POSITIVE,
    );

    expect(without.result.score).toBe(100);
    expect(withFalsePositive.result.score).toBe(85);
    expect(withFalsePositive.result.score).toBeLessThan(without.result.score);
    expect(withFalsePositive.result.falsePositives).toBe(1);
  });

  it("sin defectos detectados la nota es 0, falla y no acredita nivel", async () => {
    const { service, repository } = setup();

    const { result } = await service.answerAudit("user_a", "audit_1", {
      marks: [],
      decision: "accept",
    });

    expect(result).toMatchObject({ score: 0, outcome: "FAILED", detectedDefects: 0 });
    expect(repository.created[0]).toMatchObject({ outcome: "FAILED", achievedLevel: null });
  });

  it("rechaza un ejercicio que no es una auditoría", async () => {
    const quiz = base({ id: "quiz_1", type: "QUIZ" });
    const { service, repository } = setup([quiz]);

    const answer = service.answerAudit("user_a", "quiz_1", PERFECT);

    await expect(answer).rejects.toBeInstanceOf(BadRequestException);
    await expect(answer).rejects.toThrow("Este ejercicio no es una auditoría");
    expect(await repository.countSubmissions("user_a", "quiz_1")).toBe(0);
  });

  it("rechaza un hallazgo inexistente sin crear envío ni consumir intento", async () => {
    const limited = { ...AUDIT, maxAttempts: 1 };
    const { service, repository, calls } = setup([limited]);

    await expect(
      service.answerAudit("user_a", "audit_1", {
        marks: [{ findingId: "f9", severity: "low" }],
        decision: "accept",
      }),
    ).rejects.toThrow("El hallazgo f9 no existe en esta auditoría");
    expect(await repository.countSubmissions("user_a", "audit_1")).toBe(0);
    expect(calls).toEqual([]);

    // El intento sigue disponible: la respuesta inválida no gastó ninguno.
    const { result } = await service.answerAudit("user_a", "audit_1", PERFECT);

    expect(result.outcome).toBe("PASSED");
    expect(await repository.countSubmissions("user_a", "audit_1")).toBe(1);
  });

  it("respeta el tope de intentos", async () => {
    const limited = { ...AUDIT, maxAttempts: 1 };
    const { service, repository } = setup([limited]);

    await service.answerAudit("user_a", "audit_1", PERFECT);

    await expect(service.answerAudit("user_a", "audit_1", PERFECT)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await repository.countSubmissions("user_a", "audit_1")).toBe(1);
  });

  it("un contenido mal sembrado responde 500 sin registrar el intento", async () => {
    const broken = base({
      id: "audit_broken",
      type: "AUDIT",
      solution: {
        findings: [
          { id: "f1", isDefect: false, severity: null, explanation: "El nombre es claro." },
        ],
        verdict: "accept",
      },
    });
    const { service, repository, calls } = setup([broken]);

    const answer = service.answerAudit("user_a", "audit_broken", PERFECT);

    await expect(answer).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(answer).rejects.toThrow("El ejercicio está mal configurado");
    expect(await repository.countSubmissions("user_a", "audit_broken")).toBe(0);
    expect(calls).toEqual([]);
  });
});

describe("ExercisesService.getDetail — auditorías", () => {
  it("no filtra isDefect, severity ni explanation de la solución", async () => {
    const { service } = setup();

    const detail = (await service.getDetail("audit_1")).exercise;

    expect(detail).not.toHaveProperty("solution");
    expect(detail.config).toEqual(AUDIT.config);

    const serialized = JSON.stringify(detail);

    expect(serialized).not.toContain("isDefect");
    expect(serialized).not.toContain("severity");
    expect(serialized).not.toContain("explanation");
    expect(serialized).not.toContain("Borra la tabla entera.");
  });
});
