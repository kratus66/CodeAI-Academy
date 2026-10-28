import type {
  InterviewLevel,
  InterviewLanguage,
  InterviewPhase,
  InterviewRole,
  InterviewStatus,
} from "@codeai/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  CreateInterviewSessionRecord,
  FinishInterviewSessionRecord,
  InterviewRepository,
  InterviewScenarioRecord,
  InterviewSessionRecord,
  ListScenariosFilter,
  SaveInterviewReviewRecord,
  SaveInterviewSelfReviewRecord,
  SaveInterviewTurnRecord,
  ScenarioCatalogRow,
  ScenariosPage,
} from "./interview.repository";
import { INTERVIEW_APPROVED_COMPETENCY_LEVEL } from "./interview.repository";

/** Columnas que el puerto necesita; `referenceSolution` sólo para el filtro de fuga. */
const SCENARIO_SELECT = {
  id: true,
  slug: true,
  title: true,
  role: true,
  level: true,
  language: true,
  competencies: true,
  phases: true,
  rubric: true,
  referenceSolution: true,
  estimatedMinutes: true,
  isPublished: true,
  createdAt: true,
} satisfies Prisma.InterviewScenarioSelect;

const SESSION_INCLUDE = {
  scenario: { select: SCENARIO_SELECT },
} satisfies Prisma.InterviewSessionInclude;

type ScenarioRow = Prisma.InterviewScenarioGetPayload<{
  select: typeof SCENARIO_SELECT;
}>;
type SessionRow = Prisma.InterviewSessionGetPayload<{
  include: typeof SESSION_INCLUDE;
}>;

/** La base guarda `String`; el catálogo sólo sembró valores del contrato. */
function toScenarioRecord(row: ScenarioRow): InterviewScenarioRecord {
  return {
    ...row,
    role: row.role as InterviewRole,
    level: row.level as InterviewLevel,
    language: row.language as InterviewLanguage,
  };
}

function toSessionRecord(row: SessionRow): InterviewSessionRecord {
  return {
    ...row,
    status: row.status as InterviewStatus,
    phase: row.phase as InterviewPhase,
    scenario: toScenarioRecord(row.scenario),
  };
}

