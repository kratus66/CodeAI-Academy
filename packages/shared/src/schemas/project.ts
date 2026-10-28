import { z } from "zod";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import { paginatedSchema } from "./common";
import { CURRICULUM_STAGE_COUNT } from "./content";
import { competencyCodeSchema } from "./progress";
import { avatarUrlSchema } from "./user";

/**
 * Contrato de proyectos, rúbricas y portafolio (`contratos-api.md` §4.11 y
 * `modelo-datos.md` §6).
 *
 * La rúbrica vive como `Json` en `Project` y se valida dos veces: al sembrar el
 * proyecto y al revisar una entrega. Por eso el esquema exige los cinco
 * criterios, pesos enteros que suman 100 y exactamente cuatro anclajes por
 * criterio en orden 1–4.
 */

/** Criterios de la rúbrica base (`rubricas-evaluacion.md` §1). */
export const PROJECT_CRITERIA = [
  "correctitud",
  "calidad",
  "pruebas",
  "seguridad",
  "justificacion",
] as const;

export type ProjectCriterion = (typeof PROJECT_CRITERIA)[number];

/** Etiquetas legibles para la web; no alteran el contrato de la API. */
export const PROJECT_CRITERION_LABELS: Record<ProjectCriterion, string> = {
  correctitud: "Correctitud funcional y cumplimiento de requisitos",
  calidad: "Calidad, legibilidad y mantenibilidad del código",
  pruebas: "Pruebas y manejo de casos límite",
  seguridad: "Seguridad y buenas prácticas",
  justificacion: "Explicación y justificación de decisiones",
};

/** Estados de una entrega: nace `SUBMITTED` y sólo la revisión la cierra. */
export const PROJECT_SUBMISSION_STATUSES = ["SUBMITTED", "REVIEWED"] as const;

export type ProjectSubmissionStatus =
  (typeof PROJECT_SUBMISSION_STATUSES)[number];

/** Niveles descriptivos de cada criterio; 0 = «no cumple» y no se describe. */
export const PROJECT_RUBRIC_LEVEL_MIN = 1;
export const PROJECT_RUBRIC_LEVEL_MAX = 4;

/** Longitud máxima de un anclaje; cabe en una ficha de rúbrica sin truncarse. */
export const PROJECT_RUBRIC_ANCHOR_MAX_LENGTH = 280;

/** Los pesos de la rúbrica son porcentajes y deben sumar el total exacto. */
export const PROJECT_RUBRIC_WEIGHT_TOTAL = 100;

/**
 * Nota mínima que deja evidencia de competencia en `CompetencyProgress`
 * (`rubricas-evaluacion.md` §3: 80 es «aprobado con dominio»).
 */
export const PROJECT_EVIDENCE_MIN_SCORE = 80;

/** Tope de `repoUrl` y `deployUrl`; coincide con las columnas del modelo. */
export const PROJECT_URL_MAX_LENGTH = 500;

/** Tope de la explicación propia de la entrega. */
export const PROJECT_NOTES_MAX_LENGTH = 2_000;

/** Tope de la retroalimentación del instructor. */
export const PROJECT_FEEDBACK_MAX_LENGTH = 2_000;

/** Slug de proyecto: minúsculas separadas por guiones, igual que el contenido. */
export const projectSlugSchema = z
  .string({ invalid_type_error: "El slug debe ser texto" })
  .trim()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug en minúsculas separado por guiones",
  );

const stageIdSchema = z
  .number({ invalid_type_error: "La etapa debe ser un número entero" })
  .int("La etapa debe ser un número entero")
  .min(0, `La etapa debe estar entre 0 y ${CURRICULUM_STAGE_COUNT - 1}`)
  .max(
    CURRICULUM_STAGE_COUNT - 1,
    `La etapa debe estar entre 0 y ${CURRICULUM_STAGE_COUNT - 1}`,
  );

const isoTimestampSchema = z
  .string({ invalid_type_error: "La fecha debe ser texto ISO 8601" })
  .datetime("La fecha debe estar en formato ISO 8601");

