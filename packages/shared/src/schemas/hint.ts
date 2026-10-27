import { z } from "zod";

/**
 * Contrato de las pistas (`contratos-api.md` §4.3, `POST /api/exercises/:id/hints`).
 * La respuesta nunca incluye `solution`, `code`, `tests` ni `hintsUsed`.
 */

/** Niveles de pista disponibles (`contratos-api.md` §4.3). */
export const HINT_LEVELS = [1, 2, 3] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];

/** Longitud máxima del texto de una pista. */
export const HINT_TEXT_MAX_CHARS = 2_000;

const HINT_LEVEL_MESSAGE = "El nivel de pista debe ser 1, 2 o 3";

/** Nivel de pista solicitado: solo 1, 2 o 3 (`contratos-api.md` §4.3). */
export const hintLevelSchema = z.union(
  [z.literal(1), z.literal(2), z.literal(3)],
  { errorMap: () => ({ message: HINT_LEVEL_MESSAGE }) },
);

/** `POST /api/exercises/:id/hints` — cuerpo de la petición (`contratos-api.md` §4.3). */
export const hintRequestSchema = z
  .object({
    level: hintLevelSchema,
  })
  .strict();

/** Pista entregada (`contratos-api.md` §4.3): nivel, texto y si existe un nivel siguiente. */
export const hintResponseSchema = z
  .object({
    level: hintLevelSchema,
    text: z
      .string({
        required_error: "El texto de la pista es obligatorio",
        invalid_type_error: "El texto de la pista debe ser texto",
      })
      .min(1, "El texto de la pista es obligatorio")
      .max(
        HINT_TEXT_MAX_CHARS,
        `El texto de la pista no puede superar ${HINT_TEXT_MAX_CHARS} caracteres`,
      ),
    nextLevelAvailable: z.boolean({
      required_error: "Indica si hay un nivel siguiente",
      invalid_type_error: "nextLevelAvailable debe ser booleano",
    }),
  })
  .strict();

/** Respuesta de `POST /api/exercises/:id/hints`: `{ hint }` (`contratos-api.md` §4.3). */
export const hintResponseEnvelopeSchema = z.object({ hint: hintResponseSchema }).strict();

export type HintRequestInput = z.infer<typeof hintRequestSchema>;
export type HintResponse = z.infer<typeof hintResponseSchema>;
export type HintResponseEnvelope = z.infer<typeof hintResponseEnvelopeSchema>;
