import type { SubmissionOutcome } from "@codeai/shared";

/**
 * Motor SM-2 (`prerequisitos-y-progreso.md` §5.2).
 *
 * Funciones puras y sin dependencias: el servicio les pasa el estado guardado
 * del ítem y la calidad de la recuperación, y recibe el estado siguiente con su
 * fecha. Nadie más calcula intervalos: ni el cliente, ni el adaptador de datos.
 */

/** Un día en milisegundos; el intervalo de SM-2 se mide en días completos. */
const DAY_MS = 86_400_000;

/** Suelo de la facilidad (§5.2). */
const MIN_EASE_FACTOR = 1.3;

/** Estado persistido de un `ReviewItem` que participa en el cálculo. */
export interface Sm2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

/** Estado siguiente: lo que se guarda en el ítem tras la respuesta. */
export interface Sm2Schedule extends Sm2State {
  dueAt: Date;
}

/** Estado con el que nace un ítem (`modelo-datos.md` §5). */
export function initialReviewState(): Sm2State {
  return { easeFactor: 2.5, intervalDays: 1, repetitions: 0 };
}

/**
 * Aplica un paso de SM-2.
 *
 * Cálculo literal de §5.2: la facilidad se actualiza primero y el intervalo
 * largo (repeticiones > 2) usa la facilidad **previa**, como escribe la fórmula
 * (`round(intervalo_anterior · facilidad)`); la nueva facilidad se guarda para
 * el paso siguiente. Con `q < 3` la progresión se reinicia en un día.
 *
 * La calidad se normaliza a un entero 0–5 de forma defensiva: en HTTP ya la
 * valida `reviewAnswerSchema`, pero la función no debe devolver `NaN` si se
 * reutiliza con datos de semilla.
 */
export function scheduleReview(
  state: Sm2State,
  quality: number,
  now: Date,
): Sm2Schedule {
  const q = clampQuality(quality);
  const easeFactor = roundToCents(
    Math.max(MIN_EASE_FACTOR, state.easeFactor + easeDelta(q)),
  );

  if (q < 3) {
    return { easeFactor, intervalDays: 1, repetitions: 0, dueAt: addDays(now, 1) };
  }

  const repetitions = state.repetitions + 1;
  const intervalDays =
    repetitions === 1
      ? 1
      : repetitions === 2
        ? 6
        : Math.max(1, Math.round(state.intervalDays * state.easeFactor));

  return {
    easeFactor,
    intervalDays,
    repetitions,
    dueAt: addDays(now, intervalDays),
  };
}

/**
 * Calidad de la recuperación derivada del envío corregido (`Submission`).
 *
 * `prerequisitos-y-progreso.md` §5.1: acertar sin pistas es 5, acertar con
 * esfuerzo 3, acertar con pistas 2, fallar con el error identificado 1 y no
 * comprenderlo 0. §5.3 penaliza las pistas de nivel 3+ aunque el envío pase.
 */
export interface SubmissionQualityInput {
  outcome: SubmissionOutcome;
  score: number;
  hintsUsed: number;
}

export function qualityFromSubmission({
  outcome,
  score,
  hintsUsed,
}: SubmissionQualityInput): number {
  switch (outcome) {
    case "PASSED":
      if (hintsUsed === 0) {
        return score >= 90 ? 5 : 4;
      }

      return hintsUsed >= 3 ? 2 : 3;
    case "PARTIAL":
      return 2;
    case "FAILED":
      return 1;
    case "ERROR":
    case "TIMEOUT":
      return 0;
  }
}

/** Variación de facilidad de §5.2 para una calidad dada. */
function easeDelta(quality: number): number {
  const miss = 5 - quality;

  return 0.1 - miss * (0.08 + miss * 0.02);
}

function clampQuality(quality: number): number {
  return Math.min(5, Math.max(0, Math.round(quality)));
}

/** Dos decimales: evita que el binario acumule `2.5999999999999996`. */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}
