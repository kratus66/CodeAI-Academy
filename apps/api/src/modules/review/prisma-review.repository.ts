import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  ReviewItemRow,
  ReviewRepository,
  SaveReviewAnswerInput,
  ScheduleFromSubmissionInput,
} from "./review.repository";

/**
 * Select compartido por la cola y la respuesta: el ítem con lo que la web
 * necesita para identificarlo (`title`, `slug`) y agruparlo (`concept`,
 * `competencies`). Nunca incluye la solución ni el código del ejercicio.
 */
const REVIEW_ITEM_SELECT = {
  id: true,
  exerciseId: true,
  concept: true,
  easeFactor: true,
  intervalDays: true,
  repetitions: true,
  dueAt: true,
  priority: true,
  exercise: {
    select: { title: true, slug: true, competencies: true },
  },
} satisfies Prisma.ReviewItemSelect;

type ReviewItemDbRow = Prisma.ReviewItemGetPayload<{
  select: typeof REVIEW_ITEM_SELECT;
}>;

/** Adaptador Prisma del puerto `ReviewRepository`. */
@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDue(userId: string, now: Date, limit: number): Promise<ReviewItemRow[]> {
    const rows = await this.prisma.reviewItem.findMany({
      where: { userId, dueAt: { lte: now } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: REVIEW_ITEM_SELECT,
    });

    return rows.map(toReviewItemRow);
  }

  async countDue(userId: string, now: Date): Promise<number> {
    return this.prisma.reviewItem.count({
      where: { userId, dueAt: { lte: now } },
    });
  }

  async findOwned(userId: string, id: string): Promise<ReviewItemRow | null> {
    const row = await this.prisma.reviewItem.findFirst({
      where: { id, userId },
      select: REVIEW_ITEM_SELECT,
    });

    return row === null ? null : toReviewItemRow(row);
  }

  async findByExercise(userId: string, exerciseId: string): Promise<ReviewItemRow | null> {
    const row = await this.prisma.reviewItem.findUnique({
      where: { userId_exerciseId: { userId, exerciseId } },
      select: REVIEW_ITEM_SELECT,
    });

    return row === null ? null : toReviewItemRow(row);
  }

  /** Estado y bitácora se escriben juntos: una respuesta no puede quedar a medias. */
  async saveAnswer(input: SaveReviewAnswerInput): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.reviewItem.update({
        where: { id: input.itemId },
        data: {
          easeFactor: input.easeFactor,
          intervalDays: input.intervalDays,
          repetitions: input.repetitions,
          dueAt: input.dueAt,
          lastReviewedAt: input.reviewedAt,
          priority: input.priority,
        },
      }),
      this.prisma.reviewLog.create({
        data: {
          reviewItemId: input.itemId,
          quality: input.quality,
          intervalDays: input.intervalDays,
          easeFactor: input.easeFactor,
          reviewedAt: input.reviewedAt,
        },
      }),
    ]);
  }

  /**
   * Crea o reprograma el ítem del ejercicio y guarda la respuesta.
   *
   * El concepto sale del catálogo (`Exercise.concepts[0]`), no del cliente; si
   * el ejercicio desapareció entre la corrección y la programación se devuelve
   * `false` sin crear nada.
   */
  async scheduleFromSubmission(input: ScheduleFromSubmissionInput): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const exercise = await tx.exercise.findUnique({
        where: { id: input.exerciseId },
        select: { concepts: true },
      });

      if (exercise === null) {
        return false;
      }

      const concept = exercise.concepts[0] ?? "general";
      const item = await tx.reviewItem.upsert({
        where: {
          userId_exerciseId: { userId: input.userId, exerciseId: input.exerciseId },
        },
        create: {
          userId: input.userId,
          exerciseId: input.exerciseId,
          concept,
          easeFactor: input.easeFactor,
          intervalDays: input.intervalDays,
          repetitions: input.repetitions,
          dueAt: input.dueAt,
          lastReviewedAt: input.reviewedAt,
          priority: input.priority,
        },
        update: {
          concept,
          easeFactor: input.easeFactor,
          intervalDays: input.intervalDays,
          repetitions: input.repetitions,
          dueAt: input.dueAt,
          lastReviewedAt: input.reviewedAt,
          priority: input.priority,
        },
        select: { id: true },
      });

      await tx.reviewLog.create({
        data: {
          reviewItemId: item.id,
          quality: input.quality,
          intervalDays: input.intervalDays,
          easeFactor: input.easeFactor,
          reviewedAt: input.reviewedAt,
        },
      });

      return true;
    });
  }
}

function toReviewItemRow(row: ReviewItemDbRow): ReviewItemRow {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    exerciseTitle: row.exercise.title,
    exerciseSlug: row.exercise.slug,
    concept: row.concept,
    competencies: row.exercise.competencies,
    easeFactor: row.easeFactor,
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    dueAt: row.dueAt,
    priority: row.priority,
  };
}
