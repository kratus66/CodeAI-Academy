import type { HintRequestRepository } from "./hint-requests.repository";

/** Fila de `HintRequest` con dueño; `requests` y las marcas son opcionales en el seed. */
export interface HintRequestSeed {
  userId: string;
  exerciseId: string;
  level: number;
  requests?: number;
  lastRequestedAt?: Date;
  createdAt?: Date;
}

export interface HintRequestsDataset {
  hintRequests: readonly HintRequestSeed[];
}

export const EMPTY_HINT_REQUESTS_DATASET: HintRequestsDataset = {
  hintRequests: [],
};

interface HintRequestRow {
  userId: string;
  exerciseId: string;
  level: number;
  requests: number;
  lastRequestedAt: Date;
  createdAt: Date;
}

/**
 * Implementación en memoria de `HintRequestRepository` para pruebas y entornos
 * sin base de datos. Mantiene una fila por `(userId, exerciseId, level)`, igual
 * que el índice único del adaptador Prisma.
 */
export class InMemoryHintRequestsRepository implements HintRequestRepository {
  private readonly rows: HintRequestRow[];

  constructor(
    dataset: HintRequestsDataset = EMPTY_HINT_REQUESTS_DATASET,
    private readonly now: () => Date = () => new Date(),
  ) {
    // Copia profunda: nunca se muta ni se retiene nada del llamador.
    this.rows = dataset.hintRequests.map((seed) => {
      const createdAt = new Date((seed.createdAt ?? seed.lastRequestedAt ?? this.now()).getTime());

      return {
        userId: seed.userId,
        exerciseId: seed.exerciseId,
        level: seed.level,
        requests: seed.requests ?? 1,
        lastRequestedAt: new Date((seed.lastRequestedAt ?? createdAt).getTime()),
        createdAt,
      };
    });
  }

  async findUsedLevels(userId: string, exerciseId: string): Promise<number[]> {
    return this.levelsOf(userId, exerciseId, () => true);
  }

  async findLevelsRequestedSince(
    userId: string,
    exerciseId: string,
    since: Date | null,
  ): Promise<number[]> {
    return this.levelsOf(
      userId,
      exerciseId,
      (row) => since === null || row.lastRequestedAt.getTime() > since.getTime(),
    );
  }

  async recordRequest(userId: string, exerciseId: string, level: number): Promise<void> {
    const moment = this.now();
    const existing = this.rows.find(
      (row) => row.userId === userId && row.exerciseId === exerciseId && row.level === level,
    );

    if (existing) {
      existing.requests += 1;
      existing.lastRequestedAt = new Date(moment.getTime());

      return;
    }

    this.rows.push({
      userId,
      exerciseId,
      level,
      requests: 1,
      lastRequestedAt: new Date(moment.getTime()),
      createdAt: new Date(moment.getTime()),
    });
  }

  private levelsOf(
    userId: string,
    exerciseId: string,
    predicate: (row: HintRequestRow) => boolean,
  ): number[] {
    const levels = this.rows
      .filter((row) => row.userId === userId && row.exerciseId === exerciseId && predicate(row))
      .map((row) => row.level);

    return [...new Set(levels)].sort((left, right) => left - right);
  }
}
