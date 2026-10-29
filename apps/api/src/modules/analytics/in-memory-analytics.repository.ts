import type { Role, UnitState } from "@codeai/shared";
import { Injectable } from "@nestjs/common";

import type {
  ActivityMetricsRow,
  AiMetricsRow,
  AnalyticsRepository,
  AnalyticsWindow,
  CohortMetricsRow,
  ConceptErrorRow,
  ErrorCountRow,
  ReviewMetricsRow,
  SubmissionMetricsRow,
  UnitMetricsRow,
} from "./analytics.repository";

const DAY_MS = 86_400_000;

export interface AnalyticsUserSeed {
  id: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

export interface AnalyticsUnitSeed {
  id: string;
  /** Título de la etapa, en el orden en que se siembra el currículo. */
  stage: string;
  isPublished: boolean;
}

export interface AnalyticsUnitProgressSeed {
  userId: string;
  unitId: string;
  state: UnitState;
  progressPct: number;
  lastActivityAt: Date | null;
}

export interface AnalyticsSubmissionSeed {
  userId: string;
  createdAt: Date;
  outcome: string;
  score: number;
  errorCategory: string | null;
  concepts: readonly string[];
}

export interface AnalyticsReviewSeed {
  userId: string;
  dueAt: Date;
  logs: readonly { reviewedAt: Date; quality: number }[];
}

export interface AnalyticsAiSeed {
  userId: string;
  createdAt: Date;
  costUsd: number;
}

/** Datos que el adaptador en memoria sirve en las pruebas y en la demo. */
export interface AnalyticsDataset {
  users: readonly AnalyticsUserSeed[];
  units: readonly AnalyticsUnitSeed[];
  unitProgress: readonly AnalyticsUnitProgressSeed[];
  submissions: readonly AnalyticsSubmissionSeed[];
  reviews: readonly AnalyticsReviewSeed[];
  ai: readonly AnalyticsAiSeed[];
}

export const EMPTY_ANALYTICS_DATASET: AnalyticsDataset = {
  users: [],
  units: [],
  unitProgress: [],
  submissions: [],
  reviews: [],
  ai: [],
};

const EMPTY_BY_STATE: Record<UnitState, number> = {
  MASTERED: 0,
  IN_PROGRESS: 0,
  NEEDS_REVIEW: 0,
  LOCKED: 0,
  AVAILABLE: 0,
};

function inWindow(date: Date, window: AnalyticsWindow): boolean {
  return date >= window.from && date <= window.to;
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function clampPct(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
}

function maxDate(current: Date | null, candidate: Date | null): Date | null {
  if (!candidate) {
    return current;
  }

  return current === null || candidate > current ? candidate : current;
}

function sortCounts(counts: ReadonlyMap<string, number>): ErrorCountRow[] {
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.category.localeCompare(right.category),
    );
}

/** Distancia en días, nunca negativa, desde la última actividad. */
export function daysSince(
  lastActivityAt: Date | null,
  createdAt: Date,
  now: Date,
): number {
  const reference = lastActivityAt ?? createdAt;

  return Math.max(0, Math.floor((now.getTime() - reference.getTime()) / DAY_MS));
}

function stageCompletion(
  published: readonly AnalyticsUnitSeed[],
  progressRows: readonly AnalyticsUnitProgressSeed[],
): CohortMetricsRow["stageCompletion"] {
  const stages = new Map<
    string,
    { units: number; progressPctSum: number; students: Set<string> }
  >();

  for (const unit of published) {
    const entry = stages.get(unit.stage) ?? {
      units: 0,
      progressPctSum: 0,
      students: new Set<string>(),
    };

    entry.units += 1;
    stages.set(unit.stage, entry);
  }

  for (const row of progressRows) {
    const unit = published.find((candidate) => candidate.id === row.unitId);
    const entry = unit ? stages.get(unit.stage) : undefined;

    if (!entry) {
      continue;
    }

    entry.progressPctSum += clampPct(row.progressPct);
    entry.students.add(row.userId);
  }

  return [...stages.entries()].map(([stage, entry]) => ({
    stage,
    units: entry.units,
    progressPctSum: entry.progressPctSum,
    studentsAtStage: entry.students.size,
  }));
}

/**
 * Adaptador en memoria del puerto de analítica. Reproduce las mismas reglas que
 * el SQL del adaptador Prisma para que la suite fije los números exactos del
 * fixture; no sustituye una prueba de integración contra PostgreSQL.
 */
@Injectable()
export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  constructor(
    private readonly dataset: AnalyticsDataset = EMPTY_ANALYTICS_DATASET,
  ) {}

