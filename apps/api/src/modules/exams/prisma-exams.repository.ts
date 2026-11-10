import { Injectable } from "@nestjs/common";
import { certificationCodeSchema } from "@codeai/shared";
import type {
  CertificationCode,
  ExamAttemptStatus,
  ExamFormCode,
  ExamMode,
} from "@codeai/shared";
import { Prisma } from "@prisma/client";
import type {
  ExamAttemptStatus as PrismaExamAttemptStatus,
  ExamMode as PrismaExamMode,
} from "@prisma/client";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  AttemptItemRow,
  AttemptRow,
  CreateAttemptInput,
  CreateRealResultInput,
  ExamsRepository,
  FinishAttemptInput,
  ReadinessFactsRow,
  RealResultRow,
  ReservedQuestionRow,
  UpdateItemPatch,
} from "./exams.repository";

/** Los enums de Prisma y los del contrato se traducen aquí y solo aquí. */
const MODE_FROM_PRISMA: Record<PrismaExamMode, ExamMode> = {
  FORM_A: "form-a",
  FORM_B: "form-b",
  FORM_C: "form-c",
  RANDOM: "random",
  DOMAIN: "domain",
};

const MODE_TO_PRISMA: Record<ExamMode, PrismaExamMode> = {
  "form-a": "FORM_A",
  "form-b": "FORM_B",
  "form-c": "FORM_C",
  random: "RANDOM",
  domain: "DOMAIN",
};

const STATUS_FROM_PRISMA: Record<PrismaExamAttemptStatus, ExamAttemptStatus> = {
  IN_PROGRESS: "in-progress",
  SUBMITTED: "submitted",
  EXPIRED: "expired",
};

export function examModeFromPrisma(mode: PrismaExamMode): ExamMode {
  return MODE_FROM_PRISMA[mode];
}

export function examModeToPrisma(mode: ExamMode): PrismaExamMode {
  return MODE_TO_PRISMA[mode];
}

