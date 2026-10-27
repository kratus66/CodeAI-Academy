import type { SubmissionSummary } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { AttemptHistory } from "./AttemptHistory";

const NEWEST: SubmissionSummary = {
  id: "sub_2",
  outcome: "PASSED",
  score: 100,
  achievedLevel: 3,
  hintsUsed: 1,
  results: [],
  feedback: "Todas las pruebas visibles superadas.",
  createdAt: "2026-10-27T15:00:00.000Z",
};

const OLDEST: SubmissionSummary = {
  id: "sub_1",
  outcome: "PARTIAL",
  score: 50,
  achievedLevel: null,
  hintsUsed: 0,
  results: [],
  feedback: "1 de 2 pruebas visibles superadas.",
  createdAt: "2026-10-27T14:30:00.000Z",
};

describe("AttemptHistory", () => {
  it("avisa mientras carga", () => {
    const loadHistory = vi.fn(() => new Promise<SubmissionSummary[]>(() => {}));

    render(<AttemptHistory exerciseId="ex_1" loadHistory={loadHistory} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando tu historial…",
    );
  });

  it("explica el estado vacío", async () => {
    const loadHistory = vi.fn(async () => []);

    render(<AttemptHistory exerciseId="ex_1" loadHistory={loadHistory} />);

    expect(
      await screen.findByText("Todavía no has enviado este ejercicio."),
    ).toBeInTheDocument();
    expect(loadHistory).toHaveBeenCalledWith("ex_1", expect.any(AbortSignal));
  });

  it("ofrece reintentar cuando falla la carga", async () => {
    const loadHistory = vi
      .fn<() => Promise<SubmissionSummary[]>>()
      .mockRejectedValueOnce(
        new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Error interno.",
        }),
      )
      .mockResolvedValueOnce([]);

    render(<AttemptHistory exerciseId="ex_1" loadHistory={loadHistory} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar tu historial.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(loadHistory).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("Todavía no has enviado este ejercicio."),
    ).toBeInTheDocument();
  });

  it("pide volver a iniciar sesión, sin reintento, ante un 401", async () => {
    const loadHistory = vi.fn(async (): Promise<SubmissionSummary[]> => {
      throw new ApiError({
        status: 401,
        code: "UNAUTHENTICATED",
        message: "Sesión caducada.",
      });
    });

    render(<AttemptHistory exerciseId="ex_1" loadHistory={loadHistory} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /vuelve a iniciar sesión/,
    );
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("lista los intentos del más reciente al más antiguo", async () => {
    const loadHistory = vi.fn(async () => [NEWEST, OLDEST]);

    render(<AttemptHistory exerciseId="ex_1" loadHistory={loadHistory} />);

    expect(
      await screen.findByRole("heading", { name: "Historial de intentos" }),
    ).toBeInTheDocument();

    const items = screen.getAllByRole("listitem");

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Intento 2");
    expect(items[0]).toHaveTextContent("Superado · 100/100");
    expect(items[0]).toHaveTextContent("Nivel 3");
    expect(items[0]).toHaveTextContent("1 pista");
    expect(items[0]).toHaveTextContent(NEWEST.feedback);
    expect(items[1]).toHaveTextContent("Intento 1");
    expect(items[1]).toHaveTextContent("Parcial · 50/100");
    expect(items[1]).toHaveTextContent("sin nivel");
    expect(items[1]).toHaveTextContent("0 pistas");
    expect(items[1]).toHaveTextContent(OLDEST.feedback);

    const times = document.querySelectorAll("time");

    expect(times[0]).toHaveAttribute("datetime", NEWEST.createdAt);
    expect(times[1]).toHaveAttribute("datetime", OLDEST.createdAt);
  });

  it("vuelve a pedir el historial sólo cuando cambia el refreshToken", async () => {
    const loadHistory = vi.fn(async () => [OLDEST]);
    const { rerender } = render(
      <AttemptHistory
        exerciseId="ex_1"
        loadHistory={loadHistory}
        refreshToken={0}
      />,
    );

    await screen.findByText("Intento 1");
    expect(loadHistory).toHaveBeenCalledTimes(1);

    rerender(
      <AttemptHistory
        exerciseId="ex_1"
        loadHistory={loadHistory}
        refreshToken={0}
      />,
    );
    expect(loadHistory).toHaveBeenCalledTimes(1);

    rerender(
      <AttemptHistory
        exerciseId="ex_1"
        loadHistory={loadHistory}
        refreshToken={1}
      />,
    );

    await waitFor(() => expect(loadHistory).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Intento 1")).toBeInTheDocument();
  });
});
