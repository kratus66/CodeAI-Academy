import type { CertificationCode } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import type {
  CreateAttemptInput,
  FinishAttemptInput,
  ReservedQuestionRow,
} from "./exams.repository";
import { InMemoryExamsRepository } from "./in-memory-exams.repository";

const USER = "user-1";
const OTHER_USER = "user-2";
const CLF: CertificationCode = "CLF-C02";
const SAA: CertificationCode = "SAA-C03";
const START = new Date("2026-11-09T10:00:00.000Z");
const MINUTE = 60_000;

const EMPTY_FACTS = {
  unitsTotal: 0,
  pendingUnitCodes: [],
  overdueReviewCount: 0,
  projectAvailable: false,
  bestReviewedProjectScore: null,
};

function at(minutes: number): Date {
  return new Date(START.getTime() + minutes * MINUTE);
}

function question(
  exerciseId: string,
  overrides: Partial<ReservedQuestionRow> = {},
): ReservedQuestionRow {
  return {
    exerciseId,
    slug: `slug-${exerciseId}`,
    domain: 1,
    unitCode: "U1",
    statement: `Enunciado de ${exerciseId}`,
    config: { kind: "single" },
    solution: { optionId: "a" },
    reviewedByHuman: true,
    competencies: ["C1"],
    ...overrides,
  };
}

/** Repositorio con cinco preguntas en CLF-C02 y una en SAA-C03. */
function repository(): InMemoryExamsRepository {
  const repo = new InMemoryExamsRepository();

  for (const exerciseId of ["q1", "q2", "q3", "q4", "q5"]) {
    repo.seedQuestion(CLF, question(exerciseId));
  }

  repo.seedQuestion(SAA, question("s1", { domain: 2 }));

  return repo;
}

function attemptInput(overrides: Partial<CreateAttemptInput> = {}): CreateAttemptInput {
  return {
    userId: USER,
    certification: CLF,
    mode: "form-a",
    domain: null,
    extraTime: false,
    orientative: false,
    startedAt: START,
    deadlineAt: at(75),
    items: [{ position: 1, exerciseId: "q1", domain: 1 }],
    ...overrides,
  };
}

function close(
  repo: InMemoryExamsRepository,
  attemptId: string,
  overrides: Partial<FinishAttemptInput> = {},
): Promise<boolean> {
  return repo.finishAttempt(attemptId, {
    status: "SUBMITTED",
    submittedAt: at(60),
    correctCount: 1,
    scorePct: 80,
    domainScores: [{ domain: 1, scorePct: 80 }],
    itemCorrectness: [{ position: 1, correct: true }],
    ...overrides,
  });
}

