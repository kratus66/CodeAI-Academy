import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../database/prisma.service";
import { PrismaProgressRepository } from "../progress/prisma-progress.repository";
import { PrismaContentRepository } from "./prisma-content.repository";

const UNIT_ID = "unit_1";

interface FindUnitArgs {
  include: { exercises: { where: Prisma.ExerciseWhereInput } };
}

interface CountExercisesArgs {
  where: Prisma.ExerciseWhereInput;
}

interface FindSubmissionsArgs {
  where: Prisma.SubmissionWhereInput;
}

/** `PrismaService` falso: cada consulta del banco reservado se comprueba por su `where`. */
function buildPrisma(): {
  prisma: PrismaService;
  unitFindFirst: ReturnType<typeof vi.fn>;
  exerciseCount: ReturnType<typeof vi.fn>;
  submissionFindMany: ReturnType<typeof vi.fn>;
} {
  const unitFindFirst = vi.fn((_args: FindUnitArgs) => Promise.resolve(null));
  const exerciseCount = vi.fn((_args: CountExercisesArgs) => Promise.resolve(0));
  const submissionFindMany = vi.fn((_args: FindSubmissionsArgs) => Promise.resolve([]));

  const prisma = {
    unit: { findFirst: unitFindFirst },
    exercise: { count: exerciseCount },
    submission: { findMany: submissionFindMany },
  } as unknown as PrismaService;

  return { prisma, unitFindFirst, exerciseCount, submissionFindMany };
}

describe("El banco reservado fuera del detalle de unidad", () => {
  it("findUnit pide sólo los ejercicios del banco UNIT", async () => {
    const { prisma, unitFindFirst } = buildPrisma();
    const repository = new PrismaContentRepository(prisma);

    await repository.findUnit("U0.1.1");

    expect(unitFindFirst.mock.calls[0]?.[0]).toMatchObject({
      include: { exercises: { where: { isPublished: true, examPool: "UNIT" } } },
    });
  });
});

describe("El banco reservado fuera del progreso de unidad", () => {
  it("countPublishedExercises cuenta sólo los ejercicios del banco UNIT", async () => {
    const { prisma, exerciseCount } = buildPrisma();
    const repository = new PrismaProgressRepository(prisma);

    await repository.countPublishedExercises(UNIT_ID);

    expect(exerciseCount.mock.calls[0]?.[0]).toMatchObject({
      where: { unitId: UNIT_ID, isPublished: true, examPool: "UNIT" },
    });
  });

  it("countCompletedExercises cuenta sólo envíos de ejercicios del banco UNIT", async () => {
    const { prisma, submissionFindMany } = buildPrisma();
    const repository = new PrismaProgressRepository(prisma);

    await repository.countCompletedExercises("user_a", UNIT_ID);

    expect(submissionFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { exercise: { unitId: UNIT_ID, isPublished: true, examPool: "UNIT" } },
    });
  });
});
