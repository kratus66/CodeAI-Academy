import type {
  ReviewDataset,
  ReviewItemRow,
  ReviewItemSeed,
  ReviewLogRecord,
  ReviewRepository,
  SaveReviewAnswerInput,
  ScheduleFromSubmissionInput,
} from "./review.repository";
import { EMPTY_REVIEW_DATASET } from "./review.repository";

/** Copia sin dueño: el puerto nunca expone a quién pertenece un ítem. */
function withoutOwner(seed: ReviewItemSeed): ReviewItemRow {
  return {
    id: seed.id,
    exerciseId: seed.exerciseId,
    exerciseTitle: seed.exerciseTitle,
    exerciseSlug: seed.exerciseSlug,
    concept: seed.concept,
    competencies: [...seed.competencies],
    easeFactor: seed.easeFactor,
    intervalDays: seed.intervalDays,
    repetitions: seed.repetitions,
    dueAt: seed.dueAt,
    priority: seed.priority,
  };
}

/**
 * Implementación en memoria de `ReviewRepository` para pruebas y entornos sin
 * base de datos. Ordena como el adaptador Prisma (prioridad desc, vencimiento
 * asc) y guarda las bitácoras en `logs` para poder inspeccionarlas.
 */
export class InMemoryReviewRepository implements ReviewRepository {
  private readonly items: ReviewItemSeed[];
  private sequence = 0;

  /** Visible para las pruebas; no forma parte del puerto. */
  readonly logs: ReviewLogRecord[] = [];

  constructor(private readonly dataset: ReviewDataset = EMPTY_REVIEW_DATASET) {
    this.items = dataset.items.map((item) => ({
      ...item,
      competencies: [...item.competencies],
    }));
  }

  async listDue(userId: string, now: Date, limit: number): Promise<ReviewItemRow[]> {
    return this.dueItems(userId, now)
      .slice(0, limit)
      .map((item) => withoutOwner(item));
  }

  async countDue(userId: string, now: Date): Promise<number> {
    return this.dueItems(userId, now).length;
  }

  async findOwned(userId: string, id: string): Promise<ReviewItemRow | null> {
    const item = this.items.find((entry) => entry.id === id && entry.userId === userId);

    return item ? withoutOwner(item) : null;
  }

  async findByExercise(
    userId: string,
    exerciseId: string,
  ): Promise<ReviewItemRow | null> {
    const item = this.items.find(
      (entry) => entry.userId === userId && entry.exerciseId === exerciseId,
    );

    return item ? withoutOwner(item) : null;
  }

  async saveAnswer(input: SaveReviewAnswerInput): Promise<void> {
    const item = this.items.find(
      (entry) => entry.id === input.itemId && entry.userId === input.userId,
    );

    if (!item) {
      return;
    }

    applyState(item, input);
    this.pushLog(input.itemId, input);
  }

  async scheduleFromSubmission(input: ScheduleFromSubmissionInput): Promise<boolean> {
    const exercise = this.dataset.exercises.find(
      (entry) => entry.id === input.exerciseId,
    );

    if (!exercise) {
      return false;
    }

    const existing = this.items.find(
      (entry) =>
        entry.userId === input.userId && entry.exerciseId === input.exerciseId,
    );

    if (existing) {
      applyState(existing, input);
      this.pushLog(existing.id, input);

      return true;
    }

    this.sequence += 1;

    const created: ReviewItemSeed = {
      id: `review_${this.sequence}`,
      userId: input.userId,
      exerciseId: exercise.id,
      exerciseTitle: exercise.title,
      exerciseSlug: exercise.slug,
      concept: exercise.concepts[0] ?? "general",
      competencies: [...exercise.competencies],
      easeFactor: input.easeFactor,
      intervalDays: input.intervalDays,
      repetitions: input.repetitions,
      dueAt: input.dueAt,
      priority: input.priority,
    };

    this.items.push(created);
    this.pushLog(created.id, input);

    return true;
  }

  private dueItems(userId: string, now: Date): ReviewItemSeed[] {
    return this.items
      .filter((item) => item.userId === userId && item.dueAt.getTime() <= now.getTime())
      .sort(
        (left, right) =>
          right.priority - left.priority || left.dueAt.getTime() - right.dueAt.getTime(),
      );
  }

  private pushLog(
    itemId: string,
    input: Pick<
      SaveReviewAnswerInput,
      "quality" | "intervalDays" | "easeFactor" | "reviewedAt"
    >,
  ): void {
    this.logs.push({
      reviewItemId: itemId,
      quality: input.quality,
      intervalDays: input.intervalDays,
      easeFactor: input.easeFactor,
      reviewedAt: input.reviewedAt,
    });
  }
}

function applyState(
  item: ReviewItemSeed,
  state: Pick<
    SaveReviewAnswerInput,
    "easeFactor" | "intervalDays" | "repetitions" | "dueAt" | "priority"
  >,
): void {
  item.easeFactor = state.easeFactor;
  item.intervalDays = state.intervalDays;
  item.repetitions = state.repetitions;
  item.dueAt = state.dueAt;
  item.priority = state.priority;
}
