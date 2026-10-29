import { Injectable } from "@nestjs/common";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import {
  toCompetencyProgressRecord,
  toProgressUnitRow,
  toUnitProgressRecord,
} from "./progress.mapper";
import type {
  CompetencyProgressRecord,
  LessonLookup,
  ProgressRepository,
  ProgressUnitRow,
  ProgressUserRecord,
  SaveUnitProgressInput,
  UnitProgressRecord,
} from "./progress.repository";

/** Unidad publicada con toda su ascendencia publicada (misma regla que el contenido). */
const PUBLISHED_UNIT = {
  isPublished: true,
  module: { isPublished: true, stage: { isPublished: true } },
} as const;

/** Solo se cuentan lecciones publicadas: son el denominador del avance. */
const PROGRESS_UNIT_SELECT = {
  id: true,
  code: true,
  order: true,
  prerequisiteIds: true,
  module: { select: { code: true, stageId: true } },
  _count: { select: { lessons: { where: { isPublished: true } } } },
} as const;

const UNIT_PROGRESS_SELECT = {
  unitId: true,
  state: true,
  progressPct: true,
  lessonsDone: true,
  exercisesDone: true,
  bestScore: true,
  completedLessonIds: true,
  lastActivityAt: true,
  completedAt: true,
} as const;

const COMPETENCY_SELECT = {
  competency: true,
  level: true,
  evidenceCount: true,
} as const;

/** Adaptador Prisma del puerto `ProgressRepository`. */
@Injectable()
export class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(userId: string): Promise<ProgressUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
  }

  async listPublishedUnits(): Promise<ProgressUnitRow[]> {
    const rows = await this.prisma.unit.findMany({
      where: PUBLISHED_UNIT,
      // Mismo orden que el currículo: etapa → módulo → unidad.
      orderBy: [
        { module: { stageId: "asc" } },
        { module: { order: "asc" } },
        { order: "asc" },
        { code: "asc" },
      ],
      select: PROGRESS_UNIT_SELECT,
    });

    return rows.map(toProgressUnitRow);
  }

  async findPublishedUnit(unitId: string): Promise<ProgressUnitRow | null> {
    const row = await this.prisma.unit.findFirst({
      where: { id: unitId, ...PUBLISHED_UNIT },
      select: PROGRESS_UNIT_SELECT,
    });

    return row === null ? null : toProgressUnitRow(row);
  }

  async findPublishedLesson(lessonId: string): Promise<LessonLookup | null> {
    return this.prisma.lesson.findFirst({
      where: { id: lessonId, isPublished: true, unit: PUBLISHED_UNIT },
      select: { id: true, unitId: true },
    });
  }

  async listUnitProgress(userId: string): Promise<UnitProgressRecord[]> {
    const rows = await this.prisma.unitProgress.findMany({
      where: { userId },
      select: UNIT_PROGRESS_SELECT,
    });

    return rows.map(toUnitProgressRecord);
  }

  async listCompetencyProgress(userId: string): Promise<CompetencyProgressRecord[]> {
    const rows = await this.prisma.competencyProgress.findMany({
      where: { userId },
      orderBy: { competency: "asc" },
      select: COMPETENCY_SELECT,
    });

    return rows.map(toCompetencyProgressRecord);
  }

  async countPublishedExercises(unitId: string): Promise<number> {
    return this.prisma.exercise.count({ where: { unitId, isPublished: true } });
  }

  async countCompletedExercises(userId: string, unitId: string): Promise<number> {
    const rows = await this.prisma.submission.findMany({
      where: {
        userId,
        exercise: { unitId, isPublished: true },
        OR: [{ outcome: "PASSED" }, { exercise: { type: "REFLECT" } }],
      },
      distinct: ["exerciseId"],
      select: { exerciseId: true },
    });

    return rows.length;
  }

  async saveUnitProgress(input: SaveUnitProgressInput): Promise<UnitProgressRecord> {
    const data = {
      state: input.state,
      progressPct: input.progressPct,
      lessonsDone: input.lessonsDone,
      completedLessonIds: [...input.completedLessonIds],
      lastActivityAt: input.lastActivityAt,
      ...(input.exercisesDone === undefined ? {} : { exercisesDone: input.exercisesDone }),
      ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
    };

    const row = await this.prisma.unitProgress.upsert({
      where: { userId_unitId: { userId: input.userId, unitId: input.unitId } },
      create: { userId: input.userId, unitId: input.unitId, ...data },
      update: data,
      select: UNIT_PROGRESS_SELECT,
    });

    return toUnitProgressRecord(row);
  }
}
