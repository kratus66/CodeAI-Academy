import type {
  CompetencyProgressRecord,
  LessonLookup,
  ProgressRepository,
  ProgressUnitRow,
  ProgressUserRecord,
  SaveUnitProgressInput,
  UnitProgressRecord,
} from "./progress.repository";

/** Fila de progreso con dueño: el dataset en memoria sí necesita el `userId`. */
export interface UnitProgressSeed extends UnitProgressRecord {
  userId: string;
}

export interface CompetencyProgressSeed extends CompetencyProgressRecord {
  userId: string;
}

/**
 * Progreso ya guardado y listo para servir. El adaptador en memoria no conoce
 * `isPublished`: el conjunto que recibe es, por definición, publicado.
 */
export interface ProgressDataset {
  users: readonly ProgressUserRecord[];
  units: readonly ProgressUnitRow[];
  lessons: readonly LessonLookup[];
  unitProgress: readonly UnitProgressSeed[];
  competencyProgress: readonly CompetencyProgressSeed[];
}

export const EMPTY_PROGRESS_DATASET: ProgressDataset = {
  users: [],
  units: [],
  lessons: [],
  unitProgress: [],
  competencyProgress: [],
};

/**
 * Implementación en memoria de `ProgressRepository` para pruebas y entornos sin
 * base de datos. `saveUnitProgress` imita el `upsert` de Prisma: solo pisa los
 * campos que recibe y conserva `bestScore`, `exercisesDone` y `completedAt`.
 */
export class InMemoryProgressRepository implements ProgressRepository {
  private readonly rows = new Map<string, UnitProgressRecord>();

  constructor(private readonly dataset: ProgressDataset = EMPTY_PROGRESS_DATASET) {
    for (const seed of dataset.unitProgress) {
      this.rows.set(keyOf(seed.userId, seed.unitId), withoutOwner(seed));
    }
  }

  async findUser(userId: string): Promise<ProgressUserRecord | null> {
    return this.dataset.users.find((user) => user.id === userId) ?? null;
  }

  async listPublishedUnits(): Promise<ProgressUnitRow[]> {
    return this.dataset.units.map((unit) => ({ ...unit }));
  }

  async findPublishedUnit(unitId: string): Promise<ProgressUnitRow | null> {
    return this.dataset.units.find((unit) => unit.id === unitId) ?? null;
  }

  async findPublishedLesson(lessonId: string): Promise<LessonLookup | null> {
    return this.dataset.lessons.find((lesson) => lesson.id === lessonId) ?? null;
  }

  async listUnitProgress(userId: string): Promise<UnitProgressRecord[]> {
    return [...this.rows.entries()]
      .filter(([rowKey]) => rowKey.startsWith(`${userId}:`))
      .map(([, record]) => clone(record));
  }

  async listCompetencyProgress(userId: string): Promise<CompetencyProgressRecord[]> {
    return this.dataset.competencyProgress
      .filter((row) => row.userId === userId)
      .map(({ userId: _owner, ...record }) => ({ ...record }));
  }

  async saveUnitProgress(input: SaveUnitProgressInput): Promise<UnitProgressRecord> {
    const rowKey = keyOf(input.userId, input.unitId);
    const existing = this.rows.get(rowKey);

    const saved: UnitProgressRecord = {
      unitId: input.unitId,
      state: input.state,
      progressPct: input.progressPct,
      lessonsDone: input.lessonsDone,
      exercisesDone: existing?.exercisesDone ?? 0,
      bestScore: existing?.bestScore ?? null,
      completedLessonIds: [...input.completedLessonIds],
      lastActivityAt: input.lastActivityAt,
      completedAt: existing?.completedAt ?? null,
    };

    this.rows.set(rowKey, saved);

    return clone(saved);
  }
}

function keyOf(userId: string, unitId: string): string {
  return `${userId}:${unitId}`;
}

function withoutOwner(seed: UnitProgressSeed): UnitProgressRecord {
  const { userId: _owner, ...record } = seed;

  return clone(record);
}

function clone(record: UnitProgressRecord): UnitProgressRecord {
  return { ...record, completedLessonIds: [...record.completedLessonIds] };
}