function isMissingRow(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

/** Adaptador Prisma del puerto `InterviewRepository`. */
@Injectable()
export class PrismaInterviewRepository implements InterviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublishedScenarios(
    filter: ListScenariosFilter,
    userId: string,
  ): Promise<ScenariosPage> {
    const where: Prisma.InterviewScenarioWhereInput = { isPublished: true };

    if (filter.role !== undefined) where.role = filter.role;
    if (filter.level !== undefined) where.level = filter.level;
    if (filter.language !== undefined) where.language = filter.language;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.interviewScenario.findMany({
        where,
        orderBy: [{ level: "asc" }, { title: "asc" }, { id: "asc" }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        select: {
          ...SCENARIO_SELECT,
          _count: { select: { sessions: { where: { userId } } } },
        },
      }),
      this.prisma.interviewScenario.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        ...toScenarioRecord(row),
        attempts: row._count.sessions,
      })),
      total,
    };
  }

  async findPublishedScenarioBySlug(
    slug: string,
    userId: string,
  ): Promise<ScenarioCatalogRow | null> {
    const row = await this.prisma.interviewScenario.findFirst({
      where: { slug, isPublished: true },
      select: {
        ...SCENARIO_SELECT,
        _count: { select: { sessions: { where: { userId } } } },
      },
    });

    return row === null
      ? null
      : { ...toScenarioRecord(row), attempts: row._count.sessions };
  }

  async findOpenSession(
    userId: string,
    scenarioId: string,
  ): Promise<InterviewSessionRecord | null> {
    const row = await this.prisma.interviewSession.findFirst({
      where: { userId, scenarioId, status: "IN_PROGRESS" },
      include: SESSION_INCLUDE,
      orderBy: { startedAt: "desc" },
    });

    return row === null ? null : toSessionRecord(row);
  }

  async createSession(
    input: CreateInterviewSessionRecord,
  ): Promise<InterviewSessionRecord | null> {
    try {
      const row = await this.prisma.interviewSession.create({
        data: {
          userId: input.userId,
          scenarioId: input.scenarioId,
          phase: input.phase,
          transcript: input.transcript as unknown as Prisma.InputJsonValue,
          startedAt: input.startedAt,
        },
        include: SESSION_INCLUDE,
      });

      return toSessionRecord(row);
    } catch (error: unknown) {
      if (isMissingRow(error)) return null;
      throw error;
    }
  }

  async findSessionById(
    sessionId: string,
  ): Promise<InterviewSessionRecord | null> {
    const row = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: SESSION_INCLUDE,
    });

    return row === null ? null : toSessionRecord(row);
  }

  async saveTurn(
    input: SaveInterviewTurnRecord,
  ): Promise<InterviewSessionRecord | null> {
    try {
      const row = await this.prisma.interviewSession.update({
        where: { id: input.sessionId },
        data: {
          transcript: input.transcript as unknown as Prisma.InputJsonValue,
          turns: input.turns,
          phase: input.phase,
          lastTurnAt: input.lastTurnAt,
          degraded: input.degraded,
        },
        include: SESSION_INCLUDE,
      });

      return toSessionRecord(row);
    } catch (error: unknown) {
      if (isMissingRow(error)) return null;
      throw error;
    }
  }

  async finishSession(
    input: FinishInterviewSessionRecord,
  ): Promise<InterviewSessionRecord | null> {
    try {
      const row = await this.prisma.interviewSession.update({
        where: { id: input.sessionId },
        data: { status: "COMPLETED", finishedAt: input.finishedAt },
        include: SESSION_INCLUDE,
      });

      return toSessionRecord(row);
    } catch (error: unknown) {
      if (isMissingRow(error)) return null;
      throw error;
    }
  }

  async saveSelfReview(
    input: SaveInterviewSelfReviewRecord,
  ): Promise<InterviewSessionRecord | null> {
    try {
      const row = await this.prisma.interviewSession.update({
        where: { id: input.sessionId },
        data: {
          selfScores: input.selfScores as unknown as Prisma.InputJsonValue,
        },
        include: SESSION_INCLUDE,
      });

      return toSessionRecord(row);
    } catch (error: unknown) {
      if (isMissingRow(error)) return null;
      throw error;
    }
  }

  async saveReview(
    input: SaveInterviewReviewRecord,
  ): Promise<InterviewSessionRecord | null> {
    try {
      const row = await this.prisma.interviewSession.update({
        where: { id: input.sessionId },
        data: {
          status: "REVIEWED",
          scores: input.scores as unknown as Prisma.InputJsonValue,
          feedback: input.feedback,
          reviewedById: input.reviewerId,
          reviewedAt: input.reviewedAt,
        },
        include: SESSION_INCLUDE,
      });

      return toSessionRecord(row);
    } catch (error: unknown) {
      if (isMissingRow(error)) return null;
      throw error;
    }
  }

  async listSessionsByUser(userId: string): Promise<InterviewSessionRecord[]> {
    const rows = await this.prisma.interviewSession.findMany({
      where: { userId },
      include: SESSION_INCLUDE,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    });

    return rows.map(toSessionRecord);
  }

  async expireStaleSessions(userId: string, before: Date): Promise<void> {
    await this.prisma.interviewSession.updateMany({
      where: {
        userId,
        status: "IN_PROGRESS",
        OR: [
          { lastTurnAt: { lt: before } },
          { lastTurnAt: null, startedAt: { lt: before } },
        ],
      },
      data: { status: "ABANDONED" },
    });
  }

  async addCompetencyEvidence(
    userId: string,
    competency: string,
    evaluatedAt: Date,
  ): Promise<void> {
    const key = { userId_competency: { userId, competency } };
    const current = await this.prisma.competencyProgress.findUnique({
      where: key,
    });

    if (current === null) {
      await this.prisma.competencyProgress.create({
        data: {
          userId,
          competency,
          level: INTERVIEW_APPROVED_COMPETENCY_LEVEL,
          evidenceCount: 1,
          lastEvaluated: evaluatedAt,
        },
      });

      return;
    }

    await this.prisma.competencyProgress.update({
      where: key,
      data: {
        level: Math.max(current.level, INTERVIEW_APPROVED_COMPETENCY_LEVEL),
        evidenceCount: { increment: 1 },
        lastEvaluated: evaluatedAt,
      },
    });
  }
}