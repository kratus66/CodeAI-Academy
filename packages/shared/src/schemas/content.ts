import { z } from "zod";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import { EXERCISE_TYPES, LADDERS } from "../enums/exercise";
import { RESOURCE_STATUSES, RESOURCE_TYPES } from "../enums/resource";
import { paginatedSchema } from "./common";
import {
  COMPETENCY_CODE_PATTERN,
  courseSlugSchema,
  isCompetencyOfCourse,
  isKnownStageId,
  UNIT_CODE_PATTERN,
} from "./course";
import { sandboxLanguageSchema } from "./sandbox";

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

/** Mensaje único para ids de etapa que no pertenecen a ninguna ruta. */
const STAGE_ID_MESSAGE = "La etapa debe pertenecer a una ruta (0–11 o 100–112)";

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
    course: courseSlugSchema.optional(),
  })
  .strict();

export type StageListQuery = z.infer<typeof stageListQuerySchema>;

/** `GET /api/content/courses?page&pageSize` */
export const courseListQuerySchema = pageQuerySchema.strict();
export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

/** `GET /api/content/resources?page&pageSize&stage&type` */
export const resourceListQuerySchema = pageQuerySchema
  .extend({
    stage: z
      .coerce
      .number({ invalid_type_error: "La etapa debe ser un número entero" })
      .int("La etapa debe ser un número entero")
      .refine(isKnownStageId, STAGE_ID_MESSAGE)
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

export const stageIdParamsSchema = z
  .object({
    id: z.coerce
      .number({ invalid_type_error: stageIdParamMessage })
      .int(stageIdParamMessage)
      .refine(isKnownStageId, STAGE_ID_MESSAGE),
  })
  .strict();

export type StageIdParams = z.infer<typeof stageIdParamsSchema>;

export const unitCodeParamsSchema = z
  .object({
    code: z
      .string()
      .regex(
        UNIT_CODE_PATTERN,
        "Formato esperado: U<etapa>.<módulo>.<unidad> o AWS-U<etapa>.<módulo>.<unidad>",
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
  id: z.number().int().refine(isKnownStageId, STAGE_ID_MESSAGE),
  slug: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  level: stageLevelSchema,
  estimatedMin: estimatedMinSchema,
  order: z.number().int().nonnegative(),
  moduleCount: z.number().int().nonnegative(),
});

export type StageSummary = z.infer<typeof stageSummarySchema>;

/**
 * Ficha mínima de una unidad en el mapa curricular. `stageId` viaja con la
 * unidad para que el cliente no tenga que deducir la etapa del código.
 */
export const unitSummarySchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  estimatedMin: estimatedMinSchema,
  order: z.number().int().nonnegative(),
  stageId: z.number().int().refine(isKnownStageId, STAGE_ID_MESSAGE),
  moduleCode: z.string().min(1),
  prerequisiteIds: z.array(z.string().min(1)),
});

export type UnitSummary = z.infer<typeof unitSummarySchema>;

/**
 * Módulo dentro de una etapa. `unitCount` y `units` cuentan solo unidades
 * publicadas; las unidades viajan en el módulo para que una etapa se pinte con
 * una sola petición.
 */
export const moduleSummarySchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  unitCount: z.number().int().nonnegative(),
  units: z.array(unitSummarySchema),
});

export type ModuleSummary = z.infer<typeof moduleSummarySchema>;

export const stageDetailSchema = stageSummarySchema.extend({
  modules: z.array(moduleSummarySchema),
});

export type StageDetail = z.infer<typeof stageDetailSchema>;

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
  "mermaid",
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

/** Referencia de un recurso (del catálogo `resources` de la semilla) dentro de una lección. */
export const contentSeedLessonResourceSchema = z.object({
  resourceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug en minúsculas separado por guiones"),
  order: z.number().int().nonnegative(),
  note: z.string().min(1).nullable().default(null),
});

