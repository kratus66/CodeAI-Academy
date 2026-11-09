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
