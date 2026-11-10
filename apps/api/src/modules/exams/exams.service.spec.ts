import { CERTIFICATION_REGISTRY, type CertificationCode } from "@codeai/shared";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { ReviewService } from "../review/review.service";
import { ExamsService } from "./exams.service";
import type { ReservedQuestionRow } from "./exams.repository";
import { InMemoryExamsRepository } from "./in-memory-exams.repository";

const USER = "user-1";
const OTHER_USER = "user-2";
const CLF: CertificationCode = "CLF-C02";
const START = new Date("2026-11-10T10:00:00.000Z");
const MINUTE_MS = 60_000;
const POOL_SIZE = 120;
const FORBIDDEN_KEYS = ["correct", "correctAnswer", "explanations", "solution"];

function question(index: number, reviewedByHuman = true): ReservedQuestionRow {
  return {
    exerciseId: `ex-${index}`,
    slug: `q-${index}`,
    domain: (index % 4) + 1,
    unitCode: `U${(index % 4) + 1}`,
    statement: `Enunciado ${index}`,
    config: {
      kind: "single",
      options: [
        { id: "a", text: "Opción A" },
        { id: "b", text: "Opción B" },
      ],
    },
    solution: {
      correctOptionId: "a",
      explanations: { a: "Porque sí", b: "Porque no" },
    },
    reviewedByHuman,
    competencies: ["C1"],
  };
}

interface Harness {
  service: ExamsService;
  repository: InMemoryExamsRepository;
  schedule: ReturnType<typeof vi.fn>;
  setNow: (date: Date) => void;
}

function harness(options: { unreviewed?: number } = {}): Harness {
  const repository = new InMemoryExamsRepository();

  for (let index = 1; index <= POOL_SIZE; index += 1) {
    repository.seedQuestion(CLF, question(index, index !== options.unreviewed));
  }

  const formSlugs: string[] = [];

  for (let index = CERTIFICATION_REGISTRY[CLF].questionCount; index >= 1; index -= 1) {
    formSlugs.push(`q-${index}`);
  }

  repository.seedForm(CLF, "A", formSlugs);

  let current = START;
  const schedule = vi.fn(async () => true);
  const reviews = { scheduleFromSubmission: schedule } as unknown as ReviewService;
  const service = new ExamsService(repository, () => current, () => 0.5, reviews);

  return {
    service,
    repository,
    schedule,
    setNow: (date) => {
      current = date;
    },
  };
}

/** Recorre el JSON y devuelve las claves prohibidas encontradas a cualquier profundidad. */
function forbiddenKeysIn(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => forbiddenKeysIn(entry));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [
      ...(FORBIDDEN_KEYS.includes(key) ? [key] : []),
      ...forbiddenKeysIn(child),
    ]);
  }

  return [];
}

function after(minutes: number, seconds = 0): Date {
  return new Date(START.getTime() + minutes * MINUTE_MS + seconds * 1000);
}

