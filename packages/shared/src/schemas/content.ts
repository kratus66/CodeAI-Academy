import { z } from "zod";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import { EXERCISE_TYPES, LADDERS } from "../enums/exercise";
import { RESOURCE_STATUSES, RESOURCE_TYPES } from "../enums/resource";
import { paginatedSchema } from "./common";

/** Etapas del currículo maestro: E0…E11. */
export const CURRICULUM_STAGE_COUNT = 12;

/** Niveles del currículo: 1 = fundamentos, 4 = profesionalización. */
export const STAGE_LEVEL_MIN = 1;
export const STAGE_LEVEL_MAX = 4;

export const stageLevelSchema = z
  .number()
  .int()
  .min(STAGE_LEVEL_MIN)
  .max(STAGE_LEVEL_MAX);

/**
 * Parámetros de paginación comunes. Se usa `coerce` porque los query strings
 * llegan como texto; un valor no numérico cae en el `400` de validación.
 */
const pageQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: "La página debe ser un número entero" })
    .int("La página debe ser un número entero")
    .min(1, "La página debe ser 1 o mayor")
    .default(1),
  pageSize: z.coerce
    .number({ invalid_type_error: "El tamaño de página debe ser un número entero" })
    .int("El tamaño de página debe ser un número entero")
    .min(1, "El tamaño de página debe ser 1 o mayor")
    .max(PAGE_SIZE_MAX, `El tamaño de página no puede superar ${PAGE_SIZE_MAX}`)
    .default(PAGE_SIZE_DEFAULT),
});

/** `GET /api/content/stages?page&pageSize&level` */
export const stageListQuerySchema = pageQuerySchema
  .extend({
    level: z.coerce
      .number({ invalid_type_error: "El nivel debe ser un número entero" })
      .int("El nivel debe ser un número entero")
      .min(
        STAGE_LEVEL_MIN,
        `El nivel debe estar entre ${STAGE_LEVEL_MIN} y ${STAGE_LEVEL_MAX}`,
      )
      .max(
        STAGE_LEVEL_MAX,
        `El nivel debe estar entre ${STAGE_LEVEL_MIN} y ${STAGE_LEVEL_MAX}`,
      )
      .optional(),
  })
  .strict();

export type StageListQuery = z.infer<typeof stageListQuerySchema>;

/** `GET /api/content/resources?page&pageSize&stage&type` */
export const resourceListQuerySchema = pageQuerySchema
  .extend({
    stage: z
      .coerce
      .number({ invalid_type_error: "La etapa debe ser un número entero" })
      .int("La etapa debe ser un número entero")
      .min(0, `La etapa debe estar entre 0 y ${CURRICULUM_STAGE_COUNT - 1}`)
      .max(
        CURRICULUM_STAGE_COUNT - 1,
        `La etapa debe estar entre 0 y ${CURRICULUM_STAGE_COUNT - 1}`,
      )
      .optional(),
    type: z.enum(RESOURCE_TYPES).optional(),
  })
  .strict();

export type ResourceListQuery = z.infer<typeof resourceListQuerySchema>;

/**
 * Parámetros de ruta. Se validan antes del servicio para que un `:id` con
 * letras o un código mal formado devuelva `400 VALIDATION_ERROR` y no un `404`
 * que oculte un error del cliente.
 */
const stageIdParamMessage = "El id de etapa debe ser un número entero";
const stageIdRangeMessage = `El id de etapa debe estar entre 0 y ${CURRICULUM_STAGE_COUNT - 1}`;

export const stageIdParamsSchema = z
  .object({
    id: z.coerce
      .number({ invalid_type_error: stageIdParamMessage })
      .int(stageIdParamMessage)
      .min(0, stageIdRangeMessage)
      .max(CURRICULUM_STAGE_COUNT - 1, stageIdRangeMessage),
  })
  .strict();

export type StageIdParams = z.infer<typeof stageIdParamsSchema>;

export const unitCodeParamsSchema = z
  .object({
    code: z
      .string()
      .regex(
        /^U\d{1,2}\.\d{1,2}\.\d{1,2}$/,
        "Formato esperado: U<etapa>.<módulo>.<unidad>",
      ),
  })
  .strict();

export type UnitCodeParams = z.infer<typeof unitCodeParamsSchema>;

export const lessonSlugParamsSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug en minúsculas separado por guiones"),
  })
  .strict();

export type LessonSlugParams = z.infer<typeof lessonSlugParamsSchema>;

const estimatedMinSchema = z.number().int().positive().nullable();

/** Ficha mínima de una etapa en el catálogo. */
export const stageSummarySchema = z.object({
  id: z.number().int().min(0).max(CURRICULUM_STAGE_COUNT - 1),
  slug: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  level: stageLevelSchema,
  estimatedMin: estimatedMinSchema,
  order: z.number().int().nonnegative(),
  moduleCount: z.number().int().nonnegative(),
});

export type StageSummary = z.infer<typeof stageSummarySchema>;

