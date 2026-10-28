import type {
  InterviewEvaluation,
  InterviewLevel,
  InterviewLanguage,
  InterviewPhase,
  InterviewRole,
  InterviewSelfReviewRecord,
  InterviewStatus,
  InterviewTranscriptEntry,
} from "@codeai/shared";

/**
 * Puerto de persistencia de entrevistas (`sprint-10-entrevistas.md` T5).
 *
 * Devuelve datos ya normalizados (fechas como `Date`) y deja los `Json` como
 * `unknown`: el servicio los valida con `readTranscript`, `readInterviewScores`
 * o `readSelfReview` antes de servirlos. El adaptador Prisma nunca incluye
 * `referenceSolution` en los objetos que salen hacia HTTP, pero el puerto sí lo
 * expone para que el servicio pueda pasarlo al filtro de fuga.
 */
export const INTERVIEWS_REPOSITORY = Symbol("INTERVIEWS_REPOSITORY");

/** Fila de `InterviewScenario` que necesita el módulo. */
export interface InterviewScenarioRecord {
  id: string;
  slug: string;
  title: string;
  role: InterviewRole;
  level: InterviewLevel;
  language: InterviewLanguage;
  /** Códigos C1–C14 que acredita el escenario. */
  competencies: readonly string[];
  /** `[{ phase, maxTurns, objective }]` sin validar. */
  phases: unknown;
  /** Pesos por criterio sin validar. */
  rubric: unknown;
  /** Material privado para el filtro de fuga; nunca se mapea a una respuesta. */
  referenceSolution: string;
  estimatedMinutes: number;
  isPublished: boolean;
  createdAt: Date;
}

/** Sesión con su escenario embebido: evita una segunda consulta al mapear. */
export interface InterviewSessionRecord {
  id: string;
  userId: string;
  status: InterviewStatus;
  phase: InterviewPhase;
  turns: number;
  /** `[{ role, phase, content, at }]` sin validar. */
  transcript: unknown;
  scores: unknown;
  selfScores: unknown;
  feedback: string | null;
  degraded: boolean;
  startedAt: Date;
  lastTurnAt: Date | null;
  finishedAt: Date | null;
  reviewedAt: Date | null;
  scenario: InterviewScenarioRecord;
}

/** Fila del catálogo con los intentos del usuario autenticado. */
export interface ScenarioCatalogRow extends InterviewScenarioRecord {
  /** Sesiones propias del escenario, en cualquier estado. */
  attempts: number;
}

/** Filtros ya validados por `interviewScenarioListQuerySchema`. */
export interface ListScenariosFilter {
  role?: InterviewRole;
  level?: InterviewLevel;
  language?: InterviewLanguage;
  page: number;
  pageSize: number;
}

export interface ScenariosPage {
  items: ScenarioCatalogRow[];
  total: number;
}

export interface CreateInterviewSessionRecord {
  userId: string;
  scenarioId: string;
  phase: InterviewPhase;
  transcript: readonly InterviewTranscriptEntry[];
  startedAt: Date;
}

export interface SaveInterviewTurnRecord {
  sessionId: string;
  transcript: readonly InterviewTranscriptEntry[];
  turns: number;
  phase: InterviewPhase;
  lastTurnAt: Date;
  degraded: boolean;
}

export interface FinishInterviewSessionRecord {
  sessionId: string;
  finishedAt: Date;
}

export interface SaveInterviewSelfReviewRecord {
  sessionId: string;
  selfScores: InterviewSelfReviewRecord;
}

export interface SaveInterviewReviewRecord {
  sessionId: string;
  reviewerId: string;
  scores: InterviewEvaluation;
  feedback: string;
  reviewedAt: Date;
}

export interface InterviewRepository {
  /** Sólo escenarios publicados; orden estable por nivel y título. */
  listPublishedScenarios(
    filter: ListScenariosFilter,
    userId: string,
  ): Promise<ScenariosPage>;
  /** `null` si el escenario no existe o no está publicado. */
  findPublishedScenarioBySlug(
    slug: string,
    userId: string,
  ): Promise<ScenarioCatalogRow | null>;
  /** Sesión `IN_PROGRESS` del usuario en ese escenario, si existe. */
  findOpenSession(
    userId: string,
    scenarioId: string,
  ): Promise<InterviewSessionRecord | null>;
  /** `null` si el escenario desapareció antes de crear la sesión. */
  createSession(
    input: CreateInterviewSessionRecord,
  ): Promise<InterviewSessionRecord | null>;
  /** Sin filtro de dueño: el servicio decide si el visitante puede verla. */
  findSessionById(sessionId: string): Promise<InterviewSessionRecord | null>;
  /** `null` si la sesión desapareció antes de guardar el turno. */
  saveTurn(
    input: SaveInterviewTurnRecord,
  ): Promise<InterviewSessionRecord | null>;
  /** `null` si la sesión desapareció antes de cerrarla. */
  finishSession(
    input: FinishInterviewSessionRecord,
  ): Promise<InterviewSessionRecord | null>;
  /** `null` si la sesión desapareció antes de guardar la autoevaluación. */
  saveSelfReview(
    input: SaveInterviewSelfReviewRecord,
  ): Promise<InterviewSessionRecord | null>;
  /** `null` si la sesión desapareció antes de guardar la revisión. */
  saveReview(
    input: SaveInterviewReviewRecord,
  ): Promise<InterviewSessionRecord | null>;
  /** Historial propio, más reciente primero. */
  listSessionsByUser(userId: string): Promise<InterviewSessionRecord[]>;
  /** Marca `ABANDONED` las sesiones abiertas sin actividad desde `before`. */
  expireStaleSessions(userId: string, before: Date): Promise<void>;
  /**
   * Deja evidencia de C10 sin bajar el nivel ya alcanzado: sube a 3 como
   * mínimo, incrementa `evidenceCount` y sella `lastEvaluated`.
   */
  addCompetencyEvidence(
    userId: string,
    competency: string,
    evaluatedAt: Date,
  ): Promise<void>;
}

/** Nivel mínimo que deja una entrevista aprobada (nota ≥ 80) en C10. */
export const INTERVIEW_APPROVED_COMPETENCY_LEVEL = 3;

/** Datos que el adaptador en memoria sirve en las pruebas. */
export interface InterviewDataset {
  scenarios: readonly InterviewScenarioRecord[];
  sessions?: readonly InterviewSessionRecord[];
}
