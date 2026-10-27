import type { ProgressOverview as ProgressOverviewData } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProgressOverview } from "./ProgressOverview";

function overview(
  overrides: Partial<ProgressOverviewData> = {},
): ProgressOverviewData {
  return {
    user: { id: "usr_1", name: "Ana" },
    currentStage: 2,
    overallPct: 34.5,
    units: { mastered: 12, inProgress: 3, needsReview: 2, locked: 40 },
    competencies: [{ code: "C1", level: 3, evidenceCount: 14 }],
    dueReviews: 7,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProgressOverview", () => {
  it("anuncia la carga mientras llega el resumen", () => {
    const loadOverview = vi.fn(
      () => new Promise<ProgressOverviewData>(() => undefined),
    );

    render(<ProgressOverview loadOverview={loadOverview} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu avance…");
  });

  it("muestra el avance, la etapa y los cuatro contadores", async () => {
    const loadOverview = vi.fn(async () => overview());

    render(<ProgressOverview loadOverview={loadOverview} />);

    const global = await screen.findByRole("region", { name: "Avance global" });

    expect(global).toHaveTextContent("34,5 %");
    expect(global).toHaveTextContent("Etapa en curso: 2");
    expect(global).toHaveTextContent("57 unidades");

    const bar = screen.getByRole("progressbar", { name: "Avance global" });

    expect(bar).toHaveAttribute("aria-valuenow", "34.5");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    const unidades = screen.getByRole("region", { name: "Unidades" });

    expect(unidades).toHaveTextContent("Dominadas");
    expect(unidades).toHaveTextContent("Para repasar");
    expect(unidades).toHaveTextContent("40");
  });

  it("publica el nivel de las competencias con evidencia", async () => {
    const loadOverview = vi.fn(async () => overview());

    render(<ProgressOverview loadOverview={loadOverview} />);

    const competencias = await screen.findByRole("region", {
      name: "Competencias",
    });

    expect(competencias).toHaveTextContent("C1");
    expect(competencias).toHaveTextContent("Nivel 3 · 14 evidencias");
  });

  it("declara el vacío cuando no hay unidades en el resumen", async () => {
    const loadOverview = vi.fn(async () =>
      overview({
        overallPct: 0,
        currentStage: 0,
        units: { mastered: 0, inProgress: 0, needsReview: 0, locked: 0 },
        competencies: [{ code: "C1", level: 0, evidenceCount: 0 }],
      }),
    );

    render(<ProgressOverview loadOverview={loadOverview} />);

    expect(
      await screen.findByText("Todavía no hay progreso registrado."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("avisa de que aún no hay evidencia de competencias", async () => {
    const loadOverview = vi.fn(async () =>
      overview({
        competencies: [
          { code: "C1", level: 0, evidenceCount: 0 },
          { code: "C2", level: 0, evidenceCount: 0 },
        ],
      }),
    );

    render(<ProgressOverview loadOverview={loadOverview} />);

    expect(
      await screen.findByText(/Todavía no hay evidencia de competencias/),
    ).toBeInTheDocument();
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadOverview = vi
      .fn<() => Promise<ProgressOverviewData>>()
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValueOnce(overview());

    render(<ProgressOverview loadOverview={loadOverview} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar tu avance.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
    expect(loadOverview).toHaveBeenCalledTimes(2);
  });
});
