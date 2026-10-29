import type {
  AnalyticsBudgetLevel,
  AnalyticsRange,
  CohortAnalytics,
  ErrorBreakdown,
  StudentSummary,
} from "@codeai/shared";
import { COHORT_AT_RISK_LIMIT } from "@codeai/shared";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { startOfMonthUtc } from "../ai/budget.policy";
import type {
  AnalyticsRepository,
  AnalyticsWindow,
  ErrorCountRow,
} from "./analytics.repository";
import { ANALYTICS_REPOSITORY } from "./analytics.repository";
import { daysSince } from "./in-memory-analytics.repository";

/** Inyectable para fijar el reloj en las pruebas. */
export const ANALYTICS_CLOCK = Symbol("ANALYTICS_CLOCK");
/** Presupuesto mensual de IA (`AI_MONTHLY_BUDGET_USD`), inyectado por el módulo. */
export const ANALYTICS_AI_BUDGET_USD = Symbol("ANALYTICS_AI_BUDGET_USD");
export const DEFAULT_AI_BUDGET_USD = 5;
/** A partir del 80 % del presupuesto el resumen avisa (`§4.1`). */
export const BUDGET_WARNING_RATIO = 0.8;
export const AT_RISK_LIMIT = COHORT_AT_RISK_LIMIT;
export const TOP_ERROR_LIMIT = 10;

const DAY_MS = 86_400_000;

/** Días naturales que cubre cada rango; `all` empieza en la época. */
export const RANGE_DAYS: Readonly<Record<Exclude<AnalyticsRange, "all">, number>> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/**
 * Ventana inclusiva de días UTC. `7d` son hoy y los seis días anteriores, no
 * 168 horas: así `activeDays` nunca supera el número de días del rango.
 */
export function analyticsWindow(range: AnalyticsRange, now: Date): AnalyticsWindow {
  if (range === "all") {
    return { range, from: new Date(0), to: now };
  }

  const startOfTodayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  const totalDays = RANGE_DAYS[range] ?? 1;

  return {
    range,
    from: new Date(startOfTodayUtc - (totalDays - 1) * DAY_MS),
    to: now,
  };
}

/** Nivel de gasto mensual de IA, con los mismos umbrales que la capa de IA. */
export function resolveAnalyticsBudgetLevel(
  spentUsd: number,
  budgetUsd: number,
): AnalyticsBudgetLevel {
  const ratio =
    budgetUsd > 0 ? spentUsd / budgetUsd : spentUsd > 0 ? Number.POSITIVE_INFINITY : 0;

  if (ratio >= 1) return "exceeded";
  if (ratio >= BUDGET_WARNING_RATIO) return "warning";

  return "ok";
}

/**
 * Nombre visible de un concepto cuando sólo existe su slug. El catálogo de
 * conceptos no tiene etiquetas propias: `definicion-ia` se muestra como
 * «Definicion ia», sin inventar acentos que el dato no guarda.
 */
export function conceptDisplayName(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();

  if (words.length === 0) {
    return slug;
  }

  return words.charAt(0).toUpperCase() + words.slice(1);
}

function withShares(
  rows: readonly ErrorCountRow[],
  total: number,
): { category: string; count: number; share: number }[] {
  return [...rows]
    .sort(
      (left, right) =>
        right.count - left.count || left.category.localeCompare(right.category),
    )
    .map((row) => ({
      category: row.category,
      count: row.count,
      share: total === 0 ? 0 : round4(row.count / total),
    }));
}

function ratioPct(sum: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return round1(clampPct(sum / denominator));
}

