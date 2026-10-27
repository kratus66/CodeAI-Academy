import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type { Page, PageWindow } from "../content/content.repository";
import type {
  CreateSubmissionInput,
  ExercisesRepository,
  ExerciseRow,
  SubmissionRow,
} from "./exercises.repository";

/** Ejercicio publicado con toda su ascendencia publicada. */
const PUBLISHED_EXERCISE = {
  isPublished: true,
  unit: {
    isPublished: true,
    module: { isPublished: true, stage: { isPublished: true } },
  },
} as const;

/**
 * Se traen `solution` y los tests ocultos a propósito: el servicio los necesita
 * para el envío y el mapper garantiza que no salgan al cliente.
 *
 * `satisfies` (y no `as const`) porque Prisma exige `orderBy` mutable, pero se
 * conservan los literales para que `ExerciseGetPayload` deduzca la fila exacta.
 */
const EXERCISE_SELECT = {
  id: true,
  unitId: true,
  slug: true,
  type: true,
  title: true,
  statement: true,
  config: true,
  solution: true,
  ladder: true,
  difficulty: true,
  competencies: true,
  estimatedMin: true,
  language: true,
  unit: { select: { code: true } },
  hints: { select: { level: true }, orderBy: { level: "asc" } },
  tests: {
    select: { id: true, name: true, isHidden: true, weight: true, spec: true },
    orderBy: [{ isHidden: "asc" }, { name: "asc" }],
  },
} satisfies Prisma.ExerciseSelect;

const SUBMISSION_SELECT = {
  id: true,
  outcome: true,
  score: true,
  achievedLevel: true,
  hintsUsed: true,
  createdAt: true,
  results: {
    select: { testId: true, passed: true, durationMs: true },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.SubmissionSelect;

type ExerciseDbRow = Prisma.ExerciseGetPayload<{ select: typeof EXERCISE_SELECT }>;
type SubmissionDbRow = Prisma.SubmissionGetPayload<{ select: typeof SUBMISSION_SELECT }>;

/** Adaptador Prisma del puerto `ExercisesRepository`. */
@Injectable()
export class PrismaExercisesRepository implements ExercisesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUnit(unitCode: string, window: PageWindow): Promise<Page<ExerciseRow>> {
    const where: Prisma.ExerciseWhereInput = {
      ...PUBLISHED_EXERCISE,
      unit: {
        isPublished: true,
        module: { isPublished: true, stage: { isPublished: true } },
        code: unitCode,
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.exercise.findMany({
        where,
        orderBy: [{ order: "asc" }, { slug: "asc" }],
        skip: window.skip,
        take: window.take,
        select: EXERCISE_SELECT,
      }),
      this.prisma.exercise.count({ where }),
    ]);

    return { items: rows.map(toExerciseRow), total };
  }

  async findPublished(id: string): Promise<ExerciseRow | null> {
    const row = await this.prisma.exercise.findFirst({
      where: { id, ...PUBLISHED_EXERCISE },
      select: EXERCISE_SELECT,
    });

    return row === null ? null : toExerciseRow(row);
  }

  /**
   * Misma condición de publicación que el listado: si la unidad no está
   * publicada (o no existe), el estudiante recibe `404` en vez de una lista
   * vacía que parecería «sin ejercicios».
   */
  async unitExists(unitCode: string): Promise<boolean> {
    const row = await this.prisma.unit.findFirst({
      where: {
        code: unitCode,
        isPublished: true,
        module: { isPublished: true, stage: { isPublished: true } },
      },
      select: { id: true },
    });

    return row !== null;
  }

  async listSubmissions(
    userId: string,
    exerciseId: string,
    window: PageWindow,
  ): Promise<Page<SubmissionRow>> {
    const where: Prisma.SubmissionWhereInput = { userId, exerciseId };

    const [rows, total, tests] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: window.skip,
        take: window.take,
        select: SUBMISSION_SELECT,
      }),
      this.prisma.submission.count({ where }),
      this.prisma.exerciseTest.findMany({
        where: { exerciseId },
        select: { id: true, name: true },
      }),
    ]);

    const names = new Map(tests.map((test) => [test.id, test.name]));

    return { items: rows.map((row) => toSubmissionRow(row, names)), total };
  }

  async createSubmission(input: CreateSubmissionInput): Promise<SubmissionRow> {
    const row = await this.prisma.submission.create({
      data: {
        userId: input.userId,
        exerciseId: input.exerciseId,
        code: input.code,
        outcome: input.outcome,
        score: input.score,
        hintsUsed: input.hintsUsed,
        durationMs: input.durationMs,
        ...(input.selfExplanation === undefined
          ? {}
          : { selfExplanation: input.selfExplanation }),
        results: {
          create: input.results.map((result) => ({
            testId: result.testId,
            passed: result.passed,
            durationMs: result.durationMs,
          })),
        },
      },
      select: SUBMISSION_SELECT,
    });

    return toSubmissionRow(row, new Map(input.results.map((result) => [result.testId, result.name])));
  }
}

function toExerciseRow(row: ExerciseDbRow): ExerciseRow {
  return {
    id: row.id,
    unitId: row.unitId,
    unitCode: row.unit.code,
    slug: row.slug,
    type: row.type,
    title: row.title,
    statement: row.statement,
    config: row.config,
    solution: row.solution,
    ladder: row.ladder,
    difficulty: row.difficulty,
    competencies: row.competencies,
    estimatedMin: row.estimatedMin,
    language: row.language,
    hintLevels: row.hints.map((hint) => hint.level),
    tests: row.tests,
  };
}

function toSubmissionRow(
  row: SubmissionDbRow,
  names: ReadonlyMap<string, string>,
): SubmissionRow {
  return {
    id: row.id,
    outcome: row.outcome,
    score: row.score,
    achievedLevel: row.achievedLevel,
    hintsUsed: row.hintsUsed,
    createdAt: row.createdAt,
    results: row.results.map((result) => ({
      testId: result.testId,
      name: names.get(result.testId) ?? result.testId,
      passed: result.passed,
      durationMs: result.durationMs,
    })),
  };
}
