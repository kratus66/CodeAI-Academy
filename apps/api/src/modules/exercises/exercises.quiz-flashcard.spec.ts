import type { SubmissionOutcome } from "@codeai/shared";
import { BadRequestException, ConflictException, InternalServerErrorException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { ProgressService } from "../progress/progress.service";
import { MockSandboxService } from "../sandbox/mock-sandbox.service";
import type { CreateSubmissionInput, ExerciseRow, SubmissionRow } from "./exercises.repository";
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
      kind: "single",
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

    if (result.kind !== "single") {
      throw new Error(`Se esperaba un resultado «single» y llegó «${result.kind}»`);
    }

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

/** Quiz de respuesta múltiple («selecciona DOS»): `config` y `solution` declaran `kind`. */
const MULTIPLE_QUIZ = base({
  id: "quiz_multiple",
  type: "QUIZ",
  config: {
    kind: "multiple",
    selectCount: 2,
    options: [
      { id: "a", text: "Idempotente" },
      { id: "b", text: "Seguro ante reintentos" },
      { id: "c", text: "Sin estado" },
      { id: "d", text: "Síncrono" },
    ],
  },
  solution: {
    kind: "multiple",
    correctOptionIds: ["a", "b"],
    explanations: {
      a: "Sí: repetir la petición no cambia el resultado.",
      b: "Sí: un reintento no duplica el efecto.",
      c: "No: el estado no es un requisito.",
      d: "No: la sincronía no tiene que ver.",
    },
  },
});

const ORDERING_QUIZ = base({
  id: "quiz_ordering",
  type: "QUIZ",
  config: {
    kind: "ordering",
    items: [
      { id: "a", text: "Validar el cuerpo" },
      { id: "b", text: "Guardar en la base" },
      { id: "c", text: "Recibir la petición" },
    ],
  },
  solution: {
    kind: "ordering",
    correctOrder: ["c", "a", "b"],
    explanations: {
      a: "Antes hay que recibir la petición.",
      b: "Guardar es el último paso.",
      c: "Recibir la petición va primero.",
    },
  },
});

const MATCHING_QUIZ = base({
  id: "quiz_matching",
  type: "QUIZ",
  config: {
    kind: "matching",
    left: [
      { id: "a", text: "Capa de transporte" },
      { id: "b", text: "Capa de aplicación" },
      { id: "c", text: "Resolución de nombres" },
    ],
    right: [
      { id: "1", text: "HTTP" },
      { id: "2", text: "TCP" },
      { id: "3", text: "DNS" },
    ],
  },
  solution: {
    kind: "matching",
    correctPairs: { a: "2", b: "1", c: "3" },
    explanations: {
      a: "TCP es de la capa de transporte.",
      b: "HTTP es de aplicación.",
      c: "DNS resuelve nombres.",
    },
  },
});

/**
 * Guarda cada envío tal como llega al puerto. `SubmissionRow` no expone `code`,
 * así que el código que fija el corrector se captura antes de delegar.
 */
class RecordingRepository extends InMemoryExercisesRepository {
  readonly created: CreateSubmissionInput[] = [];

  override async createSubmission(input: CreateSubmissionInput): Promise<SubmissionRow> {
    this.created.push(input);

    return super.createSubmission(input);
  }
}

function setupVariants(exercises: readonly ExerciseRow[]) {
  const calls: ScheduledCall[] = [];
  const reviews: ReviewScheduler = {
    scheduleFromSubmission: (params) => {
      calls.push(params);

      return Promise.resolve(true);
    },
  };
  const progress: string[] = [];
  const progressService = {
    recordExerciseActivity: (userId: string, unitCode: string) => {
      progress.push(`${userId}:${unitCode}`);

      return Promise.resolve();
    },
  } as unknown as ProgressService;
  const repository = new RecordingRepository({ exercises, submissions: [] });
  const service = new ExercisesService(
    repository,
    new MockSandboxService(),
    noHints,
    reviews,
    progressService,
  );

  return { service, repository, calls, progress };
}

describe("ExercisesService.answerQuiz — variantes", () => {
  it("múltiple: elegir las dos correctas acierta y guarda los ids ordenados", async () => {
    const { service, repository, calls, progress } = setupVariants([MULTIPLE_QUIZ]);

    const { result } = await service.answerQuiz("user_a", "quiz_multiple", {
      optionIds: ["b", "a"],
    });

    expect(result).toMatchObject({
      kind: "multiple",
      correct: true,
      correctOptionIds: ["a", "b"],
      selectedOptionIds: ["b", "a"],
    });
    expect(repository.created[0]).toMatchObject({
      code: "a,b",
      outcome: "PASSED",
      score: 100,
      achievedLevel: 1,
    });
    expect(calls).toEqual([expect.objectContaining({ outcome: "PASSED", score: 100 })]);
    expect(progress).toEqual(["user_a:U0.1.1"]);
  });

  it("múltiple: una correcta y una incorrecta fallan, sin crédito parcial", async () => {
    const { service, repository, calls } = setupVariants([MULTIPLE_QUIZ]);

    const { result } = await service.answerQuiz("user_a", "quiz_multiple", {
      optionIds: ["a", "c"],
    });

    expect(result).toMatchObject({ kind: "multiple", correct: false });
    expect(repository.created[0]).toMatchObject({
      code: "a,c",
      outcome: "FAILED",
      score: 0,
      achievedLevel: null,
    });
    expect(calls).toEqual([expect.objectContaining({ outcome: "FAILED", score: 0 })]);
  });

  it("múltiple: una selección incompleta responde 400 sin crear envío ni gastar intento", async () => {
    const { service, repository } = setupVariants([MULTIPLE_QUIZ]);

    const answer = service.answerQuiz("user_a", "quiz_multiple", { optionIds: ["a"] });

    await expect(answer).rejects.toBeInstanceOf(BadRequestException);
    await expect(answer).rejects.toThrow("Selecciona exactamente 2 opciones");
    expect(repository.created).toEqual([]);
    expect(await repository.countSubmissions("user_a", "quiz_multiple")).toBe(0);
  });

  it("ordenar: la secuencia correcta acierta y guarda el orden con «>»", async () => {
    const { service, repository, calls, progress } = setupVariants([ORDERING_QUIZ]);

    const { result } = await service.answerQuiz("user_a", "quiz_ordering", {
      order: ["c", "a", "b"],
    });

    expect(result).toMatchObject({
      kind: "ordering",
      correct: true,
      correctOrder: ["c", "a", "b"],
      explanations: { a: "Antes hay que recibir la petición." },
    });
    expect(repository.created[0]).toMatchObject({
      code: "c>a>b",
      outcome: "PASSED",
      score: 100,
    });
    expect(calls).toEqual([expect.objectContaining({ outcome: "PASSED", score: 100 })]);
    expect(progress).toEqual(["user_a:U0.1.1"]);
  });

  it("ordenar: una secuencia equivocada falla y guarda el orden enviado", async () => {
    const { service, repository } = setupVariants([ORDERING_QUIZ]);

    const { result } = await service.answerQuiz("user_a", "quiz_ordering", {
      order: ["a", "c", "b"],
    });

    expect(result).toMatchObject({ kind: "ordering", correct: false });
    expect(repository.created[0]).toMatchObject({
      code: "a>c>b",
      outcome: "FAILED",
      score: 0,
    });
  });

  it("emparejar: todas las parejas aciertan y el código va ordenado por clave", async () => {
    const { service, repository, calls, progress } = setupVariants([MATCHING_QUIZ]);

    const { result } = await service.answerQuiz("user_a", "quiz_matching", {
      pairs: { b: "1", c: "3", a: "2" },
    });

    expect(result).toMatchObject({
      kind: "matching",
      correct: true,
      correctPairs: { a: "2", b: "1", c: "3" },
    });
    expect(repository.created[0]).toMatchObject({
      code: "a=2,b=1,c=3",
      outcome: "PASSED",
      score: 100,
    });
    expect(calls).toEqual([expect.objectContaining({ outcome: "PASSED", score: 100 })]);
    expect(progress).toEqual(["user_a:U0.1.1"]);
  });

  it("emparejar: una pareja equivocada falla aunque el resto coincida", async () => {
    const { service, repository } = setupVariants([MATCHING_QUIZ]);

    const { result } = await service.answerQuiz("user_a", "quiz_matching", {
      pairs: { a: "1", b: "2", c: "3" },
    });

    expect(result).toMatchObject({ kind: "matching", correct: false });
    expect(repository.created[0]).toMatchObject({
      code: "a=1,b=2,c=3",
      outcome: "FAILED",
      score: 0,
    });
  });

  it("un cuerpo de single contra un ejercicio múltiple responde 400 sin gastar intento", async () => {
    const { service, repository } = setupVariants([MULTIPLE_QUIZ]);

    const answer = service.answerQuiz("user_a", "quiz_multiple", { optionId: "a" });

    await expect(answer).rejects.toBeInstanceOf(BadRequestException);
    await expect(answer).rejects.toThrow("La respuesta no corresponde al tipo de pregunta");
    expect(await repository.countSubmissions("user_a", "quiz_multiple")).toBe(0);
  });

  it("el tope de intentos también responde 409 en las tres variantes nuevas", async () => {
    const limited = [
      { ...MULTIPLE_QUIZ, maxAttempts: 1 },
      { ...ORDERING_QUIZ, maxAttempts: 1 },
      { ...MATCHING_QUIZ, maxAttempts: 1 },
    ];
    const { service } = setupVariants(limited);

    await service.answerQuiz("user_a", "quiz_multiple", { optionIds: ["a", "b"] });
    await service.answerQuiz("user_a", "quiz_ordering", { order: ["c", "a", "b"] });
    await service.answerQuiz("user_a", "quiz_matching", { pairs: { a: "2", b: "1", c: "3" } });

    await expect(
      service.answerQuiz("user_a", "quiz_multiple", { optionIds: ["a", "b"] }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.answerQuiz("user_a", "quiz_ordering", { order: ["c", "a", "b"] }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.answerQuiz("user_a", "quiz_matching", { pairs: { a: "2", b: "1", c: "3" } }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("un contenido mal sembrado responde 500 sin registrar el intento", async () => {
    const broken = base({
      id: "quiz_broken",
      type: "QUIZ",
      config: {
        options: [
          { id: "a", text: "Uno" },
          { id: "b", text: "Dos" },
        ],
      },
      solution: { correctOptionId: "b", explanations: { a: "No es uno." } },
    });
    const { service, repository } = setupVariants([broken]);

    const answer = service.answerQuiz("user_a", "quiz_broken", { optionId: "b" });

    await expect(answer).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(answer).rejects.toThrow("El ejercicio está mal configurado");
    expect(await repository.countSubmissions("user_a", "quiz_broken")).toBe(0);
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
