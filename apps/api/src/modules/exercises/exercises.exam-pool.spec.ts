import type { ExerciseListQuery, SubmissionOutcome } from "@codeai/shared";
import type { Prisma } from "@prisma/client";
import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../database/prisma.service";
import { MockSandboxService } from "../sandbox/mock-sandbox.service";
import type { ExerciseRow } from "./exercises.repository";
import { ExercisesService } from "./exercises.service";
import type { ReviewScheduler } from "./exercises.service";
import type { HintRequestRepository } from "./hint-requests.repository";
import { InMemoryExercisesRepository } from "./in-memory-exercises.repository";
import type { SubmissionSeed } from "./in-memory-exercises.repository";
import { PrismaExercisesRepository } from "./prisma-exercises.repository";

const LIST_QUERY: ExerciseListQuery = { page: 1, pageSize: 20 };
const WINDOW = { skip: 0, take: 20 } as const;
const PUBLISHED_ID = "quiz_unit";
const REFLECT_ID = "reflect_unit";
const RESERVED_ID = "quiz_reserved";

/** Fila mínima de ejercicio; el banco se declara sólo cuando la prueba lo necesita. */
function exerciseRow(overrides: Partial<ExerciseRow>): ExerciseRow {
  return {
    id: "ex",
    unitId: "unit_1",
    unitCode: "U0.1.1",
    slug: "ejercicio",
    type: "QUIZ",
    title: "Título",
    statement: "Enunciado",
    config: {},
    solution: null,
    ladder: "GUIDED",
    difficulty: 1,
    competencies: ["C1"],
    estimatedMin: 2,
    language: null,
    hintLevels: [],
    tests: [],
    ...overrides,
  };
}

const DATASET: readonly ExerciseRow[] = [
  exerciseRow({ id: PUBLISHED_ID, slug: "quiz-unit" }),
  exerciseRow({ id: REFLECT_ID, slug: "reflect-unit", type: "REFLECT" }),
  exerciseRow({ id: RESERVED_ID, slug: "quiz-reserved", examPool: "RESERVED" }),
];

function submission(
  id: string,
  exerciseId: string,
  outcome: SubmissionOutcome,
  score: number,
): SubmissionSeed {
  return {
    id,
    userId: "user_a",
    exerciseId,
    outcome,
    score,
    achievedLevel: outcome === "PASSED" ? 1 : null,
    hintsUsed: 0,
    createdAt: new Date("2026-11-09T00:00:00Z"),
    results: [],
  };
}

const noHints: HintRequestRepository = {
  findUsedLevels: () => Promise.resolve([]),
  findLevelsRequestedSince: () => Promise.resolve([]),
  recordRequest: () => Promise.resolve(),
};

const noReviews: ReviewScheduler = {
  scheduleFromSubmission: () => Promise.resolve(true),
};

function buildService(
  exercises: readonly ExerciseRow[],
  submissions: readonly SubmissionSeed[] = [],
): { service: ExercisesService; repository: InMemoryExercisesRepository } {
  const repository = new InMemoryExercisesRepository({ exercises, submissions });
  const service = new ExercisesService(repository, new MockSandboxService(), noHints, noReviews);

  return { service, repository };
}

describe("InMemoryExercisesRepository y el banco reservado", () => {
  it("listByUnit no devuelve el reservado y el total cuadra", async () => {
    const repository = new InMemoryExercisesRepository({ exercises: DATASET, submissions: [] });

    const page = await repository.listByUnit("U0.1.1", WINDOW);

    expect(page.items.map((exercise) => exercise.id)).toEqual([PUBLISHED_ID, REFLECT_ID]);
    expect(page.total).toBe(2);
  });

  it("findPublished del reservado devuelve null y el de la unidad sí", async () => {
    const repository = new InMemoryExercisesRepository({ exercises: DATASET, submissions: [] });

    expect(await repository.findPublished(RESERVED_ID)).toBeNull();
    expect(await repository.findPublished(PUBLISHED_ID)).toMatchObject({ id: PUBLISHED_ID });
  });

  it("unitExists sigue viendo la unidad aunque sólo tenga reservados", async () => {
    const repository = new InMemoryExercisesRepository({
      exercises: [exerciseRow({ id: RESERVED_ID, examPool: "RESERVED" })],
      submissions: [],
    });

    expect(await repository.unitExists("U0.1.1")).toBe(true);
    expect((await repository.listByUnit("U0.1.1", WINDOW)).total).toBe(0);
  });
});

describe("ExercisesService y el banco reservado", () => {
  it("listByUnit no incluye el reservado", async () => {
    const { service } = buildService(DATASET);

    const response = await service.listByUnit("U0.1.1", LIST_QUERY);

    expect(response.data.map((item) => item.id)).toEqual([PUBLISHED_ID, REFLECT_ID]);
    expect(response.meta.total).toBe(2);
  });

  it("getDetail del reservado responde 404", async () => {
    const { service } = buildService(DATASET);

    const detail = service.getDetail(RESERVED_ID);

    await expect(detail).rejects.toBeInstanceOf(NotFoundException);
    await expect(detail).rejects.toThrow("El ejercicio solicitado no existe o no está publicado");
  });

  it("answerQuiz del reservado responde 404 sin registrar el intento", async () => {
    const { service, repository } = buildService(DATASET);

    await expect(
      service.answerQuiz("user_a", RESERVED_ID, { optionId: "b" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await repository.countSubmissions("user_a", RESERVED_ID)).toBe(0);
  });

  it("getUnitProgress no cuenta envíos de ejercicios reservados", async () => {
    const { service } = buildService(DATASET, [
      submission("sub_1", RESERVED_ID, "PASSED", 100),
      submission("sub_2", PUBLISHED_ID, "FAILED", 0),
    ]);

    const { statuses } = await service.getUnitProgress("user_a", "U0.1.1");

    expect(statuses).toEqual([
      { exerciseId: PUBLISHED_ID, status: "FAILED", attempts: 1, bestScore: 0 },
    ]);
  });
});

describe("PrismaExercisesRepository y el banco reservado", () => {
  interface ExerciseQueryArgs {
    where: Prisma.ExerciseWhereInput;
  }

  function buildRepository(): {
    repository: PrismaExercisesRepository;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  } {
    const findMany = vi.fn((_args: ExerciseQueryArgs) => Promise.resolve([]));
    const count = vi.fn((_args: ExerciseQueryArgs) => Promise.resolve(0));
    const findFirst = vi.fn((_args: ExerciseQueryArgs) => Promise.resolve(null));
    const prisma = { exercise: { findMany, count, findFirst } } as unknown as PrismaService;

    return { repository: new PrismaExercisesRepository(prisma), findMany, count, findFirst };
  }

  it("listByUnit filtra el banco UNIT en el listado y en el total", async () => {
    const { repository, findMany, count } = buildRepository();

    await repository.listByUnit("U0.1.1", WINDOW);

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { examPool: "UNIT", unit: { code: "U0.1.1" } },
    });
    expect(count.mock.calls[0]?.[0]).toMatchObject({ where: { examPool: "UNIT" } });
  });

  it("findPublished filtra el banco UNIT", async () => {
    const { repository, findFirst } = buildRepository();

    await repository.findPublished("ex_1");

    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "ex_1", examPool: "UNIT" },
    });
  });
});
