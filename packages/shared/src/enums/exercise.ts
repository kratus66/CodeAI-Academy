/** Tipos de ejercicio soportados por la plataforma (ver banco-ejercicios.md). */
export const EXERCISE_TYPES = [
  "LAB",
  "QUIZ",
  "MEMORY",
  "FLASHCARD",
  "DEBUG",
  "AUDIT",
  "CHALLENGE",
  "SIM",
  "READING",
  "REFLECT",
  "PROJECT",
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Escalera de dificultad de una lección: guiado → semi → autónomo. */
export const LADDERS = ["GUIDED", "SEMI", "AUTONOMOUS"] as const;

export type Ladder = (typeof LADDERS)[number];

/** Resultado agregado de un envío de ejercicio. */
export const SUBMISSION_OUTCOMES = [
  "PASSED",
  "FAILED",
  "PARTIAL",
  "ERROR",
  "TIMEOUT",
] as const;

export type SubmissionOutcome = (typeof SUBMISSION_OUTCOMES)[number];

/** Estado de una unidad para un estudiante concreto. */
export const UNIT_STATES = [
  "LOCKED",
  "AVAILABLE",
  "IN_PROGRESS",
  "NEEDS_REVIEW",
  "MASTERED",
] as const;

export type UnitState = (typeof UNIT_STATES)[number];