describe("ExamsService.start", () => {
  it("sirve la forma A en el orden de la semilla, con el total y el plazo oficiales", async () => {
    const { service } = harness();

    const attempt = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    expect(attempt.questionCount).toBe(CERTIFICATION_REGISTRY[CLF].questionCount);
    expect(attempt.items).toHaveLength(65);
    expect(attempt.items[0]?.statement).toBe("Enunciado 65");
    expect(attempt.items[64]?.statement).toBe("Enunciado 1");
    expect(attempt.items.map((item) => item.position)).toEqual(
      Array.from({ length: 65 }, (_, index) => index + 1),
    );
    expect(attempt.status).toBe("in-progress");
    expect(attempt.orientative).toBe(false);
    expect(attempt.answeredCount).toBe(0);
    expect(attempt.deadlineAt).toBe(after(90).toISOString());
    expect(attempt.remainingSeconds).toBe(90 * 60);
  });

  it("añade 30 minutos con extraTime y marca orientativo si falta revisión humana", async () => {
    const { service } = harness({ unreviewed: 3 });

    const attempt = await service.start(USER, CLF, { mode: "form-a", extraTime: true });

    expect(attempt.deadlineAt).toBe(after(120).toISOString());
    expect(attempt.orientative).toBe(true);
  });

  it("arma la tanda aleatoria y el bloque por dominio", async () => {
    const { service } = harness();

    const random = await service.start(USER, CLF, { mode: "random", extraTime: false });
    await service.submit(USER, random.id);
    const block = await service.start(USER, CLF, { mode: "domain", domain: 2, extraTime: false });

    expect(random.questionCount).toBe(65);
    expect(block.questionCount).toBe(20);
    expect(block.domain).toBe(2);
    expect(block.items.every((item) => item.domain === 2)).toBe(true);
    expect(block.deadlineAt).toBe(after(Math.ceil((20 * 90) / 65)).toISOString());
  });

  it("rechaza un segundo intento en curso con 409", async () => {
    const { service } = harness();

    await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    await expect(service.start(USER, CLF, { mode: "random", extraTime: false })).rejects.toThrow(
      new ConflictException("Ya tienes un simulacro en curso de esta certificación"),
    );
  });

  it("no ofrece simulacro de una certificación en beta", async () => {
    const { service } = harness();

    await expect(
      service.start(USER, "MLA-C02", { mode: "random", extraTime: false }),
    ).rejects.toThrow(
      new ConflictException(
        "Esta certificación está en beta: el simulacro llegará con la guía definitiva",
      ),
    );
  });

  it("responde 409 si la forma no existe y 400 si el dominio no existe", async () => {
    const { service } = harness();

    await expect(service.start(USER, CLF, { mode: "form-b", extraTime: false })).rejects.toThrow(
      new ConflictException("La forma B todavía no existe"),
    );
    await expect(
      service.start(USER, CLF, { mode: "domain", domain: 6, extraTime: false }),
    ).rejects.toMatchObject({ status: 400, message: "Ese dominio no existe en el examen" });
  });

  it("responde 409 si el banco no alcanza", async () => {
    const repository = new InMemoryExamsRepository();
    repository.seedQuestion(CLF, question(1));
    const reviews = { scheduleFromSubmission: vi.fn() } as unknown as ReviewService;
    const service = new ExamsService(repository, () => START, () => 0.5, reviews);

    await expect(service.start(USER, CLF, { mode: "random", extraTime: false })).rejects.toThrow(
      new ConflictException("El banco reservado no alcanza para este simulacro"),
    );
  });

  it("cierra un intento en curso vencido antes de abrir otro", async () => {
    const { service, setNow } = harness();
    const first = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    setNow(after(91));
    const second = await service.start(USER, CLF, { mode: "random", extraTime: false });

    expect(second.id).not.toBe(first.id);
    expect((await service.get(USER, first.id)).status).toBe("expired");
  });
});

describe("ExamsService: sin solución antes de entregar", () => {
  it("start, get y updateItem no contienen correct, correctAnswer, explanations ni solution", async () => {
    const { service } = harness();

    const started = await service.start(USER, CLF, { mode: "form-a", extraTime: false });
    const read = await service.get(USER, started.id);
    const updated = await service.updateItem(USER, started.id, 1, {
      answer: { optionId: "a" },
      flagged: true,
    });

    expect(forbiddenKeysIn(started)).toEqual([]);
    expect(forbiddenKeysIn(read)).toEqual([]);
    expect(forbiddenKeysIn(updated)).toEqual([]);
    expect(forbiddenKeysIn(JSON.parse(JSON.stringify(started)))).toEqual([]);
    expect(Object.keys(started.items[0] ?? {})).not.toContain("exerciseId");
    expect(Object.keys(started.items[0] ?? {})).not.toContain("slug");
  });
});

