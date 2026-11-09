import { z } from "zod";

import { certificationCodeSchema } from "./certification";
import { quizSubmissionSchema } from "./exercise";

/**
 * Contratos del simulador de examen (S15).
 *
 * La respuesta de cada pregunta usa el mismo cuerpo que `quiz-answers`
 * (`quizSubmissionSchema`, S14-T6): `{ optionId }`, `{ optionIds }`, `{ order }`
 * o `{ pairs }`. Ni el intento en curso ni la lectura de un ítem devuelven la
 * solución: eso solo aparece en el resultado (S15-T1b).
 */

/** Formas fijas A/B/C, tanda aleatoria ponderada por dominio o bloque por dominio. */
export const EXAM_MODES = ["form-a", "form-b", "form-c", "random", "domain"] as const;

export type ExamMode = (typeof EXAM_MODES)[number];

export const EXAM_ATTEMPT_STATUSES = ["in-progress", "submitted", "expired"] as const;

export type ExamAttemptStatus = (typeof EXAM_ATTEMPT_STATUSES)[number];

/** Minutos que añade la adaptación por lengua materna. */
export const EXAM_EXTRA_TIME_MIN = 30;
/** Margen para la latencia de la red al comparar con el plazo. */
export const EXAM_GRACE_SECONDS = 5;
/** Tamaño del bloque por dominio. */
export const DOMAIN_BLOCK_SIZE = 20;
/** Con menos preguntas que esto el bloque por dominio no se ofrece. */
export const DOMAIN_BLOCK_MIN = 15;
/** Tandas aleatorias cuyas preguntas se excluyen de la siguiente. */
export const RANDOM_EXCLUDE_LAST_ATTEMPTS = 3;

/**
 * Cuerpo de `POST /api/exams/:certification/attempts`. Se declara `.strict()`
 * antes del `superRefine` para que la validación del borde pueda rechazar
 * claves desconocidas (H3, S14).
 */
export const startExamAttemptSchema = z
  .object({
    mode: z.enum(EXAM_MODES),
    domain: z.number().int().min(1).max(6).optional(),
    extraTime: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "domain" && value.domain === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["domain"],
        message: "El bloque por dominio necesita domain",
      });
      return;
    }

    if (value.mode !== "domain" && value.domain !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["domain"],
        message: "domain solo se usa en el bloque por dominio",
      });
    }
  });

export type StartExamAttemptInput = z.infer<typeof startExamAttemptSchema>;

/** Una pregunta del intento en curso: el `config` del quiz, nunca la solución. */
export const examAttemptItemSchema = z.object({
  position: z.number().int().min(1),
  domain: z.number().int().min(1).max(6),
  statement: z.string().min(1),
  config: z.record(z.unknown()),
  answer: quizSubmissionSchema.nullable(),
  flagged: z.boolean(),
});

export type ExamAttemptItem = z.infer<typeof examAttemptItemSchema>;

export const examAttemptSchema = z.object({
  id: z.string().min(1),
  certification: certificationCodeSchema,
  mode: z.enum(EXAM_MODES),
  domain: z.number().int().min(1).max(6).nullable(),
  extraTime: z.boolean(),
  status: z.enum(EXAM_ATTEMPT_STATUSES),
  orientative: z.boolean(),
  startedAt: z.string().datetime(),
  deadlineAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  remainingSeconds: z.number().int().nonnegative(),
  questionCount: z.number().int().positive(),
  answeredCount: z.number().int().nonnegative(),
  items: z.array(examAttemptItemSchema),
});

export type ExamAttempt = z.infer<typeof examAttemptSchema>;

export const examAttemptResponseSchema = z.object({ attempt: examAttemptSchema });

export type ExamAttemptResponse = z.infer<typeof examAttemptResponseSchema>;

/**
 * Cuerpo de `PUT /api/exams/attempts/:id/items/:position`. `answer: null` borra
 * la respuesta; `flagged` marca la pregunta para revisarla antes de entregar.
 */
export const updateExamItemSchema = z
  .object({ answer: quizSubmissionSchema.nullable().optional(), flagged: z.boolean().optional() })
  .strict()
  .refine((value) => value.answer !== undefined || value.flagged !== undefined, {
    message: "Envía answer, flagged o ambos",
  });

export type UpdateExamItemInput = z.infer<typeof updateExamItemSchema>;

export const examItemUpdateResponseSchema = z.object({
  item: examAttemptItemSchema,
  remainingSeconds: z.number().int().nonnegative(),
});

export type ExamItemUpdateResponse = z.infer<typeof examItemUpdateResponseSchema>;

/** Aciertos de un dominio en el resultado entregado; `pct` es entero 0–100. */
export const examDomainScoreSchema = z.object({
  domain: z.number().int().min(1).max(6),
  name: z.string().min(1),
  correct: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  pct: z.number().int().min(0).max(100),
});

