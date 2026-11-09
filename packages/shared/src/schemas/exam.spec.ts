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
  examAttemptResponseSchema,
  examAttemptSchema,
  examItemUpdateResponseSchema,
  startExamAttemptSchema,
  updateExamItemSchema,
  type ExamAttempt,
  type ExamAttemptItem,
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
