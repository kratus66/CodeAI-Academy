import type { UnitState } from "@codeai/shared";
import { Injectable } from "@nestjs/common";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  ActivityMetricsRow,
  AiMetricsRow,
  AnalyticsRepository,
  AnalyticsWindow,
  CohortMetricsRow,
  CohortStudentRow,
  ConceptErrorRow,
  ErrorCountRow,
  ReviewMetricsRow,
  StageCompletionRow,
  SubmissionMetricsRow,
  UnitMetricsRow,
} from "./analytics.repository";

/** Una fila por estado con al menos un registro de progreso. */
interface StateCountRow {
  state: string;
  count: number;
  progressPctSum: number;
}

interface SubmissionAggregateRow {
  total: number;
  passed: number;
  avgScore: number | null;
}

interface ActivityAggregateRow {
  activeDays: number;
  lastActivityAt: Date | null;
}

interface ReviewAggregateRow {
  due: number;
  completed: number;
  lapses: number;
}

interface ConceptCountRow {
  concept: string;
  count: number;
}

interface StudentProgressRow {
  userId: string;
  displayName: string;
  progressPctSum: number;
  lastActivityAt: Date | null;
  createdAt: Date;
}

interface StageCompletionDbRow {
  stage: string;
  units: number;
  progressPctSum: number;
  studentsAtStage: number;
}

interface CountRow {
  count: number;
}

const PUBLISHED_UNIT_WHERE = {
  isPublished: true,
  module: { isPublished: true, stage: { isPublished: true } },
} as const;

