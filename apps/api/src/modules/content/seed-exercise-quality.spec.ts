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
    // MEMORY se sirve desde que existe su reproductor de cliente (`MemoryPlayer`).
    const served = new Set(["QUIZ", "FLASHCARD", "REFLECT", "MEMORY", "LAB", "DEBUG"]);
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

/**
 * Unidades piloto que aún no tienen escalón autónomo (`banco-ejercicios.md` §4).
 * Es deuda declarada, no una excepción permanente: quitar la unidad de la lista
 * en cuanto exista su ejercicio autónomo.
 */
const UNITS_WITHOUT_AUTONOMOUS_LADDER: readonly string[] = ["U2.3.3"];

describe("metadatos y escalera de los ejercicios sembrados (banco-ejercicios.md §4 y §6)", () => {
  const withUnit = seed.stages.flatMap((stage) =>
    stage.modules.flatMap((module) =>
      module.units.flatMap((unit) =>
        unit.exercises.map((exercise) => ({ unit: unit.code, exercise })),
      ),
    ),
  );
  const codeExercises = withUnit.filter(({ exercise }) => ["LAB", "DEBUG"].includes(exercise.type));
  const quizzes = withUnit.filter(({ exercise }) => exercise.quiz !== null);

  it("declara el tiempo estimado de cada ejercicio", () => {
    const sinTiempo = withUnit
      .filter(({ exercise }) => !exercise.estimatedMin)
      .map(({ exercise }) => exercise.slug);

    expect(sinTiempo).toEqual([]);
  });

  it("explica cada opción de un quiz con un texto propio y suficiente", () => {
    const MINIMO = 15;
    const problemas: string[] = [];

    for (const { exercise } of quizzes) {
      const options = exercise.quiz?.options ?? [];
      const explanations = options.map((option) => option.explanation.trim());
      const texts = options.map((option) => option.text.trim().toLowerCase());

      if (new Set(explanations).size !== options.length) problemas.push(`${exercise.slug}: explicaciones repetidas`);
      if (new Set(texts).size !== options.length) problemas.push(`${exercise.slug}: opciones repetidas`);
      if (explanations.some((explanation) => explanation.length < MINIMO)) {
        problemas.push(`${exercise.slug}: explicación de menos de ${MINIMO} caracteres`);
      }
    }

    expect(problemas).toEqual([]);
  });

  it("no repite el frente de una tarjeta como su reverso", () => {
    const iguales = withUnit
      .filter(
        ({ exercise }) =>
          exercise.flashcard !== null &&
          exercise.flashcard.back.trim().toLowerCase() === exercise.statement.trim().toLowerCase(),
      )
      .map(({ exercise }) => exercise.slug);

    expect(iguales).toEqual([]);
  });

  it("todo ejercicio de código trae solución oficial y una prueba oculta", () => {
    const incompletos = codeExercises
      .filter(
        ({ exercise }) =>
          exercise.solution === null || !exercise.tests.some((test) => test.isHidden),
      )
      .map(({ exercise }) => exercise.slug);

    expect(incompletos).toEqual([]);
  });

  it("cada unidad con laboratorios ofrece el escalón autónomo, y ese escalón no trae pistas", () => {
    const unidades = new Map<string, ContentSeedExercise[]>();

    for (const { unit, exercise } of codeExercises) {
      unidades.set(unit, [...(unidades.get(unit) ?? []), exercise]);
    }

    const sinAutonomo = [...unidades.entries()]
      .filter(([, list]) => !list.some((exercise) => exercise.ladder === "AUTONOMOUS"))
      .map(([unit]) => unit)
      .filter((unit) => !UNITS_WITHOUT_AUTONOMOUS_LADDER.includes(unit));
    const autonomosConPistas = codeExercises
      .filter(({ exercise }) => exercise.ladder === "AUTONOMOUS" && exercise.hints.length > 0)
      .map(({ exercise }) => exercise.slug);

    expect(sinAutonomo).toEqual([]);
    expect(autonomosConPistas).toEqual([]);
  });

  it("la lista de excepciones no esconde unidades que ya cumplen", () => {
    const conAutonomo = new Set(
      codeExercises.filter(({ exercise }) => exercise.ladder === "AUTONOMOUS").map(({ unit }) => unit),
    );

    expect(UNITS_WITHOUT_AUTONOMOUS_LADDER.filter((unit) => conAutonomo.has(unit))).toEqual([]);
  });
});

describe("juegos de memoria sembrados (banco-ejercicios.md §3.3)", () => {
  const memories = exercises.filter((exercise) => exercise.type === "MEMORY");

  it("cada unidad de E0 trae un juego de memoria con 6 a 10 pares", () => {
    const e0Units = seed.stages[0]?.modules.flatMap((module) => module.units) ?? [];
    const sinJuego = e0Units
      .filter((unit) => !unit.exercises.some((exercise) => exercise.type === "MEMORY"))
      .map((unit) => unit.code);

    expect(sinJuego).toEqual([]);
    expect(memories.length).toBeGreaterThanOrEqual(e0Units.length);
    expect(memories.every((exercise) => (exercise.memory?.pairs.length ?? 0) >= 6)).toBe(true);
  });

  it("ningún par repite una cara dentro de su juego ni mezcla término y definición", () => {
    const problemas = memories.flatMap((exercise) => {
      const pairs = exercise.memory?.pairs ?? [];
      const caras = pairs.flatMap((pair) => [pair.term.trim().toLowerCase(), pair.definition.trim().toLowerCase()]);

      return new Set(caras).size === caras.length ? [] : [exercise.slug];
    });

    expect(problemas).toEqual([]);
  });
});

describe("introducción de los juegos de memoria", () => {
  const memories = exercises.filter((exercise) => exercise.type === "MEMORY");

  it("cada juego explica qué enseña antes de jugar", () => {
    const sinIntro = memories.filter((exercise) => exercise.memory?.intro == null).map((exercise) => exercise.slug);

    expect(sinIntro).toEqual([]);
  });

  it("la lista de una intro no repite elementos", () => {
    const repetidas = memories
      .filter((exercise) => {
        const items = exercise.memory?.intro?.list?.items ?? [];

        return new Set(items.map((item) => item.toLowerCase())).size !== items.length;
      })
      .map((exercise) => exercise.slug);

    expect(repetidas).toEqual([]);
  });
});
