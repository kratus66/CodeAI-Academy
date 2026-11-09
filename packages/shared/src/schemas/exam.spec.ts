import { describe, expect, it } from "vitest";
import type { ZodError } from "zod";

import {
  DOMAIN_BLOCK_MIN,
  DOMAIN_BLOCK_SIZE,
  EXAM_ATTEMPT_STATUSES,
  EXAM_EXTRA_TIME_MIN,
  EXAM_GRACE_SECONDS,
  EXAM_MODES,
  RANDOM_EXCLUDE_LAST_ATTEMPTS,
  READINESS_CRITERIA,
  READINESS_STATUSES,
  examAttemptResponseSchema,
  examAttemptSchema,
  examHistoryResponseSchema,
  examItemUpdateResponseSchema,
  examReadinessResponseSchema,
  examReadinessSchema,
  examResultItemSchema,
  examResultResponseSchema,
  examResultSchema,
  readinessCriterionSchema,
  realExamResultSchema,
  realResultResponseSchema,
  registerRealResultSchema,
  startExamAttemptSchema,
  updateExamItemSchema,
  type ExamAttempt,
  type ExamAttemptItem,
  type ExamHistoryItem,
  type ExamReadiness,
  type ExamResult,
  type ExamResultItem,
  type ReadinessCriterion,
  type RealExamResult,
  type RegisterRealResultInput,
  type StartExamAttemptInput,
  type UpdateExamItemInput,
} from "./exam";

const ITEM = {
  position: 1,
  domain: 2,
  statement: "¿Qué servicio almacena objetos de forma duradera?",
  config: { kind: "single", options: [{ id: "a", text: "Amazon S3" }] },
  answer: { optionId: "a" },
  flagged: false,
} as const;

const ATTEMPT = {
  id: "attempt_1",
  certification: "CLF-C02",
  mode: "form-a",
  domain: null,
  extraTime: true,
  status: "in-progress",
  orientative: false,
  startedAt: "2026-11-09T09:00:00.000Z",
  deadlineAt: "2026-11-09T10:30:00.000Z",
  submittedAt: null,
  remainingSeconds: 5400,
  questionCount: 65,
  answeredCount: 1,
  items: [ITEM],
} as const;

const RESULT_ITEM = {
  ...ITEM,
  correct: true,
  correctAnswer: { optionId: "a" },
  explanations: { a: "S3 guarda objetos de forma duradera." },
  unitCode: "U9.1.1",
} as const;

const RESULT = {
  attemptId: "attempt_1",
  certification: "CLF-C02",
  mode: "form-a",
  domain: null,
  status: "submitted",
  orientative: false,
  startedAt: "2026-11-09T09:00:00.000Z",
  submittedAt: "2026-11-09T10:12:00.000Z",
  correctCount: 52,
  questionCount: 65,
  scorePct: 80,
  domains: [{ domain: 1, name: "Cloud Concepts", correct: 13, total: 16, pct: 81 }],
  items: [RESULT_ITEM],
} as const;

const HISTORY_ITEM = {
  attemptId: "attempt_1",
  mode: "form-a",
  domain: null,
  status: "submitted",
  orientative: false,
  startedAt: "2026-11-09T09:00:00.000Z",
  submittedAt: "2026-11-09T10:12:00.000Z",
  scorePct: 80,
  questionCount: 65,
} as const;

const CRITERIA = [
  {
    id: "mastery",
    status: "missing",
    summary: "Faltan unidades de la etapa por dominar.",
    missing: ["U9.1.1"],
  },
  {
    id: "mock-exams",
    status: "met",
    summary: "Dos formas distintas con al menos un 80 %.",
    missing: [],
  },
  {
    id: "review",
    status: "missing",
    summary: "Quedan preguntas falladas en el repaso.",
    missing: ["12 preguntas"],
  },
  {
    id: "evidence",
    status: "unavailable",
    summary: "La defensa técnica llega con los escenarios de S26.",
    missing: [],
  },
] as const;

const REAL_RESULT = {
  id: "real_1",
  certification: "CLF-C02",
  passed: true,
  scaledScore: 780,
  takenOn: "2026-11-07",
  readyAtRegistration: false,
  createdAt: "2026-11-09T09:00:00.000Z",
} as const;

const READINESS = {
  certification: "CLF-C02",
  stageId: 101,
  ready: false,
  criteria: CRITERIA,
  evaluatedAt: "2026-11-09T09:00:00.000Z",
  lastRealResult: REAL_RESULT,
} as const;

