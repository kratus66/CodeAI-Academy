/**
 * Puerto de persistencia del repaso (`modelo-datos.md` §5).
 *
 * Devuelve filas ya normalizadas (fechas como `Date`) y filtra siempre por el
 * `userId` que llega del token: el cliente nunca elige de quién es un ítem.
 */
export const REVIEW_REPOSITORY = Symbol("REVIEW_REPOSITORY");

/** Ítem de la cola con lo que la web necesita para pintarlo. */
export interface ReviewItemRow {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  exerciseSlug: string;
  /** Concepto del ejercicio; agrupa el intercalado (§5.3). */
  concept: string;
  /** Competencias del ejercicio (C1–C14); permiten leer aciertos por competencia. */
  competencies: readonly string[];
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
  priority: number;
}

/** Estado siguiente ya calculado por `scheduleReview`; el adaptador sólo escribe. */
export interface ReviewAnswerState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
  reviewedAt: Date;
  priority: number;
}

export interface SaveReviewAnswerInput extends ReviewAnswerState {
  userId: string;
  itemId: string;
  quality: number;
}

export interface ScheduleFromSubmissionInput extends ReviewAnswerState {
  userId: string;
  exerciseId: string;
  quality: number;
}

export interface ReviewRepository {
  /** Vencidos del usuario, primero los prioritarios y luego los más antiguos. */
  listDue(userId: string, now: Date, limit: number): Promise<ReviewItemRow[]>;
  /** Deuda total: puede superar el tamaño de la cola servida. */
  countDue(userId: string, now: Date): Promise<number>;
  /** `null` si el ítem no existe o pertenece a otro usuario. */
  findOwned(userId: string, id: string): Promise<ReviewItemRow | null>;
  /** Estado guardado del ítem de un ejercicio; `null` si aún no existe. */
  findByExercise(userId: string, exerciseId: string): Promise<ReviewItemRow | null>;
  /** Actualiza el estado del ítem y añade su `ReviewLog`. */
  saveAnswer(input: SaveReviewAnswerInput): Promise<void>;
  /**
   * Crea o reprograma el único ítem del usuario para el ejercicio y registra
   * la respuesta. Devuelve `false` si el ejercicio ya no existe.
   */
  scheduleFromSubmission(input: ScheduleFromSubmissionInput): Promise<boolean>;
}

/** Un ítem con dueño: sólo el adaptador en memoria lo necesita. */
export interface ReviewItemSeed extends ReviewItemRow {
  userId: string;
}

/** Ejercicio del catálogo que el adaptador en memoria usa para programar. */
export interface ReviewExerciseSeed {
  id: string;
  title: string;
  slug: string;
  concepts: readonly string[];
  competencies: readonly string[];
}

export interface ReviewDataset {
  items: readonly ReviewItemSeed[];
  exercises: readonly ReviewExerciseSeed[];
}

export const EMPTY_REVIEW_DATASET: ReviewDataset = { items: [], exercises: [] };

/** Fila de bitácora que el adaptador en memoria guarda para las pruebas. */
export interface ReviewLogRecord {
  reviewItemId: string;
  quality: number;
  intervalDays: number;
  easeFactor: number;
  reviewedAt: Date;
}