/** Anclaje de un nivel: qué se observa para considerar ese nivel alcanzado. */
export const projectRubricLevelSchema = z
  .object({
    level: z
      .number({ invalid_type_error: "El nivel debe ser un número" })
      .int("El nivel debe ser un número entero")
      .min(
        PROJECT_RUBRIC_LEVEL_MIN,
        `El nivel debe estar entre ${PROJECT_RUBRIC_LEVEL_MIN} y ${PROJECT_RUBRIC_LEVEL_MAX}`,
      )
      .max(
        PROJECT_RUBRIC_LEVEL_MAX,
        `El nivel debe estar entre ${PROJECT_RUBRIC_LEVEL_MIN} y ${PROJECT_RUBRIC_LEVEL_MAX}`,
      ),
    anchor: z
      .string({ invalid_type_error: "El anclaje debe ser texto" })
      .trim()
      .min(1, "El anclaje es obligatorio")
      .max(
        PROJECT_RUBRIC_ANCHOR_MAX_LENGTH,
        `El anclaje no puede superar ${PROJECT_RUBRIC_ANCHOR_MAX_LENGTH} caracteres`,
      ),
  })
  .strict();

export type ProjectRubricLevel = z.infer<typeof projectRubricLevelSchema>;

/** Criterio con su peso y sus cuatro anclajes en orden 1–4. */
export const projectRubricCriterionSchema = z
  .object({
    criterion: z.enum(PROJECT_CRITERIA, {
      errorMap: () => ({
        message: `El criterio debe ser uno de: ${PROJECT_CRITERIA.join(", ")}`,
      }),
    }),
    weight: z
      .number({ invalid_type_error: "El peso debe ser un número" })
      .int("El peso debe ser un número entero")
      .min(1, "El peso debe estar entre 1 y 100")
      .max(PROJECT_RUBRIC_WEIGHT_TOTAL, "El peso debe estar entre 1 y 100"),
    levels: z
      .array(projectRubricLevelSchema)
      .length(
        PROJECT_RUBRIC_LEVEL_MAX,
        `Cada criterio debe declarar exactamente ${PROJECT_RUBRIC_LEVEL_MAX} niveles`,
      ),
  })
  .strict()
  .superRefine((criterion, ctx) => {
    criterion.levels.forEach((level, index) => {
      if (level.level !== index + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["levels", index, "level"],
          message: `Los niveles deben venir en orden ${PROJECT_RUBRIC_LEVEL_MIN}..${PROJECT_RUBRIC_LEVEL_MAX}`,
        });
      }
    });
  });

export type ProjectRubricCriterion = z.infer<
  typeof projectRubricCriterionSchema
>;

/**
 * Rúbrica completa: cinco criterios sin repetir, pesos que suman 100 y la
 * puerta de correctitud declarada de forma explícita.
 */
export const projectRubricSchema = z
  .object({
    criteria: z
      .array(projectRubricCriterionSchema)
      .length(
        PROJECT_CRITERIA.length,
        `La rúbrica debe declarar exactamente ${PROJECT_CRITERIA.length} criterios`,
      ),
    correctitudGate: z.literal(true, {
      errorMap: () => ({
        message: "La rúbrica debe declarar correctitudGate: true",
      }),
    }),
  })
  .strict()
  .superRefine((rubric, ctx) => {
    const seen = new Set<ProjectCriterion>();

    rubric.criteria.forEach((criterion, index) => {
      if (seen.has(criterion.criterion)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria", index, "criterion"],
          message: `El criterio ${criterion.criterion} está repetido`,
        });
      }
      seen.add(criterion.criterion);
    });

    for (const missing of PROJECT_CRITERIA) {
      if (!seen.has(missing)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria"],
          message: `Falta el criterio ${missing}`,
        });
      }
    }

    const total = rubric.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    );

    if (total !== PROJECT_RUBRIC_WEIGHT_TOTAL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criteria"],
        message: `Los pesos de la rúbrica deben sumar ${PROJECT_RUBRIC_WEIGHT_TOTAL} (suman ${total})`,
      });
    }
  });

export type ProjectRubric = z.infer<typeof projectRubricSchema>;

