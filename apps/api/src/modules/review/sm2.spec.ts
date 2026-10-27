import { describe, expect, it } from "vitest";

import {
  initialReviewState,
  qualityFromSubmission,
  scheduleReview,
} from "./sm2";

const NOW = new Date("2026-10-27T09:00:00.000Z");

describe("scheduleReview", () => {
  it("nace con facilidad 2.5, un día y cero repeticiones", () => {
    expect(initialReviewState()).toEqual({
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 0,
    });
  });

  it("sube la facilidad a 2.6 con una recuperación perfecta", () => {
    const next = scheduleReview(initialReviewState(), 5, NOW);

    expect(next.easeFactor).toBe(2.6);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
  });

  it("baja la facilidad a 1.7 sin comprensión del error", () => {
    const next = scheduleReview(initialReviewState(), 0, NOW);

    expect(next.easeFactor).toBe(1.7);
  });

  it("reinicia la progresión con q < 3: cero repeticiones y un día", () => {
    const next = scheduleReview(
      { easeFactor: 2.6, intervalDays: 25, repetitions: 5 },
      2,
      NOW,
    );

    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.dueAt.toISOString()).toBe("2026-10-28T09:00:00.000Z");
    expect(next.easeFactor).toBe(2.28);
  });

  it("progresa 1 → 6 → 16 días con tres aciertos perfectos", () => {
    let state = initialReviewState();
    const intervals: number[] = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const next = scheduleReview(state, 5, NOW);

      intervals.push(next.intervalDays);
      state = {
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
      };
    }

    expect(intervals).toEqual([1, 6, 16]);
    expect(state.easeFactor).toBe(2.8);
  });

  it("calcula la fecha como ahora + intervalo exacto en días", () => {
    const next = scheduleReview(
      { easeFactor: 2.5, intervalDays: 6, repetitions: 2 },
      4,
      NOW,
    );

    expect(next.intervalDays).toBe(15);
    expect(next.dueAt.getTime() - NOW.getTime()).toBe(15 * 86_400_000);
  });

  it("nunca deja la facilidad por debajo de 1.3", () => {
    const next = scheduleReview(
      { easeFactor: 1.3, intervalDays: 4, repetitions: 1 },
      0,
      NOW,
    );

    expect(next.easeFactor).toBe(1.3);
  });

  it("normaliza una calidad fuera de rango en vez de devolver NaN", () => {
    const next = scheduleReview(initialReviewState(), 9, NOW);

    expect(next.easeFactor).toBe(2.6);
  });
});

describe("qualityFromSubmission", () => {
  it.each([
    { outcome: "PASSED", score: 100, hintsUsed: 0, quality: 5 },
    { outcome: "PASSED", score: 90, hintsUsed: 0, quality: 5 },
    { outcome: "PASSED", score: 89, hintsUsed: 0, quality: 4 },
    { outcome: "PASSED", score: 100, hintsUsed: 1, quality: 3 },
    { outcome: "PASSED", score: 100, hintsUsed: 2, quality: 3 },
    { outcome: "PASSED", score: 100, hintsUsed: 3, quality: 2 },
    { outcome: "PARTIAL", score: 60, hintsUsed: 0, quality: 2 },
    { outcome: "FAILED", score: 0, hintsUsed: 2, quality: 1 },
    { outcome: "ERROR", score: 0, hintsUsed: 0, quality: 0 },
    { outcome: "TIMEOUT", score: 0, hintsUsed: 0, quality: 0 },
  ] as const)(
    "$outcome con $score y $hintsUsed pistas deriva q = $quality",
    ({ outcome, score, hintsUsed, quality }) => {
      expect(qualityFromSubmission({ outcome, score, hintsUsed })).toBe(quality);
    },
  );
});