function clampPct(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly repository: AnalyticsRepository,
    @Optional()
    @Inject(ANALYTICS_CLOCK)
    private readonly clock: () => Date = () => new Date(),
    @Optional()
    @Inject(ANALYTICS_AI_BUDGET_USD)
    private readonly aiBudgetUsd: number = DEFAULT_AI_BUDGET_USD,
  ) {}

  async getSummary(userId: string, range: AnalyticsRange): Promise<StudentSummary> {
    const now = this.clock();
    const window = analyticsWindow(range, now);
    const monthWindow: AnalyticsWindow = {
      range,
      from: startOfMonthUtc(now),
      to: now,
    };

    const [units, submissions, activity, reviews, ai, aiMonth] = await Promise.all([
      this.repository.getUnitMetrics(userId),
      this.repository.getSubmissionMetrics(userId, window),
      this.repository.getActivityMetrics(userId, window),
      this.repository.getReviewMetrics(userId, window, now),
      this.repository.getAiMetrics(userId, window),
      // El nivel de presupuesto es mensual aunque el rango sea `7d`.
      this.repository.getAiMetrics(userId, monthWindow),
    ]);

    const total = units.totalUnits;

    return {
      range,
      // Misma media que `/progress/overview`: dos pantallas no pueden dar
      // porcentajes distintos para el mismo estudiante.
      overallPct: ratioPct(units.progressPctSum, total),
      activeDays: activity.activeDays,
      lastActivityAt: activity.lastActivityAt?.toISOString() ?? null,
      units: {
        mastered: units.byState.MASTERED,
        inProgress: units.byState.IN_PROGRESS + units.byState.AVAILABLE,
        needsReview: units.byState.NEEDS_REVIEW,
        locked: units.byState.LOCKED,
        total,
      },
      submissions: {
        total: submissions.total,
        passed: submissions.passed,
        failed: submissions.failed,
        avgScore:
          submissions.avgScore === null
            ? null
            : round1(clampPct(submissions.avgScore)),
      },
      reviews,
      ai: {
        calls: ai.calls,
        costUsd: round4(Math.max(0, ai.costUsd)),
        budgetLevel: resolveAnalyticsBudgetLevel(aiMonth.costUsd, this.aiBudgetUsd),
      },
    };
  }

  async getErrors(userId: string, range: AnalyticsRange): Promise<ErrorBreakdown> {
    const window = analyticsWindow(range, this.clock());
    const [byCategory, byConcept] = await Promise.all([
      this.repository.getErrorBreakdown(userId, window),
      this.repository.getConceptErrors(userId, window),
    ]);
    const total = byCategory.reduce((sum, row) => sum + row.count, 0);

    return {
      range,
      total,
      byCategory: withShares(byCategory, total),
      byConcept: byConcept.slice(0, TOP_ERROR_LIMIT).map((row) => ({
        conceptSlug: row.concept,
        conceptName: conceptDisplayName(row.concept),
        count: row.count,
      })),
    };
  }

  async getCohort(range: AnalyticsRange): Promise<CohortAnalytics> {
    const now = this.clock();
    const window = analyticsWindow(range, now);
    const metrics = await this.repository.getCohortMetrics(window, now);
    const denominator = metrics.publishedUnits * metrics.students;

    const atRisk = metrics.studentProgress
      .map((student) => ({
        userId: student.userId,
        displayName: student.displayName,
        overallPct: ratioPct(student.progressPctSum, metrics.publishedUnits),
        daysSinceActivity: daysSince(student.lastActivityAt, student.createdAt, now),
      }))
      .sort(
        (left, right) =>
          right.daysSinceActivity - left.daysSinceActivity ||
          left.overallPct - right.overallPct ||
          left.userId.localeCompare(right.userId),
      )
      .slice(0, AT_RISK_LIMIT);

    const errorTotal = metrics.errorRows.reduce((sum, row) => sum + row.count, 0);

    return {
      range,
      students: { total: metrics.students, active: metrics.activeStudents },
      avgOverallPct:
        denominator === 0
          ? 0
          : round1(
              clampPct(
                metrics.studentProgress.reduce(
                  (sum, student) => sum + Math.max(0, student.progressPctSum),
                  0,
                ) / denominator,
              ),
            ),
      stageCompletion: metrics.stageCompletion.map((stage) => ({
        stage: stage.stage,
        completedPct: ratioPct(
          stage.progressPctSum,
          stage.units * Math.max(metrics.students, 1),
        ),
        studentsAtStage: stage.studentsAtStage,
      })),
      topErrors: withShares(metrics.errorRows, errorTotal),
      reviewBacklog: metrics.reviewBacklog,
      atRisk,
    };
  }
}