export type ExamDomainScore = z.infer<typeof examDomainScoreSchema>;

/**
 * Pregunta corregida de un intento entregado. Añade el acierto, la respuesta
 * correcta (con la misma forma que el cuerpo), las explicaciones de cada opción
 * o elemento y la unidad del concepto, para enlazar `/learn/units/:code`.
 */
export const examResultItemSchema = examAttemptItemSchema.extend({
  correct: z.boolean(),
  correctAnswer: quizSubmissionSchema,
  explanations: z.record(z.string(), z.string().min(1)),
  unitCode: z.string().min(1),
});

export type ExamResultItem = z.infer<typeof examResultItemSchema>;

/**
 * Resultado de un intento entregado. No lleva puntuación escalada: AWS no
 * publica cómo la obtiene (decisión 2.2), así que solo se publica `scorePct`,
 * el porcentaje de aciertos, con su desglose por dominio.
 */
export const examResultSchema = z.object({
  attemptId: z.string().min(1),
  certification: certificationCodeSchema,
  mode: z.enum(EXAM_MODES),
  domain: z.number().int().nullable(),
  status: z.enum(["submitted", "expired"]),
  orientative: z.boolean(),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
  correctCount: z.number().int().nonnegative(),
  questionCount: z.number().int().positive(),
  scorePct: z.number().int().min(0).max(100),
  domains: z.array(examDomainScoreSchema).min(1),
  items: z.array(examResultItemSchema),
});

export type ExamResult = z.infer<typeof examResultSchema>;

export const examResultResponseSchema = z.object({ result: examResultSchema });

export type ExamResultResponse = z.infer<typeof examResultResponseSchema>;

/** Un intento del historial, el más reciente primero. `scorePct` es nulo en curso. */
export const examHistoryItemSchema = z.object({
  attemptId: z.string().min(1),
  mode: z.enum(EXAM_MODES),
  domain: z.number().int().min(1).max(6).nullable(),
  status: z.enum(EXAM_ATTEMPT_STATUSES),
  orientative: z.boolean(),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  scorePct: z.number().int().min(0).max(100).nullable(),
  questionCount: z.number().int().positive(),
});

export type ExamHistoryItem = z.infer<typeof examHistoryItemSchema>;

export const examHistoryResponseSchema = z.object({ attempts: z.array(examHistoryItemSchema) });

export type ExamHistoryResponse = z.infer<typeof examHistoryResponseSchema>;

/** Los cuatro criterios de «listo para presentar», en el orden en que se muestran. */
export const READINESS_CRITERIA = ["mastery", "mock-exams", "review", "evidence"] as const;

export type ReadinessCriterionId = (typeof READINESS_CRITERIA)[number];

export const READINESS_STATUSES = ["met", "missing", "unavailable"] as const;

export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

/**
 * Un criterio del panel de preparación: `missing` dice qué falta (vacío si se
 * cumple) y `unavailable` marca lo que la plataforma todavía no puede evaluar.
 */
export const readinessCriterionSchema = z.object({
  id: z.enum(READINESS_CRITERIA),
  status: z.enum(READINESS_STATUSES),
  summary: z.string().min(1),
  missing: z.array(z.string().min(1)),
});

export type ReadinessCriterion = z.infer<typeof readinessCriterionSchema>;

/**
 * Resultado real del examen oficial, registrado por la persona: la plataforma
 * no lo calcula ni lo verifica. `scaledScore` es la puntuación de AWS (100–1000).
 */
export const realExamResultSchema = z.object({
  id: z.string().min(1),
  certification: certificationCodeSchema,
  passed: z.boolean(),
  scaledScore: z.number().int().min(100).max(1000).nullable(),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  readyAtRegistration: z.boolean(),
  createdAt: z.string().datetime(),
});

export type RealExamResult = z.infer<typeof realExamResultSchema>;

export const examReadinessSchema = z.object({
  certification: certificationCodeSchema,
  stageId: z.number().int(),
  ready: z.boolean(),
  criteria: z.array(readinessCriterionSchema).length(4),
  evaluatedAt: z.string().datetime(),
  lastRealResult: realExamResultSchema.nullable(),
});

export type ExamReadiness = z.infer<typeof examReadinessSchema>;

export const examReadinessResponseSchema = z.object({ readiness: examReadinessSchema });

export type ExamReadinessResponse = z.infer<typeof examReadinessResponseSchema>;

/** Cuerpo de `POST /api/exams/:certification/real-results`. */
export const registerRealResultSchema = z
  .object({
    passed: z.boolean(),
    scaledScore: z.number().int().min(100).max(1000).optional(),
    takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va en formato AAAA-MM-DD"),
  })
  .strict();

export type RegisterRealResultInput = z.infer<typeof registerRealResultSchema>;

export const realResultResponseSchema = z.object({ realResult: realExamResultSchema });

export type RealResultResponse = z.infer<typeof realResultResponseSchema>;