/** Adaptador Prisma del puerto `AnalyticsRepository` (`T2`). */
@Injectable()
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUnitMetrics(userId: string): Promise<UnitMetricsRow> {
    const [rows, totalUnits] = await Promise.all([
      this.prisma.$queryRaw<StateCountRow[]>`
        SELECT up.state::text AS state,
               COUNT(*)::int AS count,
               COALESCE(SUM(up."progressPct"), 0)::float8 AS "progressPctSum"
        FROM "UnitProgress" up
        JOIN "Unit" u ON u.id = up."unitId" AND u."isPublished"
        JOIN "Module" m ON m.id = u."moduleId" AND m."isPublished"
        JOIN "Stage" st ON st.id = m."stageId" AND st."isPublished"
        WHERE up."userId" = ${userId}
        GROUP BY up.state
      `,
      this.prisma.unit.count({ where: PUBLISHED_UNIT_WHERE }),
    ]);

    const byState: Record<UnitState, number> = {
      MASTERED: 0,
      IN_PROGRESS: 0,
      NEEDS_REVIEW: 0,
      LOCKED: 0,
      AVAILABLE: 0,
    };
    let progressPctSum = 0;
    let tracked = 0;

    for (const row of rows) {
      if (row.state in byState) {
        byState[row.state as keyof typeof byState] = row.count;
      }
      tracked += row.count;
      progressPctSum += row.progressPctSum;
    }

    // Las unidades publicadas sin fila de progreso siguen bloqueadas.
    byState.LOCKED += Math.max(0, totalUnits - tracked);

    return { byState, totalUnits, progressPctSum };
  }

  async getSubmissionMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<SubmissionMetricsRow> {
    const [row] = await this.prisma.$queryRaw<SubmissionAggregateRow[]>`
      SELECT COUNT(*)::int AS total,
             (COUNT(*) FILTER (WHERE s.outcome = 'PASSED'))::int AS passed,
             AVG(s.score)::float8 AS "avgScore"
      FROM "Submission" s
      WHERE s."userId" = ${userId}
        AND s."createdAt" >= ${window.from}
        AND s."createdAt" <= ${window.to}
    `;

    const total = row?.total ?? 0;
    const passed = row?.passed ?? 0;

    return {
      total,
      passed,
      failed: total - passed,
      avgScore: row?.avgScore ?? null,
    };
  }

  async getActivityMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ActivityMetricsRow> {
    const [row] = await this.prisma.$queryRaw<ActivityAggregateRow[]>`
      WITH activity AS (
        SELECT s."createdAt" AS at
        FROM "Submission" s
        WHERE s."userId" = ${userId}
        UNION ALL
        SELECT rl."reviewedAt" AS at
        FROM "ReviewLog" rl
        JOIN "ReviewItem" ri ON ri.id = rl."reviewItemId"
        WHERE ri."userId" = ${userId}
      )
      SELECT (COUNT(DISTINCT (at)::date) FILTER (
                WHERE at >= ${window.from} AND at <= ${window.to}
              ))::int AS "activeDays",
             MAX(at) AS "lastActivityAt"
      FROM activity
    `;

    return {
      activeDays: row?.activeDays ?? 0,
      lastActivityAt: row?.lastActivityAt ?? null,
    };
  }

  async getReviewMetrics(
    userId: string,
    window: AnalyticsWindow,
    now: Date,
  ): Promise<ReviewMetricsRow> {
    const [row] = await this.prisma.$queryRaw<ReviewAggregateRow[]>`
      SELECT (
               SELECT COUNT(*)::int
               FROM "ReviewItem" due
               WHERE due."userId" = ${userId} AND due."dueAt" <= ${now}
             ) AS due,
             (COUNT(*) FILTER (
               WHERE rl."reviewedAt" >= ${window.from}
                 AND rl."reviewedAt" <= ${window.to}
             ))::int AS completed,
             (COUNT(*) FILTER (
               WHERE rl."reviewedAt" >= ${window.from}
                 AND rl."reviewedAt" <= ${window.to}
                 AND rl.quality < 3
             ))::int AS lapses
      FROM "ReviewLog" rl
      JOIN "ReviewItem" ri ON ri.id = rl."reviewItemId"
      WHERE ri."userId" = ${userId}
    `;

    return {
      due: row?.due ?? 0,
      completed: row?.completed ?? 0,
      lapses: row?.lapses ?? 0,
    };
  }

  async getAiMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<AiMetricsRow> {
    const aggregate = await this.prisma.aiInteraction.aggregate({
      where: { userId, createdAt: { gte: window.from, lte: window.to } },
      _count: { _all: true },
      _sum: { costUsd: true },
    });

    return {
      calls: aggregate._count._all,
      costUsd: aggregate._sum.costUsd ?? 0,
    };
  }

  async getErrorBreakdown(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ErrorCountRow[]> {
    const rows = await this.prisma.submission.groupBy({
      by: ["errorCategory"],
      where: {
        userId,
        createdAt: { gte: window.from, lte: window.to },
        errorCategory: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { errorCategory: "desc" } },
    });

    return rows
      .filter(
        (row): row is typeof row & { errorCategory: string } =>
          row.errorCategory !== null,
      )
      .map((row) => ({
        category: row.errorCategory,
        count: row._count._all,
      }));
  }

  async getConceptErrors(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<ConceptErrorRow[]> {
    return this.prisma.$queryRaw<ConceptCountRow[]>`
      SELECT concept, COUNT(*)::int AS count
      FROM "Submission" s
      JOIN "Exercise" e ON e.id = s."exerciseId"
      CROSS JOIN LATERAL unnest(e.concepts) AS concept
      WHERE s."userId" = ${userId}
        AND s."createdAt" >= ${window.from}
        AND s."createdAt" <= ${window.to}
        AND s.outcome <> 'PASSED'
      GROUP BY concept
      ORDER BY count DESC, concept ASC
      LIMIT 10
    `;
  }

  async getCohortMetrics(
    window: AnalyticsWindow,
    now: Date,
  ): Promise<CohortMetricsRow> {
    const [
      students,
      activeRow,
      publishedUnits,
      studentProgress,
      stages,
      errorRows,
      reviewBacklog,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: "STUDENT", isActive: true } }),
      this.prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count
        FROM "User" u
        WHERE u.role = 'STUDENT' AND u."isActive" = true AND (
          EXISTS (
            SELECT 1 FROM "Submission" s
            WHERE s."userId" = u.id
              AND s."createdAt" >= ${window.from}
              AND s."createdAt" <= ${window.to}
          )
          OR EXISTS (
            SELECT 1 FROM "ReviewLog" rl
            JOIN "ReviewItem" ri ON ri.id = rl."reviewItemId"
            WHERE ri."userId" = u.id
              AND rl."reviewedAt" >= ${window.from}
              AND rl."reviewedAt" <= ${window.to}
          )
        )
      `,
      this.prisma.unit.count({ where: PUBLISHED_UNIT_WHERE }),
      this.prisma.$queryRaw<StudentProgressRow[]>`
        SELECT u.id AS "userId",
               u.name AS "displayName",
               COALESCE((
                 SELECT SUM(up."progressPct")
                 FROM "UnitProgress" up
                 JOIN "Unit" un ON un.id = up."unitId"
                 JOIN "Module" mo ON mo.id = un."moduleId"
                 JOIN "Stage" st ON st.id = mo."stageId"
                 WHERE up."userId" = u.id
                   AND un."isPublished"
                   AND mo."isPublished"
                   AND st."isPublished"
               ), 0)::float8 AS "progressPctSum",
               GREATEST(
                 (SELECT MAX(up."lastActivityAt")
                  FROM "UnitProgress" up WHERE up."userId" = u.id),
                 (SELECT MAX(s."createdAt")
                  FROM "Submission" s WHERE s."userId" = u.id),
                 (SELECT MAX(rl."reviewedAt")
                  FROM "ReviewLog" rl
                  JOIN "ReviewItem" ri ON ri.id = rl."reviewItemId"
                  WHERE ri."userId" = u.id)
               ) AS "lastActivityAt",
               u."createdAt" AS "createdAt"
        FROM "User" u
        WHERE u.role = 'STUDENT' AND u."isActive" = true
        ORDER BY u."createdAt" ASC, u.id ASC
      `,
      this.prisma.$queryRaw<StageCompletionDbRow[]>`
        SELECT st.title AS stage,
               COUNT(DISTINCT u.id)::int AS units,
               COALESCE(SUM(up."progressPct"), 0)::float8 AS "progressPctSum",
               COUNT(DISTINCT up."userId")::int AS "studentsAtStage"
        FROM "Stage" st
        JOIN "Module" m ON m."stageId" = st.id AND m."isPublished"
        JOIN "Unit" u ON u."moduleId" = m.id AND u."isPublished"
        LEFT JOIN "UnitProgress" up ON up."unitId" = u.id
        WHERE st."isPublished"
        GROUP BY st.id, st.title, st."order"
        ORDER BY st."order" ASC
      `,
      this.prisma.submission.groupBy({
        by: ["errorCategory"],
        where: {
          createdAt: { gte: window.from, lte: window.to },
          errorCategory: { not: null },
          user: { role: "STUDENT", isActive: true },
        },
        _count: { _all: true },
        orderBy: { _count: { errorCategory: "desc" } },
      }),
      this.prisma.reviewItem.count({
        where: {
          dueAt: { lte: now },
          user: { role: "STUDENT", isActive: true },
        },
      }),
    ]);

    return {
      students,
      activeStudents: activeRow[0]?.count ?? 0,
      publishedUnits,
      studentProgress: studentProgress.map(toCohortStudentRow),
      stageCompletion: stages.map(toStageCompletionRow),
      errorRows: errorRows
        .filter(
          (row): row is typeof row & { errorCategory: string } =>
            row.errorCategory !== null,
        )
        .map((row) => ({
          category: row.errorCategory,
          count: row._count._all,
        })),
      reviewBacklog,
    };
  }
}

function toCohortStudentRow(row: StudentProgressRow): CohortStudentRow {
  return {
    userId: row.userId,
    displayName: row.displayName,
    progressPctSum: row.progressPctSum,
    lastActivityAt: row.lastActivityAt,
    createdAt: row.createdAt,
  };
}

function toStageCompletionRow(row: StageCompletionDbRow): StageCompletionRow {
  return {
    stage: row.stage,
    units: row.units,
    progressPctSum: row.progressPctSum,
    studentsAtStage: row.studentsAtStage,
  };
}
