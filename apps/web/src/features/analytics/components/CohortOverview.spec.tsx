import type { CohortAnalytics } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CohortOverview } from "./CohortOverview";

const COHORT: CohortAnalytics = {
  range: "30d",
  students: { total: 12, active: 7 },
  avgOverallPct: 48.5,
  stageCompletion: [
    { stage: "E1", completedPct: 75, studentsAtStage: 9 },
    { stage: "E2", completedPct: 20, studentsAtStage: 3 },
  ],
  topErrors: [
    { category: "syntax", count: 8, share: 0.5 },
    { category: "logic", count: 4, share: 0.25 },
  ],
  reviewBacklog: 14,
  atRisk: [
    {
      userId: "usr_2",
      displayName: "Beto",
      overallPct: 8.2,
      daysSinceActivity: 21,
    },
  ],
};

function empty(overrides: Partial<CohortAnalytics> = {}): CohortAnalytics {
  return {
    range: "30d",
    students: { total: 0, active: 0 },
    avgOverallPct: 0,
    stageCompletion: [],
    topErrors: [],
    reviewBacklog: 0,
    atRisk: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CohortOverview", () => {
  it("anuncia la carga mientras llega la cohorte", () => {
    const loadCohort = vi.fn(
      () => new Promise<CohortAnalytics>(() => undefined),
    );

    render(<CohortOverview loadCohort={loadCohort} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando la cohorte…");
  });

  it("resume estudiantes, avance, repasos y riesgo", async () => {
    const loadCohort = vi.fn(async () => COHORT);

    render(<CohortOverview loadCohort={loadCohort} />);

    const resumen = await screen.findByRole("region", {
      name: "Resumen de la cohorte",
    });

    expect(resumen).toHaveTextContent("7/12");
    expect(resumen).toHaveTextContent("48,5 %");
    expect(resumen).toHaveTextContent("14");
    expect(resumen).toHaveTextContent("Máximo de 20 estudiantes por panel");
  });

  it("pinta el cumplimiento por etapa y los errores más frecuentes", async () => {
    const loadCohort = vi.fn(async () => COHORT);

    render(<CohortOverview loadCohort={loadCohort} />);

    const etapas = await screen.findByRole("region", {
      name: "Cumplimiento por etapa",
    });

    expect(etapas).toHaveTextContent("E1");
    expect(etapas).toHaveTextContent("75 % · 9 estudiantes");
    expect(
      screen.getByRole("progressbar", { name: "Cumplimiento de la etapa E2" }),
    ).toHaveAttribute("aria-valuenow", "20");

    const errores = screen.getByRole("region", {
      name: "Errores más frecuentes",
    });

    expect(errores).toHaveTextContent("syntax");
    expect(errores).toHaveTextContent("8 fallos · 50 %");
  });

  it("lista a los estudiantes en riesgo sin datos personales de más", async () => {
    const loadCohort = vi.fn(async () => COHORT);

    render(<CohortOverview loadCohort={loadCohort} />);

    const riesgo = await screen.findByRole("region", {
      name: "Estudiantes en riesgo",
    });

    expect(riesgo).toHaveTextContent("Beto");
    expect(riesgo).toHaveTextContent("8,2 %");
    expect(riesgo).toHaveTextContent("21 días");
    expect(riesgo).not.toHaveTextContent("@");
  });

  it("declara que no hay cohorte cuando no hay estudiantes", async () => {
    const loadCohort = vi.fn(async () => empty());

    render(<CohortOverview loadCohort={loadCohort} />);

    expect(
      await screen.findByText("Todavía no hay estudiantes en la cohorte."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Cumplimiento por etapa" }),
    ).toBeNull();
  });

  it("avisa cuando nadie está en riesgo", async () => {
    const loadCohort = vi.fn(async () => ({ ...COHORT, atRisk: [] }));

    render(<CohortOverview loadCohort={loadCohort} />);

    expect(
      await screen.findByText(/Nadie en riesgo con este periodo/),
    ).toBeInTheDocument();
  });

  it("vuelve a pedir la cohorte con el rango elegido", async () => {
    const loadCohort = vi.fn(async () => COHORT);

    render(<CohortOverview loadCohort={loadCohort} />);

    await screen.findByRole("region", { name: "Resumen de la cohorte" });

    fireEvent.click(screen.getByRole("button", { name: "7 días" }));

    await waitFor(() => {
      expect(loadCohort).toHaveBeenLastCalledWith("7d", expect.anything());
    });
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadCohort = vi
      .fn<
        (
          range: "7d" | "30d" | "90d" | "all",
          signal: AbortSignal,
        ) => Promise<CohortAnalytics>
      >()
      .mockRejectedValueOnce(new Error("403"))
      .mockResolvedValueOnce(COHORT);

    render(<CohortOverview loadCohort={loadCohort} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar la cohorte.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Resumen de la cohorte" }),
      ).toBeInTheDocument();
    });
    expect(loadCohort).toHaveBeenCalledTimes(2);
  });
});

