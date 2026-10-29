import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { contentSeedSchema, type ContentSeedExercise } from "@codeai/shared";
import { describe, expect, it } from "vitest";

/**
 * Guardas de los ejercicios sembrados (`plantilla-ejercicio.md`, «Solución
 * oficial probada»). Aquí las pruebas SÍ se ejecutan en el proceso de prueba:
 * el sandbox `mock` de la API no ejecuta código, así que esta es la única
 * comprobación real de que la solución oficial resuelve el ejercicio y de que
 * el código inicial no lo resuelve ya.
 */

const raw: unknown = JSON.parse(
  readFileSync(resolve(__dirname, "../../../prisma/seed/content.seed.json"), "utf8"),
);
const seed = contentSeedSchema.parse(raw);

const exercises: ContentSeedExercise[] = seed.stages.flatMap((stage) =>
  stage.modules.flatMap((module) => module.units.flatMap((unit) => unit.exercises)),
);

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

/** Código del estudiante + cuerpo de la prueba, con `assert` en el ámbito. */
async function runTest(studentCode: string, testCode: string): Promise<boolean> {
  try {
    await new AsyncFunction("assert", `${studentCode}\n${testCode}`)(assert);
    return true;
  } catch {
    return false;
  }
}

const javascript = exercises.filter((exercise) => exercise.language === "javascript");

describe("calidad de los ejercicios sembrados", () => {
  it("siembra el piloto de código y declara concepto y competencia en cada ejercicio", () => {
    const slugs = exercises.map((exercise) => exercise.slug);

    expect(slugs).toEqual(expect.arrayContaining(["js-async-001", "js-async-002", "js-async-003"]));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(exercises.every((exercise) => exercise.concepts.length > 0)).toBe(true);
  });

  it("reparte la respuesta correcta entre las posiciones dentro de cada unidad", () => {
    // Un banco donde la correcta es casi siempre «b» se resuelve sin leer.
    const byUnit = new Map<string, string[]>();

    for (const stage of seed.stages) {
      for (const module of stage.modules) {
        for (const unit of module.units) {
          const positions = unit.exercises
            .filter((exercise) => exercise.quiz !== null)
            .map((exercise) => exercise.quiz?.correctOptionId ?? "");

          if (positions.length >= 6) byUnit.set(unit.code, positions);
        }
      }
    }

    const skewed = [...byUnit.entries()]
      .filter(([, positions]) => {
        const counts = new Map<string, number>();
        for (const position of positions) counts.set(position, (counts.get(position) ?? 0) + 1);

        return Math.max(...counts.values()) > positions.length / 2;
      })
      .map(([code]) => code);

    expect(skewed).toEqual([]);
  });

  it("no delata la respuesta correcta por su longitud", () => {
    // Un distractor telegráfico frente a una correcta explicada convierte el quiz
    // en «elige la más larga» (`banco-ejercicios.md` §3.2, regla de paridad). Se
    // comparan la media y el distractor más largo: con la media sola, un único
    // distractor corto escondería la pista.
    const RATIO_MAXIMO = 2;
    const desproporcionados: string[] = [];

    for (const stage of seed.stages) {
      for (const module of stage.modules) {
        for (const unit of module.units) {
          for (const exercise of unit.exercises) {
            const quiz = exercise.quiz;
            if (quiz === null) continue;

            const correct = quiz.options.find((option) => option.id === quiz.correctOptionId);
            const distractors = quiz.options.filter((option) => option.id !== quiz.correctOptionId);
            if (!correct || distractors.length === 0) continue;

            const lengths = distractors.map((option) => option.text.length);
            const meanDistractor = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
            const longestDistractor = Math.max(...lengths);

            if (
              correct.text.length / meanDistractor > RATIO_MAXIMO ||
              correct.text.length / longestDistractor > RATIO_MAXIMO
            ) {
              desproporcionados.push(exercise.slug);
            }
          }
        }
      }
    }

    expect(desproporcionados).toEqual([]);
  });

  it("no repite la misma pregunta ni la misma respuesta dentro de una unidad", () => {
    // Dos quizzes que preguntan lo mismo con otras palabras no miden dos veces:
    // el estudiante memoriza la respuesta y no el concepto.
    const LONGITUD_MINIMA = 25;
    const repetidos: string[] = [];

    for (const stage of seed.stages) {
      for (const module of stage.modules) {
        for (const unit of module.units) {
          const preguntas = new Set<string>();
          const respuestas = new Set<string>();

          for (const exercise of unit.exercises) {
            const quiz = exercise.quiz;
            if (quiz === null) continue;

            const pregunta = exercise.statement.trim().toLowerCase();
            if (preguntas.has(pregunta)) repetidos.push(`${exercise.slug}: pregunta repetida`);
            preguntas.add(pregunta);

            const correct = quiz.options.find((option) => option.id === quiz.correctOptionId);
            const respuesta = correct?.text.trim().toLowerCase() ?? "";
            if (respuesta.length < LONGITUD_MINIMA) continue;
            if (respuestas.has(respuesta)) repetidos.push(`${exercise.slug}: respuesta repetida`);
            respuestas.add(respuesta);
          }
        }
      }
    }

    expect(repetidos).toEqual([]);
  });

  it("solo publica tipos que la plataforma sabe servir", () => {
    // Decisión del responsable (2026-10-28): se publican también LAB y DEBUG aunque
    // `SANDBOX_MODE=mock` dé PASSED a cualquier código sin `TODO`. La interfaz lo
    // avisa en cada laboratorio; el riesgo sigue abierto hasta tener sandbox real
    // (`sandbox-ejecucion.md`, H1 de `revision-pedagogica.md`).
    const served = new Set(["QUIZ", "FLASHCARD", "REFLECT", "LAB", "DEBUG"]);
    const published = exercises.filter((exercise) => exercise.isPublished);

    expect(published.filter((exercise) => !served.has(exercise.type))).toEqual([]);
  });

  it("la versión autónoma (Nivel 3) no ofrece pistas", () => {
    const autonomous = exercises.filter((exercise) => exercise.ladder === "AUTONOMOUS");

    expect(autonomous.length).toBeGreaterThan(0);
    expect(autonomous.every((exercise) => exercise.hints.length === 0)).toBe(true);
  });

  describe.each(javascript.map((exercise) => [exercise.slug, exercise] as const))(
    "%s",
    (_slug, exercise) => {
      it("la solución oficial pasa todas las pruebas, visibles y ocultas", async () => {
        const solution = exercise.solution?.code ?? "";
        const failed: string[] = [];

        for (const test of exercise.tests) {
          if (!(await runTest(solution, test.spec.code))) failed.push(test.name);
        }

        expect(failed).toEqual([]);
      });

      it("el código inicial falla al menos una prueba visible (el defecto es reproducible)", async () => {
        const starter = exercise.starterCode ?? "";
        let visibleFailures = 0;

        for (const test of exercise.tests.filter((candidate) => !candidate.isHidden)) {
          if (!(await runTest(starter, test.spec.code))) visibleFailures++;
        }

        expect(visibleFailures).toBeGreaterThan(0);
      });

      it("el enunciado incluye un ejemplo", () => {
        expect(exercise.statement).toMatch(/ejemplo/i);
      });
    },
  );
});
