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
