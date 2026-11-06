import type { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  competencyCodeSchema,
  competencyProgressSchema,
  progressOverviewSchema,
  progressPctSchema,
  unitProgressSummarySchema,
} from "./progress";

function issueMessages(result: { success: false; error: z.ZodError }): string[] {
  return result.error.issues.map((issue) => issue.message);
}

describe("progressPctSchema", () => {
  it("acepta los extremos del rango 0–100", () => {
    expect(progressPctSchema.safeParse(0).success).toBe(true);
    expect(progressPctSchema.safeParse(100).success).toBe(true);
  });

  it("acepta decimales porque el avance se sirve con un decimal", () => {
    expect(progressPctSchema.safeParse(34.5).success).toBe(true);
  });

  it("rechaza un avance negativo", () => {
    expect(progressPctSchema.safeParse(-0.1).success).toBe(false);
  });

  it("rechaza un avance superior al 100 %", () => {
    expect(progressPctSchema.safeParse(100.1).success).toBe(false);
  });
});

describe("competencyCodeSchema", () => {
  it("acepta los códigos del perfil profesional C1–C14", () => {
    expect(competencyCodeSchema.safeParse("C1").success).toBe(true);
    expect(competencyCodeSchema.safeParse("C10").success).toBe(true);
    expect(competencyCodeSchema.safeParse("C14").success).toBe(true);
  });

  it("rechaza códigos fuera del rango", () => {
    expect(competencyCodeSchema.safeParse("C0").success).toBe(false);
    expect(competencyCodeSchema.safeParse("C15").success).toBe(false);
  });

  it("rechaza el código en minúsculas", () => {
    expect(competencyCodeSchema.safeParse("c1").success).toBe(false);
  });

  it("rechaza una letra suelta sin número", () => {
    expect(competencyCodeSchema.safeParse("C").success).toBe(false);
  });

  it("acepta los códigos de la ruta AWS C1–C15", () => {
    expect(competencyCodeSchema.safeParse("AWS-C1").success).toBe(true);
    expect(competencyCodeSchema.safeParse("AWS-C15").success).toBe(true);
  });

  it("rechaza códigos fuera de ambas rutas con el mensaje del contrato", () => {
    for (const code of ["C0", "C15", "AWS-C16", "aws-c1"]) {
      const result = competencyCodeSchema.safeParse(code);

      expect(result.success).toBe(false);
      expect(result.success ? [] : issueMessages(result)).toContain(
        "La competencia debe ser C1–C14 o AWS-C1–AWS-C15",
      );
    }
  });
});

describe("unitProgressSummarySchema", () => {
  const unit = {
    unitId: "ckv2n3x0a0001qz8h2b3c4d5e",
    unitCode: "U0.1.1",
    state: "IN_PROGRESS",
    progressPct: 40,
    lessonsDone: 2,
    exercisesDone: 0,
    bestScore: null,
    lastActivityAt: "2026-10-27T14:30:00.000Z",
    completedAt: null,
  };

  it("acepta el resumen de una unidad en curso sin fecha de fin", () => {
    expect(unitProgressSummarySchema.safeParse(unit).success).toBe(true);
  });

  it("rechaza un estado de unidad desconocido", () => {
    const result = unitProgressSummarySchema.safeParse({
      ...unit,
      state: "DONE",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un porcentaje fuera del rango aunque el estado sea válido", () => {
    const result = unitProgressSummarySchema.safeParse({
      ...unit,
      progressPct: 140,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza una fecha de actividad que no está en ISO 8601", () => {
    const result = unitProgressSummarySchema.safeParse({
      ...unit,
      lastActivityAt: "27/10/2026",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza contadores negativos", () => {
    const result = unitProgressSummarySchema.safeParse({
      ...unit,
      lessonsDone: -1,
    });

    expect(result.success).toBe(false);
  });
});

describe("competencyProgressSchema", () => {
  it("acepta un nivel entre 0 y 4 con sus evidencias", () => {
    const result = competencyProgressSchema.safeParse({
      code: "C4",
      level: 3,
      evidenceCount: 14,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un nivel superior a 4", () => {
    const result = competencyProgressSchema.safeParse({
      code: "C4",
      level: 5,
      evidenceCount: 14,
    });

    expect(result.success).toBe(false);
  });
});

describe("progressOverviewSchema", () => {
  const overview = {
    user: { id: "ckv2n3x0a0001qz8h2b3c4d5e", name: "Ana" },
    currentStage: 2,
    overallPct: 34.5,
    units: { mastered: 12, inProgress: 3, needsReview: 2, locked: 40 },
    competencies: [{ code: "C1", level: 3, evidenceCount: 14 }],
    dueReviews: 0,
  };

  it("acepta la respuesta documentada en contratos-api.md §4.4", () => {
    expect(progressOverviewSchema.safeParse(overview).success).toBe(true);
  });

  it("rechaza una etapa fuera del currículo de 12 etapas", () => {
    const result = progressOverviewSchema.safeParse({
      ...overview,
      currentStage: 12,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un contador de unidades negativo", () => {
    const result = progressOverviewSchema.safeParse({
      ...overview,
      units: { ...overview.units, needsReview: -1 },
    });

    expect(result.success).toBe(false);
  });

  it("rechaza una competencia con código no registrado", () => {
    const result = progressOverviewSchema.safeParse({
      ...overview,
      competencies: [{ code: "C99", level: 3, evidenceCount: 14 }],
    });

    expect(result.success).toBe(false);
  });

  it("acepta la etapa actual de cualquier ruta", () => {
    for (const currentStage of [0, 11, 100, 112]) {
      expect(
        progressOverviewSchema.safeParse({ ...overview, currentStage }).success,
      ).toBe(true);
    }
  });

  it("rechaza una etapa actual fuera de toda ruta con el mensaje del contrato", () => {
    for (const currentStage of [12, 99]) {
      const result = progressOverviewSchema.safeParse({ ...overview, currentStage });

      expect(result.success).toBe(false);
      expect(result.success ? [] : issueMessages(result)).toContain(
        "La etapa actual debe pertenecer a una ruta",
      );
    }
  });
});
