import { describe, expect, it } from "vitest";

import {
  createSubmissionSchema,
  exerciseDetailSchema,
  exerciseListItemSchema,
  exerciseListQuerySchema,
  submissionSummarySchema,
} from "./exercise";

const ITEM = {
  id: "ex_1",
  unitId: "unit_1",
  unitCode: "U1.1.1",
  type: "LAB",
  title: "Valida el status antes de parsear",
  ladder: "GUIDED",
  difficulty: 2,
  estimatedMin: 25,
  language: "typescript",
  competencies: ["C1", "C5"],
} as const;

const SUBMISSION = {
  id: "sub_1",
  outcome: "PARTIAL",
  score: 75,
  achievedLevel: null,
  hintsUsed: 1,
  results: [{ testId: "t1", name: "devuelve el usuario", passed: true, durationMs: 3 }],
  feedback: "1 de 2 pruebas visibles superadas.",
  createdAt: "2026-10-27T14:30:00.000Z",
} as const;

describe("exerciseListItemSchema", () => {
  it("acepta un ejercicio del listado", () => {
    expect(exerciseListItemSchema.parse(ITEM)).toEqual(ITEM);
  });

  it("rechaza dificultad fuera de 1–4", () => {
    expect(exerciseListItemSchema.safeParse({ ...ITEM, difficulty: 5 }).success).toBe(false);
    expect(exerciseListItemSchema.safeParse({ ...ITEM, difficulty: 0 }).success).toBe(false);
    expect(exerciseListItemSchema.safeParse({ ...ITEM, difficulty: 2.5 }).success).toBe(false);
  });

  it("rechaza un tipo de ejercicio o una competencia desconocidos", () => {
    expect(exerciseListItemSchema.safeParse({ ...ITEM, type: "CODE" }).success).toBe(false);
    expect(
      exerciseListItemSchema.safeParse({ ...ITEM, competencies: ["resolucion"] }).success,
    ).toBe(false);
  });

  it("admite lenguaje nulo y duración nula (ejercicios que no son de código)", () => {
    const parsed = exerciseListItemSchema.parse({
      ...ITEM,
      type: "QUIZ",
      language: null,
      estimatedMin: null,
    });

    expect(parsed.language).toBeNull();
    expect(parsed.estimatedMin).toBeNull();
  });

  it("rechaza un lenguaje fuera de typescript|javascript|sql", () => {
    expect(exerciseListItemSchema.safeParse({ ...ITEM, language: "python" }).success).toBe(false);
  });
});

describe("exerciseDetailSchema", () => {
  it("acepta el detalle con pruebas públicas y sin solución", () => {
    const detail = {
      ...ITEM,
      statement: "Implementa la función",
      config: { starterCode: "export function f() {}", entry: "index.ts" },
      publicTests: [{ testId: "t1", name: "devuelve el usuario" }],
      hintsAvailable: 3,
      starterCode: "export function f() {}",
    };
    const parsed = exerciseDetailSchema.parse(detail);

    expect(parsed.publicTests).toHaveLength(1);
    expect(parsed).not.toHaveProperty("solution");
  });

  it("rechaza un detalle sin enunciado y con pistas negativas", () => {
    const detail = {
      ...ITEM,
      statement: "Implementa la función",
      config: {},
      publicTests: [],
      hintsAvailable: 3,
      starterCode: null,
    };

    expect(exerciseDetailSchema.safeParse({ ...detail, statement: "" }).success).toBe(false);
    expect(exerciseDetailSchema.safeParse({ ...detail, hintsAvailable: -1 }).success).toBe(false);
  });
});

describe("submissionSummarySchema", () => {
  it("acepta achievedLevel nulo y resultados con duración opcional", () => {
    expect(submissionSummarySchema.parse(SUBMISSION)).toEqual(SUBMISSION);
    expect(
      submissionSummarySchema.parse({
        ...SUBMISSION,
        results: [{ testId: "t1", name: "pasa", passed: true }],
      }).results[0],
    ).not.toHaveProperty("durationMs");
  });

  it("rechaza un outcome fuera del catálogo", () => {
    expect(submissionSummarySchema.safeParse({ ...SUBMISSION, outcome: "OK" }).success).toBe(false);
  });

  it("rechaza nota fuera de 0–100 y nivel fuera de 1–4", () => {
    expect(submissionSummarySchema.safeParse({ ...SUBMISSION, score: 101 }).success).toBe(false);
    expect(submissionSummarySchema.safeParse({ ...SUBMISSION, score: -1 }).success).toBe(false);
    expect(
      submissionSummarySchema.safeParse({ ...SUBMISSION, achievedLevel: 0 }).success,
    ).toBe(false);
    expect(
      submissionSummarySchema.safeParse({ ...SUBMISSION, achievedLevel: 5 }).success,
    ).toBe(false);
  });
});

describe("createSubmissionSchema", () => {
  it("exige el código y admite la autoevaluación opcional", () => {
    expect(createSubmissionSchema.parse({ code: "console.log(1)" })).toEqual({
      code: "console.log(1)",
    });
    expect(
      createSubmissionSchema.parse({ code: "x", selfExplanation: "Valido el status." })
        .selfExplanation,
    ).toBe("Valido el status.");
  });

  it("rechaza código vacío y cuerpos de más de 100 KB", () => {
    expect(createSubmissionSchema.safeParse({ code: "" }).success).toBe(false);
    expect(createSubmissionSchema.safeParse({ code: "a".repeat(100_001) }).success).toBe(false);
    expect(createSubmissionSchema.safeParse({}).success).toBe(false);
  });
});

describe("exerciseListQuerySchema", () => {
  it("convierte los query strings y aplica los valores por defecto", () => {
    expect(exerciseListQuerySchema.parse({ page: "2", pageSize: "5" })).toEqual({
      page: 2,
      pageSize: 5,
    });
    expect(exerciseListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("rechaza páginas inválidas y parámetros desconocidos", () => {
    expect(exerciseListQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(exerciseListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(exerciseListQuerySchema.safeParse({ unitCode: "U1.1.1" }).success).toBe(false);
  });
});
