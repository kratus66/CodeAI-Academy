import {
  DEFAULT_INTERVIEW_RUBRIC,
  INTERVIEW_MAX_TURNS,
  INTERVIEW_STALE_HOURS,
} from "@codeai/shared";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { InMemoryInterviewRepository } from "./in-memory-interview.repository";
import type { InterviewTurnPipelineInput } from "../ai/ai.service";
import type { InterviewAiPort } from "./interview-ai.port";
import type { InterviewDataset } from "./interview.repository";
import type {
  InterviewScenarioRecord,
  InterviewSessionRecord,
} from "./interview.repository";
import { InterviewsService } from "./interviews.service";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const MINUTE = 60_000;

const PHASES = [
  { phase: "warmup", maxTurns: 1, objective: "Conocer al candidato." },
  { phase: "conceptual", maxTurns: 2, objective: "Comprobar fundamentos." },
  { phase: "live-coding", maxTurns: 2, objective: "Resolver un caso." },
  { phase: "code-review", maxTurns: 1, objective: "Revisar un fragmento." },
  { phase: "follow-ups", maxTurns: 1, objective: "Repreguntar." },
  { phase: "candidate-questions", maxTurns: 1, objective: "Cerrar con preguntas." },
] as const;

const SCENARIO: InterviewScenarioRecord = {
  id: "scn_backend_junior",
  slug: "backend-junior",
  title: "Backend junior",
  role: "backend",
  level: "junior",
  language: "ts",
  competencies: ["C4", "C10"],
  phases: PHASES,
  rubric: DEFAULT_INTERVIEW_RUBRIC,
  referenceSolution: "export function solve(values) {\n  return values.filter(Boolean);\n}",
  estimatedMinutes: 45,
  isPublished: true,
  createdAt: NOW,
};

const FRONTEND: InterviewScenarioRecord = {
  ...SCENARIO,
  id: "scn_frontend_senior",
  slug: "frontend-senior",
  title: "Frontend senior",
  role: "frontend",
  level: "senior",
  language: "ts",
  isPublished: false,
};

function opening(at: Date): InterviewSessionRecord["transcript"] {
  return [
    {
      role: "interviewer",
      phase: "warmup",
      content: "Entrevista de práctica. Empecemos.",
      at: at.toISOString(),
    },
  ];
}

function sessionRecord(
  overrides: Partial<InterviewSessionRecord> = {},
): InterviewSessionRecord {
  return {
    id: "ses_1",
    userId: "ana",
    status: "COMPLETED",
    phase: "conceptual",
    turns: 2,
    transcript: opening(NOW),
    scores: null,
    selfScores: null,
    feedback: null,
    degraded: false,
    startedAt: NOW,
    lastTurnAt: NOW,
    finishedAt: new Date(NOW.getTime() + 30 * MINUTE),
    reviewedAt: null,
    scenario: SCENARIO,
    ...overrides,
  };
}

const SELF_REVIEW = {
  scores: {
    razonamiento: 4,
    correctitud: 4,
    comunicacion: 4,
    seguimiento: 3,
    limites: 3,
  },
  reflection: "a".repeat(200),
};

type Reply = Awaited<ReturnType<InterviewAiPort["interviewTurn"]>>;

function setup(
  options: {
    scenarios?: readonly InterviewScenarioRecord[];
    sessions?: readonly InterviewSessionRecord[];
    reply?: (phase: string) => Reply;
  } = {},
) {
  const dataset: InterviewDataset = {
    scenarios: options.scenarios ?? [SCENARIO, FRONTEND],
    sessions: options.sessions ?? [],
  };
  const repository = new InMemoryInterviewRepository(dataset);
  const ai = {
    interviewTurn: vi.fn(async (input: InterviewTurnPipelineInput) =>
      options.reply?.(input.phase) ?? {
        text: "¿Y si la lista llega vacía?",
        degraded: false,
        filtered: false,
        tokensUsed: 12,
        budgetRemainingUsd: 4.9,
      },
    ),
  };
  const service = new InterviewsService(repository, ai, () => NOW);

  return { service, repository, ai };
}