function messagesOf(result: { success: true } | { success: false; error: ZodError }): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function pathsOf(result: { success: true } | { success: false; error: ZodError }): (string | number)[][] {
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

describe("constantes del simulacro", () => {
  it("tienen los valores del contrato", () => {
    expect(EXAM_MODES).toEqual(["form-a", "form-b", "form-c", "random", "domain"]);
    expect(EXAM_ATTEMPT_STATUSES).toEqual(["in-progress", "submitted", "expired"]);
    expect(EXAM_EXTRA_TIME_MIN).toBe(30);
    expect(EXAM_GRACE_SECONDS).toBe(5);
    expect(DOMAIN_BLOCK_SIZE).toBe(20);
    expect(DOMAIN_BLOCK_MIN).toBe(15);
    expect(RANDOM_EXCLUDE_LAST_ATTEMPTS).toBe(3);
  });
});

describe("startExamAttemptSchema", () => {
  it("acepta una forma fija y aplica extraTime por defecto", () => {
    expect(startExamAttemptSchema.parse({ mode: "form-a" })).toEqual({
      mode: "form-a",
      extraTime: false,
    });
  });

  it("acepta el bloque por dominio y el tiempo extra", () => {
    const block: StartExamAttemptInput = { mode: "domain", domain: 2, extraTime: false };

    expect(startExamAttemptSchema.parse(block)).toEqual(block);
    expect(startExamAttemptSchema.parse({ mode: "random", extraTime: true })).toEqual({
      mode: "random",
      extraTime: true,
    });
  });

  it("exige domain en el bloque por dominio", () => {
    const result = startExamAttemptSchema.safeParse({ mode: "domain" });

    expect(result.success).toBe(false);
    expect(messagesOf(result)).toEqual(["El bloque por dominio necesita domain"]);
    expect(pathsOf(result)).toContainEqual(["domain"]);
  });

  it("rechaza domain fuera del bloque por dominio", () => {
    const result = startExamAttemptSchema.safeParse({ mode: "form-a", domain: 2 });

    expect(result.success).toBe(false);
    expect(messagesOf(result)).toEqual(["domain solo se usa en el bloque por dominio"]);
    expect(pathsOf(result)).toContainEqual(["domain"]);
  });

  it("rechaza claves desconocidas", () => {
    const result = startExamAttemptSchema.safeParse({ mode: "form-a", answers: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe("unrecognized_keys");
    }
  });

  it("rechaza un dominio fuera de 1–6 y un modo desconocido", () => {
    expect(startExamAttemptSchema.safeParse({ mode: "domain", domain: 7 }).success).toBe(false);
    expect(startExamAttemptSchema.safeParse({ mode: "domain", domain: 0 }).success).toBe(false);
    expect(startExamAttemptSchema.safeParse({ mode: "form-d" }).success).toBe(false);
  });
});

describe("updateExamItemSchema", () => {
  it("acepta marcar, borrar la respuesta o responder", () => {
    const flagged: UpdateExamItemInput = { flagged: true };

    expect(updateExamItemSchema.parse(flagged)).toEqual({ flagged: true });
    expect(updateExamItemSchema.parse({ answer: null })).toEqual({ answer: null });
    expect(updateExamItemSchema.parse({ answer: { optionIds: ["a", "c"] } })).toEqual({
      answer: { optionIds: ["a", "c"] },
    });
    expect(updateExamItemSchema.parse({ answer: { pairs: { a: "2" } }, flagged: false })).toEqual({
      answer: { pairs: { a: "2" } },
      flagged: false,
    });
  });

  it("rechaza un cuerpo vacío con su mensaje", () => {
    const result = updateExamItemSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain("Envía answer, flagged o ambos");
  });

  it("rechaza una respuesta con dos claves de quiz", () => {
    const result = updateExamItemSchema.safeParse({ answer: { optionId: "b", order: ["a"] } });

    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain(
      "Envía exactamente una respuesta: optionId, optionIds, order o pairs",
    );
  });

  it("rechaza claves desconocidas", () => {
    const result = updateExamItemSchema.safeParse({ reviewed: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe("unrecognized_keys");
    }
  });
});

describe("examAttemptSchema", () => {
  it("parsea un intento completo de ejemplo", () => {
    const attempt: ExamAttempt = examAttemptSchema.parse(ATTEMPT);

    expect(attempt).toEqual(ATTEMPT);
    expect(examAttemptResponseSchema.parse({ attempt: ATTEMPT })).toEqual({ attempt: ATTEMPT });
  });

  it("admite una pregunta sin responder y otra marcada para revisar", () => {
    const parsed = examAttemptSchema.parse({
      ...ATTEMPT,
      answeredCount: 0,
      items: [{ ...ITEM, answer: null, flagged: true }],
    });

    expect(parsed.items[0]?.answer).toBeNull();
    expect(parsed.items[0]?.flagged).toBe(true);
  });

  it("rechaza segundos restantes negativos", () => {
    expect(examAttemptSchema.safeParse({ ...ATTEMPT, remainingSeconds: -1 }).success).toBe(false);
  });

  it("rechaza una certificación o un modo desconocidos", () => {
    expect(examAttemptSchema.safeParse({ ...ATTEMPT, certification: "CLF-C03" }).success).toBe(
      false,
    );
    expect(examAttemptSchema.safeParse({ ...ATTEMPT, mode: "form-d" }).success).toBe(false);
  });

  it("rechaza una respuesta con la forma de otro quiz", () => {
    expect(
      examAttemptSchema.safeParse({
        ...ATTEMPT,
        items: [{ ...ITEM, answer: { optionId: "b", order: ["a"] } }],
      }).success,
    ).toBe(false);
  });
});

describe("examItemUpdateResponseSchema", () => {
  it("publica el ítem actualizado con los segundos restantes", () => {
    const parsed = examItemUpdateResponseSchema.parse({ item: ITEM, remainingSeconds: 60 });
    const item: ExamAttemptItem = parsed.item;

    expect(parsed.remainingSeconds).toBe(60);
    expect(item.position).toBe(1);
    expect(item.answer).toEqual({ optionId: "a" });
  });

  it("rechaza segundos restantes negativos", () => {
    expect(examItemUpdateResponseSchema.safeParse({ item: ITEM, remainingSeconds: -1 }).success).toBe(
      false,
    );
  });
});

describe("examResultItemSchema", () => {
  it("añade acierto, respuesta correcta, explicaciones y unidad al ítem del intento", () => {
    const item: ExamResultItem = examResultItemSchema.parse(RESULT_ITEM);

    expect(item.correct).toBe(true);
    expect(item.correctAnswer).toEqual({ optionId: "a" });
    expect(item.explanations.a).toBe("S3 guarda objetos de forma duradera.");
    expect(item.unitCode).toBe("U9.1.1");
  });
});

describe("examResultSchema", () => {
  it("parsea un resultado completo con su desglose por dominio", () => {
    const result: ExamResult = examResultSchema.parse(RESULT);

    expect(result).toEqual(RESULT);
    expect(result.domains[0]?.pct).toBe(81);
    expect(examResultResponseSchema.parse({ result: RESULT })).toEqual({ result: RESULT });
  });

  it("rechaza un porcentaje por encima de 100", () => {
    expect(examResultSchema.safeParse({ ...RESULT, scorePct: 101 }).success).toBe(false);
  });

  it("no publica ninguna clave de puntuación escalada", () => {
    expect(Object.keys(examResultSchema.shape)).toEqual([
      "attemptId",
      "certification",
      "mode",
      "domain",
      "status",
      "orientative",
      "startedAt",
      "submittedAt",
      "correctCount",
      "questionCount",
      "scorePct",
      "domains",
      "items",
    ]);
    expect(
      Object.keys(examResultSchema.shape).some((key) => key.toLowerCase().includes("scaled")),
    ).toBe(false);
  });
});

describe("examHistoryResponseSchema", () => {
  it("parsea el historial con un intento en curso sin nota", () => {
    const attempts = [
      {
        ...HISTORY_ITEM,
        attemptId: "attempt_2",
        status: "in-progress",
        submittedAt: null,
        scorePct: null,
      },
      HISTORY_ITEM,
    ] as const;
    const parsed = examHistoryResponseSchema.parse({ attempts });
    const first: ExamHistoryItem | undefined = parsed.attempts[0];

    expect(parsed.attempts).toHaveLength(2);
    expect(first?.scorePct).toBeNull();
    expect(parsed.attempts[1]?.scorePct).toBe(80);
  });

  it("rechaza una nota por encima de 100", () => {
    expect(
      examHistoryResponseSchema.safeParse({
        attempts: [{ ...HISTORY_ITEM, scorePct: 101 }],
      }).success,
    ).toBe(false);
  });
});

describe("readinessCriterionSchema", () => {
  it("tiene los cuatro criterios y los tres estados del contrato", () => {
    expect(READINESS_CRITERIA).toEqual(["mastery", "mock-exams", "review", "evidence"]);
    expect(READINESS_STATUSES).toEqual(["met", "missing", "unavailable"]);

    const criterion: ReadinessCriterion = readinessCriterionSchema.parse(CRITERIA[0]);

    expect(criterion.missing).toEqual(["U9.1.1"]);
  });

  it("rechaza un criterio o un estado desconocidos", () => {
    expect(readinessCriterionSchema.safeParse({ ...CRITERIA[0], id: "speed" }).success).toBe(false);
    expect(readinessCriterionSchema.safeParse({ ...CRITERIA[0], status: "done" }).success).toBe(
      false,
    );
  });
});

describe("examReadinessSchema", () => {
  it("parsea el panel de preparación con sus cuatro criterios", () => {
    const readiness: ExamReadiness = examReadinessSchema.parse(READINESS);

    expect(readiness.criteria).toHaveLength(4);
    expect(readiness.criteria.map(({ id }) => id)).toEqual([...READINESS_CRITERIA]);
    expect(examReadinessResponseSchema.parse({ readiness: READINESS })).toEqual({
      readiness: READINESS,
    });
  });

  it("exige exactamente cuatro criterios", () => {
    expect(
      examReadinessSchema.safeParse({ ...READINESS, criteria: CRITERIA.slice(0, 3) }).success,
    ).toBe(false);
    expect(
      examReadinessSchema.safeParse({ ...READINESS, criteria: [...CRITERIA, CRITERIA[0]] }).success,
    ).toBe(false);
  });

  it("admite no tener ningún resultado real registrado", () => {
    const readiness = examReadinessSchema.parse({ ...READINESS, lastRealResult: null });

    expect(readiness.lastRealResult).toBeNull();
  });
});

describe("realExamResultSchema", () => {
  it("parsea el resultado real con su puntuación escalada", () => {
    const real: RealExamResult = realExamResultSchema.parse(REAL_RESULT);

    expect(real.scaledScore).toBe(780);
    expect(realResultResponseSchema.parse({ realResult: REAL_RESULT })).toEqual({
      realResult: REAL_RESULT,
    });
  });

  it("admite una puntuación escalada nula", () => {
    expect(realExamResultSchema.parse({ ...REAL_RESULT, scaledScore: null }).scaledScore).toBeNull();
  });

  it("rechaza una puntuación escalada fuera de 100–1000", () => {
    expect(
      realExamResultSchema.safeParse({ ...REAL_RESULT, scaledScore: 99 }).success,
    ).toBe(false);
    expect(
      realExamResultSchema.safeParse({ ...REAL_RESULT, scaledScore: 1001 }).success,
    ).toBe(false);
  });
});

describe("registerRealResultSchema", () => {
  it("acepta el resultado con y sin puntuación escalada", () => {
    const withScore: RegisterRealResultInput = {
      passed: true,
      scaledScore: 780,
      takenOn: "2026-11-07",
    };

    expect(registerRealResultSchema.parse(withScore)).toEqual(withScore);
    expect(registerRealResultSchema.parse({ passed: false, takenOn: "2026-11-07" })).toEqual({
      passed: false,
      takenOn: "2026-11-07",
    });
  });

  it("rechaza una puntuación escalada por debajo de 100", () => {
    expect(
      registerRealResultSchema.safeParse({
        passed: true,
        scaledScore: 99,
        takenOn: "2026-11-07",
      }).success,
    ).toBe(false);
  });

  it("rechaza una fecha fuera del formato AAAA-MM-DD con su mensaje", () => {
    const result = registerRealResultSchema.safeParse({ passed: true, takenOn: "9/11/2026" });

    expect(result.success).toBe(false);
    expect(messagesOf(result)).toEqual(["La fecha va en formato AAAA-MM-DD"]);
  });

  it("rechaza claves desconocidas", () => {
    expect(
      registerRealResultSchema.safeParse({
        passed: true,
        takenOn: "2026-11-07",
        score: 780,
      }).success,
    ).toBe(false);
  });
});