export type ContentSeedLessonResource = z.infer<typeof contentSeedLessonResourceSchema>;

export const contentSeedLessonSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug en minúsculas separado por guiones"),
  title: z.string().min(1),
  estimatedMin: estimatedMinSchema.default(null),
  order: z.number().int().positive(),
  isPublished: z.boolean(),
  content: lessonContentSchema,
  steps: lessonStepsSchema,
  resources: z.array(contentSeedLessonResourceSchema).default([]),
});

export type ContentSeedLesson = z.infer<typeof contentSeedLessonSchema>;

/** Pista de un ejercicio sembrado (`plantilla-ejercicio.md`: concepto → dirección → fragmento). */
export const contentSeedExerciseHintSchema = z.object({
  level: z.number().int().min(1).max(3),
  text: z.string().min(1),
});

/**
 * Prueba de un ejercicio sembrado. `spec.code` es el cuerpo de la prueba (se
 * añade tras el código del estudiante); un adaptador de sandbox real decide
 * cómo ejecutarlo. Las ocultas nunca salen del servidor.
 */
export const contentSeedExerciseTestSchema = z.object({
  name: z.string().min(1).max(200),
  isHidden: z.boolean(),
  weight: z.number().positive().default(1),
  spec: z.object({ code: z.string().min(1) }),
});

/** Variantes de quiz que la semilla puede declarar. */
export const QUIZ_KINDS = ["single", "multiple", "ordering", "matching"] as const;

export type QuizKind = (typeof QUIZ_KINDS)[number];

/**
 * Pregunta de opción múltiple. `plantilla-ejercicio.md`: «cada distractor tiene
 * explicación propia; prohibido verdadero/falso sin justificación». La correcta
 * y las explicaciones no salen del servidor hasta que hay un intento.
 */
const singleQuiz = z.object({
  kind: z.literal("single"),
  options: z
    .array(
      z.object({
        id: z.string().regex(/^[a-d]$/, "El id de opción es una letra a–d"),
        text: z.string().min(1),
        explanation: z.string().min(1),
      }),
    )
    .min(3, "Un quiz ofrece de 3 a 4 opciones")
    .max(4, "Un quiz ofrece de 3 a 4 opciones"),
  correctOptionId: z.string().regex(/^[a-d]$/),
});

/**
 * Pregunta de respuesta múltiple: cinco o seis opciones con explicación propia y
 * de dos a tres correctas. `selectCount` declara cuántas espera el estudiante.
 */
const multipleQuiz = z.object({
  kind: z.literal("multiple"),
  options: z
    .array(
      z.object({
        id: z.string().regex(/^[a-f]$/, "El id de opción es una letra a–f"),
        text: z.string().min(1),
        explanation: z.string().min(1),
      }),
    )
    .min(5, "Un quiz de respuesta múltiple ofrece de 5 a 6 opciones")
    .max(6, "Un quiz de respuesta múltiple ofrece de 5 a 6 opciones"),
  selectCount: z.union([z.literal(2), z.literal(3)]),
  correctOptionIds: z
    .array(z.string().regex(/^[a-f]$/, "El id de opción correcta es una letra a–f"))
    .min(2, "Un quiz de respuesta múltiple declara de 2 a 3 opciones correctas")
    .max(3, "Un quiz de respuesta múltiple declara de 2 a 3 opciones correctas"),
});

/**
 * Pregunta de ordenar: el orden de `items` nunca puede ser ya el correcto, o el
 * ejercicio se serviría resuelto.
 */
const orderingQuiz = z.object({
  kind: z.literal("ordering"),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[a-f]$/, "El id del elemento es una letra a–f"),
        text: z.string().min(1),
        explanation: z.string().min(1),
      }),
    )
    .min(3, "Un quiz de ordenar ofrece de 3 a 6 elementos")
    .max(6, "Un quiz de ordenar ofrece de 3 a 6 elementos"),
  correctOrder: z.array(z.string().regex(/^[a-f]$/, "El id del elemento es una letra a–f")),
});