/**
 * Rúbrica base de `rubricas-evaluacion.md` §1: 30/20/20/15/15. Los anclajes de
 * los niveles 1, 3 y 4 son los de la tabla; el nivel 2 describe el punto
 * intermedio para que la revisión no tenga que inventarlo.
 */
export const DEFAULT_PROJECT_RUBRIC: ProjectRubric = {
  criteria: [
    {
      criterion: "correctitud",
      weight: 30,
      levels: [
        {
          level: 1,
          anchor: "Falla en casos básicos o deja requisitos sin cumplir.",
        },
        {
          level: 2,
          anchor: "Cumple los requisitos principales, pero falla en casos límite.",
        },
        {
          level: 3,
          anchor:
            "Cumple todos los criterios del enunciado, incluidos los casos límite declarados.",
        },
        {
          level: 4,
          anchor:
            "Cumple y anticipa requisitos conflictivos; documenta las decisiones tomadas.",
        },
      ],
    },
    {
      criterion: "calidad",
      weight: 20,
      levels: [
        {
          level: 1,
          anchor:
            "Código funcional pero opaco: nombres pobres o estructura difícil de seguir.",
        },
        {
          level: 2,
          anchor:
            "Código comprensible con duplicaciones o funciones largas evitables.",
        },
        {
          level: 3,
          anchor:
            "Claro, modular y sin duplicación evidente; sigue las convenciones del proyecto.",
        },
        {
          level: 4,
          anchor:
            "Refleja el dominio del problema y es fácil de extender sin tocar lo existente.",
        },
      ],
    },
    {
      criterion: "pruebas",
      weight: 20,
      levels: [
        {
          level: 1,
          anchor:
            "Sin pruebas o con pruebas triviales que no ejercitan el comportamiento.",
        },
        {
          level: 2,
          anchor: "Cubre el camino feliz; deja sin probar errores y bordes.",
        },
        {
          level: 3,
          anchor:
            "Pruebas significativas de éxito y de fallo, incluidos los casos límite.",
        },
        {
          level: 4,
          anchor:
            "Las pruebas documentan decisiones y previenen regresiones futuras.",
        },
      ],
    },
    {
      criterion: "seguridad",
      weight: 15,
      levels: [
        {
          level: 1,
          anchor:
            "Riesgos evidentes: validación ausente, secretos expuestos o permisos sin comprobar.",
        },
        {
          level: 2,
          anchor:
            "Valida lo esencial, con algún descuido en permisos o dependencias.",
        },
        {
          level: 3,
          anchor:
            "Sin vulnerabilidades conocidas: valida entradas, protege secretos y comprueba permisos.",
        },
        {
          level: 4,
          anchor:
            "Endurecido y justificado: defensas explícitas y límites documentados.",
        },
      ],
    },
    {
      criterion: "justificacion",
      weight: 15,
      levels: [
        {
          level: 1,
          anchor: "No explica las decisiones ni los compromisos asumidos.",
        },
        {
          level: 2,
          anchor:
            "Explica qué hizo, pero no por qué ni qué alternativas descartó.",
        },
        {
          level: 3,
          anchor:
            "Justifica con fundamentos técnicos y menciona alternativas consideradas.",
        },
        {
          level: 4,
          anchor:
            "Defiende las decisiones bajo cuestionamiento y reconoce los límites de la solución.",
        },
      ],
    },
  ],
  correctitudGate: true,
};

/**
 * Nivel asignado por el instructor a un criterio: entero 0–4. `0` es «no
 * cumple» y en `correctitud` invalida el entregable.
 */
export const projectRubricScoreSchema = z
  .number({ invalid_type_error: "El nivel debe ser un número" })
  .int("El nivel debe ser un número entero")
  .min(0, "El nivel debe estar entre 0 y 4")
  .max(
    PROJECT_RUBRIC_LEVEL_MAX,
    `El nivel debe estar entre 0 y ${PROJECT_RUBRIC_LEVEL_MAX}`,
  );

/** Los cinco criterios son obligatorios: una revisión parcial no produce nota. */
export const projectRubricScoresSchema = z
  .object({
    correctitud: projectRubricScoreSchema,
    calidad: projectRubricScoreSchema,
    pruebas: projectRubricScoreSchema,
    seguridad: projectRubricScoreSchema,
    justificacion: projectRubricScoreSchema,
  })
  .strict();

