import type {
  AiDataset,
  AiInteractionRecord,
  AiLessonContext,
  AiMonthUsage,
  AiRepository,
  AiSubmissionContext,
  RecordAiInteractionInput,
} from "./ai.repository";

/**
 * Implementación en memoria de `AiRepository`. `interactions` queda visible
 * para que las pruebas comprueben la auditoría; `now` permite fijar el reloj.
 */
export class InMemoryAiRepository implements AiRepository {
  readonly interactions: AiInteractionRecord[] = [];

  constructor(
    private readonly dataset: AiDataset,
    private readonly now: () => Date = () => new Date(),
  ) {}

  findLessonContext(lessonId: string): Promise<AiLessonContext | null> {
    return Promise.resolve(this.dataset.lessons.find((lesson) => lesson.lessonId === lessonId) ?? null);
  }

  findOwnedSubmission(userId: string, submissionId: string): Promise<AiSubmissionContext | null> {
    const found = this.dataset.submissions.find(
      (submission) => submission.submissionId === submissionId && submission.userId === userId,
    );

    if (found === undefined) {
      return Promise.resolve(null);
    }

    const { userId: _owner, ...context } = found;

    return Promise.resolve(context);
  }

  getMasteryLevel(userId: string, competencies: readonly string[]): Promise<number> {
    const levels = competencies.map((code) => this.dataset.mastery?.[`${userId}:${code}`] ?? 0);

    return Promise.resolve(Math.max(0, ...levels));
  }

  getUsageSince(userId: string, since: Date): Promise<AiMonthUsage> {
    const rows = this.interactions.filter(
      (row) => row.userId === userId && row.createdAt.getTime() >= since.getTime(),
    );

    return Promise.resolve({
      spentUsd: rows.reduce((total, row) => total + row.costUsd, 0),
      interactions: rows.length,
    });
  }

  recordInteraction(input: RecordAiInteractionInput): Promise<void> {
    this.interactions.push({ ...input, createdAt: this.now() });

    return Promise.resolve();
  }
}
