import { z } from "zod";

import {
  certificationCodeSchema,
  certificationForStageId,
  examTaskBelongsToDomain,
  isExamDomainOf,
} from "./certification";
import {
  contentSeedExerciseSchema,
  contentSeedLessonSchema,
  contentSeedModuleSchema,
  contentSeedResourceSchema,
  contentSeedStageSchema,
  contentSeedUnitSchema,
  exerciseRuleViolations,
} from "./content";
import {
  courseForStageId,
  courseSlugSchema,
  DEFAULT_COURSE_SLUG,
  isCompetencyOfCourse,
  isKnownStageId,
  MODULE_CODE_PATTERN,
  moduleCodePrefix,
  stageSlugMatchesCourse,
  UNIT_CODE_PATTERN,
  unitCodePrefix,
} from "./course";

export const courseSeedCourseSchema = z.object({
  slug: courseSlugSchema.refine(
    (slug) => slug !== DEFAULT_COURSE_SLUG,
    "La ruta por defecto se siembra con content.seed.json",
  ),
  title: z.string().min(1),
  objective: z.string().min(1),
  notice: z.string().min(1).nullable(),
  order: z.number().int().nonnegative(),
  isPublished: z.boolean(),
});

/** Bancos de un ejercicio de examen: el de la unidad o el reservado al simulacro. */
export const EXAM_POOLS = ["unit", "reserved"] as const;

/**
 * Metadatos de examen de un ejercicio de las rutas con certificación. `task` se
 * comprueba por formato y por su número de dominio, no contra una lista: las
 * guías no publican todas las tareas (`aws-guias-examen.md`).
 */
export const courseSeedExamSchema = z
  .object({
    certification: certificationCodeSchema,
    domain: z.number().int().min(1).max(6),
    task: z
      .string()
      .regex(/^\d{1,2}\.\d{1,2}$/, "La tarea es «dominio.tarea», por ejemplo 1.2")
      .nullable()
      .default(null),
    pool: z.enum(EXAM_POOLS).default("unit"),
  })
  .strict();

export type CourseSeedExam = z.infer<typeof courseSeedExamSchema>;

export const courseSeedExerciseSchema = contentSeedExerciseSchema.extend({
  exam: courseSeedExamSchema.nullable().default(null),
});

export type CourseSeedExercise = z.infer<typeof courseSeedExerciseSchema>;

/** Reutiliza los esquemas de content.ts cambiando sólo códigos, ids y slugs. */
export const courseSeedUnitSchema = contentSeedUnitSchema.extend({
  code: z.string().regex(UNIT_CODE_PATTERN),
  prerequisiteIds: z.array(z.string().regex(UNIT_CODE_PATTERN)).default([]),
  exercises: z.array(courseSeedExerciseSchema).default([]),
});

export const courseSeedModuleSchema = contentSeedModuleSchema.extend({
  code: z.string().regex(MODULE_CODE_PATTERN),
  units: z.array(courseSeedUnitSchema),
});