export type ProjectRubricScores = z.infer<typeof projectRubricScoresSchema>;

/** Ficha de un proyecto en el catálogo (`GET /api/projects`). */
export const projectSummarySchema = z.object({
  id: z.string().min(1),
  slug: projectSlugSchema,
  stageId: stageIdSchema,
  title: z.string().min(1),
  brief: z.string().min(1),
  requirements: z
    .array(z.string().min(1))
    .min(1, "El proyecto debe declarar al menos un requisito"),
  isPublished: z.boolean(),
  submitted: z.boolean(),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

const httpUrlSchema = (field: string) =>
  z
    .string({ invalid_type_error: `La URL de ${field} debe ser texto` })
    .trim()
    .url(`La URL de ${field} debe ser válida`)
    .max(
      PROJECT_URL_MAX_LENGTH,
      `La URL de ${field} no puede superar ${PROJECT_URL_MAX_LENGTH} caracteres`,
    )
    .refine(
      (value) => /^https?:\/\//i.test(value),
      `La URL de ${field} debe apuntar a http o https`,
    );

/** `repoUrl` es obligatorio: una entrega sin repositorio no es evaluable. */
export const projectRepoUrlSchema = z
  .string({
    required_error: "El repositorio es obligatorio",
    invalid_type_error: "El repositorio debe ser una URL",
  })
  .trim()
  .min(1, "El repositorio es obligatorio")
  .url("El repositorio debe ser una URL válida")
  .max(
    PROJECT_URL_MAX_LENGTH,
    `La URL del repositorio no puede superar ${PROJECT_URL_MAX_LENGTH} caracteres`,
  )
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "La URL del repositorio debe apuntar a http o https",
  );

/** `deployUrl` es opcional; si viene, apunta a http(s) o es `null`. */
export const projectDeployUrlSchema = httpUrlSchema("despliegue").nullable();

export const projectNotesSchema = z
  .string({ invalid_type_error: "La explicación debe ser texto" })
  .trim()
  .max(
    PROJECT_NOTES_MAX_LENGTH,
    `La explicación no puede superar ${PROJECT_NOTES_MAX_LENGTH} caracteres`,
  );

export const projectFeedbackSchema = z
  .string({ invalid_type_error: "La retroalimentación debe ser texto" })
  .trim()
  .max(
    PROJECT_FEEDBACK_MAX_LENGTH,
    `La retroalimentación no puede superar ${PROJECT_FEEDBACK_MAX_LENGTH} caracteres`,
  );

/** `POST /api/projects/:slug/submissions` — cuerpo de la entrega. */
export const createProjectSubmissionSchema = z
  .object({
    repoUrl: projectRepoUrlSchema,
    deployUrl: projectDeployUrlSchema.optional(),
    notes: projectNotesSchema.nullable().optional(),
  })
  .strict();

export type CreateProjectSubmissionInput = z.infer<
  typeof createProjectSubmissionSchema
>;

/** `POST /api/projects/submissions/:id/review` — cuerpo de la revisión. */
export const reviewProjectSubmissionSchema = z
  .object({
    rubricScores: projectRubricScoresSchema,
    feedback: projectFeedbackSchema.nullable().optional(),
  })
  .strict();

export type ReviewProjectSubmissionInput = z.infer<
  typeof reviewProjectSubmissionSchema
>;

/** Entrega tal como la ve su autor o un instructor. */
export const projectSubmissionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  projectSlug: projectSlugSchema,
  projectTitle: z.string().min(1),
  stageId: stageIdSchema,
  userId: z.string().min(1),
  status: z.enum(PROJECT_SUBMISSION_STATUSES),
  repoUrl: projectRepoUrlSchema,
  deployUrl: projectDeployUrlSchema,
  notes: projectNotesSchema.nullable(),
  score: z
    .number()
    .min(0, "La nota no puede ser negativa")
    .max(
      PROJECT_RUBRIC_WEIGHT_TOTAL,
      `La nota no puede superar ${PROJECT_RUBRIC_WEIGHT_TOTAL}`,
    )
    .nullable(),
  rubricScores: projectRubricScoresSchema.nullable(),
  feedback: projectFeedbackSchema.nullable(),
  reviewedAt: isoTimestampSchema.nullable(),
  isPublic: z.boolean(),
  publishedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
});