  async getUnitMetrics(userId: string): Promise<UnitMetricsRow> {
    const published = this.dataset.units.filter((unit) => unit.isPublished);
    const publishedIds = new Set(published.map((unit) => unit.id));
    const rows = this.dataset.unitProgress.filter(
      (row) => row.userId === userId && publishedIds.has(row.unitId),
    );

    const byState: Record<UnitState, number> = { ...EMPTY_BY_STATE };
    let progressPctSum = 0;

    for (const row of rows) {
      byState[row.state] += 1;
      progressPctSum += clampPct(row.progressPct);
    }

    // Una unidad publicada sin fila de progreso sigue bloqueada; una fila
    // explícita `LOCKED` ya está contada arriba.
    byState.LOCKED += published.length - rows.length;

    return { byState, totalUnits: published.length, progressPctSum };
  }

  async getSubmissionMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<SubmissionMetricsRow> {
    const rows = this.dataset.submissions.filter(
      (row) => row.userId === userId && inWindow(row.createdAt, window),
    );
    const passed = rows.filter((row) => row.outcome === "PASSED").length;
    const scoreSum = rows.reduce((sum, row) => sum + clampPct(row.score), 0);

    return {
      total: rows.length,
      passed,
      failed: rows.length - passed,
      avgScore: rows.length === 0 ? null : scoreSum / rows.length,
    };
  }

  async getActivityMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ActivityMetricsRow> {
    const submissions = this.dataset.submissions.filter(
      (row) => row.userId === userId,
    );
    const logs = this.dataset.reviews
      .filter((review) => review.userId === userId)
      .flatMap((review) => review.logs);

    const days = new Set<string>();
    let lastActivityAt: Date | null = null;

    for (const row of submissions) {
      lastActivityAt = maxDate(lastActivityAt, row.createdAt);

      if (inWindow(row.createdAt, window)) {
        days.add(utcDayKey(row.createdAt));
      }
    }

    for (const log of logs) {
      lastActivityAt = maxDate(lastActivityAt, log.reviewedAt);

      if (inWindow(log.reviewedAt, window)) {
        days.add(utcDayKey(log.reviewedAt));
      }
    }

    return { activeDays: days.size, lastActivityAt };
  }

  async getReviewMetrics(
    userId: string,
    window: AnalyticsWindow,
    now: Date,
  ): Promise<ReviewMetricsRow> {
    const reviews = this.dataset.reviews.filter(
      (review) => review.userId === userId,
    );
    const logs = reviews
      .flatMap((review) => review.logs)
      .filter((log) => inWindow(log.reviewedAt, window));

    return {
      due: reviews.filter((review) => review.dueAt <= now).length,
      completed: logs.length,
      lapses: logs.filter((log) => log.quality < 3).length,
    };
  }

  async getAiMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<AiMetricsRow> {
    const calls = this.dataset.ai.filter(
      (row) => row.userId === userId && inWindow(row.createdAt, window),
    );

    return {
      calls: calls.length,
      costUsd: calls.reduce((sum, row) => sum + Math.max(0, row.costUsd), 0),
    };
  }

