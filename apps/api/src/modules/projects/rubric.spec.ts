import {
  DEFAULT_PROJECT_RUBRIC,
  PROJECT_EVIDENCE_MIN_SCORE,
  type ProjectRubric,
  type ProjectRubricScores,
} from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { InvalidRubricError, readRubric, scoreSubmission } from "./rubric";

/** Explicación propia para los casos que sí deben puntuar la justificación. */
const EXPLANATION =
  "Elegí colas porque el orden importa y descarté un array por el coste de búsqueda.";

/** Los cinco criterios en el mismo nivel, con las excepciones que pida el caso. */
function levels(overrides: Partial<ProjectRubricScores> = {}): ProjectRubricScores {
  return {
    correctitud: 4,
    calidad: 4,
    pruebas: 4,
    seguridad: 4,
    justificacion: 4,
    ...overrides,
  };
}

/** Rúbrica base con otros pesos, en el orden de `DEFAULT_PROJECT_RUBRIC`. */
function rubricWithWeights(weights: readonly number[]): ProjectRubric {
  return {
    correctitudGate: true,
    criteria: DEFAULT_PROJECT_RUBRIC.criteria.map((criterion, index) => ({
      ...criterion,
      weight: weights[index] ?? criterion.weight,
    })),
  };
}

function cloneDefaultRubric(): ProjectRubric {
  return JSON.parse(JSON.stringify(DEFAULT_PROJECT_RUBRIC)) as ProjectRubric;
}

describe("readRubric", () => {
  it("acepta la rúbrica base y conserva los pesos 30/20/20/15/15", () => {
    const rubric = readRubric(DEFAULT_PROJECT_RUBRIC);

    expect(rubric.criteria.map((criterion) => criterion.criterion)).toEqual([
      "correctitud",
      "calidad",
      "pruebas",
      "seguridad",
      "justificacion",
    ]);
    expect(rubric.criteria.map((criterion) => criterion.weight)).toEqual([
      30, 20, 20, 15, 15,
    ]);
    expect(rubric.correctitudGate).toBe(true);
  });

  it("trata un `null` almacenado como rúbrica inválida", () => {
    expect(() => readRubric(null)).toThrow(InvalidRubricError);
  });

  it("rechaza pesos que no suman 100 con un error de dominio accionable", () => {
    const rubric = rubricWithWeights([30, 20, 20, 15, 10]);

    expect(() => readRubric(rubric)).toThrow(InvalidRubricError);
    expect(() => readRubric(rubric)).toThrow(/Rúbrica inválida/);

    try {
      readRubric(rubric);
      expect.unreachable("readRubric debió rechazar la rúbrica");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(InvalidRubricError);
      expect((error as InvalidRubricError).code).toBe("INVALID_RUBRIC");
      expect((error as InvalidRubricError).issues.length).toBeGreaterThan(0);
      expect((error as InvalidRubricError).issues.join("\n")).toContain("criteria");
    }
  });

  it("rechaza criterios repetidos", () => {
    const rubric = cloneDefaultRubric();
    rubric.criteria[4] = { ...rubric.criteria[0]!, weight: 15 };

    expect(() => readRubric(rubric)).toThrow(/Rúbrica inválida/);
  });

  it("rechaza una rúbrica que no declara la puerta de correctitud", () => {
    const rubric = { ...cloneDefaultRubric(), correctitudGate: false };

    expect(() => readRubric(rubric)).toThrow(InvalidRubricError);
  });

  it("recorta los espacios de los anclajes al leerlos", () => {
    const rubric = cloneDefaultRubric();
    rubric.criteria[0]!.levels[0]!.anchor = "   Falla en casos básicos.   ";

    const read = readRubric(rubric);

    expect(read.criteria[0]!.levels[0]!.anchor).toBe("Falla en casos básicos.");
  });
});

