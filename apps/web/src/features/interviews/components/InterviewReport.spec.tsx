import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  InterviewHistoryResponse,
  InterviewSession,
} from "@codeai/shared";

import { InterviewReport } from "./InterviewReport";

const SELF_SCORES = {
  razonamiento: 4,
  correctitud: 4,
  comunicacion: 4,
  seguimiento: 3,
  limites: 3,
};

const REFLECTION = "a".repeat(200);

function session(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: "ses_1",
    scenarioSlug: "backend-junior",
    scenarioTitle: "Backend junior: API de tareas",
    status: "COMPLETED",
    phase: "candidate-questions",
    turns: 3,
    startedAt: "2026-10-28T12:00:00.000Z",
    finishedAt: "2026-10-28T12:18:00.000Z",
    durationMinutes: 18,
    score: null,
    selfScore: 93.75,
    transcript: [
      {
        role: "interviewer",
        phase: "warmup",
        content: "Cuéntame un problema técnico.",
        at: "2026-10-28T12:00:00.000Z",
      },
      {
        role: "candidate",
        phase: "conceptual",
        content: "Validaría el caso vacío.",
        at: "2026-10-28T12:05:00.000Z",
      },
    ],
    selfScores: { scores: SELF_SCORES, score: 93.75, reflection: REFLECTION },
    scores: null,
    feedback: null,
    degraded: false,
    ...overrides,
  };
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    id: "ses_1",
    scenarioSlug: "backend-junior",
    scenarioTitle: "Backend junior: API de tareas",
    status: "COMPLETED",
    phase: "candidate-questions",
    turns: 3,
    startedAt: "2026-10-28T12:00:00.000Z",
    finishedAt: "2026-10-28T12:18:00.000Z",
    durationMinutes: 18,
    score: 85,
    selfScore: 93.75,
    ...overrides,
  };
}

function history(
  items: readonly unknown[],
  overrides: Partial<InterviewHistoryResponse> = {},
): InterviewHistoryResponse {
  return {
    items: items as unknown as InterviewHistoryResponse["items"],
    best: { score: 85, sessionId: "ses_1" },
    average: 77.5,
    ...overrides,
  };
}

describe("InterviewReport", () => {
  it("muestra transcripción, autoevaluación frente a nota y comparación", async () => {
    render(
      <InterviewReport
        sessionId="ses_1"
        loadSession={vi.fn(async () => session())}
        loadHistory={vi.fn(async () =>
          history([
            summary({ id: "ses_0", score: 70, startedAt: "2026-10-20T10:00:00.000Z" }),
            summary(),
          ]),
        )}
      />,
    );

    expect(
      await screen.findByText("Cuéntame un problema técnico."),
    ).toBeInTheDocument();
    expect(screen.getByText("Validaría el caso vacío.")).toBeInTheDocument();
    expect(screen.getByText("93.75")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText(/Intento 1/)).toBeInTheDocument();
    expect(screen.getByText(/Intento 2/)).toBeInTheDocument();
    expect(screen.getByText(/Mejor nota: 85/)).toBeInTheDocument();
    expect(screen.getByText(/Promedio: 77.5/)).toBeInTheDocument();
  });

  it("guarda la autoevaluación con los cinco criterios y la reflexión", async () => {
    const submitSelfReview = vi.fn(async () =>
      session({ selfScore: 93.75 }),
    );

    render(
      <InterviewReport
        sessionId="ses_1"
        loadSession={vi.fn(async () => session({ selfScores: null, selfScore: null }))}
        loadHistory={vi.fn(async () => history([summary()]))}
        submitSelfReview={submitSelfReview}
      />,
    );

    fireEvent.change(await screen.findByLabelText("Reflexión"), {
      target: { value: REFLECTION },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar autoevaluación" }),
    );

    expect(submitSelfReview).toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Guardar autoevaluación" }),
      ).toBeNull();
    });
    expect(screen.getByText("Tu reflexión").parentElement).toHaveTextContent(
      REFLECTION,
    );
    expect(submitSelfReview).toHaveBeenCalledWith("ses_1", {
      scores: {
        razonamiento: 2,
        correctitud: 2,
        comunicacion: 2,
        seguimiento: 2,
        limites: 2,
      },
      reflection: REFLECTION,
    });
  });

  it("el instructor revisa con retroalimentación y ve la nota emitida", async () => {
    const submitReview = vi.fn(async () =>
      session({
        status: "REVIEWED" as const,
        score: 85,
        feedback: "Buen razonamiento y comunicación clara.",
        scores: { rubric: { razonamiento: 30, correctitud: 25, comunicacion: 20, seguimiento: 15, limites: 10 }, levels: SELF_SCORES, score: 85 },
      }),
    );

    render(
      <InterviewReport
        sessionId="ses_1"
        instructor
        loadSession={vi.fn(async () => session())}
        loadHistory={vi.fn(async () => history([summary()]))}
        submitReview={submitReview}
      />,
    );

    fireEvent.change(await screen.findByLabelText("Retroalimentación"), {
      target: { value: "Buen razonamiento y comunicación clara." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Retroalimentación")).toBeNull();
    });
    expect(
      screen.getByText("Buen razonamiento y comunicación clara."),
    ).toBeInTheDocument();
    expect(submitReview).toHaveBeenCalledWith("ses_1", {
      scores: {
        razonamiento: 2,
        correctitud: 2,
        comunicacion: 2,
        seguimiento: 2,
        limites: 2,
      },
      feedback: "Buen razonamiento y comunicación clara.",
    });
    expect(screen.queryByLabelText("Retroalimentación")).toBeNull();
  });

  it("el instructor no puede revisar antes de la autoevaluación", async () => {
    render(
      <InterviewReport
        sessionId="ses_1"
        instructor
        loadSession={vi.fn(async () =>
          session({ selfScores: null, selfScore: null }),
        )}
        loadHistory={vi.fn(async () => history([summary({ score: null })]))}
      />,
    );

    expect(
      await screen.findByText(/aún no ha completado su autoevaluación/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar revisión" })).toBeNull();
  });

  it("una sesión revisada muestra la nota y no vuelve a ofrecer el formulario", async () => {
    render(
      <InterviewReport
        sessionId="ses_1"
        instructor
        loadSession={vi.fn(async () =>
          session({
            status: "REVIEWED" as const,
            score: 85,
            feedback: "Buen cierre.",
          }),
        )}
        loadHistory={vi.fn(async () => history([summary()]))}
      />,
    );

    expect(await screen.findByText("Buen cierre.")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar revisión" })).toBeNull();
  });
});