  async getErrorBreakdown(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ErrorCountRow[]> {
    const counts = new Map<string, number>();

    for (const row of this.dataset.submissions) {
      if (
        row.userId !== userId ||
        !inWindow(row.createdAt, window) ||
        row.errorCategory === null
      ) {
        continue;
      }

      counts.set(row.errorCategory, (counts.get(row.errorCategory) ?? 0) + 1);
    }

    return sortCounts(counts);
  }

  async getConceptErrors(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ConceptErrorRow[]> {
    const counts = new Map<string, number>();

    for (const row of this.dataset.submissions) {
      if (
        row.userId !== userId ||
        !inWindow(row.createdAt, window) ||
        row.outcome === "PASSED"
      ) {
        continue;
      }

      for (const concept of new Set(row.concepts)) {
        counts.set(concept, (counts.get(concept) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([concept, count]) => ({ concept, count }))
      .sort(
        (left, right) =>
          right.count - left.count || left.concept.localeCompare(right.concept),
      )
      .slice(0, 10);
  }

  async getCohortMetrics(
    window: AnalyticsWindow,
    now: Date,
  ): Promise<CohortMetricsRow> {
    const students = this.dataset.users.filter(
      (user) => user.role === "STUDENT" && user.isActive,
    );
    const studentIds = new Set(students.map((student) => student.id));
    const published = this.dataset.units.filter((unit) => unit.isPublished);
    const publishedIds = new Set(published.map((unit) => unit.id));
    const progressRows = this.dataset.unitProgress.filter(
      (row) => studentIds.has(row.userId) && publishedIds.has(row.unitId),
    );

    return {
      students: students.length,
      activeStudents: students.filter((student) => {
        const hasSubmission = this.dataset.submissions.some(
          (row) =>
            row.userId === student.id && inWindow(row.createdAt, window),
        );
        const hasReview = this.dataset.reviews.some(
          (review) =>
            review.userId === student.id &&
            review.logs.some((log) => inWindow(log.reviewedAt, window)),
        );

        return hasSubmission || hasReview;
      }).length,
      publishedUnits: published.length,
      studentProgress: students.map((student) =>
        this.studentProgress(student, progressRows),
      ),
      stageCompletion: stageCompletion(published, progressRows),
      errorRows: this.cohortErrors(studentIds, window),
      reviewBacklog: this.dataset.reviews.filter(
        (review) => studentIds.has(review.userId) && review.dueAt <= now,
      ).length,
    };
  }

  private studentProgress(
    student: AnalyticsUserSeed,
    progressRows: readonly AnalyticsUnitProgressSeed[],
  ): CohortMetricsRow["studentProgress"][number] {
    const own = progressRows.filter((row) => row.userId === student.id);
    let lastActivityAt: Date | null = null;

    for (const row of own) {
      lastActivityAt = maxDate(lastActivityAt, row.lastActivityAt);
    }

    for (const submission of this.dataset.submissions) {
      if (submission.userId === student.id) {
        lastActivityAt = maxDate(lastActivityAt, submission.createdAt);
      }
    }

    for (const review of this.dataset.reviews) {
      if (review.userId === student.id) {
        for (const log of review.logs) {
          lastActivityAt = maxDate(lastActivityAt, log.reviewedAt);
        }
      }
    }

    return {
      userId: student.id,
      displayName: student.name,
      progressPctSum: own.reduce((sum, row) => sum + clampPct(row.progressPct), 0),
      lastActivityAt,
      createdAt: student.createdAt,
    };
  }

  private cohortErrors(
    studentIds: ReadonlySet<string>,
    window: AnalyticsWindow,
  ): ErrorCountRow[] {
    const counts = new Map<string, number>();

    for (const row of this.dataset.submissions) {
      if (
        !studentIds.has(row.userId) ||
        !inWindow(row.createdAt, window) ||
        row.errorCategory === null
      ) {
        continue;
      }

      counts.set(row.errorCategory, (counts.get(row.errorCategory) ?? 0) + 1);
    }

    return sortCounts(counts);
  }
}