export const courseSeedStageSchema = contentSeedStageSchema.extend({
  id: z.number().int().refine(isKnownStageId, "La etapa debe pertenecer a una ruta"),
  slug: z.string().regex(/^[a-z]+\d{1,2}-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  modules: z.array(courseSeedModuleSchema).min(1),
});

/**
 * Semilla de una ruta secundaria. Mantiene las mismas garantías que
 * `contentSeedSchema` pero con el espacio de nombres de cada ruta: el id de
 * etapa debe pertenecer a la ruta declarada, los códigos llevan su prefijo y
 * las competencias se validan contra el rango de la ruta.
 */
export const courseSeedSchema = z
  .object({
    course: courseSeedCourseSchema,
    resources: z.array(contentSeedResourceSchema).default([]),
    stages: z.array(courseSeedStageSchema).min(1),
  })
  .superRefine((seed, ctx) => {
    const fail = (message: string, path: (string | number)[]): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    };

    const stageIds = new Set<number>();
    const stageSlugs = new Set<string>();
    const stageOrders = new Set<number>();
    const moduleCodes = new Set<string>();
    const unitCodes = new Set<string>();
    const lessonSlugs = new Set<string>();
    const exerciseSlugs = new Set<string>();
    const resourceSlugs = new Set<string>();

    for (const [resourceIndex, resource] of seed.resources.entries()) {
      const path: (string | number)[] = ["resources", resourceIndex, "slug"];

      if (resourceSlugs.has(resource.slug)) {
        fail(`Recurso duplicado: slug ${resource.slug}`, path);
      }
      resourceSlugs.add(resource.slug);
    }

    for (const [stageIndex, stage] of seed.stages.entries()) {
      const stagePath: (string | number)[] = ["stages", stageIndex];

      if (courseForStageId(stage.id)?.slug !== seed.course.slug) {
        fail(
          `La etapa ${stage.id} no pertenece a la ruta ${seed.course.slug}`,
          [...stagePath, "id"],
        );
      }
      if (!stageSlugMatchesCourse(stage.slug, stage.id)) {
        fail(
          `El slug ${stage.slug} no corresponde a la etapa ${stage.id}`,
          [...stagePath, "slug"],
        );
      }
      if (stageIds.has(stage.id)) {
        fail(`Etapa duplicada: id ${stage.id}`, [...stagePath, "id"]);
      }
      if (stageSlugs.has(stage.slug)) {
        fail(`Etapa duplicada: slug ${stage.slug}`, [...stagePath, "slug"]);
      }
      if (stageOrders.has(stage.order)) {
        fail(`Orden de etapa repetido: ${stage.order}`, [...stagePath, "order"]);
      }
      stageIds.add(stage.id);
      stageSlugs.add(stage.slug);
      stageOrders.add(stage.order);

      const moduleOrders = new Set<number>();
      const expectedModulePrefix = moduleCodePrefix(stage.id);

      for (const [moduleIndex, module] of stage.modules.entries()) {
        const modulePath: (string | number)[] = [...stagePath, "modules", moduleIndex];

        if (moduleCodes.has(module.code)) {
          fail(`Módulo duplicado: ${module.code}`, [...modulePath, "code"]);
        }
        if (moduleOrders.has(module.order)) {
          fail(
            `Orden de módulo repetido en la etapa ${stage.id}: ${module.order}`,
            [...modulePath, "order"],
          );
        }
        if (expectedModulePrefix === null || !module.code.startsWith(expectedModulePrefix)) {
          fail(
            `El módulo ${module.code} no pertenece a la etapa ${stage.id}`,
            [...modulePath, "code"],
          );
        }
        moduleCodes.add(module.code);
        moduleOrders.add(module.order);

        const unitOrders = new Set<number>();
        const lessonOrders = new Set<number>();
        const exerciseOrders = new Set<number>();
        const expectedUnitPrefix = unitCodePrefix(module.code);

        for (const [unitIndex, unit] of module.units.entries()) {
          const unitPath: (string | number)[] = [...modulePath, "units", unitIndex];

          if (unitCodes.has(unit.code)) {
            fail(`Unidad duplicada: ${unit.code}`, [...unitPath, "code"]);
          }
          if (unitOrders.has(unit.order)) {
            fail(
              `Orden de unidad repetido en ${module.code}: ${unit.order}`,
              [...unitPath, "order"],
            );
          }
          if (expectedUnitPrefix === null || !unit.code.startsWith(expectedUnitPrefix)) {
            fail(
              `La unidad ${unit.code} no pertenece al módulo ${module.code}`,
              [...unitPath, "code"],
            );
          }
          unitOrders.add(unit.order);
          unitCodes.add(unit.code);

          for (const [lessonIndex, lesson] of unit.lessons.entries()) {
            const lessonPath: (string | number)[] = [...unitPath, "lessons", lessonIndex];

            if (lessonSlugs.has(lesson.slug)) {
              fail(`Lección duplicada: slug ${lesson.slug}`, [...lessonPath, "slug"]);
            }
            if (lessonOrders.has(lesson.order)) {
              fail(
                `Orden de lección repetido en ${unit.code}: ${lesson.order}`,
                [...lessonPath, "order"],
              );
            }
            lessonSlugs.add(lesson.slug);
            lessonOrders.add(lesson.order);

            for (const [resourceLinkIndex, link] of lesson.resources.entries()) {
              if (!resourceSlugs.has(link.resourceSlug)) {
                fail(
                  `La lección ${lesson.slug} enlaza un recurso inexistente: ${link.resourceSlug}`,
                  [...lessonPath, "resources", resourceLinkIndex, "resourceSlug"],
                );
              }
            }
          }

          for (const [exerciseIndex, exercise] of unit.exercises.entries()) {
            const exercisePath: (string | number)[] = [...unitPath, "exercises", exerciseIndex];

            if (exerciseSlugs.has(exercise.slug)) {
              fail(`Ejercicio duplicado: slug ${exercise.slug}`, [...exercisePath, "slug"]);
            }
            if (exerciseOrders.has(exercise.order)) {
              fail(
                `Orden de ejercicio repetido en ${unit.code}: ${exercise.order}`,
                [...exercisePath, "order"],
              );
            }
            exerciseSlugs.add(exercise.slug);
            exerciseOrders.add(exercise.order);

            for (const message of exerciseRuleViolations(exercise)) {
              fail(`Ejercicio ${exercise.slug}: ${message}`, exercisePath);
            }

            const exam = exercise.exam;

            if (exam !== null) {
              if (certificationForStageId(stage.id)?.code !== exam.certification) {
                fail(
                  `Ejercicio ${exercise.slug}: la certificación ${exam.certification} no corresponde a la etapa ${stage.id}`,
                  exercisePath,
                );
              }
              if (!isExamDomainOf(exam.certification, exam.domain)) {
                fail(
                  `Ejercicio ${exercise.slug}: el dominio ${exam.domain} no existe en ${exam.certification}`,
                  exercisePath,
                );
              }
              if (exam.task !== null && !examTaskBelongsToDomain(exam.task, exam.domain)) {
                fail(
                  `Ejercicio ${exercise.slug}: la tarea ${exam.task} no pertenece al dominio ${exam.domain}`,
                  exercisePath,
                );
              }
              if (exercise.type !== "QUIZ") {
                fail(`Ejercicio ${exercise.slug}: solo un QUIZ declara exam`, exercisePath);
              }
            } else if (exercise.type === "QUIZ" && certificationForStageId(stage.id) !== null) {
              fail(
                `Ejercicio ${exercise.slug}: un QUIZ de la etapa ${stage.id} requiere exam`,
                exercisePath,
              );
            }

            for (const [competencyIndex, code] of exercise.competencies.entries()) {
              if (!isCompetencyOfCourse(code, seed.course.slug)) {
                fail(
                  `La competencia ${code} no pertenece a la ruta ${seed.course.slug}`,
                  [...exercisePath, "competencies", competencyIndex],
                );
              }
            }
          }
        }
      }
    }

    for (const [stageIndex, stage] of seed.stages.entries()) {
      for (const [moduleIndex, module] of stage.modules.entries()) {
        for (const [unitIndex, unit] of module.units.entries()) {
          for (const [prerequisiteIndex, prerequisiteId] of unit.prerequisiteIds.entries()) {
            if (!unitCodes.has(prerequisiteId)) {
              fail(`Prerrequisito inexistente: ${prerequisiteId}`, [
                "stages",
                stageIndex,
                "modules",
                moduleIndex,
                "units",
                unitIndex,
                "prerequisiteIds",
                prerequisiteIndex,
              ]);
            }
          }
        }
      }
    }
  });

