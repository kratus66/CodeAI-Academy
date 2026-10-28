/**
 * Puerto de persistencia de la capa de IA (`sprint-08-capa-ia.md` T6).
 *
 * Lee el contexto del catálogo (lección, unidad, ejercicios), el envío propio y
 * el gasto del mes, y escribe una única cosa: la auditoría `AiInteraction`.
 * Filtra siempre por el `userId` del token.
 */
export const AI_REPOSITORY = Symbol("AI_REPOSITORY");

export type AiModule = "tutor" | "explain" | "interview";

/** Ejercicio de la unidad con lo que las guardas necesitan; nunca sale al cliente. */
export interface AiExerciseContext {
  id: string;
  title: string;
  statement: string;
  concepts: readonly string[];
  /** Competencias C1–C14 del ejercicio; de ahí sale el nivel de dominio. */
  competencies: readonly string[];
  /** Código de la solución oficial; `null` en quizzes y reflexiones. */
  solutionCode: string | null;
}

/** Lección publicada con su ubicación en el currículo. */
export interface AiLessonContext {
  lessonId: string;
  stageTitle: string;
  unitTitle: string;
  unitObjective: string;
  /** Unión de las competencias de los ejercicios de la unidad. */
  competencies: readonly string[];
  /** Ejercicios publicados de la unidad, en orden. */
  exercises: readonly AiExerciseContext[];
}

/** Envío propio, ya corregido por S6, con su ejercicio y su unidad. */
export interface AiSubmissionContext {
  submissionId: string;
  code: string | null;
  outcome: string;
  score: number;
  errorCategory: string | null;
  exercise: AiExerciseContext;
  stageTitle: string;
  unitTitle: string;
  unitObjective: string;
  /** Todos los ejercicios de la unidad: las guardas comparan contra cualquiera. */
  unitExercises: readonly AiExerciseContext[];
}

export interface AiMonthUsage {
  spentUsd: number;
  interactions: number;
}

export interface RecordAiInteractionInput {
  userId: string;
  module: AiModule;
  provider: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number | null;
  success: boolean;
  errorCode: string | null;
}

export interface AiRepository {
  /** `null` si la lección no existe o no está publicada. */
  findLessonContext(lessonId: string): Promise<AiLessonContext | null>;
  /** `null` si el envío no existe o es de otro usuario. */
  findOwnedSubmission(userId: string, submissionId: string): Promise<AiSubmissionContext | null>;
  /** Máximo `CompetencyProgress.level` entre las competencias; `0` sin evidencia. */
  getMasteryLevel(userId: string, competencies: readonly string[]): Promise<number>;
  /** Gasto y llamadas reales del usuario desde `since` (inicio de mes UTC). */
  getUsageSince(userId: string, since: Date): Promise<AiMonthUsage>;
  recordInteraction(input: RecordAiInteractionInput): Promise<void>;
}

/** Datos que el adaptador en memoria sirve en las pruebas. */
export interface AiDataset {
  lessons: readonly AiLessonContext[];
  submissions: readonly (AiSubmissionContext & { userId: string })[];
  mastery?: Readonly<Record<string, number>>;
}

export interface AiInteractionRecord extends RecordAiInteractionInput {
  createdAt: Date;
}
