import { describe, expect, it } from "vitest";

import {
  REVIEW_QUEUE_MAX,
  reviewAnswerResultSchema,
  reviewAnswerSchema,
  reviewQueueItemSchema,
  reviewQueueResponseSchema,
} from "./review";

const ITEM = {
  id: "item_1",
  exerciseId: "ex_1",
  exerciseTitle: "Suma segura",
  exerciseSlug: "suma-segura-001",
  concept: "funciones",
  competencies: ["C1"],
  dueAt: "2026-10-28T09:00:00.000Z",
  intervalDays: 1,
  repetitions: 1,
  easeFactor: 2.6,
  priority: 0,
} as const;

describe("reviewQueueItemSchema", () => {
  it("acepta un ítem completo del contrato", () => {
    expect(reviewQueueItemSchema.parse(ITEM)).toEqual(ITEM);
  });

  it("rechaza una facilidad por debajo del mínimo de SM-2", () => {
    expect(
      reviewQueueItemSchema.safeParse({ ...ITEM, easeFactor: 1.2 }).success,
    ).toBe(false);
  });

  it("rechaza un intervalo de cero días", () => {
    expect(
      reviewQueueItemSchema.safeParse({ ...ITEM, intervalDays: 0 }).success,
    ).toBe(false);
  });

  it("rechaza una competencia fuera del mapa C1–C14", () => {
    expect(
      reviewQueueItemSchema.safeParse({ ...ITEM, competencies: ["C15"] }).success,
    ).toBe(false);
  });
});

describe("reviewQueueResponseSchema", () => {
  it("publica la cola con su límite y la deuda total", () => {
    const parsed = reviewQueueResponseSchema.parse({
      items: [ITEM],
      dueReviews: 7,
      limit: REVIEW_QUEUE_MAX,
    });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.limit).toBe(30);
    expect(parsed.dueReviews).toBe(7);
  });

  it("rechaza una deuda negativa", () => {
    expect(
      reviewQueueResponseSchema.safeParse({
        items: [],
        dueReviews: -1,
        limit: REVIEW_QUEUE_MAX,
      }).success,
    ).toBe(false);
  });
});

describe("reviewAnswerSchema", () => {
  it.each([0, 1, 2, 3, 4, 5])("acepta la calidad %i", (quality) => {
    expect(reviewAnswerSchema.parse({ quality })).toEqual({ quality });
  });

  it("acepta la duración opcional", () => {
    expect(reviewAnswerSchema.parse({ quality: 4, durationMs: 42_000 })).toEqual({
      quality: 4,
      durationMs: 42_000,
    });
  });

  it("rechaza la calidad 6 y la calidad fraccionaria", () => {
    expect(reviewAnswerSchema.safeParse({ quality: 6 }).success).toBe(false);
    expect(reviewAnswerSchema.safeParse({ quality: 2.5 }).success).toBe(false);
  });

  it("rechaza un cuerpo sin calidad", () => {
    expect(reviewAnswerSchema.safeParse({ durationMs: 100 }).success).toBe(false);
  });

  it("rechaza campos ajenos al contrato, como el dueño del ítem", () => {
    expect(
      reviewAnswerSchema.safeParse({ quality: 4, userId: "user_2" }).success,
    ).toBe(false);
  });

  it("rechaza una duración no positiva", () => {
    expect(
      reviewAnswerSchema.safeParse({ quality: 4, durationMs: 0 }).success,
    ).toBe(false);
  });
});

describe("reviewAnswerResultSchema", () => {
  it("acepta la respuesta SM-2 del contrato", () => {
    expect(
      reviewAnswerResultSchema.parse({
        nextDueAt: "2026-11-02T09:00:00.000Z",
        intervalDays: 6,
        easeFactor: 2.5,
        repetitions: 2,
      }),
    ).toEqual({
      nextDueAt: "2026-11-02T09:00:00.000Z",
      intervalDays: 6,
      easeFactor: 2.5,
      repetitions: 2,
    });
  });

  it("rechaza un intervalo de cero y una facilidad bajo el mínimo", () => {
    expect(
      reviewAnswerResultSchema.safeParse({
        nextDueAt: "2026-11-02T09:00:00.000Z",
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 1,
      }).success,
    ).toBe(false);
    expect(
      reviewAnswerResultSchema.safeParse({
        nextDueAt: "2026-11-02T09:00:00.000Z",
        intervalDays: 1,
        easeFactor: 1.2,
        repetitions: 1,
      }).success,
    ).toBe(false);
  });

  it("rechaza campos añadidos fuera del contrato", () => {
    expect(
      reviewAnswerResultSchema.safeParse({
        nextDueAt: "2026-11-02T09:00:00.000Z",
        intervalDays: 6,
        easeFactor: 2.5,
        repetitions: 2,
        item: ITEM,
      }).success,
    ).toBe(false);
  });
});