/**
 * Pregunta de emparejar: la explicación va en el elemento de la izquierda y
 * justifica por qué su pareja es la de la derecha.
 */
const matchingQuiz = z.object({
  kind: z.literal("matching"),
  left: z
    .array(
      z.object({
        id: z.string().regex(/^[a-f]$/, "El id de la columna izquierda es una letra a–f"),
        text: z.string().min(1),
        explanation: z.string().min(1),
      }),
    )
    .min(3, "La columna izquierda ofrece de 3 a 6 elementos")
    .max(6, "La columna izquierda ofrece de 3 a 6 elementos"),
  right: z
    .array(
      z.object({
        id: z.string().regex(/^[1-6]$/, "El id de la columna derecha es un número del 1 al 6"),
        text: z.string().min(1),
      }),
    )
    .min(3, "La columna derecha ofrece de 3 a 6 elementos")
    .max(6, "La columna derecha ofrece de 3 a 6 elementos"),
  correctPairs: z.record(z.string(), z.string()),
});

/** Los quizzes ya sembrados no declaran `kind`: se completan como respuesta única. */
function addDefaultQuizKind(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  if ("kind" in value) return value;

  return { ...value, kind: "single" };
}

/**
 * Quiz de la semilla. La entrada nunca exige `kind`; la salida siempre lo lleva,
 * así el resto del código discrimina la variante sin comprobaciones opcionales.
 */
export const contentSeedQuizSchema = z.preprocess(
  addDefaultQuizKind,
  z.discriminatedUnion("kind", [singleQuiz, multipleQuiz, orderingQuiz, matchingQuiz]),
);

export type ContentSeedQuiz = z.infer<typeof contentSeedQuizSchema>;

/**
 * Juego de memoria (`banco-ejercicios.md` §3.3): 6–10 pares término ↔ definición
 * (12–20 cartas). Las dos caras están a la vista por definición, así que el juego
 * se corrige en el cliente y los pares viajan tal cual en `config.pairs`.
 */
export const contentSeedMemorySchema = z.object({
  /**
   * `flip`: voltear cartas con un tope de fallos (ahorcado). `match`: arrastrar cada
   * definición hasta su concepto, sin tope de fallos; mejor para temas de razonamiento
   * donde recordar posiciones no aporta.
   */
  mode: z.enum(["flip", "match"]).default("flip"),
  pairs: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Id de par en minúsculas separado por guiones"),
        term: z.string().min(1).max(60, "El término de una carta es breve (máx. 60 caracteres)"),
        definition: z.string().min(1).max(110, "La definición de una carta es breve (máx. 110 caracteres)"),
      }),
    )
    .min(6, "Un juego de memoria tiene de 6 a 10 pares")
    .max(10, "Un juego de memoria tiene de 6 a 10 pares"),
  /**
   * Recuadro «Qué vas a repasar» que se muestra antes de jugar: un resumen de lo
   * que enseña el juego y, si hay una secuencia o un mapa natural, su lista
   * (por ejemplo, las etapas del recorrido de un requisito).
   */
  intro: z
    .object({
      summary: z.string().min(1).max(400, "El resumen del juego es breve (máx. 400 caracteres)"),
      list: z
        .object({
          title: z.string().min(1).max(80),
          ordered: z.boolean(),
          items: z.array(z.string().min(1).max(120)).min(2).max(8),
        })
        .nullable()
        .default(null),
    })
    .nullable()
    .default(null),
});

/** Tarjeta de recuperación: el frente es el `statement`; el reverso se revela tras un intento. */
export const contentSeedFlashcardSchema = z.object({
  back: z.string().min(1).max(400, "El reverso de una tarjeta es breve (máx. 400 caracteres)"),
});

/** Severidad de un defecto real, de más a menos grave (`banco-ejercicios.md` §3.6). */
export const AUDIT_SEVERITIES = ["critical", "high", "medium", "low"] as const;

