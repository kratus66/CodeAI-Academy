import type { SubmissionOutcome } from "@codeai/shared";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { MockSandboxService } from "../sandbox/mock-sandbox.service";
import type { ExerciseRow } from "./exercises.repository";
import type { HintRequestRepository } from "./hint-requests.repository";
import { InMemoryExercisesRepository } from "./in-memory-exercises.repository";
import type { ReviewScheduler } from "./exercises.service";
import { ExercisesService } from "./exercises.service";

interface ScheduledCall {
  outcome: SubmissionOutcome;
  score: number;
  quality?: number;
}

const noHints: HintRequestRepository = {
  findUsedLevels: () => Promise.resolve([]),
  findLevelsRequestedSince: () => Promise.resolve([]),
  recordRequest: () => Promise.resolve(),
};

function base(overrides: Partial<ExerciseRow>): ExerciseRow {
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

const QUIZ = base({
  id: "quiz_1",
  type: "QUIZ",
  config: {
    options: [
      { id: "a", text: "Uno" },
      { id: "b", text: "Dos" },
      { id: "c", text: "Tres" },
    ],
  },
  solution: {
    correctOptionId: "b",
    explanations: { a: "No es uno.", b: "Es dos.", c: "No es tres." },
  },
});

const CARD = base({
  id: "card_1",
  type: "FLASHCARD",
  solution: { back: "El reverso" },
});

function setup(exercises: readonly ExerciseRow[] = [QUIZ, CARD]) {
  const calls: ScheduledCall[] = [];
  const reviews: ReviewScheduler = {
    scheduleFromSubmission: (params) => {
      calls.push(params);

      return Promise.resolve(true);
    },
  };
  const repository = new InMemoryExercisesRepository({ exercises, submissions: [] });
  const service = new ExercisesService(repository, new MockSandboxService(), noHints, reviews);

  return { service, repository, calls };
}

describe("ExercisesService.answerQuiz", () => {
  it("acierta: devuelve la explicación, registra el intento y programa el repaso", async () => {
    const { service, repository, calls } = setup();

    const { result } = await service.answerQuiz("user_a", "quiz_1", { optionId: "b" });

    expect(result).toEqual({
      correct: true,
      correctOptionId: "b",
      explanation: "Es dos.",
      correctExplanation: "Es dos.",
    });
    expect(await repository.countSubmissions("user_a", "quiz_1")).toBe(1);
    expect(calls).toEqual([expect.objectContaining({ outcome: "PASSED", score: 100 })]);
  });

  it("falla: explica la opción elegida y la correcta, y programa el repaso con prioridad", async () => {
    const { service, calls } = setup();

    const { result } = await service.answerQuiz("user_a", "quiz_1", { optionId: "a" });

    expect(result.correct).toBe(false);
    expect(result.explanation).toBe("No es uno.");
    expect(result.correctOptionId).toBe("b");
    expect(result.correctExplanation).toBe("Es dos.");
    expect(calls).toEqual([expect.objectContaining({ outcome: "FAILED", score: 0 })]);
  });

  it("rechaza una opción que no existe sin registrar el intento", async () => {
    const { service, repository } = setup();

    await expect(service.answerQuiz("user_a", "quiz_1", { optionId: "d" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await repository.countSubmissions("user_a", "quiz_1")).toBe(0);
  });

  it("rechaza un ejercicio que no es quiz", async () => {
    const { service } = setup();

    await expect(service.answerQuiz("user_a", "card_1", { optionId: "a" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("respeta el tope de intentos", async () => {
    const limited = { ...QUIZ, maxAttempts: 1 };
    const { service } = setup([limited, CARD]);

    await service.answerQuiz("user_a", "quiz_1", { optionId: "a" });

    await expect(service.answerQuiz("user_a", "quiz_1", { optionId: "b" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe("ExercisesService tarjetas", () => {
  it("no revela el reverso sin un intento y lo devuelve al registrar uno", async () => {
    const { service, repository } = setup();

    const { back } = await service.revealFlashcard("user_a", "card_1", { attempt: "creo que…" });

    expect(back).toBe("El reverso");
    expect(await repository.countSubmissions("user_a", "card_1")).toBe(1);
  });

  it("calificar sin haber revelado responde 409", async () => {
    const { service, calls } = setup();

    await expect(service.rateFlashcard("user_a", "card_1", { quality: 4 })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(calls).toEqual([]);
  });

  it("tras revelar, la calidad declarada reprograma el repaso", async () => {
    const { service, calls } = setup();

    await service.revealFlashcard("user_a", "card_1", { attempt: "mi intento" });
    const rated = await service.rateFlashcard("user_a", "card_1", { quality: 4 });

    expect(rated).toEqual({ scheduled: true });
    expect(calls).toEqual([expect.objectContaining({ outcome: "PASSED", quality: 4 })]);
  });

  it("una calificación no puede repetirse sobre la misma revelación", async () => {
    const { service } = setup();

    await service.revealFlashcard("user_a", "card_1", { attempt: "mi intento" });
    await service.rateFlashcard("user_a", "card_1", { quality: 2 });

    await expect(service.rateFlashcard("user_a", "card_1", { quality: 5 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("una calidad baja cuenta como fallo", async () => {
    const { service, calls } = setup();

    await service.revealFlashcard("user_a", "card_1", { attempt: "no sé" });
    await service.rateFlashcard("user_a", "card_1", { quality: 1 });

    expect(calls[0]).toEqual(expect.objectContaining({ outcome: "FAILED", quality: 1 }));
  });

  it("rechaza revelar un ejercicio que no es tarjeta", async () => {
    const { service } = setup();

    await expect(
      service.revealFlashcard("user_a", "quiz_1", { attempt: "x" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("ExercisesService.submitReflection", () => {
  const REFLECT = base({ id: "ref_1", type: "REFLECT", ladder: "SEMI" });

  it("registra la reflexión como intento sin programar un repaso", async () => {
    const { service, repository, calls } = setup([REFLECT, QUIZ]);

    const response = await service.submitReflection("user_a", "ref_1", { text: "Decidí X y descarté Y." });

    expect(response).toEqual({ recorded: true });
    expect(await repository.countSubmissions("user_a", "ref_1")).toBe(1);
    expect(calls).toEqual([]);
  });

  it("rechaza un ejercicio que no es una reflexión", async () => {
    const { service } = setup([REFLECT, QUIZ]);

    await expect(service.submitReflection("user_a", "quiz_1", { text: "x" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("ExercisesService: acreditación con revisión humana", () => {
  const reviews: ReviewScheduler = { scheduleFromSubmission: () => Promise.resolve(true) };

  function build(exercise: ExerciseRow, requireHumanReview: boolean) {
    const repository = new InMemoryExercisesRepository({ exercises: [exercise], submissions: [] });
    const service = new ExercisesService(
      repository,
      new MockSandboxService(),
      noHints,
      reviews,
      undefined,
      { requireHumanReview },
    );

    return { service, repository };
  }

  async function lastLevel(repository: InMemoryExercisesRepository, exerciseId: string) {
    const page = await repository.listSubmissions("user_a", exerciseId, { skip: 0, take: 1 });

    return page.items[0]?.achievedLevel;
  }

  it("con la política activa, un quiz sin revisar da práctica pero no acredita", async () => {
    const { service, repository } = build(QUIZ, true);

    const { result } = await service.answerQuiz("user_a", "quiz_1", { optionId: "b" });

    expect(result.correct).toBe(true);
    expect(await lastLevel(repository, "quiz_1")).toBeNull();
  });

  it("con la política activa, un quiz revisado por una persona acredita", async () => {
    const { service, repository } = build({ ...QUIZ, reviewedByHuman: true }, true);

    await service.answerQuiz("user_a", "quiz_1", { optionId: "b" });

    expect(await lastLevel(repository, "quiz_1")).toBe(1);
  });

  it("con la política apagada acredita igual que antes aunque no esté revisado", async () => {
    const { service, repository } = build(QUIZ, false);

    await service.answerQuiz("user_a", "quiz_1", { optionId: "b" });

    expect(await lastLevel(repository, "quiz_1")).toBe(1);
  });

  it("con la política activa, un LAB sin revisar corrige pero no acredita nivel", async () => {
    const lab = base({
      id: "lab_1",
      type: "LAB",
      language: "javascript",
      ladder: "AUTONOMOUS",
      tests: [{ id: "t1", name: "suma", isHidden: false, spec: { code: "assert.ok(true);" } }],
    });
    const gated = build(lab, true);
    const open = build({ ...lab, reviewedByHuman: true }, true);

    const run = await gated.service.submit("user_a", "lab_1", { code: "const x = 1;" });
    await open.service.submit("user_a", "lab_1", { code: "const x = 1;" });

    expect(run.submission.outcome).toBe("PASSED");
    expect(await lastLevel(gated.repository, "lab_1")).toBeNull();
    expect(await lastLevel(open.repository, "lab_1")).toBeGreaterThanOrEqual(2);
  });
});

describe("ExercisesService.getUnitProgress", () => {
  const reflect = base({ id: "ref_1", type: "REFLECT", config: {} });

  it("no lista ejercicios sin intentos", async () => {
    const { service } = setup();

    expect((await service.getUnitProgress("user_a", "U0.1.1")).statuses).toEqual([]);
  });

  it("un quiz acertado es PASSED y uno fallado es FAILED", async () => {
    const { service } = setup([QUIZ, base({ ...QUIZ, id: "quiz_2", slug: "otro" })]);

    await service.answerQuiz("user_a", "quiz_1", { optionId: "b" });
    await service.answerQuiz("user_a", "quiz_2", { optionId: "a" });

    const { statuses } = await service.getUnitProgress("user_a", "U0.1.1");

    expect(statuses.find((s) => s.exerciseId === "quiz_1")).toMatchObject({ status: "PASSED", attempts: 1, bestScore: 100 });
    expect(statuses.find((s) => s.exerciseId === "quiz_2")).toMatchObject({ status: "FAILED", attempts: 1, bestScore: 0 });
  });

  it("superar el ejercicio alguna vez lo deja en PASSED aunque el último intento falle", async () => {
    const { service } = setup();

    await service.answerQuiz("user_a", "quiz_1", { optionId: "b" });
    await service.answerQuiz("user_a", "quiz_1", { optionId: "a" });

    expect((await service.getUnitProgress("user_a", "U0.1.1")).statuses[0]).toMatchObject({
      status: "PASSED",
      attempts: 2,
      bestScore: 100,
    });
  });

  it("fallar y luego acertar pasa de FAILED a PASSED", async () => {
    const { service } = setup();

    await service.answerQuiz("user_a", "quiz_1", { optionId: "a" });
    expect((await service.getUnitProgress("user_a", "U0.1.1")).statuses[0]?.status).toBe("FAILED");

    await service.answerQuiz("user_a", "quiz_1", { optionId: "b" });
    expect((await service.getUnitProgress("user_a", "U0.1.1")).statuses[0]?.status).toBe("PASSED");
  });

  it("una tarjeta revelada pero sin calificar está en curso", async () => {
    const { service } = setup();

    await service.revealFlashcard("user_a", "card_1", { attempt: "no recuerdo" });

    expect((await service.getUnitProgress("user_a", "U0.1.1")).statuses[0]).toMatchObject({
      exerciseId: "card_1",
      status: "PARTIAL",
    });
  });

  it("una reflexión enviada cuenta como hecha", async () => {
    const { service } = setup([reflect]);

    await service.submitReflection("user_a", "ref_1", { text: "Decidí X y descarté Y porque Z." });

    expect((await service.getUnitProgress("user_a", "U0.1.1")).statuses[0]).toMatchObject({
      exerciseId: "ref_1",
      status: "PASSED",
    });
  });

  it("sólo cuenta los intentos del propio usuario y responde 404 si la unidad no existe", async () => {
    const { service } = setup();

    await service.answerQuiz("user_b", "quiz_1", { optionId: "b" });

    expect((await service.getUnitProgress("user_a", "U0.1.1")).statuses).toEqual([]);
    await expect(service.getUnitProgress("user_a", "U9.9.9")).rejects.toThrow();
  });
});
