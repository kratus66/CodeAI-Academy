import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import type {
  InterviewHistoryResponse,
  InterviewScenario,
  InterviewSession,
} from "@codeai/shared";

import { InterviewRoom } from "./InterviewRoom";

const PHASES = [
  { phase: "warmup", maxTurns: 2, objective: "Conocer al candidato." },
  { phase: "conceptual", maxTurns: 4, objective: "Comprobar fundamentos." },
  { phase: "live-coding", maxTurns: 5, objective: "Resolver un caso." },
  { phase: "code-review", maxTurns: 3, objective: "Revisar un fragmento." },
  { phase: "follow-ups", maxTurns: 3, objective: "Repreguntar." },
  { phase: "candidate-questions", maxTurns: 2, objective: "Cerrar." },
] as const;

const SCENARIO: InterviewScenario = {
  slug: "backend-junior",
  title: "Backend junior: API de tareas",
  role: "backend",
  level: "junior",
  language: "ts",
  competencies: ["C4", "C10"],
  phaseCount: 6,
  estimatedMinutes: 45,
  attempts: 0,
  phases: [...PHASES],
  rubric: {
    razonamiento: 30,
    correctitud: 25,
    comunicacion: 20,
    seguimiento: 15,
    limites: 10,
  },
};

function session(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: "ses_1",
    scenarioSlug: "backend-junior",
    scenarioTitle: "Backend junior: API de tareas",
    status: "IN_PROGRESS",
    phase: "warmup",
    turns: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMinutes: null,
    score: null,
    selfScore: null,
    transcript: [
      {
        role: "interviewer",
        phase: "warmup",
        content: "Cuéntame un problema técnico.",
        at: new Date().toISOString(),
      },
    ],
    selfScores: null,
    scores: null,
    feedback: null,
    degraded: false,
    ...overrides,
  };
}

describe("InterviewRoom", () => {
  it("inicia la sesión y muestra fase, turnos restantes y cronómetro", async () => {
    const loadScenario = vi.fn(async () => SCENARIO);
    const startSession = vi.fn(async () => session());

    render(
      <InterviewRoom
        scenarioSlug="backend-junior"
        loadScenario={loadScenario}
        startSession={startSession}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Backend junior: API de tareas",
      }),
    ).toBeInTheDocument();
    expect(startSession).toHaveBeenCalledWith({
      scenarioSlug: "backend-junior",
    });
    expect(screen.getByText("1 de 6 · Presentación")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/^\d{2}:\d{2}$/);
    expect(
      await screen.findByText("Cuéntame un problema técnico."),
    ).toBeInTheDocument();
  });

  it("retoma una entrevista abierta cuando el arranque devuelve 409", async () => {
    const loadScenario = vi.fn(async () => SCENARIO);
    const startSession = vi.fn(async () => {
      throw new ApiError({
        status: 409,
        code: "CONFLICT",
        message: "SESSION_IN_PROGRESS",
      });
    });
    const loadHistory = vi.fn(
      async (): Promise<InterviewHistoryResponse> => ({
        items: [
          {
            id: "ses_1",
            scenarioSlug: "backend-junior",
            scenarioTitle: "Backend junior: API de tareas",
            status: "IN_PROGRESS",
            phase: "warmup",
            turns: 1,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            durationMinutes: null,
            score: null,
            selfScore: null,
          },
        ],
        best: null,
        average: 0,
      }),
    );
    const loadSession = vi.fn(async () => session({ turns: 1 }));

    render(
      <InterviewRoom
        scenarioSlug="backend-junior"
        loadScenario={loadScenario}
        startSession={startSession}
        loadHistory={loadHistory}
        loadSession={loadSession}
      />,
    );

    await waitFor(() => {
      expect(loadSession).toHaveBeenCalledWith("ses_1");
    });
    expect(await screen.findByText("39")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("envía una respuesta y actualiza fase, turno y conversación", async () => {
    const sendMessage = vi.fn(async () => ({
      reply: "¿Y si la lista llega vacía?",
      phase: "conceptual" as const,
      turn: 1,
      turnsRemaining: 39,
      degraded: false,
      budgetRemainingUsd: 4.9,
    }));

    render(
      <InterviewRoom
        scenarioSlug="backend-junior"
        loadScenario={vi.fn(async () => SCENARIO)}
        startSession={vi.fn(async () => session())}
        sendMessage={sendMessage}
      />,
    );

    fireEvent.change(await screen.findByLabelText("Tu respuesta"), {
      target: { value: "Validaría el caso vacío." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));

    expect(
      await screen.findByText("¿Y si la lista llega vacía?"),
    ).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith("ses_1", {
      message: "Validaría el caso vacío.",
    });
    expect(screen.getByText("2 de 6 · Conceptos")).toBeInTheDocument();
    expect(screen.getByText("39")).toBeInTheDocument();
    expect(screen.getByText("Validaría el caso vacío.")).toBeInTheDocument();
  });

  it("avisa cuando la réplica viene del guion estático", async () => {
    const sendMessage = vi.fn(async () => ({
      reply: "Réplica del guion.",
      phase: "conceptual" as const,
      turn: 1,
      turnsRemaining: 39,
      degraded: true,
      budgetRemainingUsd: 0,
    }));

    render(
      <InterviewRoom
        scenarioSlug="backend-junior"
        loadScenario={vi.fn(async () => SCENARIO)}
        startSession={vi.fn(async () => session())}
        sendMessage={sendMessage}
      />,
    );

    fireEvent.change(await screen.findByLabelText("Tu respuesta"), {
      target: { value: "No estoy seguro." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));

    expect(await screen.findByText(/Modo degradado/)).toBeInTheDocument();
  });

  it("cierre con confirmación y enlace al informe", async () => {
    const finishSession = vi.fn(async () =>
      session({
        status: "COMPLETED" as const,
        finishedAt: new Date().toISOString(),
        durationMinutes: 18,
      }),
    );

    render(
      <InterviewRoom
        scenarioSlug="backend-junior"
        loadScenario={vi.fn(async () => SCENARIO)}
        startSession={vi.fn(async () => session())}
        finishSession={finishSession}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Cerrar entrevista" }),
    );

    expect(screen.getByText("¿Cerrar la entrevista?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Cerrar la entrevista?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar entrevista" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar" }));

    expect(await screen.findByText("Entrevista cerrada.")).toBeInTheDocument();
    expect(finishSession).toHaveBeenCalledWith("ses_1");
    expect(screen.getByRole("link", { name: "Ver informe" })).toHaveAttribute(
      "href",
      "/learn/interviews/sessions/ses_1",
    );
    expect(screen.queryByLabelText("Tu respuesta")).toBeNull();
  });
});
