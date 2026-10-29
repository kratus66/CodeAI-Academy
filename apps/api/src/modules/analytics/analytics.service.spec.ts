import {
  cohortAnalyticsSchema,
  errorBreakdownSchema,
  studentSummarySchema,
} from "@codeai/shared";
import { describe, expect, it } from "vitest";

import type { AnalyticsDataset } from "./in-memory-analytics.repository";
import { InMemoryAnalyticsRepository } from "./in-memory-analytics.repository";
import { ANALYTICS_REPOSITORY } from "./analytics.repository";
import {
  ANALYTICS_AI_BUDGET_USD,
  ANALYTICS_CLOCK,
  AnalyticsService,
  analyticsWindow,
  conceptDisplayName,
  resolveAnalyticsBudgetLevel,
} from "./analytics.service";

const NOW = new Date("2026-10-29T12:00:00.000Z");

function fixture(): AnalyticsDataset {
  return {
    users: [
      {
        id: "student-a",
        name: "Ana",
        role: "STUDENT",
        isActive: true,
        createdAt: new Date("2026-10-01T09:00:00.000Z"),
      },
      {
        id: "student-b",
        name: "Beto",
        role: "STUDENT",
        isActive: true,
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
      },
      {
        id: "student-inactive",
        name: "Carlos",
        role: "STUDENT",
        isActive: false,
        createdAt: new Date("2026-10-01T09:00:00.000Z"),
      },
      {
        id: "instructor",
        name: "Docente",
        role: "INSTRUCTOR",
        isActive: true,
        createdAt: new Date("2026-10-01T09:00:00.000Z"),
      },
    ],
    units: [
      { id: "unit-1", stage: "Etapa 1", isPublished: true },
      { id: "unit-2", stage: "Etapa 1", isPublished: true },
      { id: "unit-3", stage: "Etapa 2", isPublished: false },
    ],
    unitProgress: [
      {
        userId: "student-a",
        unitId: "unit-1",
        state: "MASTERED",
        progressPct: 100,
        lastActivityAt: new Date("2026-10-28T10:00:00.000Z"),
      },
      {
        userId: "student-a",
        unitId: "unit-2",
        state: "IN_PROGRESS",
        progressPct: 50,
        lastActivityAt: new Date("2026-10-27T10:00:00.000Z"),
      },
    ],
    submissions: [
      {
        userId: "student-a",
        createdAt: new Date("2026-10-29T09:00:00.000Z"),
        outcome: "PASSED",
        score: 80,
        errorCategory: null,
        concepts: ["variables"],
      },
      {
        userId: "student-a",
        createdAt: new Date("2026-10-28T09:00:00.000Z"),
        outcome: "FAILED",
        score: 60,
        errorCategory: "syntax",
        concepts: ["variables", "loops"],
      },
      {
        userId: "student-a",
        createdAt: new Date("2026-09-01T09:00:00.000Z"),
        outcome: "FAILED",
        score: 40,
        errorCategory: "logic",
        concepts: ["functions"],
      },
      {
        userId: "student-b",
        createdAt: new Date("2026-09-01T09:00:00.000Z"),
        outcome: "FAILED",
        score: 50,
        errorCategory: "logic",
        concepts: ["functions"],
      },
    ],
    reviews: [
      {
        userId: "student-a",
        dueAt: new Date("2026-10-29T08:00:00.000Z"),
        logs: [
          {
            reviewedAt: new Date("2026-10-29T08:05:00.000Z"),
            quality: 2,
          },
          {
            reviewedAt: new Date("2026-10-27T08:05:00.000Z"),
            quality: 5,
          },
        ],
      },
      {
        userId: "student-a",
        dueAt: new Date("2026-11-05T08:00:00.000Z"),
        logs: [],
      },
    ],
    ai: [
      {
        userId: "student-a",
        createdAt: new Date("2026-10-29T10:00:00.000Z"),
        costUsd: 2,
      },
      {
        userId: "student-a",
        createdAt: new Date("2026-10-02T10:00:00.000Z"),
        costUsd: 2.5,
      },
    ],
  };
}

