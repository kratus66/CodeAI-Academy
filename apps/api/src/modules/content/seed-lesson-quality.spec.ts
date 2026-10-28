import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { LESSON_STEP_KINDS } from "@codeai/shared";
import { describe, expect, it } from "vitest";

/**
 * Guardas pedagógicas sobre la semilla publicada. Codifican las reglas
 * comprobables de `fundamentos-pedagogicos.md` §5 y §7 y de
 * `plantilla-leccion.md`; NO sustituyen la revisión pedagógica humana
 * (ver `docs/02-contenido/revision-pedagogica.md`).
 */

interface SeedLesson {
  slug: string;
  estimatedMin: number | null;
  content: { type: string; title?: string; text?: string }[];
  steps: { kind: string; body: string }[];
}

interface SeedFile {
  stages: { modules: { units: { lessons?: SeedLesson[] }[] }[] }[];
}

const seed = JSON.parse(
  readFileSync(resolve(__dirname, "../../../prisma/seed/content.seed.json"), "utf8"),
) as SeedFile;

const lessons: SeedLesson[] = seed.stages.flatMap((stage) =>
  stage.modules.flatMap((module) => module.units.flatMap((unit) => unit.lessons ?? [])),
);

const step = (lesson: SeedLesson, kind: string): string =>
  lesson.steps.find((candidate) => candidate.kind === kind)?.body ?? "";

/** Familias de concepto con representación visual obligatoria (§3.5). */
const DIAGRAM_REQUIRED = [
  "event-loop-stack-microtasks-macrotasks",
  "promesas-estados-encadenamiento-y-errores",
  "async-await",
  "http-metodos-cabeceras-y-codigos-de-estado",
  "autenticacion-sesiones-jwt-y-refresh-tokens",
  "arquitectura-por-capas-y-separacion-de-responsabilidades",
  "arquitectura-por-capas-y-limites-de-modulos",
  "modelo-entidad-relacion",
  "relaciones-1-1-1-n-y-n-m",
  "embeddings-y-busqueda-semantica",
  "rag-arquitectura-de-recuperacion-aumentada",
  "ciclos-de-decision-y-ejecucion",
  "chatbot-flujo-automatizado-y-agente-diferencias-reales",
  "uso-de-herramientas-por-modelos-en-un-agente",
];

function failing(predicate: (lesson: SeedLesson) => boolean): string[] {
  return lessons.filter((lesson) => !predicate(lesson)).map((lesson) => lesson.slug);
}

describe("calidad pedagógica de la semilla de lecciones", () => {
  it("publica las 207 lecciones del currículo", () => {
    expect(lessons).toHaveLength(207);
  });

  it("sigue los 7 pasos en el orden de la microestructura", () => {
    expect(
      failing(
        (lesson) =>
          lesson.steps.map((candidate) => candidate.kind).join() === LESSON_STEP_KINDS.join(),
      ),
    ).toEqual([]);
  });

  it("dura entre 45 y 90 minutos", () => {
    expect(
      failing(
        (lesson) =>
          lesson.estimatedMin !== null && lesson.estimatedMin >= 45 && lesson.estimatedMin <= 90,
      ),
    ).toEqual([]);
  });

  it("enumera al menos dos errores comunes con causa y solución", () => {
    expect(
      failing((lesson) => {
        const errors = lesson.content.filter((block) => /^Error com/i.test(block.title ?? ""));
        return (
          errors.length >= 2 &&
          errors.every(
            (block) => /causa/i.test(block.text ?? "") && /soluci/i.test(block.text ?? ""),
          )
        );
      }),
    ).toEqual([]);
  });

  it("declara criterio de paso en la práctica guiada, la independiente y la evaluación", () => {
    expect(
      failing((lesson) =>
        ["guided_practice", "independent_practice", "assessment"].every((kind) =>
          /criterio de paso/i.test(step(lesson, kind)),
        ),
      ),
    ).toEqual([]);
  });

  it("no ofrece pistas en la práctica independiente (Nivel 3)", () => {
    expect(failing((lesson) => !/\(pista:/i.test(step(lesson, "independent_practice")))).toEqual([]);
  });

  it("evalúa por recuperación, sin apuntes", () => {
    expect(failing((lesson) => /^Sin /.test(step(lesson, "assessment")))).toEqual([]);
  });

  it("cierra con una variante con restricción y una pregunta de cierre", () => {
    expect(
      failing((lesson) => {
        const transfer = step(lesson, "transfer");
        return /variante/i.test(transfer) && /pregunta de cierre/i.test(transfer);
      }),
    ).toEqual([]);
  });

  it("incluye el material visual de las familias que lo exigen", () => {
    const bySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]));
    const missing = DIAGRAM_REQUIRED.filter((slug) => {
      const lesson = bySlug.get(slug);
      return !lesson || !lesson.content.some((block) => block.type === "diagram");
    });

    expect(missing).toEqual([]);
  });

  it("no cita la nomenclatura interna de sprints (S3, S2-T9…)", () => {
    // «S3» también es Amazon S3 en las lecciones de almacenamiento de objetos.
    const clean = (lesson: SeedLesson) =>
      JSON.stringify(lesson).replace(/\(?(como )?S3 o equivalentes?\)?/g, "");

    expect(failing((lesson) => !/\bS\d{1,2}(-T\d+)?\b/.test(clean(lesson)))).toEqual([]);
  });

  it("exige evidencia escrita y un artefacto dado en la depuración de las lecciones de juicio", () => {
    const judgement = [
      "cuando-no-usar-ia",
      "que-contexto-aportar-repositorio-convenciones-y-documentacion",
      "ejercicios-cronometrados",
      "analisis-de-vacantes-y-perfiles",
      "repositorio-y-portafolio",
      "streaming-de-respuestas",
    ];
    const bad = lessons
      .filter((lesson) => judgement.includes(lesson.slug))
      .filter((lesson) => {
        const debug = step(lesson, "debug");
        return !(/^Te damos/.test(debug) && /anota/i.test(debug));
      })
      .map((lesson) => lesson.slug);

    expect(bad).toEqual([]);
  });

  it("no deja marcadores de contenido pendiente", () => {
    expect(
      failing((lesson) => !/\b(TODO|TBD|FIXME|lorem ipsum)\b/.test(JSON.stringify(lesson))),
    ).toEqual([]);
  });
});
