/**
 * Biblioteca de la semilla: escritura idempotente de recursos y de árboles de
 * etapa (módulos, unidades, ejercicios y lecciones), compartida por la semilla
 * de la ruta por defecto y por las de las demás rutas.
 */
import type { PrismaClient } from "@prisma/client";
import type {
  ContentSeedExercise,
  ContentSeedResource,
  ContentSeedStage,
  CourseSeedStage,
  CourseSlug,
} from "@codeai/shared";

/** Mismo valor por defecto que `apps/api/src/config/env.ts`. */
const DATABASE_URL_FALLBACK =
  "postgresql://codeai:codeai@localhost:5433/codeai?schema=public";

/**
 * Rutas candidatas de `.env`: el proceso puede arrancar desde la raíz del
 * monorepo o desde `apps/api` (caso de `npm run db:seed`).
 */
const ENV_FILES = [".env", "apps/api/.env"] as const;

function loadEnvFile(): void {
  for (const path of ENV_FILES) {
    try {
      process.loadEnvFile(path);
      return;
    } catch {
      // Siguiente candidato: la ausencia de `.env` no es un error.
    }
  }
}

export function prepareDatabaseEnv(): void {
  loadEnvFile();
  process.env.DATABASE_URL ??= DATABASE_URL_FALLBACK;
}

