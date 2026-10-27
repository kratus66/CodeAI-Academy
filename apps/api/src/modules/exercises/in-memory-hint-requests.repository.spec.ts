import { describe, expect, it } from "vitest";

import {
  EMPTY_HINT_REQUESTS_DATASET,
  InMemoryHintRequestsRepository,
  type HintRequestSeed,
} from "./in-memory-hint-requests.repository";

function clock(start: string) {
  let current = new Date(start);

  return {
    now: () => new Date(current.getTime()),
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe("InMemoryHintRequestsRepository", () => {
  it("registra un nivel nuevo y lo devuelve como usado", async () => {
    const repository = new InMemoryHintRequestsRepository();

    await repository.recordRequest("u1", "e1", 1);

    expect(await repository.findUsedLevels("u1", "e1")).toEqual([1]);
  });

  it("pedir el mismo nivel dos veces no duplica el registro", async () => {
    const repository = new InMemoryHintRequestsRepository();

    await repository.recordRequest("u1", "e1", 2);
    await repository.recordRequest("u1", "e1", 2);

    expect(await repository.findUsedLevels("u1", "e1")).toEqual([2]);
  });

  it("repetir el nivel actualiza lastRequestedAt sin crear fila", async () => {
    const time = clock("2026-01-01T10:00:00Z");
    const repository = new InMemoryHintRequestsRepository(EMPTY_HINT_REQUESTS_DATASET, time.now);

    await repository.recordRequest("u1", "e1", 1);
    const first = time.now();
    time.advance(60_000);
    await repository.recordRequest("u1", "e1", 1);

    expect(await repository.findLevelsRequestedSince("u1", "e1", first)).toEqual([1]);
    expect(await repository.findUsedLevels("u1", "e1")).toEqual([1]);
  });

  it("devuelve varios niveles ascendentes y sin duplicados", async () => {
    const repository = new InMemoryHintRequestsRepository();

    await repository.recordRequest("u1", "e1", 3);
    await repository.recordRequest("u1", "e1", 1);
    await repository.recordRequest("u1", "e1", 2);
    await repository.recordRequest("u1", "e1", 1);

    expect(await repository.findUsedLevels("u1", "e1")).toEqual([1, 2, 3]);
  });

  it("aísla por usuario y por ejercicio", async () => {
    const repository = new InMemoryHintRequestsRepository();

    await repository.recordRequest("u1", "e1", 1);
    await repository.recordRequest("u2", "e1", 2);
    await repository.recordRequest("u1", "e2", 3);

    expect(await repository.findUsedLevels("u1", "e1")).toEqual([1]);
    expect(await repository.findUsedLevels("u2", "e1")).toEqual([2]);
    expect(await repository.findUsedLevels("u1", "e2")).toEqual([3]);
    expect(await repository.findLevelsRequestedSince("u2", "e2", null)).toEqual([]);
  });

  it("findLevelsRequestedSince usa comparación estricta", async () => {
    const time = clock("2026-01-01T10:00:00Z");
    const repository = new InMemoryHintRequestsRepository(EMPTY_HINT_REQUESTS_DATASET, time.now);

    await repository.recordRequest("u1", "e1", 1);
    const boundary = time.now();
    time.advance(1_000);
    await repository.recordRequest("u1", "e1", 2);

    expect(await repository.findLevelsRequestedSince("u1", "e1", null)).toEqual([1, 2]);
    expect(await repository.findLevelsRequestedSince("u1", "e1", boundary)).toEqual([2]);
    expect(await repository.findLevelsRequestedSince("u1", "e1", time.now())).toEqual([]);
  });

  it("no muta el dataset del llamador", async () => {
    const lastRequestedAt = new Date("2026-01-01T09:00:00Z");
    const seeds: HintRequestSeed[] = [
      { userId: "u1", exerciseId: "e1", level: 1, requests: 2, lastRequestedAt },
    ];
    const dataset = { hintRequests: seeds };
    const repository = new InMemoryHintRequestsRepository(dataset);

    await repository.recordRequest("u1", "e1", 1);
    await repository.recordRequest("u1", "e1", 2);
    await repository.findUsedLevels("u1", "e1");

    expect(dataset.hintRequests).toBe(seeds);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toEqual({
      userId: "u1",
      exerciseId: "e1",
      level: 1,
      requests: 2,
      lastRequestedAt: new Date("2026-01-01T09:00:00Z"),
    });
    expect(lastRequestedAt.toISOString()).toBe("2026-01-01T09:00:00.000Z");
  });

  it("con dataset vacío no devuelve niveles", async () => {
    const repository = new InMemoryHintRequestsRepository();

    expect(await repository.findUsedLevels("u1", "e1")).toEqual([]);
    expect(await repository.findLevelsRequestedSince("u1", "e1", null)).toEqual([]);
  });
});
