import { describe, expect, it } from "vitest";

import {
  ANALYTICS_RANGES,
  COHORT_AT_RISK_LIMIT,
  analyticsRangeQuerySchema,
  cohortAnalyticsSchema,
  errorBreakdownSchema,
  readinessResponseSchema,
  studentSummarySchema,
} from "./analytics";

const summary = {
  range: "30d" as const,
  overallPct: 62,
  activeDays: 11,
  lastActivityAt: "2026-10-27T21:12:04.000Z",
  units: { mastered: 9, inProgress: 2, needsReview: 1, locked: 14, total: 26 },
  submissions: { total: 34, passed: 21, failed: 13, avgScore: 71.4 },
  reviews: { due: 12, completed: 40, lapses: 5 },
  ai: { calls: 18, costUsd: 0.42, budgetLevel: "ok" as const },
};

describe("ANALYTICS_RANGES", () => {
  it("publica los cuatro rangos del contrato", () => {
    expect(ANALYTICS_RANGES).toEqual(["7d", "30d", "90d", "all"]);
  });
});

describe("analyticsRangeQuerySchema", () => {
  it("usa 30d cuando el rango no llega", () => {
    expect(analyticsRangeQuerySchema.parse({})).toEqual({ range: "30d" });
  });

  it("acepta los rangos del catálogo", () => {
    for (const range of ANALYTICS_RANGES) {
      expect(analyticsRangeQuerySchema.safeParse({ range }).success).toBe(true);
    }
  });

  it("rechaza un rango fuera del catálogo", () => {
    expect(analyticsRangeQuerySchema.safeParse({ range: "1y" }).success).toBe(false);
    expect(analyticsRangeQuerySchema.safeParse({ range: "" }).success).toBe(false);
  });
});

describe("studentSummarySchema", () => {
  it("acepta el ejemplo del contrato", () => {
    expect(studentSummarySchema.safeParse(summary).success).toBe(true);
  });

  it("rechaza porcentajes fuera de 0–100", () => {
    expect(
      studentSummarySchema.safeParse({ ...summary, overallPct: 101 }).success,
    ).toBe(false);
    expect(
      studentSummarySchema.safeParse({
        ...summary,
        submissions: { ...summary.submissions, avgScore: -1 },
      }).success,
    ).toBe(false);
  });

  it("acepta avgScore nulo cuando no hay envíos", () => {
    expect(
      studentSummarySchema.safeParse({
        ...summary,
        submissions: { total: 0, passed: 0, failed: 0, avgScore: null },
      }).success,
    ).toBe(true);
  });

  it("rechaza contadores negativos o decimales", () => {
    expect(
      studentSummarySchema.safeParse({
        ...summary,
        reviews: { due: -1, completed: 0, lapses: 0 },
      }).success,
    ).toBe(false);
    expect(
      studentSummarySchema.safeParse({ ...summary, activeDays: 1.5 }).success,
    ).toBe(false);
  });
});

describe("errorBreakdownSchema", () => {
  it("acepta cuotas entre 0 y 1", () => {
    const breakdown = {
      range: "7d",
      total: 4,
      byCategory: [{ category: "SYNTAX", count: 4, share: 1 }],
      byConcept: [{ conceptSlug: "closures", conceptName: "Closures", count: 4 }],
    };

    expect(errorBreakdownSchema.safeParse(breakdown).success).toBe(true);
  });

  it("rechaza una cuota mayor que 1", () => {
    expect(
      errorBreakdownSchema.safeParse({
        range: "7d",
        total: 1,
        byCategory: [{ category: "SYNTAX", count: 1, share: 1.2 }],
        byConcept: [],
      }).success,
    ).toBe(false);
  });
});

describe("cohortAnalyticsSchema", () => {
  const cohort = {
    range: "30d",
    students: { total: 2, active: 1 },
    avgOverallPct: 31.5,
    stageCompletion: [{ stage: "E0", completedPct: 40, studentsAtStage: 2 }],
    topErrors: [{ category: "SYNTAX", count: 3, share: 1 }],
    reviewBacklog: 7,
    atRisk: [
      {
        userId: "u1",
        displayName: "Ada",
        overallPct: 12.5,
        daysSinceActivity: 9,
      },
    ],
  };

  it("acepta el ejemplo del contrato", () => {
    expect(cohortAnalyticsSchema.safeParse(cohort).success).toBe(true);
  });

  it(`no admite más de ${COHORT_AT_RISK_LIMIT} filas de riesgo`, () => {
    const atRisk = Array.from({ length: COHORT_AT_RISK_LIMIT + 1 }, (_, index) => ({
      userId: `u${index}`,
      displayName: `Estudiante ${index}`,
      overallPct: 10,
      daysSinceActivity: index,
    }));

    expect(cohortAnalyticsSchema.safeParse({ ...cohort, atRisk }).success).toBe(
      false,
    );
  });
});

describe("readinessResponseSchema", () => {
  it("acepta listo y degradado", () => {
    const ready = {
      status: "ready",
      checks: [{ name: "database", ok: true, latencyMs: 3 }],
      version: "0.1.0",
      timestamp: "2026-10-28T09:00:00.000Z",
    };

    expect(readinessResponseSchema.safeParse(ready).success).toBe(true);
    expect(
      readinessResponseSchema.safeParse({
        ...ready,
        status: "degraded",
        checks: [{ name: "database", ok: false, latencyMs: 2001 }],
      }).success,
    ).toBe(true);
  });

  it("no admite otros nombres de comprobación", () => {
    expect(
      readinessResponseSchema.safeParse({
        status: "ready",
        checks: [{ name: "redis", ok: true, latencyMs: 1 }],
        version: "0.1.0",
        timestamp: "2026-10-28T09:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
