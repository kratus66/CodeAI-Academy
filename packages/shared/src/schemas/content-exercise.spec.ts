import { describe, expect, it } from "vitest";

import {
  contentSeedExerciseSchema,
  exerciseRuleViolations,
  type ContentSeedExercise,
} from "./content";

function exercise(overrides: Record<string, unknown> = {}): ContentSeedExercise {
  return contentSeedExerciseSchema.parse({
    slug: "js-async-900",
    type: "LAB",
    title: "Ejercicio de prueba",
    statement: "Enunciado con ejemplo.",
    ladder: "GUIDED",
    difficulty: 2,
    concepts: ["promises"],
    competencies: ["C1"],
    language: "javascript",
    starterCode: "function f() {}",
    solution: { code: "function f() { return 1; }" },
    sources: ["https://developer.mozilla.org/es/"],
    isPublished: false,
    order: 1,
    hints: [
      { level: 1, text: "a" },
      { level: 2, text: "b" },
      { level: 3, text: "c" },
    ],
    tests: [
      { name: "visible", isHidden: false, spec: { code: "assert.ok(true)" } },
      { name: "oculta", isHidden: true, spec: { code: "assert.ok(true)" } },
    ],
    ...overrides,
  });
}

describe("contentSeedExerciseSchema", () => {
  it("acepta un LAB guiado completo", () => {
    expect(exerciseRuleViolations(exercise())).toEqual([]);
  });

  it("exige concepto, competencia válida y documentación oficial", () => {
    expect(() => exercise({ concepts: [] })).toThrow(/concepto/);
    expect(() => exercise({ competencies: ["C15"] })).toThrow(/C1 y C14/);
    expect(() => exercise({ sources: [] })).toThrow(/documentación oficial/);
  });
});

describe("exerciseRuleViolations", () => {
  it("un ejercicio guiado declara las tres pistas", () => {
    const problems = exerciseRuleViolations(exercise({ hints: [{ level: 1, text: "a" }] }));

    expect(problems).toContain("un LAB/DEBUG guiado declara las 3 pistas progresivas");
  });

  it("un ejercicio autónomo (Nivel 3) no puede tener pistas", () => {
    const problems = exerciseRuleViolations(exercise({ ladder: "AUTONOMOUS" }));

    expect(problems).toContain("un ejercicio autónomo (Nivel 3) no puede tener pistas");
  });

  it("rechaza pistas con el mismo nivel y pruebas con el mismo nombre", () => {
    const problems = exerciseRuleViolations(
      exercise({
        ladder: "SEMI",
        hints: [
          { level: 1, text: "a" },
          { level: 1, text: "b" },
        ],
        tests: [
          { name: "igual", isHidden: false, spec: { code: "x" } },
          { name: "igual", isHidden: true, spec: { code: "x" } },
        ],
      }),
    );

    expect(problems).toEqual(
      expect.arrayContaining(["las pistas repiten nivel", "hay pruebas con el mismo nombre"]),
    );
  });

  it("un LAB necesita lenguaje, código inicial, solución y pruebas visible y oculta", () => {
    const problems = exerciseRuleViolations(
      exercise({
        language: null,
        starterCode: null,
        solution: null,
        tests: [{ name: "solo visible", isHidden: false, spec: { code: "x" } }],
      }),
    );

    expect(problems).toEqual(
      expect.arrayContaining([
        "requiere language",
        "requiere starterCode",
        "requiere la solución oficial",
        "requiere una prueba oculta",
      ]),
    );
  });

  describe("QUIZ y FLASHCARD", () => {
    const quiz = (overrides: Record<string, unknown> = {}) =>
      exercise({
        type: "QUIZ",
        ladder: "SEMI",
        hints: [],
        tests: [],
        language: null,
        starterCode: null,
        solution: null,
        quiz: {
          correctOptionId: "a",
          options: [
            { id: "a", text: "Correcta", explanation: "Porque sí." },
            { id: "b", text: "Distractor uno", explanation: "Porque no." },
            { id: "c", text: "Distractor dos", explanation: "Tampoco." },
          ],
        },
        ...overrides,
      });

    it("acepta un quiz con explicación en cada opción", () => {
      expect(exerciseRuleViolations(quiz())).toEqual([]);
    });

    it("exige el objeto quiz", () => {
      expect(exerciseRuleViolations(quiz({ quiz: null }))).toContain(
        "un QUIZ requiere quiz (opciones y respuesta)",
      );
    });

    it("la opción correcta debe existir", () => {
      const problems = exerciseRuleViolations(
        quiz({
          quiz: {
            correctOptionId: "d",
            options: [
              { id: "a", text: "Uno", explanation: "x" },
              { id: "b", text: "Dos", explanation: "x" },
              { id: "c", text: "Tres", explanation: "x" },
            ],
          },
        }),
      );

      expect(problems).toContain("la opción correcta no existe");
    });

    it("prohíbe verdadero/falso y «todas las anteriores»", () => {
      const bad = quiz({
        quiz: {
          correctOptionId: "a",
          options: [
            { id: "a", text: "Verdadero", explanation: "x" },
            { id: "b", text: "Todas las anteriores", explanation: "x" },
            { id: "c", text: "Falso", explanation: "x" },
          ],
        },
      });

      expect(exerciseRuleViolations(bad)).toEqual(
        expect.arrayContaining(["prohibido verdadero/falso", "prohibido «todas/ninguna de las anteriores»"]),
      );
    });

    it("rechaza un quiz sin explicación en una opción", () => {
      expect(() =>
        quiz({
          quiz: {
            correctOptionId: "a",
            options: [
              { id: "a", text: "Uno", explanation: "x" },
              { id: "b", text: "Dos", explanation: "" },
              { id: "c", text: "Tres", explanation: "x" },
            ],
          },
        }),
      ).toThrow();
    });

    it("una FLASHCARD necesita reverso y no admite quiz", () => {
      const flashcard = (overrides: Record<string, unknown>) =>
        exercise({
          type: "FLASHCARD",
          ladder: "GUIDED",
          hints: [],
          tests: [],
          language: null,
          starterCode: null,
          solution: null,
          ...overrides,
        });

      expect(exerciseRuleViolations(flashcard({}))).toContain("una FLASHCARD requiere flashcard.back");
      expect(exerciseRuleViolations(flashcard({ flashcard: { back: "Reverso" } }))).toEqual([]);
    });
  });
});
