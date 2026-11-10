import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../database/prisma.service";
import {
  PrismaExamsRepository,
  examModeFromPrisma,
  examModeToPrisma,
  examStatusFromPrisma,
} from "./prisma-exams.repository";

const NOW = new Date("2026-11-10T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

type Args = Record<string, unknown>;

const QUESTION_RECORD = {
  id: "ex_1",
  slug: "q-1",
  examDomain: 2,
  statement: "Enunciado",
  config: { options: [] },
  solution: { optionId: "a" },
  reviewedByHuman: true,
  competencies: ["C1"],
  unit: { code: "U1.1.1" },
};

const HEADER_RECORD = {
  id: "att_1",
  userId: "user_a",
  certification: "SAA-C03",
  mode: "FORM_A",
  domain: null,
  extraTime: false,
  status: "IN_PROGRESS",
  orientative: false,
  startedAt: NOW,
  deadlineAt: new Date(NOW.getTime() + 60_000),
  submittedAt: null,
  correctCount: null,
  scorePct: null,
  domainScores: null,
};

const ITEM_RECORD = {
  position: 1,
  exerciseId: "ex_1",
  domain: 2,
  answer: null,
  flagged: false,
  correct: null,
  exercise: QUESTION_RECORD,
};

/** Delegado falso: cada método registra sus argumentos y devuelve el valor indicado. */
function delegate(results: Record<string, unknown>): Record<string, ReturnType<typeof vi.fn>> {
  const methods: Record<string, ReturnType<typeof vi.fn>> = {};

  for (const [name, value] of Object.entries(results)) {
    methods[name] = vi.fn((_args?: Args) => Promise.resolve(value));
  }

  return methods;
}

function buildRepository(delegates: Record<string, Record<string, ReturnType<typeof vi.fn>>>) {
  const prisma = {
    ...delegates,
    $transaction: vi.fn((work: (tx: unknown) => Promise<unknown>) => work(prisma)),
  };

  return {
    repository: new PrismaExamsRepository(prisma as unknown as PrismaService),
    delegates,
  };
}

function firstArgs(fn: ReturnType<typeof vi.fn> | undefined): Args {
  const call = fn?.mock.calls[0] as [Args] | undefined;

  if (!call) {
    throw new Error("El método no se llamó.");
  }

  return call[0];
}

describe("PrismaExamsRepository", () => {
  it("listReservedPool filtra el banco reservado publicado de la certificación", async () => {
    const { repository, delegates } = buildRepository({
      exercise: delegate({ findMany: [QUESTION_RECORD] }),
    });

    const rows = await repository.listReservedPool("SAA-C03");

    expect(firstArgs(delegates.exercise?.findMany).where).toEqual({
      type: "QUIZ",
      examPool: "RESERVED",
      isPublished: true,
      certification: "SAA-C03",
      examDomain: { not: null },
    });
    expect(firstArgs(delegates.exercise?.findMany).select).toMatchObject({
      unit: { select: { code: true } },
    });
    expect(rows).toEqual([
      {
        exerciseId: "ex_1",
        slug: "q-1",
        domain: 2,
        unitCode: "U1.1.1",
        statement: "Enunciado",
        config: { options: [] },
        solution: { optionId: "a" },
        reviewedByHuman: true,
        competencies: ["C1"],
      },
    ]);
  });

  it("listReservedPool descarta una fila sin dominio", async () => {
    const { repository } = buildRepository({
      exercise: delegate({
        findMany: [QUESTION_RECORD, { ...QUESTION_RECORD, id: "ex_2", examDomain: null }],
      }),
    });

    const rows = await repository.listReservedPool("SAA-C03");

    expect(rows.map((row) => row.exerciseId)).toEqual(["ex_1"]);
  });

  it("findFormSlugs busca por certificación y código, y devuelve null si no existe", async () => {
    const found = buildRepository({
      examForm: delegate({ findUnique: { exerciseSlugs: ["q-1", "q-2"] } }),
    });

    await expect(found.repository.findFormSlugs("SAA-C03", "B")).resolves.toEqual([
      "q-1",
      "q-2",
    ]);
    expect(firstArgs(found.delegates.examForm?.findUnique).where).toEqual({
      certification_code: { certification: "SAA-C03", code: "B" },
    });

    const missing = buildRepository({ examForm: delegate({ findUnique: null }) });

    await expect(missing.repository.findFormSlugs("SAA-C03", "C")).resolves.toBeNull();
  });

  it("countForms cuenta las formas de la certificación", async () => {
    const { repository, delegates } = buildRepository({ examForm: delegate({ count: 3 }) });

    await expect(repository.countForms("SAA-C03")).resolves.toBe(3);
    expect(firstArgs(delegates.examForm?.count).where).toEqual({ certification: "SAA-C03" });
  });

  it("recentExerciseIds mira los N últimos intentos terminados", async () => {
    const { repository, delegates } = buildRepository({
      examAttempt: delegate({
        findMany: [
          { items: [{ exerciseId: "ex_1" }, { exerciseId: "ex_2" }] },
          { items: [{ exerciseId: "ex_2" }, { exerciseId: "ex_3" }] },
        ],
      }),
    });

    const ids = await repository.recentExerciseIds("user_a", "SAA-C03", 3);

    const args = firstArgs(delegates.examAttempt?.findMany);
    expect(args.where).toEqual({
      userId: "user_a",
      certification: "SAA-C03",
      status: { not: "IN_PROGRESS" },
    });
    expect(args.take).toBe(3);
    expect(ids).toEqual(new Set(["ex_1", "ex_2", "ex_3"]));
  });

  it("recentExerciseIds con 0 intentos no consulta la base", async () => {
    const { repository, delegates } = buildRepository({
      examAttempt: delegate({ findMany: [] }),
    });

    await expect(repository.recentExerciseIds("user_a", "SAA-C03", 0)).resolves.toEqual(
      new Set(),
    );
    expect(delegates.examAttempt?.findMany).not.toHaveBeenCalled();
  });

  it("findOpenAttemptId busca un intento IN_PROGRESS del usuario", async () => {
    const { repository, delegates } = buildRepository({
      examAttempt: delegate({ findFirst: { id: "att_1" } }),
    });

    await expect(repository.findOpenAttemptId("user_a", "SAA-C03")).resolves.toBe("att_1");
    expect(firstArgs(delegates.examAttempt?.findFirst).where).toEqual({
      userId: "user_a",
      certification: "SAA-C03",
      status: "IN_PROGRESS",
    });
  });

  it("findOpenAttemptId devuelve null si no hay intento en curso", async () => {
    const { repository } = buildRepository({ examAttempt: delegate({ findFirst: null }) });

    await expect(repository.findOpenAttemptId("user_a", "SAA-C03")).resolves.toBeNull();
  });

  it("createAttempt hace un solo create con los ítems anidados", async () => {
    const { repository, delegates } = buildRepository({
      examAttempt: delegate({ create: { ...HEADER_RECORD, items: [ITEM_RECORD] } }),
    });

    const attempt = await repository.createAttempt({
      userId: "user_a",
      certification: "SAA-C03",
      mode: "form-a",
      domain: null,
      extraTime: false,
      orientative: false,
      startedAt: NOW,
      deadlineAt: HEADER_RECORD.deadlineAt,
      items: [{ position: 1, exerciseId: "ex_1", domain: 2 }],
    });

    expect(delegates.examAttempt?.create).toHaveBeenCalledTimes(1);
    expect(firstArgs(delegates.examAttempt?.create).data).toEqual({
      userId: "user_a",
      certification: "SAA-C03",
      mode: "FORM_A",
      domain: null,
      extraTime: false,
      orientative: false,
      startedAt: NOW,
      deadlineAt: HEADER_RECORD.deadlineAt,
      items: { create: [{ position: 1, exerciseId: "ex_1", domain: 2 }] },
    });
    expect(attempt.mode).toBe("form-a");
    expect(attempt.status).toBe("in-progress");
    expect(attempt.items).toHaveLength(1);
    expect(attempt.items[0]?.question.unitCode).toBe("U1.1.1");
  });

  it("findOwnedAttempt filtra por id y dueño; null si no hay fila", async () => {
    const found = buildRepository({
      examAttempt: delegate({ findFirst: { ...HEADER_RECORD, items: [ITEM_RECORD] } }),
    });

    const attempt = await found.repository.findOwnedAttempt("user_a", "att_1");

    expect(firstArgs(found.delegates.examAttempt?.findFirst).where).toEqual({
      id: "att_1",
      userId: "user_a",
    });
    expect(attempt?.id).toBe("att_1");

    const missing = buildRepository({ examAttempt: delegate({ findFirst: null }) });

    await expect(missing.repository.findOwnedAttempt("user_b", "att_1")).resolves.toBeNull();
  });

  it("updateItem actualiza por intento y posición; la respuesta null usa DbNull", async () => {
    const { repository, delegates } = buildRepository({
      examAttemptItem: delegate({ update: ITEM_RECORD }),
    });
    const answeredAt = new Date("2026-11-10T12:01:00.000Z");

    await repository.updateItem("att_1", 1, { answer: null, flagged: true, answeredAt });

    const args = firstArgs(delegates.examAttemptItem?.update);
    expect(args.where).toEqual({ attemptId_position: { attemptId: "att_1", position: 1 } });
    expect(args.data).toEqual({ answer: Prisma.DbNull, flagged: true, answeredAt });
  });

  it("updateItem solo envía los campos presentes en el parche", async () => {
    const { repository, delegates } = buildRepository({
      examAttemptItem: delegate({ update: ITEM_RECORD }),
    });

    const item = await repository.updateItem("att_1", 1, { answer: { optionId: "b" } });

    expect(firstArgs(delegates.examAttemptItem?.update).data).toEqual({
      answer: { optionId: "b" },
    });
    expect(item.position).toBe(1);
  });

  it("finishAttempt cierra solo si sigue IN_PROGRESS y marca cada ítem", async () => {
    const { repository, delegates } = buildRepository({
      examAttempt: delegate({ updateMany: { count: 1 } }),
      examAttemptItem: delegate({ update: ITEM_RECORD }),
    });

    const closed = await repository.finishAttempt("att_1", {
      status: "SUBMITTED",
      submittedAt: NOW,
      correctCount: 1,
      scorePct: 50,
      domainScores: [{ domain: 2, pct: 50 }],
      itemCorrectness: [
        { position: 1, correct: true },
        { position: 2, correct: false },
      ],
    });

    expect(closed).toBe(true);
    expect(firstArgs(delegates.examAttempt?.updateMany).where).toEqual({
      id: "att_1",
      status: "IN_PROGRESS",
    });
    expect(firstArgs(delegates.examAttempt?.updateMany).data).toEqual({
      status: "SUBMITTED",
      submittedAt: NOW,
      correctCount: 1,
      scorePct: 50,
      domainScores: [{ domain: 2, pct: 50 }],
    });
    expect(delegates.examAttemptItem?.update).toHaveBeenCalledTimes(2);
    expect(delegates.examAttemptItem?.update?.mock.calls[1]?.[0]).toEqual({
      where: { attemptId_position: { attemptId: "att_1", position: 2 } },
      data: { correct: false },
    });
  });

  it("finishAttempt devuelve false con count 0 y no toca los ítems", async () => {
    const { repository, delegates } = buildRepository({
      examAttempt: delegate({ updateMany: { count: 0 } }),
      examAttemptItem: delegate({ update: ITEM_RECORD }),
    });

    const closed = await repository.finishAttempt("att_1", {
      status: "EXPIRED",
      submittedAt: NOW,
      correctCount: 0,
      scorePct: 0,
      domainScores: [],
      itemCorrectness: [{ position: 1, correct: false }],
    });

    expect(closed).toBe(false);
    expect(delegates.examAttemptItem?.update).not.toHaveBeenCalled();
  });

  it("listAttempts ordena del más reciente al más antiguo, sin ítems", async () => {
    const { repository, delegates } = buildRepository({
      examAttempt: delegate({ findMany: [{ ...HEADER_RECORD, status: "SUBMITTED" }] }),
    });

    const attempts = await repository.listAttempts("user_a", "SAA-C03");

    const args = firstArgs(delegates.examAttempt?.findMany);
    expect(args.where).toEqual({ userId: "user_a", certification: "SAA-C03" });
    expect(args.orderBy).toEqual([{ startedAt: "desc" }, { id: "desc" }]);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.status).toBe("submitted");
    expect(attempts[0]).not.toHaveProperty("items");
  });

  it("readinessFacts consulta unidades, repasos vencidos y proyecto de la etapa", async () => {
    const { repository, delegates } = buildRepository({
      unit: delegate({
        findMany: [
          { code: "U1.1.1", progress: [{ id: "p1" }] },
          { code: "U1.1.2", progress: [] },
        ],
      }),
      reviewItem: delegate({ count: 4 }),
      project: delegate({ findFirst: { id: "proj_1" } }),
      projectSubmission: delegate({ aggregate: { _max: { score: 82.5 } } }),
    });

    const facts = await repository.readinessFacts("user_a", 3, NOW);

    expect(firstArgs(delegates.unit?.findMany).where).toEqual({
      isPublished: true,
      module: { stageId: 3 },
    });
    expect(firstArgs(delegates.unit?.findMany).select).toMatchObject({
      progress: { where: { userId: "user_a", state: "MASTERED" } },
    });
    expect(firstArgs(delegates.reviewItem?.count).where).toEqual({
      userId: "user_a",
      dueAt: { lt: new Date(NOW.getTime() - 7 * DAY_MS) },
      exercise: { unit: { module: { stageId: 3 } } },
    });
    expect(firstArgs(delegates.project?.findFirst).where).toEqual({
      stageId: 3,
      isPublished: true,
    });
    expect(firstArgs(delegates.projectSubmission?.aggregate).where).toEqual({
      userId: "user_a",
      projectId: "proj_1",
      status: "REVIEWED",
    });
    expect(facts).toEqual({
      unitsTotal: 2,
      pendingUnitCodes: ["U1.1.2"],
      overdueReviewCount: 4,
      projectAvailable: true,
      bestReviewedProjectScore: 82.5,
    });
  });

  it("readinessFacts sin proyecto publicado no consulta entregas", async () => {
    const { repository, delegates } = buildRepository({
      unit: delegate({ findMany: [] }),
      reviewItem: delegate({ count: 0 }),
      project: delegate({ findFirst: null }),
      projectSubmission: delegate({ aggregate: { _max: { score: null } } }),
    });

    const facts = await repository.readinessFacts("user_a", 3, NOW);

    expect(delegates.projectSubmission?.aggregate).not.toHaveBeenCalled();
    expect(facts).toEqual({
      unitsTotal: 0,
      pendingUnitCodes: [],
      overdueReviewCount: 0,
      projectAvailable: false,
      bestReviewedProjectScore: null,
    });
  });

  it("createRealResult escribe el resultado y lo devuelve normalizado", async () => {
    const record = {
      id: "real_1",
      userId: "user_a",
      certification: "SAA-C03",
      passed: true,
      scaledScore: 780,
      takenOn: new Date("2026-11-01T00:00:00.000Z"),
      readyAtRegistration: true,
      createdAt: NOW,
    };
    const { repository, delegates } = buildRepository({
      realExamResult: delegate({ create: record }),
    });

    const row = await repository.createRealResult({
      userId: "user_a",
      certification: "SAA-C03",
      passed: true,
      scaledScore: 780,
      takenOn: record.takenOn,
      readyAtRegistration: true,
    });

    expect(firstArgs(delegates.realExamResult?.create).data).toEqual({
      userId: "user_a",
      certification: "SAA-C03",
      passed: true,
      scaledScore: 780,
      takenOn: record.takenOn,
      readyAtRegistration: true,
    });
    expect(row).toEqual(record);
  });

  it("latestRealResult toma el más reciente de la certificación", async () => {
    const found = buildRepository({
      realExamResult: delegate({
        findFirst: {
          id: "real_1",
          userId: "user_a",
          certification: "SAA-C03",
          passed: false,
          scaledScore: null,
          takenOn: NOW,
          readyAtRegistration: false,
          createdAt: NOW,
        },
      }),
    });

    const row = await found.repository.latestRealResult("user_a", "SAA-C03");

    const args = firstArgs(found.delegates.realExamResult?.findFirst);
    expect(args.where).toEqual({ userId: "user_a", certification: "SAA-C03" });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(row?.passed).toBe(false);

    const missing = buildRepository({ realExamResult: delegate({ findFirst: null }) });

    await expect(missing.repository.latestRealResult("user_a", "SAA-C03")).resolves.toBeNull();
  });
});