describe("InterviewsService · catálogo", () => {
  it("sólo publica escenarios publicados y cuenta los intentos propios", async () => {
    const { service } = setup({
      sessions: [
        sessionRecord({ id: "ses_a", status: "REVIEWED" }),
        sessionRecord({ id: "ses_b", userId: "bea", status: "REVIEWED" }),
      ],
    });

    const result = await service.listScenarios("ana", {
      page: 1,
      pageSize: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      slug: "backend-junior",
      phaseCount: 6,
      attempts: 1,
    });
    expect(result.meta.total).toBe(1);
  });

  it("filtra por rol, nivel y lenguaje con paginación", async () => {
    const { service } = setup({
      scenarios: [
        SCENARIO,
        {
          ...SCENARIO,
          id: "scn_data",
          slug: "data-senior",
          role: "data",
          level: "senior",
          language: "py",
        },
      ],
    });

    const backend = await service.listScenarios("ana", {
      role: "backend",
      level: "junior",
      language: "ts",
      page: 1,
      pageSize: 1,
    });
    const data = await service.listScenarios("ana", {
      role: "data",
      page: 1,
      pageSize: 10,
    });

    expect(backend.data.map((item) => item.slug)).toEqual(["backend-junior"]);
    expect(backend.meta.totalPages).toBe(1);
    expect(data.data.map((item) => item.slug)).toEqual(["data-senior"]);
  });

  it("el detalle incluye fases y rúbrica pero nunca la solución de referencia", async () => {
    const { service } = setup();
    const detail = await service.getScenario("ana", "backend-junior");
    const serialized = JSON.stringify(detail);

    expect(detail.phases).toHaveLength(6);
    expect(detail.rubric).toEqual(DEFAULT_INTERVIEW_RUBRIC);
    expect(serialized).not.toContain("values.filter");
    expect(serialized).not.toContain("referenceSolution");
  });

  it("responde 404 para un escenario inexistente o no publicado", async () => {
    const { service } = setup();

    await expect(
      service.getScenario("ana", "frontend-senior"),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getScenario("ana", "no-existe"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("InterviewsService · arranque", () => {
  it("crea la sesión IN_PROGRESS con el primer turno del entrevistador", async () => {
    const { service, ai } = setup();
    const session = await service.startSession("ana", {
      scenarioSlug: "backend-junior",
    });

    expect(session).toMatchObject({
      status: "IN_PROGRESS",
      phase: "warmup",
      turns: 0,
      score: null,
      degraded: false,
    });
    expect(session.transcript).toHaveLength(1);
    expect(session.transcript[0]?.content).toContain(PHASES[0].objective);
    expect(ai.interviewTurn).not.toHaveBeenCalled();
  });

  it("impide dos sesiones abiertas del mismo escenario y usuario", async () => {
    const { service } = setup();
    await service.startSession("ana", { scenarioSlug: "backend-junior" });

    await expect(
      service.startSession("ana", { scenarioSlug: "backend-junior" }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SESSION_IN_PROGRESS"),
    });
  });

  it("otro usuario puede abrir su propia sesión del mismo escenario", async () => {
    const { service } = setup();
    await service.startSession("ana", { scenarioSlug: "backend-junior" });
    const other = await service.startSession("bea", {
      scenarioSlug: "backend-junior",
    });

    expect(other.status).toBe("IN_PROGRESS");
  });

  it("una sesión inactiva 48 h se abandona y permite empezar de nuevo", async () => {
    const old = new Date(
      NOW.getTime() - (INTERVIEW_STALE_HOURS + 1) * 3_600_000,
    );
    const stale = sessionRecord({
      id: "ses_old",
      status: "IN_PROGRESS",
      phase: "warmup",
      turns: 0,
      transcript: opening(old),
      startedAt: old,
      lastTurnAt: null,
      finishedAt: null,
      userId: "ana",
    });
    const { service, repository } = setup({ sessions: [stale] });

    const created = await service.startSession("ana", {
      scenarioSlug: "backend-junior",
    });

    expect(created.status).toBe("IN_PROGRESS");
    expect((await repository.findSessionById("ses_old"))?.status).toBe(
      "ABANDONED",
    );
  });
});

describe("InterviewsService · turnos", () => {
  it("guarda el turno, avanza la fase por conteo y responde con el restante", async () => {
    const { service, ai, repository } = setup();
    const started = await service.startSession("ana", {
      scenarioSlug: "backend-junior",
    });

    const turn = await service.sendMessage("ana", started.id, {
      message: "Empezaría validando el array vacío.",
    });

    expect(turn).toEqual({
      reply: "¿Y si la lista llega vacía?",
      phase: "conceptual",
      turn: 1,
      turnsRemaining: INTERVIEW_MAX_TURNS - 1,
      degraded: false,
      budgetRemainingUsd: 4.9,
    });

    const input = ai.interviewTurn.mock.calls[0]?.[0];
    expect(input?.system).toContain("Fase actual: warmup");
    expect(input?.system).not.toContain("razonamiento");
    expect(input?.phase).toBe("conceptual");
    expect(input?.referenceSolution).toContain("values.filter");

    const stored = await repository.findSessionById(started.id);
    expect(stored?.turns).toBe(1);
    expect(stored?.phase).toBe("conceptual");
    expect(stored?.transcript).toHaveLength(3);
  });

  it("propaga la degradación de la IA a la respuesta y a la sesión", async () => {
    const { service } = setup({
      reply: () => ({
        text: "Réplica del guion.",
        degraded: true,
        filtered: true,
        tokensUsed: 0,
        budgetRemainingUsd: 4.5,
      }),
    });
    const started = await service.startSession("ana", {
      scenarioSlug: "backend-junior",
    });

    const turn = await service.sendMessage("ana", started.id, {
      message: "No estoy seguro.",
    });
    const detail = await service.getSession(
      { id: "ana", role: "STUDENT" },
      started.id,
    );

    expect(turn).toMatchObject({ degraded: true, reply: "Réplica del guion." });
    expect(detail.degraded).toBe(true);
  });

  it("el turno 41 devuelve 429 sin llamar al proveedor", async () => {
    const full = sessionRecord({
      id: "ses_full",
      status: "IN_PROGRESS",
      phase: "candidate-questions",
      turns: INTERVIEW_MAX_TURNS,
      lastTurnAt: NOW,
      finishedAt: null,
    });
    const { service, ai } = setup({ sessions: [full] });

    await expect(
      service.sendMessage("ana", "ses_full", { message: "Una última idea." }),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      service.sendMessage("ana", "ses_full", { message: "Una última idea." }),
    ).rejects.toMatchObject({ status: 429 });
    expect(ai.interviewTurn).not.toHaveBeenCalled();
  });

  it("una sesión cerrada no admite turnos", async () => {
    const { service } = setup({ sessions: [sessionRecord()] });

    await expect(
      service.sendMessage("ana", "ses_1", { message: "Hola." }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SESSION_CLOSED"),
    });
  });

  it("un turno sobre una sesión ajena responde 404", async () => {
    const { service, ai } = setup({
      sessions: [sessionRecord({ status: "IN_PROGRESS", userId: "bea" })],
    });

    await expect(
      service.sendMessage("ana", "ses_1", { message: "Hola." }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SESSION_NOT_FOUND"),
    });
    expect(ai.interviewTurn).not.toHaveBeenCalled();
  });

  it("un mensaje de 2 001 caracteres responde 400 sin gastar tokens", async () => {
    const { service, ai } = setup({
      sessions: [sessionRecord({ status: "IN_PROGRESS", turns: 0 })],
    });

    await expect(
      service.sendMessage("ana", "ses_1", { message: "a".repeat(2_001) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ai.interviewTurn).not.toHaveBeenCalled();
  });
});

describe("InterviewsService · cierre, detalle e historial", () => {
  it("el detalle de una sesión ajena es indistinguible de una inexistente", async () => {
    const { service } = setup({
      sessions: [sessionRecord({ userId: "bea" })],
    });

    const foreign = await service
      .getSession({ id: "ana", role: "STUDENT" }, "ses_1")
      .catch((error: unknown) => error);
    const missing = await service
      .getSession({ id: "ana", role: "STUDENT" }, "ses_no_existe")
      .catch((error: unknown) => error);

    expect(foreign).toBeInstanceOf(NotFoundException);
    expect((foreign as Error).message).toBe((missing as Error).message);
  });

  it("una transcripción corrupta responde 422 de dominio, no 500", async () => {
    const { service } = setup({
      sessions: [sessionRecord({ transcript: "no-es-una-lista" })],
    });

    await expect(
      service.getSession({ id: "ana", role: "STUDENT" }, "ses_1"),
    ).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("INVALID_TRANSCRIPT"),
    });
  });

  it("el dueño y un instructor leen la transcripción completa", async () => {
    const { service } = setup({ sessions: [sessionRecord()] });

    const owner = await service.getSession(
      { id: "ana", role: "STUDENT" },
      "ses_1",
    );
    const instructor = await service.getSession(
      { id: "profe", role: "INSTRUCTOR" },
      "ses_1",
    );

    expect(owner.transcript).toHaveLength(1);
    expect(instructor.transcript).toEqual(owner.transcript);
  });

  it("cerrar calcula la duración y es idempotente desde COMPLETED", async () => {
    const inProgress = sessionRecord({
      status: "IN_PROGRESS",
      startedAt: new Date(NOW.getTime() - 32 * MINUTE),
      lastTurnAt: new Date(NOW.getTime() - 5 * MINUTE),
      finishedAt: null,
    });
    const { service } = setup({ sessions: [inProgress] });

    const first = await service.finishSession("ana", "ses_1");
    const second = await service.finishSession("ana", "ses_1");

    expect(first).toMatchObject({
      status: "COMPLETED",
      durationMinutes: 32,
    });
    expect(second.finishedAt).toBe(first.finishedAt);
  });

  it("una sesión revisada o abandonada no se cierra", async () => {
    const reviewed = sessionRecord({ id: "ses_rev", status: "REVIEWED" });
    const abandoned = sessionRecord({ id: "ses_abs", status: "ABANDONED" });
    const { service } = setup({ sessions: [reviewed, abandoned] });

    await expect(
      service.finishSession("ana", "ses_rev"),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SESSION_ALREADY_REVIEWED"),
    });
    await expect(
      service.finishSession("ana", "ses_abs"),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SESSION_CLOSED"),
    });
  });

  it("el historial sólo incluye sesiones propias, ordenadas y con mejor nota y promedio", async () => {
    const old = sessionRecord({
      id: "ses_old",
      status: "REVIEWED",
      startedAt: new Date(NOW.getTime() - 2 * 3_600_000),
      scores: { rubric: DEFAULT_INTERVIEW_RUBRIC, levels: SELF_REVIEW.scores, score: 80 },
    });
    const recent = sessionRecord({
      id: "ses_new",
      status: "REVIEWED",
      startedAt: new Date(NOW.getTime() - 3_600_000),
      scores: { rubric: DEFAULT_INTERVIEW_RUBRIC, levels: SELF_REVIEW.scores, score: 90 },
    });
    const open = sessionRecord({
      id: "ses_open",
      status: "IN_PROGRESS",
      startedAt: new Date(NOW.getTime() - 30 * MINUTE),
      lastTurnAt: NOW,
      finishedAt: null,
    });
    const foreign = sessionRecord({ id: "ses_bea", userId: "bea", status: "REVIEWED" });
    const { service } = setup({
      sessions: [old, recent, open, foreign],
    });

    const history = await service.getHistory("ana");

    expect(history.items.map((item) => item.id)).toEqual([
      "ses_open",
      "ses_new",
      "ses_old",
    ]);
    expect(history.best).toEqual({ score: 90, sessionId: "ses_new" });
    expect(history.average).toBe(85);
  });
});

describe("InterviewsService · autoevaluación", () => {
  it("exige que la sesión esté cerrada", async () => {
    const { service } = setup({
      sessions: [sessionRecord({ status: "IN_PROGRESS", finishedAt: null })],
    });

    await expect(
      service.selfReview("ana", "ses_1", SELF_REVIEW),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SESSION_CLOSED"),
    });
  });

  it("exige una reflexión de 200 caracteres", async () => {
    const { service } = setup({ sessions: [sessionRecord()] });

    await expect(
      service.selfReview("ana", "ses_1", {
        ...SELF_REVIEW,
        reflection: "a".repeat(199),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("guarda niveles, nota autoevaluada y reflexión", async () => {
    const { service } = setup({ sessions: [sessionRecord()] });

    const reviewed = await service.selfReview("ana", "ses_1", SELF_REVIEW);

    expect(reviewed.selfScore).toBe(93.75);
    expect(reviewed.selfScores).toMatchObject({
      scores: SELF_REVIEW.scores,
      score: 93.75,
      reflection: SELF_REVIEW.reflection,
    });
    expect(reviewed.status).toBe("COMPLETED");
  });
});

describe("InterviewsService · revisión", () => {
  const READY = sessionRecord({
    selfScores: {
      scores: SELF_REVIEW.scores,
      score: 93.75,
      reflection: SELF_REVIEW.reflection,
    },
  });

  it("sólo INSTRUCTOR o ADMIN pueden revisar", async () => {
    const { service } = setup({ sessions: [READY] });

    await expect(
      service.review({ id: "ana", role: "STUDENT" }, "ses_1", {
        scores: SELF_REVIEW.scores,
        feedback: "Buen trabajo.",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("exige la autoevaluación antes de puntuar", async () => {
    const { service } = setup({ sessions: [sessionRecord()] });

    await expect(
      service.review({ id: "profe", role: "INSTRUCTOR" }, "ses_1", {
        scores: SELF_REVIEW.scores,
        feedback: "Buen trabajo.",
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SELF_REVIEW_REQUIRED"),
    });
  });

  it("una nota de 85 cierra la sesión y deja evidencia de C10", async () => {
    const { service, repository } = setup({ sessions: [READY] });

    const reviewed = await service.review(
      { id: "profe", role: "INSTRUCTOR" },
      "ses_1",
      {
        scores: {
          razonamiento: 4,
          correctitud: 4,
          comunicacion: 3,
          seguimiento: 2,
          limites: 3,
        },
        feedback: "Razonamiento sólido; cuida el seguimiento.",
      },
    );

    expect(reviewed).toMatchObject({
      status: "REVIEWED",
      score: 85,
      feedback: "Razonamiento sólido; cuida el seguimiento.",
    });
    expect(reviewed.scores?.rubric).toEqual(DEFAULT_INTERVIEW_RUBRIC);
    expect(repository.getEvidence("ana", "C10")).toMatchObject({
      level: 3,
      evidenceCount: 1,
    });
  });

  it("una segunda revisión devuelve 409 SESSION_ALREADY_REVIEWED", async () => {
    const { service } = setup({ sessions: [READY] });
    const input = {
      scores: SELF_REVIEW.scores,
      feedback: "Buen trabajo.",
    };

    await service.review({ id: "profe", role: "INSTRUCTOR" }, "ses_1", input);

    await expect(
      service.review({ id: "profe", role: "INSTRUCTOR" }, "ses_1", input),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SESSION_ALREADY_REVIEWED"),
    });
  });

  it("una nota de 76.25 no deja evidencia", async () => {
    const { service, repository } = setup({ sessions: [READY] });

    const reviewed = await service.review(
      { id: "profe", role: "ADMIN" },
      "ses_1",
      {
        scores: {
          razonamiento: 4,
          correctitud: 3,
          comunicacion: 3,
          seguimiento: 2,
          limites: 2,
        },
        feedback: "Falta profundidad en los límites.",
      },
    );

    expect(reviewed.score).toBe(76.25);
    expect(repository.getEvidence("ana", "C10")).toBeNull();
  });

  it("invalidar cierra la sesión con nota 0 y sin evidencia", async () => {
    const { service, repository } = setup({ sessions: [READY] });

    const reviewed = await service.review(
      { id: "profe", role: "INSTRUCTOR" },
      "ses_1",
      { scores: SELF_REVIEW.scores, invalidate: true },
    );

    expect(reviewed).toMatchObject({
      status: "REVIEWED",
      score: 0,
      feedback: "Sesión invalidada por el instructor.",
    });
    expect(repository.getEvidence("ana", "C10")).toBeNull();
  });

  it("correctitud 0 responde 422 y no guarda la revisión", async () => {
    const { service } = setup({ sessions: [READY] });

    await expect(
      service.review({ id: "profe", role: "INSTRUCTOR" }, "ses_1", {
        scores: { ...SELF_REVIEW.scores, correctitud: 0 },
        feedback: "No cumple.",
      }),
    ).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("CORRECTITUD_ZERO"),
    });
  });

  it("no se revisa una sesión que sigue abierta", async () => {
    const { service } = setup({
      sessions: [
        sessionRecord({
          status: "IN_PROGRESS",
          finishedAt: null,
          selfScores: {
            scores: SELF_REVIEW.scores,
            score: 93.75,
            reflection: SELF_REVIEW.reflection,
          },
        }),
      ],
    });

    await expect(
      service.review({ id: "profe", role: "INSTRUCTOR" }, "ses_1", {
        scores: SELF_REVIEW.scores,
        feedback: "Buen trabajo.",
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("SESSION_CLOSED"),
    });
  });
});