export function describeIssues(issues: readonly { path: (string | number)[]; message: string }[]): string {
  return issues
    .map((issue) => `  · ${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
    .join("\n");
}

/** Lo que el cliente puede ver del ejercicio: nunca la respuesta ni las explicaciones. */
function exerciseConfig(exercise: ContentSeedExercise) {
  if (exercise.quiz !== null) {
    return { options: exercise.quiz.options.map(({ id, text }) => ({ id, text })) };
  }

  if (exercise.memory !== null) {
    return {
      ...(exercise.memory.mode === "flip" ? {} : { mode: exercise.memory.mode }),
      pairs: exercise.memory.pairs.map(({ id, term, definition }) => ({ id, term, definition })),
      ...(exercise.memory.intro === null ? {} : { intro: exercise.memory.intro }),
    };
  }

  return exercise.starterCode === null ? {} : { starterCode: exercise.starterCode };
}

/** Lo que solo conoce el servidor: solución, respuesta correcta y explicaciones. */
function exerciseSolution(exercise: ContentSeedExercise) {
  if (exercise.quiz !== null) {
    return {
      correctOptionId: exercise.quiz.correctOptionId,
      explanations: Object.fromEntries(
        exercise.quiz.options.map((option) => [option.id, option.explanation]),
      ),
    };
  }
  if (exercise.flashcard !== null) {
    return { back: exercise.flashcard.back };
  }

  return exercise.solution ?? undefined;
}

/** Prerrequisitos declarados; si no hay ninguno, la unidad anterior del currículo. */
function unitPrerequisites(
  declared: readonly string[] | undefined,
  previous: string | undefined,
): string[] {
  if (declared && declared.length > 0) {
    return [...declared];
  }

  return previous ? [previous] : [];
}

/**
 * Mapa unidad → unidad anterior en el orden etapa → módulo → unidad (por `order`).
 * El seed no declara prerrequisitos: sin ellos ninguna unidad se bloquea y el
 * currículo no se desbloquea de forma progresiva. Por defecto cada unidad
 * exige dominar la anterior.
 */
export function previousUnitCodes(
  stages: readonly (ContentSeedStage | CourseSeedStage)[],
): ReadonlyMap<string, string> {
  const previousUnitCode = new Map<string, string>();
  let lastCode: string | undefined;

  for (const stage of [...stages].sort((a, b) => a.order - b.order)) {
    for (const module of [...stage.modules].sort((a, b) => a.order - b.order)) {
      for (const unit of [...module.units].sort((a, b) => a.order - b.order)) {
        if (lastCode !== undefined) {
          previousUnitCode.set(unit.code, lastCode);
        }

        lastCode = unit.code;
      }
    }
  }

  return previousUnitCode;
}

/** Devuelve el id de cada recurso indexado por su slug. */
export async function upsertResources(
  prisma: PrismaClient,
  resources: readonly ContentSeedResource[],
): Promise<ReadonlyMap<string, string>> {
  const resourceIdsBySlug = new Map<string, string>();

  for (const resource of resources) {
    const resourceFields = {
      title: resource.title,
      provider: resource.provider,
      url: resource.url,
      type: resource.type,
      language: resource.language,
      level: resource.level,
      durationMin: resource.durationMin,
      license: resource.license,
      embedAllowed: resource.embedAllowed,
      status: resource.status,
      notes: resource.notes,
    };

    const storedResource = await prisma.resource.upsert({
      where: { slug: resource.slug },
      create: { slug: resource.slug, ...resourceFields },
      update: resourceFields,
    });

    resourceIdsBySlug.set(resource.slug, storedResource.id);
  }

  return resourceIdsBySlug;
}

export async function upsertStageTree(
  prisma: PrismaClient,
  stage: ContentSeedStage | CourseSeedStage,
  context: {
    courseSlug: CourseSlug;
    resourceIdsBySlug: ReadonlyMap<string, string>;
    previousUnitCode: ReadonlyMap<string, string>;
  },
): Promise<void> {
  const { courseSlug, resourceIdsBySlug, previousUnitCode } = context;

  const stageFields = {
    slug: stage.slug,
    title: stage.title,
    objective: stage.objective,
    level: stage.level,
    estimatedMin: stage.estimatedMin,
    order: stage.order,
    isPublished: stage.isPublished,
    courseSlug,
  };

  await prisma.stage.upsert({
    where: { id: stage.id },
    create: { id: stage.id, ...stageFields },
    update: stageFields,
  });

  for (const module of stage.modules) {
    const moduleFields = {
      title: module.title,
      order: module.order,
      isPublished: module.isPublished,
      stageId: stage.id,
    };

    const storedModule = await prisma.module.upsert({
      where: { code: module.code },
      create: { code: module.code, ...moduleFields },
      update: moduleFields,
    });

    for (const unit of module.units) {
      const unitFields = {
        title: unit.title,
        objective: unit.objective,
        estimatedMin: unit.estimatedMin,
        order: unit.order,
        isPublished: unit.isPublished,
        prerequisiteIds: unitPrerequisites(unit.prerequisiteIds, previousUnitCode.get(unit.code)),
        moduleId: storedModule.id,
      };

      const storedUnit = await prisma.unit.upsert({
        where: { code: unit.code },
        create: { code: unit.code, ...unitFields },
        update: unitFields,
      });

      for (const exercise of unit.exercises) {
        const exerciseFields = {
          unitId: storedUnit.id,
          type: exercise.type,
          title: exercise.title,
          statement: exercise.statement,
          config: exerciseConfig(exercise),
          solution: exerciseSolution(exercise),
          ladder: exercise.ladder,
          difficulty: exercise.difficulty,
          concepts: exercise.concepts,
          competencies: exercise.competencies,
          estimatedMin: exercise.estimatedMin,
          language: exercise.language,
          sources: exercise.sources,
          maxAttempts: exercise.maxAttempts,
          isPublished: exercise.isPublished,
          order: exercise.order,
        };

        const storedExercise = await prisma.exercise.upsert({
          where: { slug: exercise.slug },
          create: { slug: exercise.slug, ...exerciseFields },
          update: exerciseFields,
        });

        // Pistas y pruebas se reconcilian con la semilla: lo retirado del JSON
        // desaparece de la base de datos y lo demás se actualiza en su sitio.
        await prisma.exerciseHint.deleteMany({
          where: {
            exerciseId: storedExercise.id,
            level: { notIn: exercise.hints.map((hint) => hint.level) },
          },
        });

        for (const hint of exercise.hints) {
          await prisma.exerciseHint.upsert({
            where: {
              exerciseId_level: { exerciseId: storedExercise.id, level: hint.level },
            },
            create: { exerciseId: storedExercise.id, level: hint.level, text: hint.text },
            update: { text: hint.text },
          });
        }

        await prisma.exerciseTest.deleteMany({
          where: {
            exerciseId: storedExercise.id,
            name: { notIn: exercise.tests.map((test) => test.name) },
          },
        });

        for (const test of exercise.tests) {
          const testFields = { isHidden: test.isHidden, weight: test.weight, spec: test.spec };
          const existing = await prisma.exerciseTest.findFirst({
            where: { exerciseId: storedExercise.id, name: test.name },
            select: { id: true },
          });

          if (existing) {
            await prisma.exerciseTest.update({ where: { id: existing.id }, data: testFields });
          } else {
            await prisma.exerciseTest.create({
              data: { exerciseId: storedExercise.id, name: test.name, ...testFields },
            });
          }
        }
      }

      for (const lesson of unit.lessons) {
        const lessonFields = {
          title: lesson.title,
          estimatedMin: lesson.estimatedMin,
          order: lesson.order,
          isPublished: lesson.isPublished,
          content: lesson.content,
          steps: lesson.steps,
          unitId: storedUnit.id,
        };

        const storedLesson = await prisma.lesson.upsert({
          where: { slug: lesson.slug },
          create: { slug: lesson.slug, ...lessonFields },
          update: lessonFields,
        });

        const linkedResourceIds = lesson.resources.map((link) => {
          const resourceId = resourceIdsBySlug.get(link.resourceSlug);

          if (resourceId === undefined) {
            throw new Error(
              `Recurso sin resolver: ${link.resourceSlug} (lección ${lesson.slug})`,
            );
          }

          return resourceId;
        });

        // Reemplaza todos los enlaces de la lección por los declarados en la
        // semilla: evita que un recurso retirado del JSON quede huérfano en BD.
        await prisma.lessonResource.deleteMany({
          where: { lessonId: storedLesson.id, resourceId: { notIn: linkedResourceIds } },
        });

        for (const [index, link] of lesson.resources.entries()) {
          const resourceId = linkedResourceIds[index]!;
          const linkFields = { order: link.order, note: link.note };

          await prisma.lessonResource.upsert({
            where: { lessonId_resourceId: { lessonId: storedLesson.id, resourceId } },
            create: { lessonId: storedLesson.id, resourceId, ...linkFields },
            update: linkFields,
          });
        }
      }
    }
  }
}

export async function countCourse(
  prisma: PrismaClient,
  courseSlug: CourseSlug,
): Promise<{ stages: number; publishedStages: number; modules: number; units: number; exercises: number }> {
  // Los conteos se leen de la base de datos: es la prueba de idempotencia
  // que se repite en S2-T9 al ejecutar la semilla dos veces seguidas.
  const [stages, publishedStages, modules, units, exercises] = await Promise.all([
    prisma.stage.count({ where: { courseSlug } }),
    prisma.stage.count({ where: { courseSlug, isPublished: true } }),
    prisma.module.count({ where: { stage: { courseSlug } } }),
    prisma.unit.count({ where: { module: { stage: { courseSlug } } } }),
    prisma.exercise.count({ where: { unit: { module: { stage: { courseSlug } } } } }),
  ]);

  return { stages, publishedStages, modules, units, exercises };
}
