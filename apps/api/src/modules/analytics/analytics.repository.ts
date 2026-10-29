import type { AnalyticsRange, UnitState } from "@codeai/shared";

/**
 * Puerto de analítica (`sprint-11-analitica-lanzamiento.md` T2).
 *
 * Los agregados se calculan en SQL: el servicio nunca trae todos los envíos ni
 * todos los repasos para contarlos en memoria. Todas las consultas filtran por
 * el `userId` que llega del token; la cohorte sólo devuelve datos agregados y
 * el nombre visible de cada estudiante.
 */
export const ANALYTICS_REPOSITORY = Symbol("ANALYTICS_REPOSITORY");

/** Ventana de fechas ya resuelta a partir de `range`. */
export interface AnalyticsWindow {
  readonly range: AnalyticsRange;
  /** Inicio inclusivo; la época (`1970-01-01`) representa `all`. */
  readonly from: Date;
  /** Fin inclusivo: el instante de la petición. */
  readonly to: Date;
}

/** Contadores de unidades publicadas y suma de su avance. */
export interface UnitMetricsRow {
  readonly byState: Readonly<Record<UnitState, number>>;
  readonly totalUnits: number;
  readonly progressPctSum: number;
}

export interface SubmissionMetricsRow {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  /** Media sin redondear; `null` si no hubo envíos. */
  readonly avgScore: number | null;
}

export interface ActivityMetricsRow {
  /** Días UTC distintos con envío o repaso dentro de la ventana. */
  readonly activeDays: number;
  /** Última actividad global, no limitada por la ventana. */
  readonly lastActivityAt: Date | null;
}

export interface ReviewMetricsRow {
  readonly due: number;
  readonly completed: number;
  readonly lapses: number;
}

export interface AiMetricsRow {
  readonly calls: number;
  readonly costUsd: number;
}

export interface ErrorCountRow {
  readonly category: string;
  readonly count: number;
}

export interface ConceptErrorRow {
  readonly concept: string;
  readonly count: number;
}

export interface CohortStudentRow {
  readonly userId: string;
  readonly displayName: string;
  /** Suma del avance de sus unidades publicadas (0–100 cada una). */
  readonly progressPctSum: number;
  readonly lastActivityAt: Date | null;
  /** Se usa como referencia cuando el estudiante nunca ha actuado. */
  readonly createdAt: Date;
}

export interface StageCompletionRow {
  readonly stage: string;
  readonly units: number;
  readonly progressPctSum: number;
  readonly studentsAtStage: number;
}

export interface CohortMetricsRow {
  readonly students: number;
  readonly activeStudents: number;
  readonly publishedUnits: number;
  readonly studentProgress: readonly CohortStudentRow[];
  readonly stageCompletion: readonly StageCompletionRow[];
  readonly errorRows: readonly ErrorCountRow[];
  /** Repasos vencidos de toda la cohorte en este instante. */
  readonly reviewBacklog: number;
}

export interface AnalyticsRepository {
  getUnitMetrics(userId: string): Promise<UnitMetricsRow>;
  getSubmissionMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<SubmissionMetricsRow>;
  getActivityMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ActivityMetricsRow>;
  getReviewMetrics(
    userId: string,
    window: AnalyticsWindow,
    now: Date,
  ): Promise<ReviewMetricsRow>;
  getAiMetrics(userId: string, window: AnalyticsWindow): Promise<AiMetricsRow>;
  getErrorBreakdown(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ErrorCountRow[]>;
  getConceptErrors(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ConceptErrorRow[]>;
  getCohortMetrics(
    window: AnalyticsWindow,
    now: Date,
  ): Promise<CohortMetricsRow>;
}
