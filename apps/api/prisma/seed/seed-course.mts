/**
 * Semilla de una ruta secundaria (Sprint 13, S13-T9).
 *
 * Uso: `node prisma/seed/seed-course.mts aws-cloud`.
 *
 * Lee el esqueleto `<ruta>/course.seed.json` y los archivos `<ruta>/units/*.json`,
 * los fusiona, valida el resultado completo con `courseSeedSchema` y, solo si todo
 * es válido, aplica `upsert` por clave natural. Cualquier problema detiene el
 * proceso antes de conectarse a la base de datos.
 */
import { readdir, readFile } from "node:fs/promises";

import { PrismaClient } from "@prisma/client";
import {
  courseSeedSchema,
  courseSlugSchema,
  courseUnitFileSchema,
  DEFAULT_COURSE_SLUG,
  mergeCourseSeed,
} from "@codeai/shared";
import type { CourseSlug, CourseUnitFileEntry, FormExerciseFacts } from "@codeai/shared";

import {
  countCourse,
  describeIssues,
  prepareDatabaseEnv,
  previousUnitCodes,
  readExamFormFiles,
  upsertExamForms,
  upsertResources,
  upsertStageTree,
} from "./seed-lib.mts";

const COURSE_DIRS = { "aws-cloud": "aws" } as const;

type SeededCourseSlug = keyof typeof COURSE_DIRS;

function isSeededCourse(slug: CourseSlug): slug is SeededCourseSlug {
  return slug in COURSE_DIRS;
}

function parseCourseArgument(argument: string | undefined): SeededCourseSlug {
  const parsed = courseSlugSchema.safeParse(argument);

  if (!parsed.success) {
    throw new Error(
      `Uso: node prisma/seed/seed-course.mts <ruta>. Rutas disponibles: ${Object.keys(COURSE_DIRS).join(", ")}.`,
    );
  }

  if (parsed.data === DEFAULT_COURSE_SLUG || !isSeededCourse(parsed.data)) {
    throw new Error(
      `La ruta "${parsed.data}" se siembra con "npm run db:seed", no con este script. Rutas disponibles: ${Object.keys(COURSE_DIRS).join(", ")}.`,
    );
  }

  return parsed.data;
}

async function readJson(url: URL): Promise<unknown> {
  const raw: unknown = JSON.parse(await readFile(url, "utf8"));

  return raw;
}

async function listUnitFiles(unitsDir: URL): Promise<string[]> {
  try {
    const names = await readdir(unitsDir);

    return names.filter((name) => name.endsWith(".json")).sort();
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readSkeleton(courseDir: string) {
  const result = courseSeedSchema.safeParse(
    await readJson(new URL(`./${courseDir}/course.seed.json`, import.meta.url)),
  );

  if (!result.success) {
    throw new Error(
      `Semilla inválida: ${result.error.issues.length} problema(s) en ${courseDir}/course.seed.json\n${describeIssues(result.error.issues)}`,
    );
  }

  return result.data;
}

async function readUnitFiles(courseDir: string): Promise<CourseUnitFileEntry[]> {
  const unitsDir = new URL(`./${courseDir}/units/`, import.meta.url);
  const entries: CourseUnitFileEntry[] = [];

  for (const fileName of await listUnitFiles(unitsDir)) {
    const result = courseUnitFileSchema.safeParse(
      await readJson(new URL(fileName, unitsDir)),
    );

    if (!result.success) {
      throw new Error(
        `Archivo de unidad inválido: ${courseDir}/units/${fileName}\n${describeIssues(result.error.issues)}`,
      );
    }

    entries.push({ fileName, unit: result.data });
  }

  return entries;
}

async function readCourseSeed(courseDir: string) {
  const skeleton = await readSkeleton(courseDir);
  const files = await readUnitFiles(courseDir);
  const { seed: merged, problems } = mergeCourseSeed(skeleton, files);

  if (problems.length > 0) {
    throw new Error(
      `Semilla de ${courseDir} con ${problems.length} problema(s) al fusionar los archivos de unidad:\n${problems.map((problem) => `  · ${problem}`).join("\n")}`,
    );
  }

  const result = courseSeedSchema.safeParse(merged);

  if (!result.success) {
    throw new Error(
      `Semilla fusionada inválida: ${result.error.issues.length} problema(s) en ${courseDir}\n${describeIssues(result.error.issues)}`,
    );
  }

  return result.data;
}

type CourseSeed = Awaited<ReturnType<typeof readCourseSeed>>;

/** Datos de examen de cada ejercicio declarado en las unidades, por slug. */
function exerciseFactsBySlug(seed: CourseSeed): ReadonlyMap<string, FormExerciseFacts> {
  const facts = new Map<string, FormExerciseFacts>();

  for (const stage of seed.stages) {
    for (const module of stage.modules) {
      for (const unit of module.units) {
        for (const exercise of unit.exercises) {
          facts.set(exercise.slug, {
            type: exercise.type,
            examPool: exercise.exam?.pool ?? "unit",
            certification: exercise.exam?.certification ?? null,
            domain: exercise.exam?.domain ?? null,
            quizKind: exercise.quiz?.kind ?? null,
          });
        }
      }
    }
  }

  return facts;
}

async function main(): Promise<void> {
  const courseSlug = parseCourseArgument(process.argv[2]);
  const courseDir = COURSE_DIRS[courseSlug];
  const seed = await readCourseSeed(courseDir);
  const examFormFiles = await readExamFormFiles(new URL(`./${courseDir}/`, import.meta.url));

  prepareDatabaseEnv();

  const prisma = new PrismaClient();

  try {
    const { course } = seed;
    const courseFields = {
      title: course.title,
      objective: course.objective,
      notice: course.notice,
      order: course.order,
      isPublished: course.isPublished,
    };

    await prisma.course.upsert({
      where: { slug: course.slug },
      create: { slug: course.slug, ...courseFields },
      update: courseFields,
    });

    const resourceIdsBySlug = await upsertResources(prisma, seed.resources);
    const previousUnitCode = previousUnitCodes(seed.stages);

    for (const stage of seed.stages) {
      await upsertStageTree(prisma, stage, {
        courseSlug: course.slug,
        resourceIdsBySlug,
        previousUnitCode,
      });
    }

    const examForms = await upsertExamForms(prisma, examFormFiles, exerciseFactsBySlug(seed));

    const { stages, publishedStages, modules, units, exercises } = await countCourse(
      prisma,
      course.slug,
    );

    const expected = {
      stages: seed.stages.length,
      modules: seed.stages.reduce((total, stage) => total + stage.modules.length, 0),
      units: seed.stages.reduce(
        (total, stage) =>
          total + stage.modules.reduce((count, module) => count + module.units.length, 0),
        0,
      ),
    };

    console.log(
      `Semilla aplicada: ${stages} etapas (${publishedStages} publicadas), ${modules} módulos, ${units} unidades, ${exercises} ejercicios.`,
    );
    console.log(`Formas de simulacro: ${examForms}`);
    console.log(
      `Declarado en ${courseDir}/course.seed.json: ${expected.stages} etapas, ${expected.modules} módulos, ${expected.units} unidades.`,
    );

    if (
      stages !== expected.stages ||
      modules !== expected.modules ||
      units !== expected.units
    ) {
      console.warn(
        "Aviso: la base de datos tiene filas que no están declaradas en la semilla (no se borran a propósito).",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
