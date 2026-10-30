import type {
  ReviewQueueResponse,
  StageSummary,
  StudentSummary,
  UnitProgressSummary,
} from "@codeai/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_STORAGE_KEY } from "@/features/learning/lib/onboarding-preference";

import type { StudentDashboardData } from "./StudentDashboard";
import { StudentDashboard } from "./StudentDashboard";

function summary(overrides: Partial<StudentSummary> = {}): StudentSummary {
  return {
    range: "30d",
    overallPct: 0,
    activeDays: 0,
    lastActivityAt: null,
    units: { mastered: 0, inProgress: 0, needsReview: 0, locked: 0, total: 4 },
    submissions: { total: 0, passed: 0, failed: 0, avgScore: null },
    reviews: { due: 0, completed: 0, lapses: 0 },
    ai: { calls: 0, costUsd: 0, budgetLevel: "ok" },
    ...overrides,
  };
}

function unit(
  overrides: Partial<UnitProgressSummary> & Pick<UnitProgressSummary, "unitCode">,
): UnitProgressSummary {
  return {
    unitId: `unit-${overrides.unitCode}`,
    state: "AVAILABLE",
    progressPct: 0,
    lessonsDone: 0,
    exercisesDone: 0,
    bestScore: null,
    lastActivityAt: null,
    completedAt: null,
    ...overrides,
  };
}

function stage(
  overrides: Partial<StageSummary> & Pick<StageSummary, "id" | "order">,
): StageSummary {
  return {
    slug: `e${overrides.id}`,
    title: `Etapa ${overrides.order}`,
    objective: "Objetivo de la etapa.",
    level: 1,
    estimatedMin: 600,
    moduleCount: 2,
    ...overrides,
  };
}

function reviewQueue(dueReviews: number): ReviewQueueResponse {
  return { items: [], dueReviews, limit: 30 };
}

function data(overrides: Partial<StudentDashboardData> = {}): StudentDashboardData {
  return {
    summary: summary(),
    units: [],
    review: reviewQueue(0),
    stages: [stage({ id: 0, order: 1, title: "Fundamentos" })],
    ...overrides,
  };
}