describe("InMemoryExamsRepository", () => {
  it("devuelve sólo el banco reservado de la certificación pedida", async () => {
    const repo = repository();

    const pool = await repo.listReservedPool(CLF);

    expect(pool.map((entry) => entry.slug)).toEqual([
      "slug-q1",
      "slug-q2",
      "slug-q3",
      "slug-q4",
      "slug-q5",
    ]);
    expect(await repo.listReservedPool(SAA)).toHaveLength(1);
    expect(await repo.listReservedPool("DVA-C03")).toEqual([]);
  });

  it("entrega copias del banco, no las filas guardadas", async () => {
    const repo = repository();

    const pool = await repo.listReservedPool(CLF);
    pool[0]?.competencies.push("C9");

    expect((await repo.listReservedPool(CLF))[0]?.competencies).toEqual(["C1"]);
  });

  it("guarda las formas fijas y cuenta sólo las de su certificación", async () => {
    const repo = repository();

    repo.seedForm(CLF, "A", ["slug-q1", "slug-q2"]);
    repo.seedForm(CLF, "B", ["slug-q3", "slug-q4"]);

    const slugs = await repo.findFormSlugs(CLF, "A");
    expect(slugs).toEqual(["slug-q1", "slug-q2"]);
    expect(await repo.findFormSlugs(CLF, "C")).toBeNull();
    expect(await repo.findFormSlugs(SAA, "A")).toBeNull();
    expect(await repo.countForms(CLF)).toBe(2);
    expect(await repo.countForms(SAA)).toBe(0);

    slugs?.push("slug-q5");
    expect(await repo.findFormSlugs(CLF, "A")).toEqual(["slug-q1", "slug-q2"]);
  });

  it("arma el intento con los ítems vacíos y su pregunta", async () => {
    const repo = repository();

    const created = await repo.createAttempt(
      attemptInput({
        mode: "domain",
        domain: 1,
        extraTime: true,
        items: [
          { position: 2, exerciseId: "q2", domain: 1 },
          { position: 1, exerciseId: "q1", domain: 1 },
        ],
      }),
    );

    expect(created.status).toBe("in-progress");
    expect(created.domain).toBe(1);
    expect(created.extraTime).toBe(true);
    expect(created.orientative).toBe(false);
    expect(created.submittedAt).toBeNull();
    expect(created.correctCount).toBeNull();
    expect(created.scorePct).toBeNull();
    expect(created.domainScores).toBeNull();
    expect(created.items.map((item) => item.position)).toEqual([1, 2]);
    expect(created.items[0]).toMatchObject({
      exerciseId: "q1",
      domain: 1,
      answer: null,
      flagged: false,
      correct: null,
    });
    expect(created.items[0]?.question.slug).toBe("slug-q1");
  });

  it("no entrega el intento de otra persona", async () => {
    const repo = repository();
    const created = await repo.createAttempt(attemptInput());

    expect((await repo.findOwnedAttempt(USER, created.id))?.id).toBe(created.id);
    expect(await repo.findOwnedAttempt(OTHER_USER, created.id)).toBeNull();
    expect(await repo.findOwnedAttempt(USER, "intento-inexistente")).toBeNull();
  });

  it("guarda la respuesta y la marca del ítem, y la despeja con null", async () => {
    const repo = repository();
    const created = await repo.createAttempt(attemptInput());

    const answered = await repo.updateItem(created.id, 1, {
      answer: { optionId: "a" },
      flagged: true,
    });
    expect(answered.answer).toEqual({ optionId: "a" });
    expect(answered.flagged).toBe(true);
    expect(answered.question.slug).toBe("slug-q1");

    const cleared = await repo.updateItem(created.id, 1, { answer: null });
    expect(cleared.answer).toBeNull();
    expect(cleared.flagged).toBe(true);

    const unflagged = await repo.updateItem(created.id, 1, { flagged: false });
    expect(unflagged.flagged).toBe(false);

    await expect(
      repo.updateItem(created.id, 9, { flagged: true }),
    ).rejects.toThrow("Ítem inexistente en el intento");
  });

  it("cierra una sola vez: la segunda entrega devuelve false sin tocar nada", async () => {
    const repo = repository();
    const created = await repo.createAttempt(attemptInput());

    expect(await close(repo, created.id)).toBe(true);

    const closed = await repo.findOwnedAttempt(USER, created.id);
    expect(closed?.status).toBe("submitted");
    expect(closed?.submittedAt?.toISOString()).toBe(at(60).toISOString());
    expect(closed?.correctCount).toBe(1);
    expect(closed?.scorePct).toBe(80);
    expect(closed?.domainScores).toEqual([{ domain: 1, scorePct: 80 }]);
    expect(closed?.items[0]?.correct).toBe(true);

    expect(
      await close(repo, created.id, {
        status: "EXPIRED",
        submittedAt: at(120),
        correctCount: 0,
        scorePct: 0,
        domainScores: null,
        itemCorrectness: [{ position: 1, correct: false }],
      }),
    ).toBe(false);

    const untouched = await repo.findOwnedAttempt(USER, created.id);
    expect(untouched).toMatchObject({
      status: "submitted",
      correctCount: 1,
      scorePct: 80,
      domainScores: [{ domain: 1, scorePct: 80 }],
    });
    expect(untouched?.submittedAt?.toISOString()).toBe(at(60).toISOString());
    expect(untouched?.items[0]?.correct).toBe(true);
  });

  it("cierra un intento que venció como expired", async () => {
    const repo = repository();
    const created = await repo.createAttempt(attemptInput());

    expect(
      await close(repo, created.id, { status: "EXPIRED", scorePct: 30 }),
    ).toBe(true);
    expect((await repo.findOwnedAttempt(USER, created.id))?.status).toBe("expired");
    expect(await close(repo, "intento-inexistente")).toBe(false);
  });

  it("recentExerciseIds mira sólo los N últimos intentos terminados de la certificación", async () => {
    const repo = repository();

    const oldest = await repo.createAttempt(
      attemptInput({ startedAt: at(0), items: [{ position: 1, exerciseId: "q1", domain: 1 }] }),
    );
    await close(repo, oldest.id, { submittedAt: at(30) });

    const middle = await repo.createAttempt(
      attemptInput({ startedAt: at(60), items: [{ position: 1, exerciseId: "q2", domain: 1 }] }),
    );
    await close(repo, middle.id, { submittedAt: at(90) });

    const newest = await repo.createAttempt(
      attemptInput({ startedAt: at(120), items: [{ position: 1, exerciseId: "q3", domain: 1 }] }),
    );
    await close(repo, newest.id, { submittedAt: at(150) });

    const open = await repo.createAttempt(
      attemptInput({ startedAt: at(180), items: [{ position: 1, exerciseId: "q4", domain: 1 }] }),
    );
    expect(open.status).toBe("in-progress");

    const foreign = await repo.createAttempt(
      attemptInput({
        userId: OTHER_USER,
        startedAt: at(210),
        items: [{ position: 1, exerciseId: "q5", domain: 1 }],
      }),
    );
    await close(repo, foreign.id, { submittedAt: at(240) });

    const otherCertification = await repo.createAttempt(
      attemptInput({
        certification: SAA,
        startedAt: at(270),
        items: [{ position: 1, exerciseId: "s1", domain: 2 }],
      }),
    );
    await close(repo, otherCertification.id, { submittedAt: at(300) });

    expect([...(await repo.recentExerciseIds(USER, CLF, 2))].sort()).toEqual([
      "q2",
      "q3",
    ]);
    expect([...(await repo.recentExerciseIds(USER, CLF, 3))].sort()).toEqual([
      "q1",
      "q2",
      "q3",
    ]);
    expect(await repo.recentExerciseIds(USER, CLF, 0)).toEqual(new Set());
    expect(await repo.recentExerciseIds(OTHER_USER, CLF, 3)).toEqual(new Set(["q5"]));
  });

  it("encuentra el intento abierto del usuario y ninguna vez cerrado", async () => {
    const repo = repository();

    expect(await repo.findOpenAttemptId(USER, CLF)).toBeNull();

    const first = await repo.createAttempt(attemptInput({ startedAt: at(0) }));
    const second = await repo.createAttempt(attemptInput({ startedAt: at(30) }));

    expect(await repo.findOpenAttemptId(USER, CLF)).toBe(second.id);
    expect(await repo.findOpenAttemptId(USER, SAA)).toBeNull();
    expect(await repo.findOpenAttemptId(OTHER_USER, CLF)).toBeNull();

    await close(repo, second.id);
    await close(repo, first.id);

    expect(await repo.findOpenAttemptId(USER, CLF)).toBeNull();
  });

  it("lista el historial del más reciente al más antiguo y sin ítems", async () => {
    const repo = repository();

    const first = await repo.createAttempt(attemptInput({ startedAt: at(0) }));
    const second = await repo.createAttempt(attemptInput({ startedAt: at(120) }));
    const third = await repo.createAttempt(attemptInput({ startedAt: at(60) }));
    await repo.createAttempt(
      attemptInput({
        certification: SAA,
        startedAt: at(180),
        items: [{ position: 1, exerciseId: "s1", domain: 2 }],
      }),
    );

    const history = await repo.listAttempts(USER, CLF);

    expect(history.map((row) => row.id)).toEqual([second.id, third.id, first.id]);
    expect(history[0]).not.toHaveProperty("items");
    expect(await repo.listAttempts(OTHER_USER, CLF)).toEqual([]);
    expect(await repo.listAttempts(USER, SAA)).toHaveLength(1);
  });

  it("devuelve los hechos sembrados de la etapa y ceros cuando no hay nada", async () => {
    const repo = repository();

    expect(await repo.readinessFacts(USER, 4, START)).toEqual(EMPTY_FACTS);

    repo.seedReadinessFacts(USER, 4, {
      unitsTotal: 6,
      pendingUnitCodes: ["U3"],
      overdueReviewCount: 2,
      projectAvailable: true,
      bestReviewedProjectScore: 85,
    });

    expect(await repo.readinessFacts(USER, 4, START)).toEqual({
      unitsTotal: 6,
      pendingUnitCodes: ["U3"],
      overdueReviewCount: 2,
      projectAvailable: true,
      bestReviewedProjectScore: 85,
    });
    expect(await repo.readinessFacts(USER, 5, START)).toEqual(EMPTY_FACTS);
    expect(await repo.readinessFacts(OTHER_USER, 4, START)).toEqual(EMPTY_FACTS);
  });

  it("registra resultados reales y devuelve el último de la certificación", async () => {
    const repo = repository();

    expect(await repo.latestRealResult(USER, CLF)).toBeNull();

    const failed = await repo.createRealResult({
      userId: USER,
      certification: CLF,
      passed: false,
      scaledScore: 640,
      takenOn: new Date("2026-10-01T00:00:00.000Z"),
      readyAtRegistration: true,
    });
    const passed = await repo.createRealResult({
      userId: USER,
      certification: CLF,
      passed: true,
      scaledScore: 830,
      takenOn: new Date("2026-11-01T00:00:00.000Z"),
      readyAtRegistration: false,
    });
    await repo.createRealResult({
      userId: USER,
      certification: SAA,
      passed: true,
      scaledScore: null,
      takenOn: new Date("2026-11-02T00:00:00.000Z"),
      readyAtRegistration: true,
    });

    expect(failed.id).not.toBe(passed.id);
    expect(passed.createdAt).toBeInstanceOf(Date);

    const latest = await repo.latestRealResult(USER, CLF);
    expect(latest).toMatchObject({
      id: passed.id,
      passed: true,
      scaledScore: 830,
      readyAtRegistration: false,
    });
    expect(await repo.latestRealResult(OTHER_USER, CLF)).toBeNull();
  });
});