export type ProjectSubmission = z.infer<typeof projectSubmissionSchema>;

/** Detalle de un proyecto con la rúbrica y las entregas propias. */
export const projectDetailSchema = projectSummarySchema.extend({
  rubric: projectRubricSchema,
  competencies: z
    .array(competencyCodeSchema)
    .min(1, "El proyecto debe declarar al menos una competencia"),
  bestScore: z
    .number()
    .min(0)
    .max(PROJECT_RUBRIC_WEIGHT_TOTAL)
    .nullable(),
  mySubmissions: z.array(projectSubmissionSchema),
});

export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/** `GET /api/projects?stage&page&pageSize` */
export const projectListQuerySchema = z
  .object({
    stage: z.coerce
      .number({ invalid_type_error: "La etapa debe ser un número entero" })
      .int("La etapa debe ser un número entero")
      .min(0, `La etapa debe estar entre 0 y ${CURRICULUM_STAGE_COUNT - 1}`)
      .max(
        CURRICULUM_STAGE_COUNT - 1,
        `La etapa debe estar entre 0 y ${CURRICULUM_STAGE_COUNT - 1}`,
      )
      .optional(),
    page: z.coerce
      .number({ invalid_type_error: "La página debe ser un número entero" })
      .int("La página debe ser un número entero")
      .min(1, "La página debe ser 1 o mayor")
      .default(1),
    pageSize: z.coerce
      .number({
        invalid_type_error: "El tamaño de página debe ser un número entero",
      })
      .int("El tamaño de página debe ser un número entero")
      .min(1, "El tamaño de página debe ser 1 o mayor")
      .max(PAGE_SIZE_MAX, `El tamaño de página no puede superar ${PAGE_SIZE_MAX}`)
      .default(PAGE_SIZE_DEFAULT),
  })
  .strict();

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

/** Respuesta de `GET /api/projects`: mismo sobre `{ data, meta }` que el resto. */
export const projectListResponseSchema = paginatedSchema(projectSummarySchema);

export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;

/**
 * Usuario del portafolio público: sólo identidad visible. El correo no forma
 * parte del contrato y el esquema es `strict` para que un adaptador no pueda
 * colarlo por descuido.
 */
export const portfolioUserSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    avatarUrl: avatarUrlSchema,
  })
  .strict();

export type PortfolioUser = z.infer<typeof portfolioUserSchema>;

/**
 * `GET /api/portfolio/me` (incluye privadas) y `GET /api/portfolio/:userId`
 * (sólo publicadas). `publicCount` cuenta las públicas presentes en `entries`.
 */
export const portfolioResponseSchema = z.object({
  user: portfolioUserSchema,
  entries: z.array(projectSubmissionSchema),
  publicCount: z
    .number({ invalid_type_error: "El contador debe ser un número" })
    .int("El contador debe ser un número entero")
    .nonnegative("El contador no puede ser negativo"),
});

export type PortfolioResponse = z.infer<typeof portfolioResponseSchema>;

/** Parámetros de ruta de `/api/projects/:slug`. */
export const projectSlugParamsSchema = z
  .object({ slug: projectSlugSchema })
  .strict();

export type ProjectSlugParams = z.infer<typeof projectSlugParamsSchema>;

/** Parámetros de ruta de `/api/projects/submissions/:id`. */
export const projectSubmissionIdParamsSchema = z
  .object({ id: z.string().min(1) })
  .strict();

export type ProjectSubmissionIdParams = z.infer<
  typeof projectSubmissionIdParamsSchema
>;

/** Parámetros de ruta de `/api/portfolio/:userId`. */
export const portfolioUserParamsSchema = z
  .object({ userId: z.string().min(1) })
  .strict();

export type PortfolioUserParams = z.infer<typeof portfolioUserParamsSchema>;
