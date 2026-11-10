import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../database/prisma.service";
import { PrismaAiRepository } from "../ai/prisma-ai.repository";
import { PrismaReviewRepository } from "./prisma-review.repository";

const NOW = new Date("2026-11-09T00:00:00Z");

interface ReviewQueryArgs {
  where: Prisma.ReviewItemWhereInput;
  orderBy?: Prisma.ReviewItemOrderByWithRelationInput[];
  take?: number;
}

interface LessonContextArgs {
  select: { unit: { select: { exercises: { where: Prisma.ExerciseWhereInput } } } };
}

/** `PrismaService` falso: cada consulta se comprueba por su `where`. */
function buildPrisma(): {
  prisma: PrismaService;
  itemFindMany: ReturnType<typeof vi.fn>;
  itemCount: ReturnType<typeof vi.fn>;
  lessonFindFirst: ReturnType<typeof vi.fn>;
} {
  const itemFindMany = vi.fn((_args: ReviewQueryArgs) => Promise.resolve([]));
  const itemCount = vi.fn((_args: ReviewQueryArgs) => Promise.resolve(0));
  const lessonFindFirst = vi.fn((_args: LessonContextArgs) => Promise.resolve(null));

  const prisma = {
    reviewItem: { findMany: itemFindMany, count: itemCount },
    lesson: { findFirst: lessonFindFirst },
  } as unknown as PrismaService;

  return { prisma, itemFindMany, itemCount, lessonFindFirst };
}

describe("El banco reservado entra en la cola de repaso (S15-T7c)", () => {
  it("listDue no filtra por banco y conserva usuario, vencimiento, orden y límite", async () => {
    const { prisma, itemFindMany } = buildPrisma();
    const repository = new PrismaReviewRepository(prisma);

    await repository.listDue("user_a", NOW, 10);

    const args = itemFindMany.mock.calls[0]?.[0];

    expect(args?.where).toEqual({ userId: "user_a", dueAt: { lte: NOW } });
    expect(args?.where).not.toHaveProperty("exercise");
    expect(args?.orderBy).toEqual([
      { priority: "desc" },
      { dueAt: "asc" },
      { createdAt: "asc" },
    ]);
    expect(args?.take).toBe(10);
  });

  it("countDue cuenta con el mismo criterio, sin filtro del banco reservado", async () => {
    const { prisma, itemCount } = buildPrisma();
    const repository = new PrismaReviewRepository(prisma);

    await repository.countDue("user_a", NOW);

    const args = itemCount.mock.calls[0]?.[0];

    expect(args?.where).toEqual({ userId: "user_a", dueAt: { lte: NOW } });
    expect(args?.where).not.toHaveProperty("exercise");
  });
});

describe("El banco reservado fuera del contexto del tutor", () => {
  it("findLessonContext pide sólo los ejercicios del banco UNIT", async () => {
    const { prisma, lessonFindFirst } = buildPrisma();
    const repository = new PrismaAiRepository(prisma);

    await repository.findLessonContext("lesson_1");

    expect(lessonFindFirst.mock.calls[0]?.[0]).toMatchObject({
      select: {
        unit: { select: { exercises: { where: { isPublished: true, examPool: "UNIT" } } } },
      },
    });
  });
});
