import { z } from "zod";

/**
 * Contrato de la capa de IA (`capa-ia.md`, `sprint-08-capa-ia.md` §4).
 *
 * Las respuestas conservan los campos de `contratos-api.md` §4.7 y añaden
 * `source` y `filtered` para que la web distinga una respuesta del proveedor,
 * un acierto de caché y una degradación. `system` nunca llega desde el cliente.
 */

/** Longitud máxima de un mensaje del estudiante o del historial. */
export const AI_MESSAGE_MAX = 2000;
/** Mensajes previos que el cliente puede reenviar. */
export const AI_HISTORY_MAX = 10;
/** Límites de salida por caso de uso (`capa-ia.md` §3). */
export const AI_TUTOR_MAX_TOKENS = 600;
export const AI_EXPLAIN_MAX_TOKENS = 400;
export const AI_SUGGESTED_HINTS_MAX = 3;
/** Vigencia de la caché por usuario: 24 horas. */
export const AI_CACHE_TTL_MS = 86_400_000;

export const AI_SOURCES = ["provider", "cache", "fallback"] as const;
export const aiSourceSchema = z.enum(AI_SOURCES);
export type AiSource = z.infer<typeof aiSourceSchema>;

export const AI_BUDGET_LEVELS = ["normal", "economy", "tutor_only", "disabled"] as const;
export const aiBudgetLevelSchema = z.enum(AI_BUDGET_LEVELS);
export type AiBudgetLevel = z.infer<typeof aiBudgetLevelSchema>;

const aiTextSchema = z
  .string({ required_error: "El mensaje es obligatorio", invalid_type_error: "El mensaje debe ser texto" })
  .min(1, "El mensaje no puede estar vacío")
  .max(AI_MESSAGE_MAX, `El mensaje no puede superar ${AI_MESSAGE_MAX} caracteres`);

/** Mensaje del historial: el rol `system` queda fuera a propósito. */
export const aiMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"], {
      errorMap: () => ({ message: "El rol debe ser user o assistant" }),
    }),
    content: aiTextSchema,
  })
  .strict();

export type AiMessage = z.infer<typeof aiMessageSchema>;

/** `POST /api/ai/tutor` — cuerpo de la petición. */
export const aiTutorRequestSchema = z
  .object({
    lessonId: z.string({ required_error: "La lección es obligatoria" }).min(1, "La lección es obligatoria"),
    message: aiTextSchema,
    history: z
      .array(aiMessageSchema)
      .max(AI_HISTORY_MAX, `El historial admite como máximo ${AI_HISTORY_MAX} mensajes`)
      .default([]),
  })
  .strict();

export type AiTutorRequest = z.input<typeof aiTutorRequestSchema>;
export type AiTutorInput = z.output<typeof aiTutorRequestSchema>;

const nonNegativeInt = z.number().int().nonnegative();
const hintsSchema = z.array(z.string().min(1)).max(AI_SUGGESTED_HINTS_MAX);

export const aiTutorResponseSchema = z
  .object({
    reply: z.string().min(1),
    suggestedHints: hintsSchema,
    tokensUsed: nonNegativeInt,
    budgetRemainingUsd: z.number().nonnegative(),
    source: aiSourceSchema,
    filtered: z.boolean(),
  })
  .strict();

export type AiTutorResponse = z.infer<typeof aiTutorResponseSchema>;

/** `POST /api/ai/explain-error` — cuerpo de la petición. */
export const aiExplainErrorRequestSchema = z
  .object({
    submissionId: z.string({ required_error: "El envío es obligatorio" }).min(1, "El envío es obligatorio"),
  })
  .strict();

export type AiExplainErrorRequest = z.infer<typeof aiExplainErrorRequestSchema>;

export const aiExplainErrorResponseSchema = z
  .object({
    explanation: z.string().min(1),
    errorCategory: z.string().min(1).nullable(),
    suggestedHints: hintsSchema,
    tokensUsed: nonNegativeInt,
    budgetRemainingUsd: z.number().nonnegative(),
    source: aiSourceSchema,
    filtered: z.boolean(),
  })
  .strict();

export type AiExplainErrorResponse = z.infer<typeof aiExplainErrorResponseSchema>;

/** `GET /api/ai/usage` — gasto del mes UTC del usuario. */
export const aiUsageResponseSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener formato AAAA-MM"),
    spentUsd: z.number().nonnegative(),
    budgetUsd: z.number().positive(),
    remainingUsd: z.number().nonnegative(),
    percentUsed: z.number().nonnegative(),
    level: aiBudgetLevelSchema,
    interactions: nonNegativeInt,
  })
  .strict();

export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
