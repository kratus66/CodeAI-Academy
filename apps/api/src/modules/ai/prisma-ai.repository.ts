import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  AiExerciseContext,
  AiLessonContext,
  AiMonthUsage,
  AiRepository,
  AiSubmissionContext,
  RecordAiInteractionInput,
} from "./ai.repository";

/** Lección publicada con toda su ascendencia publicada. */
const PUBLISHED_ANCESTRY = {
  isPublished: true,
  module: { isPublished: true, stage: { isPublished: true } },
} as const;

const EXERCISE_SELECT = {
  id: true,
  title: true,
  statement: true,
  concepts: true,
  competencies: true,
  solution: true,
} satisfies Prisma.ExerciseSelect;

type ExerciseDbRow = Prisma.ExerciseGetPayload<{ select: typeof EXERCISE_SELECT }>;

const UNIT_SELECT = {
  title: true,
  objective: true,
  module: { select: { stage: { select: { title: true } } } },
  exercises: {
    where: { isPublished: true },
    orderBy: { order: "asc" },
    select: EXERCISE_SELECT,
  },
} satisfies Prisma.UnitSelect;

/** Adaptador Prisma del puerto `AiRepository`. */
@Injectable()
export class PrismaAiRepository implements AiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLessonContext(lessonId: string): Promise<AiLessonContext | null> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, isPublished: true, unit: PUBLISHED_ANCESTRY },
      select: { id: true, unit: { select: UNIT_SELECT } },
    });

    if (lesson === null) {
      return null;
    }

    const exercises = lesson.unit.exercises.map(toExerciseContext);

    return {
      lessonId: lesson.id,
      stageTitle: lesson.unit.module.stage.title,
      unitTitle: lesson.unit.title,
      unitObjective: lesson.unit.objective,
      competencies: [...new Set(exercises.flatMap((exercise) => exercise.competencies))].sort(),
      exercises,
    };
  }

  async findOwnedSubmission(userId: string, submissionId: string): Promise<AiSubmissionContext | null> {
    const submission = await this.prisma.submission.findFirst({
      where: { id: submissionId, userId },
      select: {
        id: true,
        code: true,
        outcome: true,
        score: true,
        errorCategory: true,
        exercise: { select: { ...EXERCISE_SELECT, unit: { select: UNIT_SELECT } } },
      },
    });

    if (submission === null) {
      return null;
    }

    const { unit, ...exercise } = submission.exercise;

    return {
      submissionId: submission.id,
      code: submission.code,
      outcome: submission.outcome,
      score: submission.score,
      errorCategory: submission.errorCategory,
      exercise: toExerciseContext(exercise),
      stageTitle: unit.module.stage.title,
      unitTitle: unit.title,
      unitObjective: unit.objective,
      unitExercises: unit.exercises.map(toExerciseContext),
    };
  }

  async getMasteryLevel(userId: string, competencies: readonly string[]): Promise<number> {
    if (competencies.length === 0) {
      return 0;
    }

    const result = await this.prisma.competencyProgress.aggregate({
      where: { userId, competency: { in: [...competencies] } },
      _max: { level: true },
    });

    return result._max.level ?? 0;
  }

  async getUsageSince(userId: string, since: Date): Promise<AiMonthUsage> {
    const result = await this.prisma.aiInteraction.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: { costUsd: true },
      _count: { _all: true },
    });

    return { spentUsd: result._sum.costUsd ?? 0, interactions: result._count._all };
  }

  async recordInteraction(input: RecordAiInteractionInput): Promise<void> {
    await this.prisma.aiInteraction.create({ data: input });
  }
}

function toExerciseContext(row: ExerciseDbRow): AiExerciseContext {
  return {
    id: row.id,
    title: row.title,
    statement: row.statement,
    concepts: row.concepts,
    competencies: row.competencies,
    solutionCode: readSolutionCode(row.solution),
  };
}

/** `Exercise.solution` es `{ code }` en los ejercicios de código; otro formato no cuenta. */
function readSolutionCode(solution: Prisma.JsonValue): string | null {
  if (typeof solution === "object" && solution !== null && !Array.isArray(solution)) {
    const code = solution.code;

    return typeof code === "string" && code.length > 0 ? code : null;
  }

  return null;
}
