import type {
  ErrorBreakdown,
  ProgressOverview,
  StudentSummary,
  UnitProgressSummary,
} from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  StudentInsights,
  summarizeStages,
  type StudentInsightsData,
} from "./StudentInsights";

const SUMMARY: StudentSummary = {
  range: "30d",
  overallPct: 34.5,
  activeDays: 9,
  lastActivityAt: "2026-10-20T12:00:00.000Z",
  units: { mastered: 12, inProgress: 3, needsReview: 2, locked: 40, total: 57 },
  submissions: { total: 4, passed: 3, failed: 1, avgScore: 75 },
  reviews: { due: 7, completed: 11, lapses: 2 },
  ai: { calls: 40, costUsd: 0.12, budgetLevel: "warning" },
};

const ERRORS: ErrorBreakdown = {
  range: "30d",
  total: 5,
  byCategory: [
    { category: "syntax", count: 3, share: 0.6 },
    { category: "logic", count: 2, share: 0.4 },
  ],
  byConcept: [{ conceptSlug: "closures", conceptName: "Closures", count: 2 }],
};

const OVERVIEW: ProgressOverview = {
  user: { id: "usr_1", name: "Ana" },
  currentStage: 2,
  overallPct: 34.5,
  units: { mastered: 12, inProgress: 3, needsReview: 2, locked: 40 },
  competencies: [
    { code: "C1", level: 3, evidenceCount: 14 },
    { code: "C2", level: 0, evidenceCount: 0 },
  ],
  dueReviews: 7,
};

function unit(
  unitCode: string,
  progressPct: number,
): UnitProgressSummary {
  return {
    unitId: unitCode.toLowerCase(),
    unitCode,
    state: "IN_PROGRESS",
    progressPct,
    lessonsDone: 1,
    exercisesDone: 1,
    bestScore: null,
    lastActivityAt: null,
    completedAt: null,
  };
}

const UNITS: readonly UnitProgressSummary[] = [
  unit("U1.1.1", 50),
  unit("U1.1.2", 100),
  unit("U2.1.1", 25),
];

function data(overrides: Partial<StudentInsightsData> = {}): StudentInsightsData {
  return {
    summary: SUMMARY,
    errors: ERRORS,
    overview: OVERVIEW,
    units: UNITS,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("summarizeStages", () => {
  it("promedia el avance de las unidades de cada etapa", () => {
    expect(summarizeStages(UNITS)).toEqual([
      { stage: 1, units: 2, avgPct: 75 },
      { stage: 2, units: 1, avgPct: 25 },
    ]);
  });

  it("ignora códigos que no codifican una etapa", () => {
    expect(summarizeStages([unit("LEGACY", 80)])).toEqual([]);
  });
});


describe("StudentInsights", () => {
  it("anuncia la carga mientras llegan las métricas", () => {
    const loadInsights = vi.fn(
      () => new Promise<StudentInsightsData>(() => undefined),
    );

    render(<StudentInsights loadInsights={loadInsights} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando tus métricas…");
  });

  it("muestra los contadores del periodo y el uso de IA", async () => {
    const loadInsights = vi.fn(async () => data());

    render(<StudentInsights loadInsights={loadInsights} />);

    const resumen = await screen.findByRole("region", {
      name: "Resumen del periodo",
    });

    expect(resumen).toHaveTextContent("34,5 %");
    expect(resumen).toHaveTextContent("Etapa en curso: 2");
    expect(resumen).toHaveTextContent("9");
    expect(resumen).toHaveTextContent("3/4");
    expect(resumen).toHaveTextContent("Nota media: 75 %");
    expect(resumen).toHaveTextContent("7");
    expect(resumen).toHaveTextContent("11 completados · 2 olvidos");

    const ai = screen.getByText(/Uso de IA en el periodo/);

    expect(ai).toHaveTextContent("40 llamadas");
    expect(ai).toHaveTextContent("0,12 USD");
    expect(ai).toHaveTextContent("cerca del límite");
  });

  it("agrupa el avance por etapa y lista competencias con evidencia", async () => {
    const loadInsights = vi.fn(async () => data());

    render(<StudentInsights loadInsights={loadInsights} />);

    const etapa1 = await screen.findByRole("progressbar", {
      name: "Avance de la etapa E1",
    });

    expect(etapa1).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText("75 % · 2 unidades")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Avance de la etapa E2" }),
    ).toHaveAttribute("aria-valuenow", "25");

    const competencias = screen.getByRole("region", { name: "Competencias" });

    expect(competencias).toHaveTextContent("Nivel 3 · 14 evidencias");
    expect(competencias).not.toHaveTextContent("Nivel 0");
  });

  it("desglosa los errores por categoría y concepto", async () => {
    const loadInsights = vi.fn(async () => data());

    render(<StudentInsights loadInsights={loadInsights} />);

    const errores = await screen.findByRole("region", {
      name: "Errores frecuentes",
    });

    expect(errores).toHaveTextContent("5 errores clasificados en el periodo.");
    expect(errores).toHaveTextContent("3 · 60 %");
    expect(errores).toHaveTextContent("Closures");
    expect(errores).toHaveTextContent("2 fallos");
  });

  it("declara el vacío cuando no hay errores en el periodo", async () => {
    const loadInsights = vi.fn(async () =>
      data({
        errors: { range: "30d", total: 0, byCategory: [], byConcept: [] },
      }),
    );

    render(<StudentInsights loadInsights={loadInsights} />);

    expect(
      await screen.findByText("Sin errores registrados en este periodo."),
    ).toBeInTheDocument();
  });

  it("declara que no hay actividad en el periodo", async () => {
    const loadInsights = vi.fn(async () =>
      data({
        summary: {
          ...SUMMARY,
          overallPct: 0,
          activeDays: 0,
          lastActivityAt: null,
          units: {
            mastered: 0,
            inProgress: 0,
            needsReview: 0,
            locked: 0,
            total: 0,
          },
          submissions: { total: 0, passed: 0, failed: 0, avgScore: null },
          reviews: { due: 0, completed: 0, lapses: 0 },
          ai: { calls: 0, costUsd: 0, budgetLevel: "ok" },
        },
        errors: { range: "30d", total: 0, byCategory: [], byConcept: [] },
        overview: { ...OVERVIEW, competencies: [] },
        units: [],
      }),
    );

    render(<StudentInsights loadInsights={loadInsights} />);

    expect(
      await screen.findByText("Todavía no hay actividad en este periodo."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("vuelve a pedir los datos con el rango elegido", async () => {
    const loadInsights = vi.fn(async () => data());

    render(<StudentInsights loadInsights={loadInsights} />);

    await screen.findByRole("region", { name: "Resumen del periodo" });

    const picker = screen.getByRole("group", { name: "Periodo del análisis" });

    expect(picker).toHaveTextContent("30 días");
    expect(screen.getByRole("button", { name: "30 días" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "90 días" }));

    await waitFor(() => {
      expect(loadInsights).toHaveBeenLastCalledWith("90d", expect.anything());
    });
    expect(screen.getByRole("button", { name: "90 días" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadInsights = vi
      .fn<
        (
          range: "7d" | "30d" | "90d" | "all",
          signal: AbortSignal,
        ) => Promise<StudentInsightsData>
      >()
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValueOnce(data());

    render(<StudentInsights loadInsights={loadInsights} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar tus métricas.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Resumen del periodo" }),
      ).toBeInTheDocument();
    });
    expect(loadInsights).toHaveBeenCalledTimes(2);
  });
});