/** Módulo dentro de una etapa; `unitCount` cuenta solo unidades publicadas. */
export const moduleSummarySchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  unitCount: z.number().int().nonnegative(),
});

export type ModuleSummary = z.infer<typeof moduleSummarySchema>;

export const stageDetailSchema = stageSummarySchema.extend({
  modules: z.array(moduleSummarySchema),
});

export type StageDetail = z.infer<typeof stageDetailSchema>;

/** Ficha mínima de una unidad en el mapa curricular. */
export const unitSummarySchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  estimatedMin: estimatedMinSchema,
  order: z.number().int().nonnegative(),
  moduleCode: z.string().min(1),
  prerequisiteIds: z.array(z.string().min(1)),
});

export type UnitSummary = z.infer<typeof unitSummarySchema>;

export const lessonSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  estimatedMin: estimatedMinSchema,
  order: z.number().int().nonnegative(),
});

export type LessonSummary = z.infer<typeof lessonSummarySchema>;

/**
 * Ejercicio tal como lo ve el estudiante: sin `solution`, sin `sources` y sin
 * pruebas ocultas. La corrección completa solo la ve el motor de evaluación.
 */
export const exerciseSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(EXERCISE_TYPES),
  title: z.string().min(1),
  statement: z.string().min(1),
  ladder: z.enum(LADDERS),
  difficulty: z.number().int().min(1).max(5),
  concepts: z.array(z.string().min(1)),
  competencies: z.array(z.string().min(1)),
  estimatedMin: estimatedMinSchema,
  order: z.number().int().nonnegative(),
});

export type ExerciseSummary = z.infer<typeof exerciseSummarySchema>;

export const unitDetailSchema = unitSummarySchema.extend({
  lessons: z.array(lessonSummarySchema),
  exercises: z.array(exerciseSummarySchema),
});

export type UnitDetail = z.infer<typeof unitDetailSchema>;


/** Bloques admitidos en el contenido estructurado de una lección. */
export const LESSON_CONTENT_BLOCK_TYPES = [
  "paragraph",
  "list",
  "code",
  "callout",
  "diagram",
  "table",
] as const;

export const lessonContentBlockSchema = z.object({
  type: z.enum(LESSON_CONTENT_BLOCK_TYPES),
  title: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  items: z.array(z.string().min(1)).optional(),
  language: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
});

export type LessonContentBlock = z.infer<typeof lessonContentBlockSchema>;

/** Los siete pasos de la microestructura (plantilla-leccion.md). */
export const LESSON_STEP_KINDS = [
  "objective",
  "explanation",
  "guided_practice",
  "independent_practice",
  "debug",
  "assessment",
  "transfer",
] as const;

export const lessonStepSchema = z.object({
  kind: z.enum(LESSON_STEP_KINDS),
  title: z.string().min(1),
  body: z.string().min(1),
});

export type LessonStep = z.infer<typeof lessonStepSchema>;

export const lessonContentSchema = z.array(lessonContentBlockSchema).min(1);

/** Sin los siete pasos la lección no se publica (y la API no la sirve). */
export const lessonStepsSchema = z
  .array(lessonStepSchema)
  .length(7, "Una lección publicada debe declarar exactamente 7 pasos");

/** Recurso del catálogo; solo se sirven los `VERIFIED`. */
export const resourceSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  provider: z.string().min(1),
  url: z.string().url(),
  type: z.enum(RESOURCE_TYPES),
  language: z.string().min(1),
  level: z.string().min(1).nullable(),
  durationMin: z.number().int().positive().nullable(),
  license: z.string().min(1).nullable(),
  embedAllowed: z.boolean(),
  status: z.enum(RESOURCE_STATUSES),
  reviewedAt: z.string().datetime().nullable(),
});

export type ResourceSummary = z.infer<typeof resourceSummarySchema>;

export const lessonResourceSchema = z.object({
  order: z.number().int().nonnegative(),
  note: z.string().min(1).nullable(),
  resource: resourceSummarySchema,
});

export type LessonResource = z.infer<typeof lessonResourceSchema>;

export const lessonDetailSchema = lessonSummarySchema.extend({
  unitCode: z.string().min(1),
  content: lessonContentSchema,
  steps: lessonStepsSchema,
  resources: z.array(lessonResourceSchema),
});

export type LessonDetail = z.infer<typeof lessonDetailSchema>;

export const stageListResponseSchema = paginatedSchema(stageSummarySchema);
export const stageDetailResponseSchema = z.object({ stage: stageDetailSchema });
export const unitDetailResponseSchema = z.object({ unit: unitDetailSchema });
export const lessonDetailResponseSchema = z.object({ lesson: lessonDetailSchema });
export const resourceListResponseSchema = paginatedSchema(resourceSummarySchema);

export type StageListResponse = z.infer<typeof stageListResponseSchema>;
export type StageDetailResponse = z.infer<typeof stageDetailResponseSchema>;
export type UnitDetailResponse = z.infer<typeof unitDetailResponseSchema>;
export type LessonDetailResponse = z.infer<typeof lessonDetailResponseSchema>;
export type ResourceListResponse = z.infer<typeof resourceListResponseSchema>;

