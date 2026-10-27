import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { ReviewDataset, ReviewItemSeed } from "./review.repository";
import { InMemoryReviewRepository } from "./in-memory-review.repository";
import { ReviewService } from "./review.service";

const NOW = new Date("2026-10-27T09:00:00.000Z");
const DAY_MS = 86_400_000;

function item(overrides: Partial<ReviewItemSeed> & { id: string }): ReviewItemSeed {
  return {
    userId: "user-1",
    exerciseId: `ex_${overrides.id}`,
    exerciseTitle: `Ejercicio ${overrides.id}`,
    exerciseSlug: `ejercicio-${overrides.id}`,
    concept: "promesas",
    competencies: ["C2"],
    easeFactor: 2.6,
    intervalDays: 1,
    repetitions: 1,
    dueAt: new Date("2026-10-27T08:00:00.000Z"),
    priority: 0,
    ...overrides,
  };
}

const DATASET: ReviewDataset = {
  items: [
    item({ id: "a" }),
    item({
      id: "b",
      concept: "funciones",
      repetitions: 2,
      intervalDays: 6,
      easeFactor: 2.5,
      dueAt: new Date("2026-10-26T09:00:00.000Z"),
    }),
    item({
      id: "c",
      repetitions: 0,
      easeFactor: 1.7,
      priority: 1,
      dueAt: new Date("2026-10-25T09:00:00.000Z"),
    }),
    item({
      id: "d",
      dueAt: new Date("2026-10-28T09:00:00.000Z"),
    }),
    item({
      id: "e",
      userId: "user-2",
      exerciseId: "ex_e",
      dueAt: new Date("2026-10-26T09:00:00.000Z"),
    }),
  ],
  exercises: [
    {
      id: "ex_a",
      title: "Ejercicio a",
      slug: "ejercicio-a",
      concepts: ["promesas", "async"],
      competencies: ["C2"],
    },
    {
      id: "ex_b",
      title: "Ejercicio b",
      slug: "ejercicio-b",
      concepts: ["funciones"],
      competencies: ["C1"],
    },
  ],
};

function createService(dataset: ReviewDataset = DATASET): {
  service: ReviewService;
  repository: InMemoryReviewRepository;
} {
  const repository = new InMemoryReviewRepository(dataset);

  return { service: new ReviewService(repository, () => NOW), repository };
}