describe("ExamsService.updateItem", () => {
  it("guarda la respuesta y la marca, y answer null la borra", async () => {
    const { service } = harness();
    const { id } = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    const saved = await service.updateItem(USER, id, 2, { answer: { optionId: "b" } });
    const flagged = await service.updateItem(USER, id, 2, { flagged: true });

    expect(saved.item.answer).toEqual({ optionId: "b" });
    expect(flagged.item.answer).toEqual({ optionId: "b" });
    expect(flagged.item.flagged).toBe(true);
    expect((await service.get(USER, id)).answeredCount).toBe(1);

    const cleared = await service.updateItem(USER, id, 2, { answer: null });

    expect(cleared.item.answer).toBeNull();
    expect((await service.get(USER, id)).answeredCount).toBe(0);
  });

  it("responde 400 si la respuesta no corresponde a la pregunta o la posición no existe", async () => {
    const { service } = harness();
    const { id } = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    await expect(
      service.updateItem(USER, id, 1, { answer: { optionId: "d" } }),
    ).rejects.toMatchObject({ status: 400, message: "La opción no existe en este quiz" });
    await expect(
      service.updateItem(USER, id, 99, { answer: { optionId: "a" } }),
    ).rejects.toMatchObject({
      status: 400,
      message: "La pregunta 99 no existe en este simulacro",
    });
  });

  it("con el reloj pasado el plazo y la gracia da 409 y deja el intento expirado", async () => {
    const { service, repository, setNow } = harness();
    const mine = await service.start(USER, CLF, { mode: "form-a", extraTime: false });
    const theirs = await service.start(OTHER_USER, CLF, { mode: "form-a", extraTime: false });

    setNow(after(90, 6));

    await expect(
      service.updateItem(USER, mine.id, 1, { answer: { optionId: "a" } }),
    ).rejects.toThrow(
      new ConflictException("El tiempo terminó: tu simulacro se entregó automáticamente"),
    );

    const read = await service.get(USER, mine.id);

    expect(read.status).toBe("expired");
    expect(read.remainingSeconds).toBe(0);
    expect((await repository.findOwnedAttempt(OTHER_USER, theirs.id))?.status).toBe("in-progress");
  });

  it("acepta la respuesta dentro de los 5 segundos de gracia", async () => {
    const { service, setNow } = harness();
    const { id } = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    setNow(after(90, 4));

    const updated = await service.updateItem(USER, id, 1, { answer: { optionId: "a" } });

    expect(updated.remainingSeconds).toBe(0);
  });

  it("get cierra como expirado un intento vencido", async () => {
    const { service, setNow } = harness();
    const { id } = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    setNow(after(95));

    const read = await service.get(USER, id);

    expect(read.status).toBe("expired");
    expect(read.submittedAt).not.toBeNull();
  });

  it("no deja responder un simulacro ya entregado", async () => {
    const { service } = harness();
    const { id } = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    await service.submit(USER, id);

    await expect(
      service.updateItem(USER, id, 1, { answer: { optionId: "a" } }),
    ).rejects.toThrow(new ConflictException("El simulacro ya se entregó"));
  });
});

describe("ExamsService: aislamiento", () => {
  it("otro usuario recibe 404 en get, updateItem y submit", async () => {
    const { service } = harness();
    const { id } = await service.start(USER, CLF, { mode: "form-a", extraTime: false });
    const notFound = new NotFoundException("El simulacro no existe");

    await expect(service.get(OTHER_USER, id)).rejects.toThrow(notFound);
    await expect(
      service.updateItem(OTHER_USER, id, 1, { answer: { optionId: "a" } }),
    ).rejects.toThrow(notFound);
    await expect(service.submit(OTHER_USER, id)).rejects.toThrow(notFound);
    await expect(service.get(USER, "no-existe")).rejects.toThrow(notFound);
  });
});

describe("ExamsService.submit", () => {
  it("puntúa, programa el repaso solo de las falladas y rechaza una segunda entrega", async () => {
    const { service, schedule } = harness();
    const { id } = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    await service.updateItem(USER, id, 1, { answer: { optionId: "a" } });
    await service.updateItem(USER, id, 2, { answer: { optionId: "a" } });
    await service.updateItem(USER, id, 3, { answer: { optionId: "b" } });

    const result = await service.submit(USER, id);

    expect(result.status).toBe("submitted");
    expect(result.correctCount).toBe(2);
    expect(result.questionCount).toBe(65);
    expect(result.scorePct).toBe(Math.round((100 * 2) / 65));
    expect(result.items).toHaveLength(65);
    expect(result.items[0]).toMatchObject({
      position: 1,
      correct: true,
      correctAnswer: { optionId: "a" },
      unitCode: "U2",
    });
    expect(result.items[2]?.correct).toBe(false);
    expect(schedule).toHaveBeenCalledTimes(63);
    expect(schedule).toHaveBeenCalledWith({
      userId: USER,
      exerciseId: "ex-63",
      outcome: "FAILED",
      score: 0,
      hintsUsed: 0,
    });
    expect(schedule).not.toHaveBeenCalledWith(expect.objectContaining({ exerciseId: "ex-65" }));

    await expect(service.submit(USER, id)).rejects.toThrow(
      new ConflictException("El simulacro ya se entregó"),
    );
  });

  it("entrega como expirado si ya pasó el plazo", async () => {
    const { service, setNow } = harness();
    const { id } = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    setNow(after(100));

    const result = await service.submit(USER, id);

    expect(result.status).toBe("expired");
    expect(result.correctCount).toBe(0);
  });
});
