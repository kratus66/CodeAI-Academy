import { z } from "zod";

import { competencyCodeSchema } from "./progress";

/**
 * Contrato del repaso espaciado (`contratos-api.md` §4.5 y
 * `prerequisitos-y-progreso.md` §5).
 *
 * La cola se sirve intercalada por concepto y acotada a
 * `REVIEW_QUEUE_MAX` ítems; `dueReviews` informa de la deuda total, que puede
 * ser mayor que la cola. La respuesta de `answer` devuelve exactamente los
 * cuatro campos del contrato SM-2, nunca el ítem completo.
 */

/** Límite diario de repasos (`prerequisitos-y-progreso.md` §5.3). */
export const REVIEW_QUEUE_MAX = 30;

/** Escala de calidad de la recuperación (`prerequisitos-y-progreso.md` §5.1). */
export const REVIEW_QUALITY_MIN = 0;
export const REVIEW_QUALITY_MAX = 5;

/** SM-2 nunca deja la facilidad por debajo de este valor (§5.2). */
export const EASE_FACTOR_MIN = 1.3;

const countSchema = z
  .number({ invalid_type_error: "El contador debe ser un número" })
  .int("El contador debe ser un número entero")
  .nonnegative("El contador no puede ser negativo");

const isoTimestampSchema = z
  .string({ invalid_type_error: "La fecha debe ser texto ISO 8601" })
  .datetime("La fecha debe estar en formato ISO 8601");

/** Calidad de la recuperación declarada por el estudiante: entero 0–5. */
export const reviewQualitySchema = z
  .number({
    required_error: "La calidad es obligatoria",
    invalid_type_error: "La calidad debe ser un número",
  })
  .int("La calidad debe ser un número entero")
  .min(
    REVIEW_QUALITY_MIN,
    `La calidad debe estar entre ${REVIEW_QUALITY_MIN} y ${REVIEW_QUALITY_MAX}`,
  )
  .max(
    REVIEW_QUALITY_MAX,
    `La calidad debe estar entre ${REVIEW_QUALITY_MIN} y ${REVIEW_QUALITY_MAX}`,
  );

/** Ítem de la cola de repaso (`GET /api/review/queue`). */
export const reviewQueueItemSchema = z
  .object({
    id: z.string().min(1),
    exerciseId: z.string().min(1),
    exerciseTitle: z.string().min(1),
    exerciseSlug: z.string().min(1),
    concept: z.string().min(1),
    competencies: z.array(competencyCodeSchema),
    dueAt: isoTimestampSchema,
    intervalDays: z
      .number({ invalid_type_error: "El intervalo debe ser un número" })
      .int("El intervalo debe ser un número entero")
      .min(1, "El intervalo debe ser al menos un día"),
    repetitions: countSchema,
    easeFactor: z
      .number({ invalid_type_error: "La facilidad debe ser un número" })
      .min(EASE_FACTOR_MIN, `La facilidad no puede ser menor que ${EASE_FACTOR_MIN}`),
    priority: z
      .number({ invalid_type_error: "La prioridad debe ser un número" })
      .int("La prioridad debe ser un número entero"),
  })
  .strict();

export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;

/** Respuesta de `GET /api/review/queue`. */
export const reviewQueueResponseSchema = z
  .object({
    items: z.array(reviewQueueItemSchema),
    dueReviews: countSchema,
    limit: countSchema,
  })
  .strict();

export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;

/** `POST /api/review/items/:id/answer` — cuerpo de la petición. */
export const reviewAnswerSchema = z
  .object({
    quality: reviewQualitySchema,
    /**
     * Tiempo de respuesta declarado. Se valida porque el contrato lo publica;
     * `ReviewLog` (`modelo-datos.md` §5) todavía no lo persiste (S11).
     */
    durationMs: z
      .number({ invalid_type_error: "La duración debe ser un número" })
      .int("La duración debe ser un número entero")
      .positive("La duración debe ser mayor que cero")
      .optional(),
  })
  .strict();

export type ReviewAnswerInput = z.infer<typeof reviewAnswerSchema>;

/** Resultado SM-2 de una respuesta (`POST /api/review/items/:id/answer`). */
export const reviewAnswerResultSchema = z
  .object({
    nextDueAt: isoTimestampSchema,
    intervalDays: z
      .number({ invalid_type_error: "El intervalo debe ser un número" })
      .int("El intervalo debe ser un número entero")
      .min(1, "El intervalo debe ser al menos un día"),
    easeFactor: z
      .number({ invalid_type_error: "La facilidad debe ser un número" })
      .min(EASE_FACTOR_MIN, `La facilidad no puede ser menor que ${EASE_FACTOR_MIN}`),
    repetitions: countSchema,
  })
  .strict();

export type ReviewAnswerResult = z.infer<typeof reviewAnswerResultSchema>;
