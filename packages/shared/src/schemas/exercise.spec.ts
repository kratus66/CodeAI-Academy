import { describe, expect, it } from "vitest";

import {
  createSubmissionSchema,
  exerciseDetailSchema,
  exerciseListItemSchema,
  exerciseListQuerySchema,
  quizAnswerSchema,
  quizGradeResultSchema,
  quizSubmissionSchema,
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

describe("quizSubmissionSchema", () => {
  it("acepta los cuatro cuerpos y `optionId` coincide con quizAnswerSchema", () => {
    expect(quizSubmissionSchema.parse({ optionId: "b" })).toEqual(
      quizAnswerSchema.parse({ optionId: "b" }),
    );
    expect(quizSubmissionSchema.parse({ optionIds: ["b", "e"] })).toEqual({
      optionIds: ["b", "e"],
    });
    expect(quizSubmissionSchema.parse({ order: ["c", "a", "b"] })).toEqual({
      order: ["c", "a", "b"],
    });
    expect(quizSubmissionSchema.parse({ pairs: { a: "2", b: "1", c: "3" } })).toEqual({
      pairs: { a: "2", b: "1", c: "3" },
    });
  });

  it("exige exactamente una respuesta", () => {
    const empty = quizSubmissionSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0]?.message).toBe(
        "Envía exactamente una respuesta: optionId, optionIds, order o pairs",
      );
    }

    const twice = quizSubmissionSchema.safeParse({ optionId: "b", optionIds: ["b", "e"] });
    expect(twice.success).toBe(false);
    if (!twice.success) {
      expect(twice.error.issues[0]?.message).toBe(
        "Envía exactamente una respuesta: optionId, optionIds, order o pairs",
      );
    }
  });

  it("rechaza ids fuera de rango y menos elementos de los exigidos", () => {
    expect(quizSubmissionSchema.safeParse({ optionId: "e" }).success).toBe(false);
    expect(quizSubmissionSchema.safeParse({ order: ["a", "b"] }).success).toBe(false);
    expect(quizSubmissionSchema.safeParse({ pairs: { a: "7" } }).success).toBe(false);
  });

  it("rechaza ids repetidos en optionIds y en order", () => {
    const repeatedOptions = quizSubmissionSchema.safeParse({ optionIds: ["a", "a"] });
    expect(repeatedOptions.success).toBe(false);
    if (!repeatedOptions.success) {
      expect(repeatedOptions.error.issues[0]?.message).toBe(
        "No repitas la misma opción en optionIds",
      );
    }

    const repeatedOrder = quizSubmissionSchema.safeParse({ order: ["a", "b", "a"] });
    expect(repeatedOrder.success).toBe(false);
    if (!repeatedOrder.success) {
      expect(repeatedOrder.error.issues[0]?.message).toBe("No repitas el mismo elemento en order");
    }
  });

  it("rechaza claves desconocidas (strict) y no exige `kind`", () => {
    expect(quizSubmissionSchema.safeParse({ optionId: "b", kind: "single" }).success).toBe(false);
    expect(quizSubmissionSchema.safeParse({ optionId: "b", extra: true }).success).toBe(false);
  });
});

describe("quizGradeResultSchema", () => {
  const EXPLANATIONS = {
    a: "Correcta: el enunciado pide una lista.",
    b: "Incorrecta: no usa el servicio adecuado.",
  };

  it("parsea un resultado de cada variante", () => {
    const single = {
      kind: "single",
      correct: true,
      correctOptionId: "a",
      explanation: EXPLANATIONS.a,
      correctExplanation: EXPLANATIONS.a,
    } as const;
    expect(quizGradeResultSchema.parse(single)).toEqual(single);

    const multiple = {
      kind: "multiple",
      correct: false,
      correctOptionIds: ["a", "b"],
      selectedOptionIds: ["a"],
      explanations: EXPLANATIONS,
    } as const;
    expect(quizGradeResultSchema.parse(multiple)).toEqual(multiple);

    const ordering = {
      kind: "ordering",
      correct: true,
      correctOrder: ["c", "a", "b"],
      explanations: EXPLANATIONS,
    } as const;
    expect(quizGradeResultSchema.parse(ordering)).toEqual(ordering);

    const matching = {
      kind: "matching",
      correct: true,
      correctPairs: { a: "2", b: "1" },
      explanations: EXPLANATIONS,
    } as const;
    expect(quizGradeResultSchema.parse(matching)).toEqual(matching);
  });

  it("rechaza un resultado sin kind y una variante desconocida", () => {
    expect(
      quizGradeResultSchema.safeParse({
        correct: true,
        correctOptionId: "a",
        explanation: EXPLANATIONS.a,
        correctExplanation: EXPLANATIONS.a,
      }).success,
    ).toBe(false);
    expect(quizGradeResultSchema.safeParse({ kind: "audit", correct: true }).success).toBe(false);
  });
});
