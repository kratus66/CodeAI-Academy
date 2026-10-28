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
