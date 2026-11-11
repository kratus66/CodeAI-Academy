import { describe, expect, it } from "vitest";

import {
  auditAnswerResponseSchema,
  auditAnswerResultSchema,
  auditAnswerSchema,
  cloudEvidenceResultSchema,
  cloudEvidenceSchema,
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

describe("auditAnswerSchema", () => {
  const BODY = {
    marks: [
      { findingId: "f1", severity: "critical" },
      { findingId: "f3", severity: "low" },
    ],
    decision: "fix",
  } as const;

  it("acepta el cuerpo de ejemplo del contrato", () => {
    expect(auditAnswerSchema.parse(BODY)).toEqual(BODY);
  });

  it("acepta `marks: []`: no encontré nada", () => {
    const empty = { marks: [], decision: "accept" } as const;
    expect(auditAnswerSchema.parse(empty)).toEqual(empty);
  });

  it("rechaza el mismo hallazgo marcado dos veces", () => {
    const repeated = auditAnswerSchema.safeParse({
      marks: [
        { findingId: "f2", severity: "high" },
        { findingId: "f2", severity: "low" },
      ],
      decision: "fix",
    });

    expect(repeated.success).toBe(false);
    if (!repeated.success) {
      expect(repeated.error.issues[0]?.message).toBe("No marques dos veces el mismo hallazgo");
    }
  });

  it("rechaza una severidad y una decisión desconocidas", () => {
    expect(
      auditAnswerSchema.safeParse({
        marks: [{ findingId: "f1", severity: "urgent" }],
        decision: "fix",
      }).success,
    ).toBe(false);
    expect(auditAnswerSchema.safeParse({ marks: [], decision: "approve" }).success).toBe(false);
  });

  it("rechaza un id de hallazgo con formato inválido", () => {
    const badId = auditAnswerSchema.safeParse({
      marks: [{ findingId: "hallazgo-1", severity: "low" }],
      decision: "fix",
    });

    expect(badId.success).toBe(false);
    if (!badId.success) {
      expect(badId.error.issues[0]?.message).toBe("El hallazgo debe ser f1, f2…");
    }
  });

  it("rechaza más de 10 marcas", () => {
    const eleven = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11"].map(
      (findingId) => ({ findingId, severity: "low" }),
    );

    expect(auditAnswerSchema.safeParse({ marks: eleven, decision: "fix" }).success).toBe(false);
    expect(
      auditAnswerSchema.safeParse({ marks: eleven.slice(0, 10), decision: "fix" }).success,
    ).toBe(true);
  });

  it("rechaza claves desconocidas en el cuerpo y en cada marca (strict)", () => {
    expect(auditAnswerSchema.safeParse({ ...BODY, extra: true }).success).toBe(false);
    expect(
      auditAnswerSchema.safeParse({
        marks: [{ findingId: "f1", severity: "low", explanation: "Esto no viaja aquí" }],
        decision: "fix",
      }).success,
    ).toBe(false);
  });
});

describe("auditAnswerResultSchema", () => {
  const RESULT = {
    score: 80,
    outcome: "PASSED",
    detectedDefects: 2,
    totalDefects: 2,
    falsePositives: 1,
    decisionCorrect: true,
    verdict: "fix",
    findings: [
      {
        id: "f1",
        isDefect: true,
        severity: "critical",
        marked: true,
        chosenSeverity: "critical",
        severityCorrect: true,
        explanation: "El mensaje revela si el correo existe.",
      },
      {
        id: "f2",
        isDefect: false,
        severity: null,
        marked: true,
        chosenSeverity: "low",
        severityCorrect: null,
        explanation: "Comparar con bcrypt es lo correcto.",
      },
      {
        id: "f3",
        isDefect: true,
        severity: "high",
        marked: false,
        chosenSeverity: null,
        severityCorrect: null,
        explanation: "La firma usa un secreto fijo en el código.",
      },
    ],
  } as const;

  it("parsea un resultado completo", () => {
    expect(auditAnswerResultSchema.parse(RESULT)).toEqual(RESULT);
    expect(auditAnswerResponseSchema.parse({ result: RESULT })).toEqual({ result: RESULT });
  });

  it("rechaza una nota fuera de 0–100 y un resultado desconocido", () => {
    expect(auditAnswerResultSchema.safeParse({ ...RESULT, score: 101 }).success).toBe(false);
    expect(auditAnswerResultSchema.safeParse({ ...RESULT, score: -1 }).success).toBe(false);
    expect(auditAnswerResultSchema.safeParse({ ...RESULT, outcome: "OK" }).success).toBe(false);
  });
});

describe("cloudEvidenceSchema", () => {
  const valid = {
    evidence: [{ checkId: "c1", output: "{}" }],
    cleanupConfirmed: false,
  };

  it("acepta una evidencia válida", () => {
    expect(cloudEvidenceSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza una evidencia vacía o con más de 20 salidas", () => {
    expect(cloudEvidenceSchema.safeParse({ ...valid, evidence: [] }).success).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => ({ checkId: `c${i}`, output: "{}" }));
    expect(cloudEvidenceSchema.safeParse({ ...valid, evidence: many }).success).toBe(false);
  });

  it("rechaza una salida demasiado corta o demasiado larga", () => {
    const short = { ...valid, evidence: [{ checkId: "c1", output: "1" }] };
    const long = { ...valid, evidence: [{ checkId: "c1", output: "x".repeat(200_001) }] };
    expect(cloudEvidenceSchema.safeParse(short).success).toBe(false);
    expect(cloudEvidenceSchema.safeParse(long).success).toBe(false);
  });

  it("exige cleanupConfirmed y rechaza campos desconocidos", () => {
    expect(cloudEvidenceSchema.safeParse({ evidence: valid.evidence }).success).toBe(false);
    expect(cloudEvidenceSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});

describe("cloudEvidenceResultSchema", () => {
  it("acepta un resultado válido y rechaza un desenlace desconocido", () => {
    const result = {
      outcome: "PARTIAL",
      checks: [{ checkId: "c1", label: "Bucket", passed: true, problems: [] }],
      cleanupConfirmed: false,
      maskedSummary: "resumen",
    };
    expect(cloudEvidenceResultSchema.safeParse(result).success).toBe(true);
    expect(cloudEvidenceResultSchema.safeParse({ ...result, outcome: "OK" }).success).toBe(false);
  });
});