describe("mapeo de enums", () => {
  it("traduce los modos de ida y vuelta", () => {
    const pairs = [
      ["FORM_A", "form-a"],
      ["FORM_B", "form-b"],
      ["FORM_C", "form-c"],
      ["RANDOM", "random"],
      ["DOMAIN", "domain"],
    ] as const;

    for (const [prisma, contract] of pairs) {
      expect(examModeFromPrisma(prisma)).toBe(contract);
      expect(examModeToPrisma(contract)).toBe(prisma);
    }
  });

  it("traduce los estados al contrato", () => {
    expect(examStatusFromPrisma("IN_PROGRESS")).toBe("in-progress");
    expect(examStatusFromPrisma("SUBMITTED")).toBe("submitted");
    expect(examStatusFromPrisma("EXPIRED")).toBe("expired");
  });
});

describe("PrismaExamsRepository.cohortFacts", () => {
  it("filtra por certificación, rango y estado terminado, y traduce el estado", async () => {
    const from = new Date("2026-10-11T00:00:00.000Z");
    const { repository, delegates } = buildRepository({
      examAttempt: delegate({
        findMany: [
          { userId: "user_a", status: "SUBMITTED", orientative: false, domainScores: [] },
          { userId: "user_b", status: "EXPIRED", orientative: true, domainScores: null },
        ],
      }),
      realExamResult: delegate({ findMany: [{ readyAtRegistration: true, passed: false }] }),
    });

    const facts = await repository.cohortFacts("SAA-C03", from, NOW);

    expect(firstArgs(delegates.examAttempt?.findMany).where).toEqual({
      certification: "SAA-C03",
      status: { in: ["SUBMITTED", "EXPIRED"] },
      startedAt: { gte: from, lte: NOW },
    });
    expect(firstArgs(delegates.realExamResult?.findMany).where).toEqual({
      certification: "SAA-C03",
      takenOn: { gte: from, lte: NOW },
    });
    expect(facts.attempts.map((attempt) => attempt.status)).toEqual(["submitted", "expired"]);
    expect(facts.realResults).toEqual([{ readyAtRegistration: true, passed: false }]);
  });
});