describe("InMemoryExamsRepository.cohortFacts", () => {
  it("devuelve solo intentos terminados de la certificación y el rango, y resultados reales", async () => {
    const repo = repository();
    const done = await repo.createAttempt(attemptInput({ orientative: true }));
    await close(repo, done.id, { status: "EXPIRED" });
    await repo.createAttempt(attemptInput({ userId: OTHER_USER }));
    const late = await repo.createAttempt(attemptInput({ startedAt: at(100_000) }));
    await close(repo, late.id);
    const other = await repo.createAttempt(
      attemptInput({
        certification: SAA,
        items: [{ position: 1, exerciseId: "s1", domain: 2 }],
      }),
    );
    await close(repo, other.id);
    await repo.createRealResult({
      userId: USER,
      certification: CLF,
      passed: true,
      scaledScore: null,
      takenOn: at(0),
      readyAtRegistration: true,
    });
    await repo.createRealResult({
      userId: USER,
      certification: SAA,
      passed: false,
      scaledScore: null,
      takenOn: at(0),
      readyAtRegistration: false,
    });

    const facts = await repo.cohortFacts(CLF, at(-1), at(1));

    expect(facts.attempts).toEqual([
      {
        userId: USER,
        status: "expired",
        orientative: true,
        domainScores: [{ domain: 1, scorePct: 80 }],
      },
    ]);
    expect(facts.realResults).toEqual([{ readyAtRegistration: true, passed: true }]);
    expect((await repo.cohortFacts(CLF, at(10), at(20))).attempts).toEqual([]);
  });
});
