import { describe, expect, it } from "vitest";

import type { AnalyticsWindow } from "./analytics.repository";
import type { AnalyticsDataset } from "./in-memory-analytics.repository";
import {
  InMemoryAnalyticsRepository,
  daysSince,
} from "./in-memory-analytics.repository";

const WINDOW: AnalyticsWindow = {
  range: "7d",
  from: new Date("2026-10-23T00:00:00.000Z"),
  to: new Date("2026-10-29T12:00:00.000Z"),
};

function dataset(): AnalyticsDataset {
  return {
    users: [
      {
        id: "a",
        name: "Ana",
        role: "STUDENT",
        isActive: true,
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      {
        id: "b",
        name: "Beto",
        role: "STUDENT",
        isActive: true,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ],
    units: [
      { id: "u1", stage: "E1", isPublished: true },
      { id: "u2", stage: "E1", isPublished: true },
      { id: "u3", stage: "E2", isPublished: false },
    ],
    unitProgress: [
      {
        userId: "a",
        unitId: "u1",
        state: "MASTERED",
        progressPct: 100,
        lastActivityAt: new Date("2026-10-28T00:00:00.000Z"),
      },
    ],
    submissions: [
      {
        userId: "a",
        createdAt: new Date("2026-10-28T10:00:00.000Z"),
        outcome: "FAILED",
        score: 50,
        errorCategory: "syntax",
        concepts: ["loops", "loops"],
      },
      {
        userId: "a",
        createdAt: new Date("2026-10-28T11:00:00.000Z"),
        outcome: "FAILED",
        score: 70,
        errorCategory: "syntax",
        concepts: ["loops"],
      },
    ],
    reviews: [
      {
        userId: "a",
        dueAt: new Date("2026-10-29T08:00:00.000Z"),
        logs: [{ reviewedAt: new Date("2026-10-27T08:00:00.000Z"), quality: 2 }],
      },
    ],
    ai: [
      {
        userId: "a",
        createdAt: new Date("2026-10-28T00:00:00.000Z"),
        costUsd: 0.25,
      },
    ],
  };
}

describe("daysSince", () => {
  it("usa la creación si nunca hubo actividad y nunca es negativo", () => {
    expect(
      daysSince(null, new Date("2026-10-01T00:00:00.000Z"), WINDOW.to),
    ).toBe(28);
    expect(
      daysSince(new Date("2026-11-01T00:00:00.000Z"), new Date(), WINDOW.to),
    ).toBe(0);
  });
});

describe("InMemoryAnalyticsRepository", () => {
  const repository = new InMemoryAnalyticsRepository(dataset());

  it("cuenta sólo unidades publicadas y bloquea las no iniciadas", async () => {
    const metrics = await repository.getUnitMetrics("a");

    expect(metrics.totalUnits).toBe(2);
    expect(metrics.progressPctSum).toBe(100);
    expect(metrics.byState).toEqual({
      MASTERED: 1,
      IN_PROGRESS: 0,
      NEEDS_REVIEW: 0,
      LOCKED: 1,
      AVAILABLE: 0,
    });
  });

  it("promedia envíos del rango y devuelve null sin filas", async () => {
    await expect(
      repository.getSubmissionMetrics("a", WINDOW),
    ).resolves.toEqual({ total: 2, passed: 0, failed: 2, avgScore: 60 });
    await expect(
      repository.getSubmissionMetrics("b", WINDOW),
    ).resolves.toEqual({ total: 0, passed: 0, failed: 0, avgScore: null });
  });

  it("cuenta días UTC distintos y la última actividad global", async () => {
    await expect(repository.getActivityMetrics("a", WINDOW)).resolves.toEqual({
      activeDays: 2,
      lastActivityAt: new Date("2026-10-28T11:00:00.000Z"),
    });
  });

  it("cuenta repasos vencidos, completados y lapsos", async () => {
    await expect(
      repository.getReviewMetrics("a", WINDOW, WINDOW.to),
    ).resolves.toEqual({ due: 1, completed: 1, lapses: 1 });
  });

  it("agrupa errores sin duplicar conceptos repetidos", async () => {
    await expect(repository.getErrorBreakdown("a", WINDOW)).resolves.toEqual([
      { category: "syntax", count: 2 },
    ]);
    await expect(repository.getConceptErrors("a", WINDOW)).resolves.toEqual([
      { concept: "loops", count: 2 },
    ]);
  });

  it("suma el costo de IA del rango", async () => {
    await expect(repository.getAiMetrics("a", WINDOW)).resolves.toEqual({
      calls: 1,
      costUsd: 0.25,
    });
  });

  it("publica sólo agregados de estudiantes activos", async () => {
    const cohort = await repository.getCohortMetrics(WINDOW, WINDOW.to);

    expect(cohort.students).toBe(2);
    expect(cohort.activeStudents).toBe(1);
    expect(cohort.publishedUnits).toBe(2);
    expect(cohort.reviewBacklog).toBe(1);
    expect(cohort.stageCompletion).toEqual([
      { stage: "E1", units: 2, progressPctSum: 100, studentsAtStage: 1 },
    ]);
    expect(cohort.studentProgress).toEqual([
      {
        userId: "a",
        displayName: "Ana",
        progressPctSum: 100,
        lastActivityAt: new Date("2026-10-28T11:00:00.000Z"),
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      {
        userId: "b",
        displayName: "Beto",
        progressPctSum: 0,
        lastActivityAt: null,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);
  });
});