export function examStatusFromPrisma(
  status: PrismaExamAttemptStatus,
): ExamAttemptStatus {
  return STATUS_FROM_PRISMA[status];
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Días de retraso a partir de los cuales un repaso cuenta como vencido. */
const OVERDUE_REVIEW_DAYS = 7;

const QUESTION_SELECT = {
  id: true,
  slug: true,
  examDomain: true,
  statement: true,
  config: true,
  solution: true,
  reviewedByHuman: true,
  competencies: true,
  unit: { select: { code: true } },
} satisfies Prisma.ExerciseSelect;

const ITEM_INCLUDE = {
  exercise: { select: QUESTION_SELECT },
} satisfies Prisma.ExamAttemptItemInclude;

const ATTEMPT_INCLUDE = {
  items: { include: ITEM_INCLUDE, orderBy: { position: "asc" } },
} satisfies Prisma.ExamAttemptInclude;

type QuestionRecord = Prisma.ExerciseGetPayload<{ select: typeof QUESTION_SELECT }>;
type ItemRecord = Prisma.ExamAttemptItemGetPayload<{ include: typeof ITEM_INCLUDE }>;
type AttemptRecord = Prisma.ExamAttemptGetPayload<{ include: typeof ATTEMPT_INCLUDE }>;
type AttemptHeaderRecord = Omit<AttemptRecord, "items">;

function toQuestion(record: QuestionRecord): ReservedQuestionRow {
  return {
    exerciseId: record.id,
    slug: record.slug,
    domain: record.examDomain ?? 0,
    unitCode: record.unit.code,
    statement: record.statement,
    config: record.config,
    solution: record.solution,
    reviewedByHuman: record.reviewedByHuman,
    competencies: [...record.competencies],
  };
}

function toItem(record: ItemRecord): AttemptItemRow {
  return {
    position: record.position,
    exerciseId: record.exerciseId,
    domain: record.domain,
    answer: record.answer,
    flagged: record.flagged,
    correct: record.correct,
    question: toQuestion(record.exercise),
  };
}

function toAttemptHeader(record: AttemptHeaderRecord): Omit<AttemptRow, "items"> {
  return {
    id: record.id,
    userId: record.userId,
    certification: certificationCodeSchema.parse(record.certification),
    mode: examModeFromPrisma(record.mode),
    domain: record.domain,
    extraTime: record.extraTime,
    status: examStatusFromPrisma(record.status),
    orientative: record.orientative,
    startedAt: record.startedAt,
    deadlineAt: record.deadlineAt,
    submittedAt: record.submittedAt,
    correctCount: record.correctCount,
    scorePct: record.scorePct,
    domainScores: record.domainScores,
  };
}

function toAttempt(record: AttemptRecord): AttemptRow {
  return { ...toAttemptHeader(record), items: record.items.map(toItem) };
}

function toRealResult(record: {
  id: string;
  userId: string;
  certification: string;
  passed: boolean;
  scaledScore: number | null;
  takenOn: Date;
  readyAtRegistration: boolean;
  createdAt: Date;
}): RealResultRow {
  return {
    id: record.id,
    userId: record.userId,
    certification: certificationCodeSchema.parse(record.certification),
    passed: record.passed,
    scaledScore: record.scaledScore,
    takenOn: record.takenOn,
    readyAtRegistration: record.readyAtRegistration,
    createdAt: record.createdAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Adaptador Prisma del simulador (S15-T6b). Las consultas del banco reservado
 * son propias: `ExercisesRepository` lo excluye a propósito (S14-T8a).
 */
@Injectable()
export class PrismaExamsRepository implements ExamsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listReservedPool(certification: CertificationCode): Promise<ReservedQuestionRow[]> {
    const rows = await this.prisma.exercise.findMany({
      where: { type: "QUIZ", examPool: "RESERVED", isPublished: true, certification },
      select: QUESTION_SELECT,
      orderBy: [{ examDomain: "asc" }, { slug: "asc" }],
    });

    return rows.map(toQuestion);
  }

  async findFormSlugs(
    certification: CertificationCode,
    code: ExamFormCode,
  ): Promise<string[] | null> {
    const form = await this.prisma.examForm.findUnique({
      where: { certification_code: { certification, code } },
      select: { exerciseSlugs: true },
    });

    return form ? [...form.exerciseSlugs] : null;
  }

  countForms(certification: CertificationCode): Promise<number> {
    return this.prisma.examForm.count({ where: { certification } });
  }

  async recentExerciseIds(
    userId: string,
    certification: CertificationCode,
    lastAttempts: number,
  ): Promise<Set<string>> {
    const take = Math.max(0, Math.trunc(lastAttempts));

    if (take === 0) {
      return new Set();
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId, certification, status: { not: "IN_PROGRESS" } },
      orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }, { id: "desc" }],
      take,
      select: { items: { select: { exerciseId: true } } },
    });

    return new Set(
      attempts.flatMap((attempt) => attempt.items.map((item) => item.exerciseId)),
    );
  }

  async findOpenAttemptId(
    userId: string,
    certification: CertificationCode,
  ): Promise<string | null> {
    const open = await this.prisma.examAttempt.findFirst({
      where: { userId, certification, status: "IN_PROGRESS" },
      select: { id: true },
    });

    return open?.id ?? null;
  }

  async createAttempt(input: CreateAttemptInput): Promise<AttemptRow> {
    const created = await this.prisma.examAttempt.create({
      data: {
        userId: input.userId,
        certification: input.certification,
        mode: examModeToPrisma(input.mode),
        domain: input.domain,
        extraTime: input.extraTime,
        orientative: input.orientative,
        startedAt: input.startedAt,
        deadlineAt: input.deadlineAt,
        items: {
          create: input.items.map((item) => ({
            position: item.position,
            exerciseId: item.exerciseId,
            domain: item.domain,
          })),
        },
      },
      include: ATTEMPT_INCLUDE,
    });

    return toAttempt(created);
  }

  async findOwnedAttempt(userId: string, attemptId: string): Promise<AttemptRow | null> {
    const found = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, userId },
      include: ATTEMPT_INCLUDE,
    });

    return found ? toAttempt(found) : null;
  }

  async updateItem(
    attemptId: string,
    position: number,
    patch: UpdateItemPatch,
  ): Promise<AttemptItemRow> {
    const data: Prisma.ExamAttemptItemUpdateInput = {};

    if (patch.answer !== undefined) {
      data.answer = patch.answer === null ? Prisma.DbNull : toJson(patch.answer);
    }

    if (patch.flagged !== undefined) {
      data.flagged = patch.flagged;
    }

    if (patch.answeredAt !== undefined) {
      data.answeredAt = patch.answeredAt;
    }

    const updated = await this.prisma.examAttemptItem.update({
      where: { attemptId_position: { attemptId, position } },
      data,
      include: ITEM_INCLUDE,
    });

    return toItem(updated);
  }

  finishAttempt(attemptId: string, input: FinishAttemptInput): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const closed = await tx.examAttempt.updateMany({
        where: { id: attemptId, status: "IN_PROGRESS" },
        data: {
          status: input.status,
          submittedAt: input.submittedAt,
          correctCount: input.correctCount,
          scorePct: input.scorePct,
          domainScores: toJson(input.domainScores),
        },
      });

      if (closed.count === 0) {
        return false;
      }

      for (const item of input.itemCorrectness) {
        await tx.examAttemptItem.update({
          where: { attemptId_position: { attemptId, position: item.position } },
          data: { correct: item.correct },
        });
      }

      return true;
    });
  }

  async listAttempts(
    userId: string,
    certification: CertificationCode,
  ): Promise<Omit<AttemptRow, "items">[]> {
    const rows = await this.prisma.examAttempt.findMany({
      where: { userId, certification },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    });

    return rows.map(toAttemptHeader);
  }

  async readinessFacts(
    userId: string,
    stageId: number,
    now: Date,
  ): Promise<ReadinessFactsRow> {
    const overdueBefore = new Date(now.getTime() - OVERDUE_REVIEW_DAYS * DAY_MS);

    const units = await this.prisma.unit.findMany({
      where: { isPublished: true, module: { stageId } },
      orderBy: { code: "asc" },
      select: {
        code: true,
        progress: { where: { userId, state: "MASTERED" }, select: { id: true } },
      },
    });

    const overdueReviewCount = await this.prisma.reviewItem.count({
      where: {
        userId,
        dueAt: { lt: overdueBefore },
        exercise: { unit: { module: { stageId } } },
      },
    });

    const project = await this.prisma.project.findFirst({
      where: { stageId, isPublished: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    let bestReviewedProjectScore: number | null = null;

    if (project) {
      const best = await this.prisma.projectSubmission.aggregate({
        where: { userId, projectId: project.id, status: "REVIEWED" },
        _max: { score: true },
      });
      bestReviewedProjectScore = best._max.score;
    }

    return {
      unitsTotal: units.length,
      pendingUnitCodes: units
        .filter((unit) => unit.progress.length === 0)
        .map((unit) => unit.code),
      overdueReviewCount,
      projectAvailable: project !== null,
      bestReviewedProjectScore,
    };
  }

  async createRealResult(input: CreateRealResultInput): Promise<RealResultRow> {
    const created = await this.prisma.realExamResult.create({
      data: {
        userId: input.userId,
        certification: input.certification,
        passed: input.passed,
        scaledScore: input.scaledScore,
        takenOn: input.takenOn,
        readyAtRegistration: input.readyAtRegistration,
      },
    });

    return toRealResult(created);
  }

  async latestRealResult(
    userId: string,
    certification: CertificationCode,
  ): Promise<RealResultRow | null> {
    const latest = await this.prisma.realExamResult.findFirst({
      where: { userId, certification },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return latest ? toRealResult(latest) : null;
  }
}
