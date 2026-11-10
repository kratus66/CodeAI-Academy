import { CERTIFICATION_REGISTRY, type CertificationCode } from "@codeai/shared";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { ReviewService } from "../review/review.service";
import type { ReservedQuestionRow } from "./exams.repository";
import { ExamsService } from "./exams.service";
import { InMemoryExamsRepository } from "./in-memory-exams.repository";

const USER = "user-1";
const CLF: CertificationCode = "CLF-C02";
const STAGE_ID = CERTIFICATION_REGISTRY[CLF].stageId;
const START = new Date("2026-11-10T10:00:00.000Z");
const MINUTE_MS = 60_000;
const QUESTION_COUNT = CERTIFICATION_REGISTRY[CLF].questionCount;

function question(index: number): ReservedQuestionRow {
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
    reviewedByHuman: true,
    competencies: ["C1"],
  };
}

function harness() {
  const repository = new InMemoryExamsRepository();

  for (let index = 1; index <= QUESTION_COUNT; index += 1) {
    repository.seedQuestion(CLF, question(index));
  }

  repository.seedForm(
    CLF,
    "A",
    Array.from({ length: QUESTION_COUNT }, (_, index) => `q-${index + 1}`),
  );

  let current = START;
  const reviews = {
    scheduleFromSubmission: vi.fn(async () => true),
  } as unknown as ReviewService;
  const service = new ExamsService(repository, () => current, () => 0.5, reviews);

  return {
    service,
    repository,
    setNow: (date: Date) => {
      current = date;
    },
  };
}

describe("ExamsService.result", () => {
  it("responde 409 mientras el intento sigue en curso y no vencido", async () => {
    const { service } = harness();
    const attempt = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    await expect(service.result(USER, attempt.id)).rejects.toThrow(
      new ConflictException("El simulacro sigue en curso"),
    );
  });

  it("tras entregar devuelve explicaciones y unitCode de cada pregunta", async () => {
    const { service } = harness();
    const attempt = await service.start(USER, CLF, { mode: "form-a", extraTime: false });
    await service.updateItem(USER, attempt.id, 1, { answer: { optionId: "a" } });
    await service.submit(USER, attempt.id);

    const result = await service.result(USER, attempt.id);

    expect(result.status).toBe("submitted");
    expect(result.items).toHaveLength(QUESTION_COUNT);
    expect(result.items[0]?.correct).toBe(true);
    expect(result.items[0]?.explanations).toEqual({ a: "Porque sí", b: "Porque no" });
    expect(result.items[0]?.unitCode).toBe("U2");
    expect(result.items.every((item) => item.unitCode.length > 0)).toBe(true);
    expect(result.correctCount).toBe(1);
  });

  it("cierra como vencido un intento fuera de plazo y devuelve su resultado", async () => {
    const { service, setNow } = harness();
    const attempt = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    setNow(new Date(START.getTime() + 91 * MINUTE_MS));
    const result = await service.result(USER, attempt.id);

    expect(result.status).toBe("expired");
    expect((await service.get(USER, attempt.id)).status).toBe("expired");
  });
});

describe("ExamsService.history", () => {
  it("lista los intentos con su total de preguntas, el más reciente primero", async () => {
    const { service, setNow } = harness();
    const first = await service.start(USER, CLF, { mode: "form-a", extraTime: false });
    await service.submit(USER, first.id);
    setNow(new Date(START.getTime() + 5 * MINUTE_MS));
    const second = await service.start(USER, CLF, { mode: "form-a", extraTime: false });

    const history = await service.history(USER, CLF);

    expect(history.map((entry) => entry.attemptId)).toEqual([second.id, first.id]);
    expect(history[0]?.status).toBe("in-progress");
    expect(history[0]?.scorePct).toBeNull();
    expect(history[0]?.questionCount).toBe(QUESTION_COUNT);
    expect(history[1]?.status).toBe("submitted");
    expect(history[1]?.scorePct).toBe(0);
    expect(history[1]?.questionCount).toBe(QUESTION_COUNT);
  });
});

describe("ExamsService.readiness", () => {
  it("devuelve los cuatro criterios en orden y la evidencia como unavailable", async () => {
    const { service, repository } = harness();
    repository.seedReadinessFacts(USER, STAGE_ID, {
      unitsTotal: 3,
      pendingUnitCodes: ["U2"],
      overdueReviewCount: 2,
      projectAvailable: true,
      bestReviewedProjectScore: 90,
    });

    const readiness = await service.readiness(USER, CLF);

    expect(readiness.certification).toBe(CLF);
    expect(readiness.stageId).toBe(STAGE_ID);
    expect(readiness.evaluatedAt).toBe(START.toISOString());
    expect(readiness.criteria.map((criterion) => criterion.id)).toEqual([
      "mastery",
      "mock-exams",
      "review",
      "evidence",
    ]);
    expect(readiness.criteria.map((criterion) => criterion.status)).toEqual([
      "missing",
      "unavailable",
      "missing",
      "unavailable",
    ]);
    expect(readiness.ready).toBe(false);
    expect(readiness.lastRealResult).toBeNull();
  });

  it("nadie sale listo mientras la defensa técnica no exista", async () => {
    const { service, repository } = harness();
    repository.seedReadinessFacts(USER, STAGE_ID, {
      unitsTotal: 3,
      pendingUnitCodes: [],
      overdueReviewCount: 0,
      projectAvailable: true,
      bestReviewedProjectScore: 95,
    });

    const readiness = await service.readiness(USER, CLF);

    expect(readiness.criteria[0]?.status).toBe("met");
    expect(readiness.criteria[2]?.status).toBe("met");
    expect(readiness.criteria[3]?.status).toBe("unavailable");
    expect(readiness.ready).toBe(false);
  });
});

describe("ExamsService.registerRealResult", () => {
  it("guarda el resultado con readyAtRegistration y lo muestra en la preparación", async () => {
    const { service } = harness();

    const saved = await service.registerRealResult(USER, CLF, {
      passed: true,
      scaledScore: 820,
      takenOn: "2026-11-10",
    });

    expect(saved.passed).toBe(true);
    expect(saved.scaledScore).toBe(820);
    expect(saved.takenOn).toBe("2026-11-10");
    expect(saved.readyAtRegistration).toBe(false);

    const readiness = await service.readiness(USER, CLF);

    expect(readiness.lastRealResult?.id).toBe(saved.id);
  });

  it("guarda scaledScore nulo si no se envía y acepta fechas pasadas", async () => {
    const { service } = harness();

    const saved = await service.registerRealResult(USER, CLF, {
      passed: false,
      takenOn: "2026-10-01",
    });

    expect(saved.scaledScore).toBeNull();
    expect(saved.takenOn).toBe("2026-10-01");
  });

  it("rechaza una fecha futura comparando días de calendario", async () => {
    const { service } = harness();

    await expect(
      service.registerRealResult(USER, CLF, { passed: true, takenOn: "2026-11-11" }),
    ).rejects.toThrow(new BadRequestException("La fecha del examen no puede ser futura"));
  });
});