/** Decisión ante el artefacto completo: aceptar, corregir o descartar. */
export const AUDIT_DECISIONS = ["accept", "fix", "discard"] as const;

/**
 * Auditoría de código generado por IA (`banco-ejercicios.md` §3.6): el artefacto
 * que se revisa, los hallazgos candidatos —con líneas 1-based, inclusive— y el
 * veredicto correcto. La etiqueta de un hallazgo es neutra (la ve el estudiante
 * antes de decidir) y la explicación solo se revela después del intento.
 */
export const contentSeedAuditSchema = z.object({
  artifact: z.object({
    language: z.enum(["json", "yaml", "typescript", "javascript", "python", "bash", "text"]),
    content: z.string().min(1).max(8000),
  }),
  findings: z
    .array(
      z.object({
        id: z.string().regex(/^f\d{1,2}$/),
        lines: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
        label: z.string().min(1).max(120),
        isDefect: z.boolean(),
        severity: z.enum(AUDIT_SEVERITIES).nullable().default(null),
        explanation: z.string().min(1),
      }),
    )
    .min(3)
    .max(10),
  verdict: z.enum(AUDIT_DECISIONS),
});

export type ContentSeedAudit = z.infer<typeof contentSeedAuditSchema>;

const CLOUD_CHECK_OPERATORS = ["equals", "exists", "absent", "matches", "lengthAtLeast", "lengthEquals"] as const;

/**
 * Laboratorio en la nube de AWS (`metodo-aws.md` §4.2). La evidencia es la
 * salida JSON de comandos de solo lectura; `path` es un camino como
 * `Budgets[0].BudgetLimit.Amount`.
 */
