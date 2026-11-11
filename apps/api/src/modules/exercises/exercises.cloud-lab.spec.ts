import type { CloudEvidenceInput, SubmissionOutcome } from "@codeai/shared";
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { ProgressService } from "../progress/progress.service";
import { MockSandboxService } from "../sandbox/mock-sandbox.service";
import type { CreateSubmissionInput, ExerciseRow, SubmissionRow } from "./exercises.repository";
import type { AccreditationPolicy, ReviewScheduler } from "./exercises.service";
import { ExercisesService } from "./exercises.service";
import type { HintRequestRepository } from "./hint-requests.repository";
import { InMemoryExercisesRepository } from "./in-memory-exercises.repository";

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
    unitCode: "U0.2.2",
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

/** Laboratorio sembrado como T9c: `config` es lo público y `expect` sólo vive en `solution`. */
const LAB = base({
  id: "lab_1",
  type: "CLOUD_LAB",
  config: {
    checks: [
      {
        id: "c1",
        label: "Existe el presupuesto",
        command: "aws budgets describe-budgets",
        phase: "build",
      },
      {
        id: "c2",
        label: "Hay una alerta",
        command: "aws budgets describe-notifications-for-budget",
        phase: "build",
      },
    ],
  },
  solution: {
    checks: [
      { id: "c1", expect: [{ path: "Budgets[0].BudgetName", op: "equals", value: "mensual" }] },
      { id: "c2", expect: [{ path: "Notifications", op: "lengthAtLeast", value: 1 }] },
    ],
  },
});

const MARKER = "MARCADOR-UNICO-7f3a9";

const GOOD: CloudEvidenceInput = {
  evidence: [
    {
      checkId: "c1",
      output: JSON.stringify({ Budgets: [{ BudgetName: "mensual" }], Tag: MARKER }),
    },
    { checkId: "c2", output: JSON.stringify({ Notifications: [{ Type: "ACTUAL" }] }) },
  ],
  cleanupConfirmed: true,
};

class RecordingRepository extends InMemoryExercisesRepository {
  readonly created: CreateSubmissionInput[] = [];

  override async createSubmission(input: CreateSubmissionInput): Promise<SubmissionRow> {
    this.created.push(input);

    return super.createSubmission(input);
  }
}

function setup(exercises: readonly ExerciseRow[] = [LAB], accreditation?: AccreditationPolicy) {
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
    accreditation,
  );

  return { service, repository, calls, progress };
}

