/**
 * Tope de intentos de un ejercicio (`sprint-06-correccion-pistas.md` §4: intentos
 * agotados → `409 CONFLICT`; `modelo-datos.md` §3: `Exercise.maxAttempts Int?`,
 * `null` = sin límite).
 *
 * Función pura: no conoce Nest ni Prisma y no lanza. Quien decide responder el
 * `409` es el servicio.
 */

/** Mensaje único del `409 CONFLICT` de intentos agotados (ficha §4). */
export const ATTEMPTS_EXHAUSTED = "Has agotado los intentos de este ejercicio";

export interface AttemptLimitInput {
  /** Envíos ya persistidos por este usuario en este ejercicio. */
  attemptsUsed: number;
  /** `Exercise.maxAttempts`; `null` = sin límite. */
  maxAttempts: number | null;
}

/** Permitido: `attemptNumber` es el número del envío que se va a crear (1-based). */
export type AttemptLimit =
  | { allowed: true; attemptNumber: number }
  | { allowed: false; attemptNumber: number; maxAttempts: number };

export function checkAttemptLimit(input: AttemptLimitInput): AttemptLimit {
  const attemptsUsed = Math.max(0, input.attemptsUsed);
  const attemptNumber = attemptsUsed + 1;
  const { maxAttempts } = input;

  const unlimited = maxAttempts === null || !Number.isInteger(maxAttempts) || maxAttempts < 1;

  if (unlimited || attemptsUsed < maxAttempts) {
    return { allowed: true, attemptNumber };
  }

  return { allowed: false, attemptNumber, maxAttempts };
}