describe("ReviewService.getQueue", () => {
  it("sirve sólo los vencidos del usuario, intercalados y con el límite diario", async () => {
    const { service } = createService();

    const queue = await service.getQueue("user-1");

    expect(queue.limit).toBe(30);
    expect(queue.dueReviews).toBe(3);
    expect(queue.items.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
    expect(queue.items[0]).toEqual({
      id: "c",
      exerciseId: "ex_c",
      exerciseTitle: "Ejercicio c",
      exerciseSlug: "ejercicio-c",
      concept: "promesas",
      competencies: ["C2"],
      dueAt: "2026-10-25T09:00:00.000Z",
      intervalDays: 1,
      repetitions: 0,
      easeFactor: 1.7,
      priority: 1,
    });
  });

  it("no mezcla la cola de dos estudiantes", async () => {
    const { service } = createService();

    const queue = await service.getQueue("user-2");

    expect(queue.items.map((entry) => entry.id)).toEqual(["e"]);
    expect(queue.dueReviews).toBe(1);
  });

  it("devuelve una cola vacía cuando no hay nada vencido", async () => {
    const { service } = createService({ items: [], exercises: [] });

    await expect(service.getQueue("user-1")).resolves.toEqual({
      items: [],
      dueReviews: 0,
      limit: 30,
    });
  });

  it("cuenta la deuda total aunque la cola esté acotada", async () => {
    const many = Array.from({ length: 35 }, (_, index) =>
      item({ id: `m${index}`, dueAt: new Date(NOW.getTime() - DAY_MS) }),
    );
    const { service } = createService({ items: many, exercises: [] });

    const queue = await service.getQueue("user-1");

    expect(queue.items).toHaveLength(30);
    expect(queue.dueReviews).toBe(35);
  });
});

describe("ReviewService.answer", () => {
  it("con q = 4 reprograma a 6 días y añade la bitácora", async () => {
    const { service, repository } = createService();

    const result = await service.answer("user-1", "a", { quality: 4 });

    expect(result).toEqual({
      nextDueAt: new Date(NOW.getTime() + 6 * DAY_MS).toISOString(),
      intervalDays: 6,
      easeFactor: 2.6,
      repetitions: 2,
    });
    expect(repository.logs).toEqual([
      {
        reviewItemId: "a",
        quality: 4,
        intervalDays: 6,
        easeFactor: 2.6,
        reviewedAt: NOW,
      },
    ]);

    const queue = await service.getQueue("user-1");

    expect(queue.items.map((entry) => entry.id)).not.toContain("a");
  });

  it("con q < 3 reinicia la progresión y sube la prioridad", async () => {
    const { service, repository } = createService();

    const result = await service.answer("user-1", "b", { quality: 1 });

    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.easeFactor).toBe(1.96);
    expect(repository.logs[0]?.quality).toBe(1);

    const stored = await repository.findOwned("user-1", "b");

    expect(stored?.priority).toBe(1);
  });

  it("responde 404 si el ítem es de otro usuario", async () => {
    const { service } = createService();

    await expect(service.answer("user-2", "a", { quality: 5 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("responde 404 si el ítem no existe", async () => {
    const { service } = createService();

    await expect(
      service.answer("user-1", "missing", { quality: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ReviewService.scheduleFromSubmission", () => {
  const passed = {
    userId: "user-2",
    exerciseId: "ex_a",
    outcome: "PASSED",
    score: 100,
    hintsUsed: 0,
  } as const;

  it("crea el ítem con el concepto del ejercicio y un día de intervalo", async () => {
    const { service, repository } = createService();

    await expect(service.scheduleFromSubmission(passed)).resolves.toBe(true);

    const stored = await repository.findByExercise("user-2", "ex_a");

    expect(stored).toMatchObject({
      concept: "promesas",
      competencies: ["C2"],
      repetitions: 1,
      intervalDays: 1,
      easeFactor: 2.6,
      priority: 0,
      dueAt: new Date(NOW.getTime() + DAY_MS),
    });
    expect(repository.logs).toHaveLength(1);
  });

  it("reutiliza el estado del ítem: dos aciertos llegan a 6 días", async () => {
    const { service, repository } = createService();

    await service.scheduleFromSubmission(passed);
    await service.scheduleFromSubmission(passed);

    const stored = await repository.findByExercise("user-2", "ex_a");

    expect(stored?.repetitions).toBe(2);
    expect(stored?.intervalDays).toBe(6);
    expect(stored?.dueAt).toEqual(new Date(NOW.getTime() + 6 * DAY_MS));
    expect(repository.logs).toHaveLength(2);
  });

  it("un fallo posterior reinicia la progresión y marca prioridad alta", async () => {
    const { service, repository } = createService();

    await service.scheduleFromSubmission(passed);
    await service.scheduleFromSubmission({ ...passed, outcome: "FAILED", score: 0 });

    const stored = await repository.findByExercise("user-2", "ex_a");

    expect(stored).toMatchObject({
      repetitions: 0,
      intervalDays: 1,
      priority: 1,
      dueAt: new Date(NOW.getTime() + DAY_MS),
    });
    expect(repository.logs.map((log) => log.quality)).toEqual([5, 1]);
  });

  it("deriva q = 2 de un acierto con tres pistas (§5.3)", async () => {
    const { service, repository } = createService();

    await service.scheduleFromSubmission({ ...passed, hintsUsed: 3 });

    const stored = await repository.findByExercise("user-2", "ex_a");

    expect(stored?.repetitions).toBe(0);
    expect(stored?.priority).toBe(1);
    expect(repository.logs[0]?.quality).toBe(2);
  });

  it("no programa nada si el ejercicio ya no existe", async () => {
    const { service, repository } = createService();

    await expect(
      service.scheduleFromSubmission({ ...passed, exerciseId: "ex_gone" }),
    ).resolves.toBe(false);
    expect(repository.logs).toHaveLength(0);
  });
});

describe("ReviewService.countDue", () => {
  it("cuenta los vencidos del usuario sin el tope de la cola", async () => {
    const { service } = createService();

    await expect(service.countDue("user-1")).resolves.toBe(3);
    await expect(service.countDue("user-2")).resolves.toBe(1);
  });
});

