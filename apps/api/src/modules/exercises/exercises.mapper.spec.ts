import { describe, expect, it } from "vitest";

import { toExerciseDetail, toExerciseListItem, toSubmissionSummary } from "./exercises.mapper";
import type { ExerciseRow, SubmissionRow } from "./exercises.repository";

function row(overrides: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id: "ex_1",
    unitId: "unit_1",
    unitCode: "U1.1.1",
    slug: "valida-el-status",
    type: "LAB",
    title: "Valida el status antes de parsear",
    statement: "Implementa fetchUser validando el status.",
    config: { starterCode: "export async function fetchUser() {}" },
    solution: { code: "export async function fetchUser() { /* solución */ }" },
    ladder: "GUIDED",
    difficulty: 2,
    competencies: ["C1"],
    estimatedMin: 25,
    language: "typescript",
    hintLevels: [1, 2, 3],
    tests: [
      { id: "t1", name: "devuelve el usuario", isHidden: false },
      { id: "t2", name: "lanza con 404", isHidden: false },
      { id: "t3", name: "caso oculto de carrera", isHidden: true },
    ],
    ...overrides,
  };
}

describe("toExerciseListItem", () => {
  it("publica los campos del listado sin enunciado ni configuración", () => {
    const item = toExerciseListItem(row());

    expect(item).toEqual({
      id: "ex_1",
      unitId: "unit_1",
      unitCode: "U1.1.1",
      type: "LAB",
      title: "Valida el status antes de parsear",
      ladder: "GUIDED",
      difficulty: 2,
      estimatedMin: 25,
      language: "typescript",
      competencies: ["C1"],
    });
  });

  it("sirve null cuando el lenguaje no es del sandbox", () => {
    expect(toExerciseListItem(row({ language: "python" })).language).toBeNull();
    expect(toExerciseListItem(row({ language: null })).language).toBeNull();
  });

  it("copia las competencias para no compartir el arreglo de la fila", () => {
    const competencies = ["C1"];
    const item = toExerciseListItem(row({ competencies }));

    competencies.push("C5");

    expect(item.competencies).toEqual(["C1"]);
  });
});

describe("toExerciseDetail", () => {
  it("nunca expone la solución ni los tests ocultos", () => {
    const detail = toExerciseDetail(row());

    expect(detail).not.toHaveProperty("solution");
    expect(detail.publicTests).toEqual([
      { testId: "t1", name: "devuelve el usuario" },
      { testId: "t2", name: "lanza con 404" },
    ]);
    expect(JSON.stringify(detail)).not.toContain("solución");
    expect(JSON.stringify(detail)).not.toContain("caso oculto");
  });

  it("cuenta las pistas y extrae el código inicial de la configuración", () => {
    const detail = toExerciseDetail(row());

    expect(detail.hintsAvailable).toBe(3);
    expect(detail.starterCode).toBe("export async function fetchUser() {}");
    expect(detail.statement).toContain("fetchUser");
  });

  it("tolera configuración que no es un objeto y códigos iniciales ausentes", () => {
    expect(toExerciseDetail(row({ config: "texto" })).config).toEqual({});
    expect(toExerciseDetail(row({ config: { entry: "index.ts" } })).starterCode).toBeNull();
  });
});

describe("toSubmissionSummary", () => {
  function submission(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
    return {
      id: "sub_1",
      outcome: "PARTIAL",
      score: 50,
      achievedLevel: null,
      hintsUsed: 1,
      createdAt: new Date("2026-10-27T14:30:00.000Z"),
      results: [
        { testId: "t1", name: "devuelve el usuario", passed: true, durationMs: 3 },
        { testId: "t2", name: "lanza con 404", passed: false, durationMs: null },
      ],
      ...overrides,
    };
  }

  it("resuelve nombres, omite duraciones nulas y deriva el feedback", () => {
    const summary = toSubmissionSummary(submission());

    expect(summary.results).toEqual([
      { testId: "t1", name: "devuelve el usuario", passed: true, durationMs: 3 },
      { testId: "t2", name: "lanza con 404", passed: false },
    ]);
    expect(summary.feedback).toBe("1 de 2 pruebas visibles superadas.");
    expect(summary.achievedLevel).toBeNull();
    expect(summary.createdAt).toBe("2026-10-27T14:30:00.000Z");
  });

  it("declara el vacío cuando la ejecución no tenía pruebas", () => {
    expect(toSubmissionSummary(submission({ results: [], outcome: "PASSED", score: 100 })).feedback).toBe(
      "La ejecución no tenía pruebas visibles.",
    );
  });

  it("cuenta todas las pruebas cuando pasan", () => {
    const summary = toSubmissionSummary(
      submission({
        results: [
          { testId: "t1", name: "uno", passed: true, durationMs: 1 },
          { testId: "t2", name: "dos", passed: true, durationMs: 1 },
        ],
      }),
    );

    expect(summary.feedback).toBe("2 de 2 pruebas visibles superadas.");
  });
});