beforeEach(() => {
  // La tarjeta de primer uso guarda su elección en `localStorage`: cada caso
  // arranca sin elección para que el panel se comporte como una visita nueva.
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StudentDashboard", () => {
  it("anuncia la carga del panel", () => {
    const loadDashboard = vi.fn(
      () => new Promise<StudentDashboardData>(() => undefined),
    );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu panel…");
  });

  it("retoma la unidad en curso con actividad más reciente", async () => {
    const loadDashboard = vi.fn(async () =>
      data({
        summary: summary({ overallPct: 20, activeDays: 2 }),
        units: [
          unit({
            unitCode: "1.1",
            state: "IN_PROGRESS",
            progressPct: 25,
            lastActivityAt: "2026-10-01T10:00:00.000Z",
          }),
          unit({
            unitCode: "1.2",
            state: "IN_PROGRESS",
            progressPct: 62.5,
            lastActivityAt: "2026-10-20T10:00:00.000Z",
          }),
          unit({
            unitCode: "1.3",
            state: "MASTERED",
            progressPct: 100,
            lastActivityAt: "2026-10-25T10:00:00.000Z",
          }),
        ],
      }),
    );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    const continuar = await screen.findByRole("link", { name: "Continuar" });

    expect(continuar).toHaveAttribute("href", "/learn/units/1.2");
    expect(continuar).toHaveAccessibleDescription(
      "Unidad 1.2 · 62,5 % completada.",
    );
  });

  it("manda al catálogo cuando ya hay progreso pero ninguna unidad en curso", async () => {
    const loadDashboard = vi.fn(async () =>
      data({
        summary: summary({ overallPct: 100, activeDays: 4 }),
        units: [
          unit({ unitCode: "1.1", state: "MASTERED", progressPct: 100 }),
          unit({ unitCode: "1.2", state: "MASTERED", progressPct: 100 }),
        ],
      }),
    );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    const continuar = await screen.findByRole("link", { name: "Continuar" });

    expect(continuar).toHaveAttribute("href", "/learn/stages");
    expect(continuar).toHaveAccessibleDescription(
      "No tienes unidades en curso: elige la siguiente etapa del catálogo.",
    );
  });

  it("empieza por la primera etapa cuando no hay progreso registrado", async () => {
    const loadDashboard = vi.fn(async () =>
      data({
        units: [
          unit({ unitCode: "1.1", state: "AVAILABLE" }),
          unit({ unitCode: "2.1", state: "LOCKED" }),
        ],
        stages: [
          stage({ id: 2, order: 3, title: "Agentes" }),
          stage({ id: 0, order: 1, title: "Fundamentos" }),
          stage({ id: 1, order: 2, title: "Programación" }),
        ],
      }),
    );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    const continuar = await screen.findByRole("link", { name: "Continuar" });

    expect(continuar).toHaveAttribute("href", "/learn/stages/0");
    expect(continuar).toHaveAccessibleDescription(
      "Empieza por la etapa 1: Fundamentos.",
    );
    expect(
      screen.getByText("Todavía no hay progreso registrado."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("cae al catálogo cuando aún no hay etapas publicadas", async () => {
    const loadDashboard = vi.fn(async () => data({ stages: [] }));

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    const continuar = await screen.findByRole("link", { name: "Continuar" });

    expect(continuar).toHaveAttribute("href", "/learn/stages");
    expect(continuar).toHaveAccessibleDescription(
      "El currículo se publica por etapas: vuelve pronto para empezar.",
    );
  });

  it("cuenta los repasos vencidos y enlaza a la cola", async () => {
    const loadDashboard = vi.fn(async () =>
      data({
        summary: summary({ overallPct: 15, activeDays: 1 }),
        units: [
          unit({ unitCode: "1.1", state: "IN_PROGRESS", progressPct: 15 }),
        ],
        review: reviewQueue(3),
      }),
    );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    const repaso = await screen.findByRole("region", {
      name: "Repaso pendiente",
    });

    expect(repaso).toHaveTextContent("3 ejercicios vencidos");
    expect(screen.getByRole("link", { name: /Repasar ahora/ })).toHaveAttribute(
      "href",
      "/learn/review",
    );
  });

  it("concuerda en singular y declara el vacío del repaso", async () => {
    const loadDashboard = vi.fn(async () =>
      data({
        summary: summary({ overallPct: 15, activeDays: 1 }),
        units: [
          unit({ unitCode: "1.1", state: "IN_PROGRESS", progressPct: 15 }),
        ],
        review: reviewQueue(1),
      }),
    );

    const { unmount } = render(
      <StudentDashboard loadDashboard={loadDashboard} />,
    );

    expect(
      await screen.findByText("1 ejercicio vencido"),
    ).toBeInTheDocument();

    unmount();

    const sinRepasos = vi.fn(async () =>
      data({
        summary: summary({ overallPct: 15, activeDays: 1 }),
        units: [
          unit({ unitCode: "1.1", state: "IN_PROGRESS", progressPct: 15 }),
        ],
      }),
    );

    render(<StudentDashboard loadDashboard={sinRepasos} />);

    expect(
      await screen.findByText(/No tienes repasos vencidos/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ir al repaso/ })).toHaveAttribute(
      "href",
      "/learn/review",
    );
  });

  it("pinta el avance, las unidades dominadas y las que están en curso", async () => {
    const loadDashboard = vi.fn(async () =>
      data({
        summary: summary({
          overallPct: 42,
          activeDays: 3,
          units: {
            mastered: 3,
            inProgress: 2,
            needsReview: 1,
            locked: 4,
            total: 10,
          },
        }),
        units: [
          unit({ unitCode: "1.1", state: "MASTERED", progressPct: 100 }),
        ],
      }),
    );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    const avance = await screen.findByRole("progressbar", {
      name: "Avance global",
    });
    const progreso = screen.getByRole("region", { name: "Tu progreso" });

    expect(avance).toHaveAttribute("aria-valuenow", "42");
    expect(progreso).toHaveTextContent("42 %");
    expect(progreso).toHaveTextContent("del avance de 10 unidades publicadas");
    expect(within(progreso).getByText("Dominadas")).toBeInTheDocument();
    expect(within(progreso).getByText("3")).toBeInTheDocument();
    expect(within(progreso).getByText("En curso")).toBeInTheDocument();
    expect(within(progreso).getByText("2")).toBeInTheDocument();
  });

  it("ofrece el onboarding de primer uso cuando aún no hay progreso", async () => {
    const loadDashboard = vi.fn(async () =>
      data({
        units: [unit({ unitCode: "1.1", state: "AVAILABLE" })],
      }),
    );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    const onboarding = await screen.findByRole("region", {
      name: "Empecemos por conocerte",
    });

    expect(within(onboarding).getByText("Paso 1 de 3")).toBeInTheDocument();
    expect(
      within(onboarding).getByRole("button", { name: "Saltar por ahora" }),
    ).toBeInTheDocument();
  });

  it("no ofrece el onboarding cuando ya hay progreso", async () => {
    const loadDashboard = vi.fn(async () =>
      data({
        summary: summary({ overallPct: 20, activeDays: 2 }),
        units: [
          unit({ unitCode: "1.1", state: "IN_PROGRESS", progressPct: 20 }),
        ],
      }),
    );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    await screen.findByRole("link", { name: "Continuar" });

    expect(
      screen.queryByRole("region", { name: "Empecemos por conocerte" }),
    ).toBeNull();
  });

  it("retira el onboarding al saltarlo y recuerda el salto", async () => {
    const loadDashboard = vi.fn(async () => data());

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Saltar por ahora" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Empecemos por conocerte" }),
      ).toBeNull();
    });
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(
      JSON.stringify({ status: "skipped" }),
    );
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      "/learn/stages/0",
    );
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadDashboard = vi
      .fn<() => Promise<StudentDashboardData>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(
        data({
          summary: summary({ overallPct: 10, activeDays: 1 }),
          units: [
            unit({ unitCode: "1.1", state: "IN_PROGRESS", progressPct: 10 }),
          ],
        }),
      );

    render(<StudentDashboard loadDashboard={loadDashboard} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar tu panel.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
        "href",
        "/learn/units/1.1",
      );
    });
    expect(loadDashboard).toHaveBeenCalledTimes(2);
  });
});