describe("scoreSubmission — cálculo de la nota", () => {
  it("da 100 con los cinco criterios en nivel 4 y deja evidencia", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels(),
      notes: EXPLANATION,
    });

    expect(result.valid).toBe(true);
    expect(result.score).toBe(100);
    expect(result.rejection).toBeNull();
    expect(result.grantsEvidence).toBe(true);
    expect(result.rubricScores).toEqual(levels());
  });

  it("da 75 con los cinco criterios en nivel 3 y no deja evidencia", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels({ correctitud: 3, calidad: 3, pruebas: 3, seguridad: 3, justificacion: 3 }),
      notes: EXPLANATION,
    });

    expect(result.score).toBe(75);
    expect(result.grantsEvidence).toBe(false);
  });

  it("da 25 con los cinco criterios en nivel 1", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels({ correctitud: 1, calidad: 1, pruebas: 1, seguridad: 1, justificacion: 1 }),
      notes: EXPLANATION,
    });

    expect(result.score).toBe(25);
    expect(result.valid).toBe(true);
  });

  it("da 85 cuando falta la explicación propia y el resto está en nivel 4", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels(),
      notes: "",
    });

    expect(result.score).toBe(85);
    expect(result.rubricScores?.justificacion).toBe(0);
  });

  it("trata una explicación con sólo espacios como ausente", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels(),
      notes: "   \n\t ",
    });

    expect(result.score).toBe(85);
    expect(result.rubricScores?.justificacion).toBe(0);
  });

  it("respeta la justificación cuando la entrega trae explicación", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels(),
      notes: "  Elegí colas porque el orden importa.  ",
    });

    expect(result.score).toBe(100);
    expect(result.rubricScores?.justificacion).toBe(4);
  });

  it("redondea la nota a dos decimales", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels({ correctitud: 1 }),
      notes: EXPLANATION,
    });

    // 30×1/4 + 20 + 20 + 15 + 15 = 77,5
    expect(result.score).toBe(77.5);
  });

  it("usa los pesos de la rúbrica del proyecto, no los de la base", () => {
    const result = scoreSubmission({
      rubric: rubricWithWeights([40, 30, 10, 10, 10]),
      scores: levels({ calidad: 2, pruebas: 2, seguridad: 2, justificacion: 2 }),
      notes: EXPLANATION,
    });

    // 40 + 15 + 5 + 5 + 5 = 70; con los pesos base serían 65.
    expect(result.score).toBe(70);
  });

  it("no modifica las notas que recibe", () => {
    const input = levels();

    scoreSubmission({ rubric: DEFAULT_PROJECT_RUBRIC, scores: input, notes: " " });

    expect(input.justificacion).toBe(4);
  });

  it("deja evidencia justo en el umbral de 80 y no por debajo", () => {
    const atThreshold = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels({ pruebas: 3, seguridad: 2, justificacion: 2 }),
      notes: EXPLANATION,
    });
    const belowThreshold = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels({ pruebas: 3, seguridad: 2, justificacion: 1 }),
      notes: EXPLANATION,
    });

    expect(atThreshold.score).toBe(PROJECT_EVIDENCE_MIN_SCORE);
    expect(atThreshold.grantsEvidence).toBe(true);
    expect(belowThreshold.score).toBeLessThan(PROJECT_EVIDENCE_MIN_SCORE);
    expect(belowThreshold.grantsEvidence).toBe(false);
  });
});

describe("scoreSubmission — puerta de correctitud", () => {
  it("invalida la revisión con correctitud 0 y no produce nota", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels({ correctitud: 0 }),
      notes: "Entrega con explicación",
    });

    expect(result.valid).toBe(false);
    expect(result.score).toBeNull();
    expect(result.rubricScores).toBeNull();
    expect(result.rejection).toBe("CORRECTITUD_ZERO");
    expect(result.grantsEvidence).toBe(false);
  });

  it("invalida aunque el resto esté perfecto y falte la justificación", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels({ correctitud: 0 }),
      notes: "",
    });

    expect(result.valid).toBe(false);
    expect(result.rejection).toBe("CORRECTITUD_ZERO");
  });

  it("acepta correctitud 1: la puerta sólo se abre con 0", () => {
    const result = scoreSubmission({
      rubric: DEFAULT_PROJECT_RUBRIC,
      scores: levels({ correctitud: 1 }),
      notes: EXPLANATION,
    });

    expect(result.valid).toBe(true);
    expect(result.rejection).toBeNull();
    expect(result.score).toBe(77.5);
  });

  it("no puntúa con una rúbrica almacenada inválida", () => {
    expect(() =>
      scoreSubmission({
        rubric: rubricWithWeights([30, 20, 20, 15, 10]),
        scores: levels(),
      }),
    ).toThrow(InvalidRubricError);
  });
});
