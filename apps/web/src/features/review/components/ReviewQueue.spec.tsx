import type { ReviewAnswerResult, ReviewQueueItem, ReviewQueueResponse } from "@codeai/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { ReviewQueue } from "./ReviewQueue";

const ITEM_A: ReviewQueueItem = {
  id: "item_a",
  exerciseId: "ex_a",
  exerciseTitle: "Suma segura",
  exerciseSlug: "suma-segura-001",
  concept: "funciones",
  competencies: ["C1"],
  dueAt: "2026-10-27T08:00:00.000Z",
  intervalDays: 1,
  repetitions: 1,
  easeFactor: 2.6,
  priority: 0,
};

const ITEM_B: ReviewQueueItem = {
  ...ITEM_A,
  id: "item_b",
  exerciseId: "ex_b",
  exerciseTitle: "Promesas en orden",
  exerciseSlug: "promesas-en-orden",
  concept: "promesas",
  competencies: ["C2"],
};

const QUEUE: ReviewQueueResponse = {
  items: [ITEM_A, ITEM_B],
  dueReviews: 2,
  limit: 30,
};

const ANSWERED: ReviewAnswerResult = {
  nextDueAt: "2026-11-02T09:00:00.000Z",
  intervalDays: 6,
  easeFactor: 2.6,
  repetitions: 2,
};

describe("ReviewQueue", () => {
  it("avisa mientras carga la cola", () => {
    const loadQueue = vi.fn(() => new Promise<ReviewQueueResponse>(() => {}));

    render(<ReviewQueue loadQueue={loadQueue} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando tu cola de repaso…",
    );
  });

  it("lista los ítems con su concepto, competencias y vencimiento", async () => {
    const loadQueue = vi.fn(async () => QUEUE);

    render(<ReviewQueue loadQueue={loadQueue} />);

    expect(
      await screen.findByRole("heading", { name: "Cola de repaso" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 repasos pendientes · máx. 30")).toBeInTheDocument();
    expect(screen.getByText("Suma segura")).toBeInTheDocument();
    expect(screen.getByText("Concepto: funciones · C1")).toBeInTheDocument();
    expect(screen.getByText("Promesas en orden")).toBeInTheDocument();

    const times = document.querySelectorAll("time");

    expect(times[0]).toHaveAttribute("datetime", ITEM_A.dueAt);
    expect(loadQueue).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("explica el estado vacío sin inventar repasos", async () => {
    const loadQueue = vi.fn(async () => ({
      items: [],
      dueReviews: 0,
      limit: 30,
    }));

    render(<ReviewQueue loadQueue={loadQueue} />);

    expect(
      await screen.findByText(/No tienes repasos pendientes hoy/),
    ).toBeInTheDocument();
    expect(screen.getByText("0 repasos pendientes · máx. 30")).toBeInTheDocument();
  });

  it("registra la calidad, anuncia el intervalo y retira el ítem", async () => {
    const loadQueue = vi.fn(async () => QUEUE);
    const answerItem = vi.fn(async () => ANSWERED);

    render(<ReviewQueue loadQueue={loadQueue} answerItem={answerItem} />);

    await screen.findByText("Suma segura");
    const group = screen.getByRole("group", {
      name: "Calidad de la recuperación de Suma segura",
    });
    fireEvent.click(
      within(group).getByRole("button", { name: "Calidad 4: Con duda menor" }),
    );

    expect(await screen.findByText("«Suma segura» vuelve en 6 días.")).toBeInTheDocument();
    expect(answerItem).toHaveBeenCalledWith("item_a", { quality: 4 });
    expect(screen.queryByText("Suma segura")).not.toBeInTheDocument();
    expect(screen.getByText("Promesas en orden")).toBeInTheDocument();
  });

  it("mantiene el ítem y explica el fallo si no se puede responder", async () => {
    const loadQueue = vi.fn(async () => QUEUE);
    const answerItem = vi.fn(async (): Promise<ReviewAnswerResult> => {
      throw new ApiError({
        status: 404,
        code: "NOT_FOUND",
        message: "El ítem de repaso no existe o no te pertenece",
      });
    });

    render(<ReviewQueue loadQueue={loadQueue} answerItem={answerItem} />);

    await screen.findByText("Suma segura");
    const group = screen.getByRole("group", {
      name: "Calidad de la recuperación de Suma segura",
    });
    fireEvent.click(
      within(group).getByRole("button", { name: "Calidad 2: Con pistas" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El ítem de repaso no existe o no te pertenece",
    );
    expect(screen.getByText("Suma segura")).toBeInTheDocument();
  });

  it("ofrece reintentar cuando falla la carga", async () => {
    const loadQueue = vi
      .fn<() => Promise<ReviewQueueResponse>>()
      .mockRejectedValueOnce(
        new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Error interno.",
        }),
      )
      .mockResolvedValueOnce(QUEUE);

    render(<ReviewQueue loadQueue={loadQueue} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar tu cola de repaso.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(loadQueue).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Suma segura")).toBeInTheDocument();
  });

  it("pide volver a iniciar sesión, sin reintento, ante un 401", async () => {
    const loadQueue = vi.fn(async (): Promise<ReviewQueueResponse> => {
      throw new ApiError({
        status: 401,
        code: "UNAUTHENTICATED",
        message: "Sesión caducada.",
      });
    });

    render(<ReviewQueue loadQueue={loadQueue} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /vuelve a iniciar sesión/,
    );
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });
});