export type CourseSeed = z.infer<typeof courseSeedSchema>;
export type CourseSeedStage = z.infer<typeof courseSeedStageSchema>;
export type CourseSeedModule = z.infer<typeof courseSeedModuleSchema>;
export type CourseSeedUnit = z.infer<typeof courseSeedUnitSchema>;

/** Contenido de `aws/units/<código>.json`. */
export const courseUnitFileSchema = z
  .object({
    code: z.string().regex(UNIT_CODE_PATTERN),
    lessons: z.array(contentSeedLessonSchema).min(1),
    exercises: z.array(courseSeedExerciseSchema).default([]),
  })
  .strict();

export type CourseUnitFile = z.infer<typeof courseUnitFileSchema>;

export interface CourseUnitFileEntry {
  readonly fileName: string;
  readonly unit: CourseUnitFile;
}

/**
 * Inserta lecciones y ejercicios de cada archivo en su unidad. No valida el
 * resultado (el llamador lo vuelve a pasar por `courseSeedSchema`) ni lee
 * archivos (eso corresponde al cargador). Cada archivo que incumple una regla
 * se ignora y su motivo se añade a `problems`.
 */
export function mergeCourseSeed(
  skeleton: CourseSeed,
  files: readonly CourseUnitFileEntry[],
): { seed: CourseSeed; problems: string[] } {
  const problems: string[] = [];

  const unitsByCode = new Map<string, CourseSeedUnit>();
  for (const stage of skeleton.stages) {
    for (const module of stage.modules) {
      for (const unit of module.units) {
        unitsByCode.set(unit.code, unit);
      }
    }
  }

  const mergedUnits = new Map<string, CourseUnitFile>();

  for (const entry of files) {
    const expectedFileName = `${entry.unit.code}.json`;

    if (entry.fileName !== expectedFileName) {
      problems.push(
        `El archivo ${entry.fileName} no corresponde a la unidad ${entry.unit.code}; se esperaba ${expectedFileName}`,
      );
      continue;
    }

    const unit = unitsByCode.get(entry.unit.code);

    if (!unit) {
      problems.push(
        `La unidad ${entry.unit.code} del archivo ${entry.fileName} no existe en el esqueleto`,
      );
      continue;
    }
    if (mergedUnits.has(unit.code)) {
      problems.push(`La unidad ${unit.code} está declarada en más de un archivo`);
      continue;
    }
    if (unit.lessons.length > 0 || unit.exercises.length > 0) {
      problems.push(
        `La unidad ${unit.code} del esqueleto ya trae lecciones o ejercicios; una sola fuente por unidad`,
      );
      continue;
    }

    mergedUnits.set(unit.code, entry.unit);
  }

  const seed: CourseSeed = {
    ...skeleton,
    stages: skeleton.stages.map((stage) => ({
      ...stage,
      modules: stage.modules.map((module) => ({
        ...module,
        units: module.units.map((unit) => {
          const file = mergedUnits.get(unit.code);

          if (!file) {
            return unit;
          }

          return { ...unit, lessons: file.lessons, exercises: file.exercises };
        }),
      })),
    })),
  };

  return { seed, problems };
}