export const contentSeedCloudLabSchema = z.object({
  region: z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d$/),
  tag: z.string().regex(/^codeai-lab=[a-z0-9-]+$/),
  cost: z.object({
    expectedUsd: z.number().nonnegative(),
    freeTier: z.string().min(1),
    source: z.string().url(),
    checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  prerequisites: z.array(z.string().min(1)).min(1),
  steps: z.array(z.object({ title: z.string().min(1), instructions: z.string().min(1) })).min(1),
  checks: z
    .array(
      z.object({
        id: z.string().regex(/^c\d{1,2}$/),
        label: z.string().min(1),
        phase: z.enum(["build", "cleanup"]),
        command: z.string().regex(/^aws [a-z0-9-]+ (describe|get|list)-[a-z0-9-]+/),
        expect: z
          .array(
            z.object({
              path: z.string().min(1),
              op: z.enum(CLOUD_CHECK_OPERATORS),
              value: z.unknown().optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type ContentSeedCloudLab = z.infer<typeof contentSeedCloudLabSchema>;

/**
 * Ejercicio sembrado (`plantilla-ejercicio.md`, `banco-ejercicios.md` §6). Las
 * reglas duras de la plantilla se validan en el esquema de la semilla completa.
 */
export const contentSeedExerciseSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug en minúsculas separado por guiones"),
  type: z.enum(EXERCISE_TYPES),
  title: z.string().min(1).max(200),
  statement: z.string().min(1),
  ladder: z.enum(LADDERS),
  difficulty: z.number().int().min(1).max(4),
  concepts: z.array(z.string().min(1)).min(1, "Declara al menos un concepto (alimenta el repaso)"),
  competencies: z
    .array(
      z.string().regex(COMPETENCY_CODE_PATTERN, "La competencia debe ser C1–C14 o AWS-C1–AWS-C15"),
    )
    .min(1),
  estimatedMin: estimatedMinSchema.default(null),
  language: sandboxLanguageSchema.nullable().default(null),
  starterCode: z.string().min(1).nullable().default(null),
  solution: z.object({ code: z.string().min(1) }).nullable().default(null),
  harness: z.enum(["aws"]).nullable().default(null),
  quiz: contentSeedQuizSchema.nullable().default(null),
  flashcard: contentSeedFlashcardSchema.nullable().default(null),
  memory: contentSeedMemorySchema.nullable().default(null),
  audit: contentSeedAuditSchema.nullable().default(null),
  cloudLab: contentSeedCloudLabSchema.nullable().default(null),
  sources: z.array(z.string().url()).min(1, "La documentación oficial es obligatoria"),
  maxAttempts: z.number().int().positive().nullable().default(null),
  isPublished: z.boolean(),
  order: z.number().int().positive(),
  hints: z.array(contentSeedExerciseHintSchema).default([]),
  tests: z.array(contentSeedExerciseTestSchema).default([]),
});

export type ContentSeedExercise = z.infer<typeof contentSeedExerciseSchema>;

export const contentSeedUnitSchema = z.object({
  code: unitCodeSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  estimatedMin: estimatedMinSchema.default(null),
  order: z.number().int().positive(),
  isPublished: z.boolean(),
  prerequisiteIds: z.array(unitCodeSchema).default([]),
  lessons: z.array(contentSeedLessonSchema).default([]),
  exercises: z.array(contentSeedExerciseSchema).default([]),
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

/** Recurso externo del catálogo de la semilla (`docs/02-contenido/catalogo-recursos.md`). */
export const contentSeedResourceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug en minúsculas separado por guiones"),
  title: z.string().min(1),
  provider: z.string().min(1),
  url: z.string().url(),
  type: z.enum(RESOURCE_TYPES),
  language: z.string().min(1).default("es"),
  level: z.string().min(1).nullable().default(null),
  durationMin: z.number().int().positive().nullable().default(null),
  license: z.string().min(1).nullable().default(null),
  embedAllowed: z.boolean().default(false),
  status: z.enum(RESOURCE_STATUSES).default("VERIFIED"),
  notes: z.string().min(1).nullable().default(null),
});

export type ContentSeedResource = z.infer<typeof contentSeedResourceSchema>;

/** Tipos que se resuelven escribiendo código y necesitan sandbox, solución y pruebas. */
const CODE_EXERCISE_TYPES: readonly string[] = ["LAB", "DEBUG"];

/** Enunciados prohibidos por `plantilla-ejercicio.md`, sea cual sea la variante. */
const TRUE_FALSE_TEXT = /^(verdadero|falso)\.?$/;
const NONE_OF_ABOVE_TEXT = /(todas|ninguna) (de )?las anteriores/;

type SingleQuiz = Extract<ContentSeedQuiz, { kind: "single" }>;
type MultipleQuiz = Extract<ContentSeedQuiz, { kind: "multiple" }>;
type OrderingQuiz = Extract<ContentSeedQuiz, { kind: "ordering" }>;
type MatchingQuiz = Extract<ContentSeedQuiz, { kind: "matching" }>;

function repeats(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/** Los mensajes de la respuesta única no han cambiado desde el piloto. */
function singleQuizViolations(quiz: SingleQuiz): string[] {
  const problems: string[] = [];
  const ids = quiz.options.map((option) => option.id);
  const texts = quiz.options.map((option) => option.text.trim().toLowerCase());

  if (repeats(ids)) problems.push("las opciones repiten id");
  if (!ids.includes(quiz.correctOptionId)) problems.push("la opción correcta no existe");
  if (texts.some((text) => TRUE_FALSE_TEXT.test(text))) {
    problems.push("prohibido verdadero/falso");
  }
  if (texts.some((text) => NONE_OF_ABOVE_TEXT.test(text))) {
    problems.push("prohibido «todas/ninguna de las anteriores»");
  }

  return problems;
}

function multipleQuizViolations(quiz: MultipleQuiz): string[] {
  const problems: string[] = [];
  const ids = quiz.options.map((option) => option.id);
  const texts = quiz.options.map((option) => option.text.trim().toLowerCase());
  const correct = quiz.correctOptionIds;

  if (repeats(ids)) problems.push("las opciones repiten id");
  if (correct.some((id) => !ids.includes(id))) problems.push("las opciones correctas deben existir");
  if (repeats(correct)) problems.push("correctOptionIds repite opciones");
  if (quiz.selectCount !== correct.length) {
    problems.push("selectCount debe coincidir con el número de opciones correctas");
  }
  if (texts.some((text) => TRUE_FALSE_TEXT.test(text))) {
    problems.push("prohibido verdadero/falso");
  }
  if (texts.some((text) => NONE_OF_ABOVE_TEXT.test(text))) {
    problems.push("prohibido «todas/ninguna de las anteriores»");
  }

  return problems;
}

function orderingQuizViolations(quiz: OrderingQuiz): string[] {
  const problems: string[] = [];
  const ids = quiz.items.map((item) => item.id);
  const order = quiz.correctOrder;
  const sameLength = ids.length === order.length;

  if (repeats(ids)) problems.push("los elementos repiten id");
  if (!sameLength || repeats(order) || !ids.every((id) => order.includes(id))) {
    problems.push("correctOrder debe contener cada elemento exactamente una vez");
  }
  if (sameLength && ids.every((id, index) => order[index] === id)) {
    problems.push("los elementos no pueden venir ya en el orden correcto");
  }

  return problems;
}

function matchingQuizViolations(quiz: MatchingQuiz): string[] {
  const problems: string[] = [];
  const leftIds = quiz.left.map((item) => item.id);
  const rightIds = quiz.right.map((item) => item.id);
  const targets = Object.values(quiz.correctPairs);
  const sameLength = leftIds.length === rightIds.length;

  if (repeats(leftIds)) problems.push("los elementos de la izquierda repiten id");
  if (repeats(rightIds)) problems.push("los elementos de la derecha repiten id");
  if (!sameLength) problems.push("debe haber tantos elementos a la derecha como a la izquierda");
  if (leftIds.some((id) => quiz.correctPairs[id] === undefined)) {
    problems.push("correctPairs debe emparejar cada elemento de la izquierda");
  }
  if (repeats(targets) || targets.some((target) => !rightIds.includes(target))) {
    problems.push("las parejas deben apuntar a elementos de la derecha, sin repetir");
  }
  if (sameLength && leftIds.every((id, index) => quiz.correctPairs[id] === rightIds[index])) {
    problems.push("las parejas no pueden venir ya alineadas");
  }

  return problems;
}

function quizRuleViolations(quiz: ContentSeedQuiz): string[] {
  if (quiz.kind === "multiple") return multipleQuizViolations(quiz);
  if (quiz.kind === "ordering") return orderingQuizViolations(quiz);
  if (quiz.kind === "matching") return matchingQuizViolations(quiz);

  return singleQuizViolations(quiz);
}

/**
 * Reglas de `banco-ejercicios.md` §3.6: defectos reales con severidad, al menos un
 * elemento correcto que parece sospechoso, líneas dentro del artefacto y un
 * veredicto compatible con la gravedad. Los hallazgos van ordenados por su línea
 * inicial para que el orden no delate cuáles son defectos; dos hallazgos pueden
 * empezar en la misma línea.
 */
function auditRuleViolations(audit: ContentSeedAudit): string[] {
  const problems: string[] = [];
  const ids = audit.findings.map((finding) => finding.id);
  const defects = audit.findings.filter((finding) => finding.isDefect);
  const lineCount = audit.artifact.content.split("\n").length;
  const startsOutOfOrder = audit.findings.some((finding, index) => {
    const previous = audit.findings[index - 1];

    return previous !== undefined && finding.lines[0] < previous.lines[0];
  });
  const linesOutsideArtifact = audit.findings.some(
    (finding) => finding.lines[0] > finding.lines[1] || finding.lines[1] > lineCount,
  );
  const severityOnNonDefect = audit.findings.some(
    (finding) => !finding.isDefect && finding.severity !== null,
  );
  const graveDefect = defects.some(
    (finding) => finding.severity === "critical" || finding.severity === "high",
  );

  if (repeats(ids)) problems.push("los hallazgos repiten id");
  if (startsOutOfOrder) problems.push("los hallazgos van ordenados por línea");
  if (defects.length === 0) problems.push("un AUDIT declara al menos un defecto real");
  if (defects.length === audit.findings.length) {
    problems.push("un AUDIT declara al menos un elemento correcto que parece sospechoso");
  }
  if (defects.some((finding) => finding.severity === null)) {
    problems.push("cada defecto real declara severidad");
  }
  if (severityOnNonDefect) problems.push("la severidad solo se declara en defectos reales");
  if (linesOutsideArtifact) {
    problems.push("las líneas de un hallazgo salen del artefacto o están al revés");
  }
  if (audit.verdict === "accept" && graveDefect) {
    problems.push("un artefacto con defectos críticos o altos no se acepta");
  }

  return problems;
}

/**
 * Reglas duras de `plantilla-ejercicio.md` que un esquema por campo no puede
 * expresar: pistas por escalón, pruebas visibles y ocultas, solución oculta.
 */
export function exerciseRuleViolations(exercise: ContentSeedExercise): string[] {
  const problems: string[] = [];
  const hintLevels = exercise.hints.map((hint) => hint.level);

  if (new Set(hintLevels).size !== hintLevels.length) {
    problems.push("las pistas repiten nivel");
  }
  if (CODE_EXERCISE_TYPES.includes(exercise.type) && exercise.ladder === "GUIDED" && new Set(hintLevels).size !== 3) {
    problems.push("un LAB/DEBUG guiado declara las 3 pistas progresivas");
  }
  if (exercise.ladder === "AUTONOMOUS" && exercise.hints.length > 0) {
    problems.push("un ejercicio autónomo (Nivel 3) no puede tener pistas");
  }

  const names = exercise.tests.map((test) => test.name);
  if (new Set(names).size !== names.length) {
    problems.push("hay pruebas con el mismo nombre");
  }

  if (exercise.type === "QUIZ") {
    const quiz = exercise.quiz;

    if (quiz === null) {
      problems.push("un QUIZ requiere quiz (opciones y respuesta)");
    } else {
      problems.push(...quizRuleViolations(quiz));
    }
  } else if (exercise.quiz !== null) {
    problems.push("solo un QUIZ declara quiz");
  }

  if (exercise.type === "FLASHCARD") {
    if (exercise.flashcard === null) problems.push("una FLASHCARD requiere flashcard.back");
  } else if (exercise.flashcard !== null) {
    problems.push("solo una FLASHCARD declara flashcard");
  }

  if (exercise.type === "MEMORY") {
    const pairs = exercise.memory?.pairs;

    if (pairs === undefined) {
      problems.push("un MEMORY requiere memory.pairs");
    } else {
      const ids = pairs.map((pair) => pair.id);
      const terms = pairs.map((pair) => pair.term.trim().toLowerCase());
      const definitions = pairs.map((pair) => pair.definition.trim().toLowerCase());

      if (new Set(ids).size !== ids.length) problems.push("los pares repiten id");
      if (new Set(terms).size !== terms.length) problems.push("los pares repiten término");
      if (new Set(definitions).size !== definitions.length) problems.push("los pares repiten definición");
    }
  } else if (exercise.memory !== null) {
    problems.push("solo un MEMORY declara memory");
  }

  if (exercise.type === "AUDIT") {
    const audit = exercise.audit;

    if (audit === null) {
      problems.push("un AUDIT requiere audit (artefacto y hallazgos)");
    } else {
      problems.push(...auditRuleViolations(audit));
    }
  } else if (exercise.audit !== null) {
    problems.push("solo un AUDIT declara audit");
  }

  if (exercise.type === "CLOUD_LAB") {
    const cloudLab = exercise.cloudLab;

    if (cloudLab === null) {
      problems.push("un CLOUD_LAB requiere cloudLab");
    } else {
      const checkIds = cloudLab.checks.map((check) => check.id);

      if (!cloudLab.checks.some((check) => check.phase === "cleanup")) {
        problems.push("un CLOUD_LAB declara al menos una comprobación de limpieza");
      }
      if (new Set(checkIds).size !== checkIds.length) {
        problems.push("las comprobaciones repiten id");
      }
    }
    if (exercise.hints.length > 0 || exercise.tests.length > 0) {
      problems.push("un CLOUD_LAB no lleva pistas ni pruebas");
    }
    if (exercise.ladder === "AUTONOMOUS") {
      problems.push("un CLOUD_LAB no es de nivel autónomo");
    }
  } else if (exercise.cloudLab !== null) {
    problems.push("solo un CLOUD_LAB declara cloudLab");
  }

  if (exercise.harness !== null) {
    if (!CODE_EXERCISE_TYPES.includes(exercise.type)) {
      problems.push("solo un LAB o DEBUG declara harness");
    }

    if (exercise.language !== "typescript" && exercise.language !== "javascript") {
      problems.push("un ejercicio con harness se escribe en typescript o javascript");
    }
  }

  if (CODE_EXERCISE_TYPES.includes(exercise.type)) {
    if (exercise.language === null) problems.push("requiere language");
    if (exercise.starterCode === null) problems.push("requiere starterCode");
    if (exercise.solution === null) problems.push("requiere la solución oficial");
    if (!exercise.tests.some((test) => !test.isHidden)) problems.push("requiere una prueba visible");
    if (!exercise.tests.some((test) => test.isHidden)) problems.push("requiere una prueba oculta");
  }

  return problems;
}

/**
 * Valida la semilla completa: además de los tipos, comprueba que los
 * identificadores son únicos, que cada módulo/unidad pertenece a su etapa, que
 * los prerrequisitos apuntan a unidades declaradas y que cada lección solo
 * enlaza recursos declarados en el catálogo `resources`.
 */
export const contentSeedSchema = z
  .object({
    resources: z.array(contentSeedResourceSchema).default([]),
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

    const resourceSlugs = new Set<string>();
    const exerciseSlugs = new Set<string>();

    for (const [resourceIndex, resource] of seed.resources.entries()) {
      const path: (string | number)[] = ["resources", resourceIndex, "slug"];

      if (resourceSlugs.has(resource.slug)) {
        fail(`Recurso duplicado: slug ${resource.slug}`, path);
      }
      resourceSlugs.add(resource.slug);
    }

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

          for (const [exerciseIndex, exercise] of unit.exercises.entries()) {
            const exercisePath = [...unitPath, "exercises", exerciseIndex];

            if (exerciseSlugs.has(exercise.slug)) {
              fail(`Ejercicio duplicado: slug ${exercise.slug}`, [...exercisePath, "slug"]);
            }
            exerciseSlugs.add(exercise.slug);

            for (const message of exerciseRuleViolations(exercise)) {
              fail(`Ejercicio ${exercise.slug}: ${message}`, exercisePath);
            }

            for (const [competencyIndex, code] of exercise.competencies.entries()) {
              if (!isCompetencyOfCourse(code, "fullstack-ia")) {
                fail(
                  `La competencia ${code} no pertenece a la ruta fullstack-ia`,
                  [...exercisePath, "competencies", competencyIndex],
                );
              }
            }
          }

          for (const [lessonIndex, lesson] of unit.lessons.entries()) {
            for (const [resourceLinkIndex, link] of lesson.resources.entries()) {
              if (!resourceSlugs.has(link.resourceSlug)) {
                fail(
                  `La lección ${lesson.slug} enlaza un recurso inexistente: ${link.resourceSlug}`,
                  [...unitPath, "lessons", lessonIndex, "resources", resourceLinkIndex, "resourceSlug"],
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