// ─────────────────────── Semilla del currículo ───────────────────────
// La semilla es contenido versionado en el repositorio: se valida completa
// antes de tocar la base de datos (ver docs/03-arquitectura/modelo-datos.md §7).

const stageSlugPattern = /^e\d{1,2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const moduleCodePattern = /^M\d{1,2}\.\d{1,2}$/;
const unitCodePattern = /^U\d{1,2}\.\d{1,2}\.\d{1,2}$/;

const stageSlugSchema = z
  .string()
  .regex(stageSlugPattern, "El slug de etapa debe tener la forma e0-fundamentos-ia");
const moduleCodeSchema = z
  .string()
  .regex(moduleCodePattern, "El código de módulo debe tener la forma M0.1");
const unitCodeSchema = z
  .string()
  .regex(unitCodePattern, "El código de unidad debe tener la forma U0.1.1");

export const contentSeedUnitSchema = z.object({
  code: unitCodeSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  estimatedMin: estimatedMinSchema.default(null),
  order: z.number().int().positive(),
  isPublished: z.boolean(),
  prerequisiteIds: z.array(unitCodeSchema).default([]),
});

export type ContentSeedUnit = z.infer<typeof contentSeedUnitSchema>;

export const contentSeedModuleSchema = z.object({
  code: moduleCodeSchema,
  title: z.string().min(1),
  order: z.number().int().positive(),
  isPublished: z.boolean(),
  units: z.array(contentSeedUnitSchema),
});

export type ContentSeedModule = z.infer<typeof contentSeedModuleSchema>;

export const contentSeedStageSchema = z.object({
  id: z.number().int().min(0).max(CURRICULUM_STAGE_COUNT - 1),
  slug: stageSlugSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  level: stageLevelSchema,
  estimatedMin: estimatedMinSchema,
  order: z.number().int().positive(),
  isPublished: z.boolean(),
  modules: z.array(contentSeedModuleSchema).min(1),
});

export type ContentSeedStage = z.infer<typeof contentSeedStageSchema>;

/**
 * Valida la semilla completa: además de los tipos, comprueba que los
 * identificadores son únicos, que cada módulo/unidad pertenece a su etapa y que
 * los prerrequisitos apuntan a unidades declaradas.
 */
export const contentSeedSchema = z
  .object({
    stages: z
      .array(contentSeedStageSchema)
      .length(
        CURRICULUM_STAGE_COUNT,
        `La semilla debe declarar exactamente ${CURRICULUM_STAGE_COUNT} etapas`,
      ),
  })
  .superRefine((seed, ctx) => {
    const stageIds = new Set<number>();
    const stageSlugs = new Set<string>();
    const moduleCodes = new Set<string>();
    const unitCodes = new Set<string>();

    const fail = (message: string, path: (string | number)[]): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    };

    for (const [stageIndex, stage] of seed.stages.entries()) {
      const stagePath: (string | number)[] = ["stages", stageIndex];

      if (stageIds.has(stage.id)) {
        fail(`Etapa duplicada: id ${stage.id}`, [...stagePath, "id"]);
      }
      if (stageSlugs.has(stage.slug)) {
        fail(`Etapa duplicada: slug ${stage.slug}`, [...stagePath, "slug"]);
      }
      stageIds.add(stage.id);
      stageSlugs.add(stage.slug);

      const moduleOrders = new Set<number>();

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
        if (!module.code.startsWith(`M${stage.id}.`)) {
          fail(
            `El módulo ${module.code} no pertenece a la etapa ${stage.id}`,
            [...modulePath, "code"],
          );
        }
        moduleCodes.add(module.code);
        moduleOrders.add(module.order);

        const unitOrders = new Set<number>();

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
          if (!unit.code.startsWith(`U${stage.id}.`)) {
            fail(
              `La unidad ${unit.code} no pertenece a la etapa ${stage.id}`,
              [...unitPath, "code"],
            );
          }
          unitOrders.add(unit.order);
          unitCodes.add(unit.code);
        }
      }
    }

    for (const [stageIndex, stage] of seed.stages.entries()) {
      for (const [moduleIndex, module] of stage.modules.entries()) {
        for (const [unitIndex, unit] of module.units.entries()) {
          for (const [prerequisiteIndex, prerequisiteId] of unit.prerequisiteIds.entries()) {
            const path: (string | number)[] = [
              "stages",
              stageIndex,
              "modules",
              moduleIndex,
              "units",
              unitIndex,
              "prerequisiteIds",
              prerequisiteIndex,
            ];

            if (!unitCodes.has(prerequisiteId)) {
              fail(`Prerrequisito inexistente: ${prerequisiteId}`, path);
            }
            if (prerequisiteId === unit.code) {
              fail(`La unidad ${unit.code} no puede ser su propio prerrequisito`, path);
            }
          }
        }
      }
    }
  });

export type ContentSeed = z.infer<typeof contentSeedSchema>;