function createService(dataset: AnalyticsDataset = fixture()): AnalyticsService {
  return new AnalyticsService(
    new InMemoryAnalyticsRepository(dataset),
    () => NOW,
    5,
  );
}
describe("analyticsWindow", () => {
  it("usa días naturales UTC inclusivos", () => {
    const window = analyticsWindow("7d", NOW);

    expect(window.from.toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(window.to).toBe(NOW);
  });

  it("all empieza en la época", () => {
    const window = analyticsWindow("all", NOW);

    expect(window.from.getTime()).toBe(0);
  });
});

describe("resolveAnalyticsBudgetLevel", () => {
  it("avisa al 80 % y se excede al 100 %", () => {
    expect(resolveAnalyticsBudgetLevel(3.99, 5)).toBe("ok");
    expect(resolveAnalyticsBudgetLevel(4, 5)).toBe("warning");
    expect(resolveAnalyticsBudgetLevel(5, 5)).toBe("exceeded");
  });

  it("con presupuesto cero sólo es ok sin gasto", () => {
    expect(resolveAnalyticsBudgetLevel(0, 0)).toBe("ok");
    expect(resolveAnalyticsBudgetLevel(0.01, 0)).toBe("exceeded");
  });
});

describe("conceptDisplayName", () => {
  it("convierte el slug en un nombre legible", () => {
    expect(conceptDisplayName("definicion-ia")).toBe("Definicion ia");
    expect(conceptDisplayName("  loops  ")).toBe("Loops");
  });

  it("conserva un slug vacío en lugar de inventar texto", () => {
    expect(conceptDisplayName("---")).toBe("---");
  });
});

describe("AnalyticsService", () => {
  it("compone el resumen del estudiante y respeta el contrato", async () => {
    const summary = await createService().getSummary("student-a", "7d");

    expect(studentSummarySchema.safeParse(summary).success).toBe(true);
    expect(summary).toMatchObject({
      range: "7d",
      overallPct: 75,
      activeDays: 3,
      lastActivityAt: "2026-10-29T09:00:00.000Z",
      units: {
        mastered: 1,
        inProgress: 1,
        needsReview: 0,
        locked: 0,
        total: 2,
      },
      submissions: { total: 2, passed: 1, failed: 1, avgScore: 70 },
      reviews: { due: 1, completed: 2, lapses: 1 },
    });
    // El gasto de IA del rango es 2, pero el nivel es mensual (4.5 de 5).
    expect(summary.ai).toEqual({ calls: 1, costUsd: 2, budgetLevel: "warning" });
  });

  it("en un rango sin actividad devuelve ceros, no promedios inventados", async () => {
    const summary = await createService().getSummary("student-b", "7d");

    expect(summary.submissions).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      avgScore: null,
    });
    expect(summary.activeDays).toBe(0);
    expect(summary.units.locked).toBe(2);
  });

  it("desglosa errores por categoría y concepto sólo dentro del rango", async () => {
    const errors = await createService().getErrors("student-a", "7d");

    expect(errorBreakdownSchema.safeParse(errors).success).toBe(true);
    expect(errors.total).toBe(1);
    expect(errors.byCategory).toEqual([
      { category: "syntax", count: 1, share: 1 },
    ]);
    expect(errors.byConcept).toEqual([
      { conceptSlug: "loops", conceptName: "Loops", count: 1 },
      { conceptSlug: "variables", conceptName: "Variables", count: 1 },
    ]);
  });

  it("agrega la cohorte sin datos personales", async () => {
    const cohort = await createService().getCohort("30d");

    expect(cohortAnalyticsSchema.safeParse(cohort).success).toBe(true);
    expect(cohort.students).toEqual({ total: 2, active: 1 });
    expect(cohort.avgOverallPct).toBe(37.5);
    expect(cohort.stageCompletion).toEqual([
      { stage: "Etapa 1", completedPct: 37.5, studentsAtStage: 1 },
    ]);
    expect(cohort.topErrors).toEqual([
      { category: "syntax", count: 1, share: 1 },
    ]);
    expect(cohort.reviewBacklog).toBe(1);
    expect(cohort.atRisk).toEqual([
      {
        userId: "student-b",
        displayName: "Beto",
        overallPct: 0,
        daysSinceActivity: 58,
      },
      {
        userId: "student-a",
        displayName: "Ana",
        overallPct: 75,
        daysSinceActivity: 0,
      },
    ]);
    expect(JSON.stringify(cohort)).not.toMatch(
      /@|passwordHash|transcript|repoUrl/,
    );
  });

  it("limita atRisk a 20 filas y ordena por inactividad", async () => {
    const dataset = fixture();
    const students = Array.from({ length: 25 }, (_, index) => ({
      id: `student-${index.toString().padStart(2, "0")}`,
      name: `Estudiante ${index}`,
      role: "STUDENT" as const,
      isActive: true,
      createdAt: new Date(NOW.getTime() - (index + 1) * 86_400_000),
    }));

    const cohort = await createService({
      ...dataset,
      users: [...students, dataset.users[0]!],
      unitProgress: [],
      submissions: [],
      reviews: [],
      ai: [],
    }).getCohort("30d");

    expect(cohort.atRisk).toHaveLength(20);
    // Ana (creada el 1 de octubre) es la más inactiva del conjunto.
    expect(cohort.atRisk[0]?.daysSinceActivity).toBe(28);
    expect(cohort.atRisk.at(-1)?.daysSinceActivity).toBe(7);
  });

  it("expone los tokens de inyección con nombres estables", () => {
    expect(ANALYTICS_REPOSITORY.description).toBe("ANALYTICS_REPOSITORY");
    expect(ANALYTICS_CLOCK.description).toBe("ANALYTICS_CLOCK");
    expect(ANALYTICS_AI_BUDGET_USD.description).toBe("ANALYTICS_AI_BUDGET_USD");
  });
});