describe("ExercisesService.submitCloudEvidence", () => {
  it("con todo superado y la limpieza confirmada guarda PASSED con 100 y nivel máximo 2", async () => {
    const { service, repository, calls, progress } = setup();

    const { result } = await service.submitCloudEvidence("user_a", "lab_1", GOOD);

    expect(result.outcome).toBe("PASSED");
    expect(repository.created).toEqual([
      {
        userId: "user_a",
        exerciseId: "lab_1",
        code: '[{"checkId":"c1","passed":true,"problems":0},{"checkId":"c2","passed":true,"problems":0}]',
        outcome: "PASSED",
        score: 100,
        achievedLevel: 2,
        hintsUsed: 0,
        durationMs: 0,
        results: [],
      },
    ]);
    expect(repository.created[0]?.achievedLevel).not.toBe(3);
    expect(calls).toEqual([{ outcome: "PASSED", score: 100, hintsUsed: 0 }]);
    expect(progress).toEqual(["user_a:U0.2.2"]);
  });

  it("una comprobación fallida da PARTIAL con 50 y sin nivel", async () => {
    const { service, repository } = setup();

    const { result } = await service.submitCloudEvidence("user_a", "lab_1", {
      evidence: [
        { checkId: "c1", output: JSON.stringify({ Budgets: [{ BudgetName: "mensual" }] }) },
        { checkId: "c2", output: JSON.stringify({ Notifications: [] }) },
      ],
      cleanupConfirmed: true,
    });

    expect(result.outcome).toBe("PARTIAL");
    expect(repository.created[0]).toMatchObject({
      outcome: "PARTIAL",
      score: 50,
      achievedLevel: null,
    });
  });

  it("con todo superado pero sin confirmar la limpieza no acredita nivel", async () => {
    const { service, repository } = setup();

    const { result } = await service.submitCloudEvidence("user_a", "lab_1", {
      ...GOOD,
      cleanupConfirmed: false,
    });

    expect(result.outcome).toBe("PARTIAL");
    expect(repository.created[0]).toMatchObject({ score: 100, achievedLevel: null });
  });

  it("sin revisión humana y con la política activa, el nivel queda en null", async () => {
    const { service, repository } = setup([LAB], { requireHumanReview: true });

    await service.submitCloudEvidence("user_a", "lab_1", GOOD);

    expect(repository.created[0]).toMatchObject({ outcome: "PASSED", achievedLevel: null });
  });

  it("ningún campo del envío guardado contiene la salida en bruto", async () => {
    const { service, repository } = setup();

    await service.submitCloudEvidence("user_a", "lab_1", GOOD);

    expect(repository.created).toHaveLength(1);
    expect(JSON.stringify(repository.created)).not.toContain(MARKER);
  });

  it("rechaza un ejercicio que no es un laboratorio en la cuenta", async () => {
    const quiz = base({ id: "quiz_1", type: "QUIZ" });
    const { service, repository } = setup([quiz]);

    const answer = service.submitCloudEvidence("user_a", "quiz_1", GOOD);

    await expect(answer).rejects.toBeInstanceOf(BadRequestException);
    await expect(answer).rejects.toThrow("Este ejercicio no es un laboratorio en tu cuenta");
    expect(await repository.countSubmissions("user_a", "quiz_1")).toBe(0);
  });

  it("las credenciales en la evidencia dan 400 sin crear envío ni consumir intento", async () => {
    const limited = { ...LAB, maxAttempts: 1 };
    const { service, repository, calls } = setup([limited]);

    const answer = service.submitCloudEvidence("user_a", "lab_1", {
      evidence: [{ checkId: "c1", output: '{"Key":"AKIAABCDEFGHIJKLMNOP"}' }],
      cleanupConfirmed: true,
    });

    await expect(answer).rejects.toBeInstanceOf(BadRequestException);
    await expect(answer).rejects.toThrow(
      "La evidencia parece contener credenciales: no la envíes",
    );
    expect(await repository.countSubmissions("user_a", "lab_1")).toBe(0);
    expect(calls).toEqual([]);

    const { result } = await service.submitCloudEvidence("user_a", "lab_1", GOOD);

    expect(result.outcome).toBe("PASSED");
  });

  it("respeta el tope de intentos", async () => {
    const limited = { ...LAB, maxAttempts: 1 };
    const { service, repository } = setup([limited]);

    await service.submitCloudEvidence("user_a", "lab_1", GOOD);

    await expect(service.submitCloudEvidence("user_a", "lab_1", GOOD)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await repository.countSubmissions("user_a", "lab_1")).toBe(1);
  });

  it("un contenido mal sembrado responde 500 sin registrar el intento", async () => {
    const broken = { ...LAB, id: "lab_broken", solution: null };
    const { service, repository, calls } = setup([broken]);

    const answer = service.submitCloudEvidence("user_a", "lab_broken", GOOD);

    await expect(answer).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(answer).rejects.toThrow("El ejercicio está mal configurado");
    expect(await repository.countSubmissions("user_a", "lab_broken")).toBe(0);
    expect(calls).toEqual([]);
  });
});

describe("ExercisesService.getDetail — laboratorios en cuenta", () => {
  it("el config devuelto no contiene expect ni la solución", async () => {
    const { service } = setup();

    const detail = (await service.getDetail("lab_1")).exercise;

    expect(detail).not.toHaveProperty("solution");
    expect(detail.config).toEqual(LAB.config);
    expect(JSON.stringify(detail)).not.toContain("expect");
    expect(JSON.stringify(detail)).not.toContain("lengthAtLeast");
  });
});
