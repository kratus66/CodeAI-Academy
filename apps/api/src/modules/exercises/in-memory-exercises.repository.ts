import type {
  CreateSubmissionInput,
  ExerciseHintRow,
  ExercisesRepository,
  ExerciseRow,
  SubmissionRow,
} from "./exercises.repository";
import type { Page, PageWindow } from "../content/content.repository";

/** Envío con dueño: el dataset en memoria necesita el `userId` y el ejercicio. */
export interface SubmissionSeed extends SubmissionRow {
  userId: string;
  exerciseId: string;
}

export interface ExercisesDataset {
  /** Ejercicios publicados; el adaptador no conoce `isPublished`. */
  exercises: readonly ExerciseRow[];
  submissions: readonly SubmissionSeed[];
  /**
   * Unidades publicadas que no tienen ejercicios en el dataset. Sin esto sólo se
   * conocen las unidades que aparecen en `exercises`, y una unidad vacía se
   * confundiría con una inexistente.
   */
  unitCodes?: readonly string[];
  /**
   * Texto de las pistas del catálogo. `ExerciseRow.hintLevels` sólo declara los
   * niveles; sin entrada aquí `findHint` devuelve `null`.
   */
  hintTexts?: readonly (ExerciseHintRow & { exerciseId: string })[];
}

export const EMPTY_EXERCISES_DATASET: ExercisesDataset = {
  exercises: [],
  submissions: [],
};

/**
 * Implementación en memoria de `ExercisesRepository` para pruebas y entornos sin
 * base de datos. Ordena los envíos del más reciente al más antiguo, igual que el
 * índice `[userId, createdAt]` del adaptador Prisma.
 */
export class InMemoryExercisesRepository implements ExercisesRepository {
  private readonly submissions: SubmissionSeed[];
  private sequence = 0;

  constructor(
    private readonly dataset: ExercisesDataset = EMPTY_EXERCISES_DATASET,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.submissions = [...dataset.submissions];
  }

  async listByUnit(unitCode: string, window: PageWindow): Promise<Page<ExerciseRow>> {
    const items = this.dataset.exercises.filter((exercise) => exercise.unitCode === unitCode);

    return paginate(items, window);
  }

  async unitExists(unitCode: string): Promise<boolean> {
    if (this.dataset.unitCodes?.includes(unitCode)) {
      return true;
    }

    return this.dataset.exercises.some((exercise) => exercise.unitCode === unitCode);
  }

  async findPublished(id: string): Promise<ExerciseRow | null> {
    return this.dataset.exercises.find((exercise) => exercise.id === id) ?? null;
  }

  async listSubmissions(
    userId: string,
    exerciseId: string,
    window: PageWindow,
  ): Promise<Page<SubmissionRow>> {
    const items = this.submissions
      .filter((submission) => submission.userId === userId && submission.exerciseId === exerciseId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(withoutOwner);

    return paginate(items, window);
  }

  async createSubmission(input: CreateSubmissionInput): Promise<SubmissionRow> {
    this.sequence += 1;

    const row: SubmissionRow = {
      id: `sub_${this.sequence}`,
      outcome: input.outcome,
      score: input.score,
      achievedLevel: null,
      hintsUsed: input.hintsUsed,
      createdAt: this.now(),
      results: input.results.map((result) => ({ ...result })),
    };

    this.submissions.push({ ...row, userId: input.userId, exerciseId: input.exerciseId });

    return { ...row, results: row.results.map((result) => ({ ...result })) };
  }

  async findHint(exerciseId: string, level: number): Promise<ExerciseHintRow | null> {
    const hint = this.dataset.hintTexts?.find(
      (entry) => entry.exerciseId === exerciseId && entry.level === level,
    );

    return hint ? { level: hint.level, text: hint.text } : null;
  }
}

function paginate<TItem>(items: readonly TItem[], window: PageWindow): Page<TItem> {
  return {
    items: items.slice(window.skip, window.skip + window.take),
    total: items.length,
  };
}

function withoutOwner(seed: SubmissionSeed): SubmissionRow {
  const { userId: _user, exerciseId: _exercise, ...row } = seed;

  return { ...row, results: row.results.map((result) => ({ ...result })) };
}
