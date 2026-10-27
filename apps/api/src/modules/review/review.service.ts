import type {
  ReviewAnswerInput,
  ReviewAnswerResult,
  ReviewQueueItem,
  ReviewQueueResponse,
  SubmissionOutcome,
} from "@codeai/shared";
import { REVIEW_QUEUE_MAX } from "@codeai/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { interleaveByConcept } from "./review.queue";
import { initialReviewState, qualityFromSubmission, scheduleReview } from "./sm2";
import type { ReviewItemRow, ReviewRepository } from "./review.repository";
import { REVIEW_REPOSITORY } from "./review.repository";

/** Reloj inyectable: las pruebas fijan la fecha sin tocar el sistema. */
export const REVIEW_CLOCK = Symbol("REVIEW_CLOCK");

export type ReviewClock = () => Date;

const ITEM_NOT_FOUND = "El ítem de repaso no existe o no te pertenece";

/** Un error adelanta el ítem en la cola (§5.3); un acierto lo devuelve al orden normal. */
const FAILED_PRIORITY = 1;
const NORMAL_PRIORITY = 0;

/** Datos del envío corregido que alimentan la programación automática. */
export interface ScheduleFromSubmissionParams {
  userId: string;
  exerciseId: string;
  outcome: SubmissionOutcome;
  score: number;
  hintsUsed: number;
}

/**
 * Repaso espaciado (`contratos-api.md` §4.5).
 *
 * El servicio no conoce Prisma ni HTTP: lee el estado del ítem, aplica SM-2 y
 * delega la escritura en el puerto. `userId` llega del token y nunca del
 * cliente, así que la cola y las respuestas quedan aisladas por estudiante.
 */
@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly repository: ReviewRepository,
    @Inject(REVIEW_CLOCK) private readonly now: ReviewClock,
  ) {}

  /** Cola diaria intercalada por concepto y acotada a `REVIEW_QUEUE_MAX`. */
  async getQueue(userId: string): Promise<ReviewQueueResponse> {
    const now = this.now();
    const [items, dueReviews] = await Promise.all([
      this.repository.listDue(userId, now, REVIEW_QUEUE_MAX),
      this.repository.countDue(userId, now),
    ]);

    return {
      items: interleaveByConcept(items).map(toQueueItem),
      dueReviews,
      limit: REVIEW_QUEUE_MAX,
    };
  }

  /** Deuda de repaso para el panel de avance; no aplica el tope de la cola. */
  async countDue(userId: string): Promise<number> {
    return this.repository.countDue(userId, this.now());
  }

  /**
   * Registra la calidad declarada y reprograma el ítem. Un ítem de otro
   * estudiante responde `404`, nunca `403`: no se confirma que exista.
   */
  async answer(
    userId: string,
    itemId: string,
    input: ReviewAnswerInput,
  ): Promise<ReviewAnswerResult> {
    const item = await this.repository.findOwned(userId, itemId);

    if (!item) {
      throw new NotFoundException(ITEM_NOT_FOUND);
    }

    const reviewedAt = this.now();
    const next = scheduleReview(item, input.quality, reviewedAt);

    await this.repository.saveAnswer({
      userId,
      itemId,
      quality: input.quality,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
      reviewedAt,
      priority: priorityOf(input.quality),
    });

    return toAnswerResult(next);
  }

  /**
   * Programa el repaso de un envío recién corregido. Usa el estado guardado del
   * ítem (si existe) para no reiniciar la progresión en cada intento.
   * Devuelve `false` cuando el ejercicio ya no está en el catálogo.
   */
  async scheduleFromSubmission(params: ScheduleFromSubmissionParams): Promise<boolean> {
    const quality = qualityFromSubmission({
      outcome: params.outcome,
      score: params.score,
      hintsUsed: params.hintsUsed,
    });
    const previous = await this.repository.findByExercise(
      params.userId,
      params.exerciseId,
    );
    const reviewedAt = this.now();
    const next = scheduleReview(previous ?? initialReviewState(), quality, reviewedAt);

    return this.repository.scheduleFromSubmission({
      userId: params.userId,
      exerciseId: params.exerciseId,
      quality,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
      reviewedAt,
      priority: priorityOf(quality),
    });
  }
}

function priorityOf(quality: number): number {
  return quality < 3 ? FAILED_PRIORITY : NORMAL_PRIORITY;
}

function toQueueItem(row: ReviewItemRow): ReviewQueueItem {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    exerciseTitle: row.exerciseTitle,
    exerciseSlug: row.exerciseSlug,
    concept: row.concept,
    competencies: [...row.competencies],
    dueAt: row.dueAt.toISOString(),
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    easeFactor: row.easeFactor,
    priority: row.priority,
  };
}

function toAnswerResult(next: ReturnType<typeof scheduleReview>): ReviewAnswerResult {
  return {
    nextDueAt: next.dueAt.toISOString(),
    intervalDays: next.intervalDays,
    easeFactor: next.easeFactor,
    repetitions: next.repetitions,
  };
}
