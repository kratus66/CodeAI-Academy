import type { UnitProgressSummary } from "@codeai/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StageCatalogPage } from "@/lib/api-client";

import { StageCatalog, summarizeStageProgress } from "./StageCatalog";

const STAGES = [
  {
    id: 0,
    slug: "e0-fundamentos",
    title: "Fundamentos de la IA",
    objective: "Entender qué es la inteligencia artificial.",
    level: 1,
    estimatedMin: 900,
    order: 1,
    moduleCount: 3,
  },
  {
    id: 1,
    slug: "e1-programacion",
    title: "Programación asistida",
    objective: "Escribir código con criterio y verificación.",
    level: 1,
    estimatedMin: 1200,
    order: 2,
    moduleCount: 1,
  },
  {
    id: 2,
    slug: "e2-agentes",
    title: "Agentes autónomos",
    objective: "Diseñar agentes que resuelven tareas.",
    level: 2,
    estimatedMin: 1500,
    order: 3,
    moduleCount: 2,
  },
] as const;

function page(stages: readonly unknown[]): StageCatalogPage {
  return {
    stages: stages as unknown as StageCatalogPage["stages"],
    meta: { page: 1, pageSize: 20, total: stages.length, totalPages: 1 },
  };
}

function unit(
  unitCode: string,
  state: UnitProgressSummary["state"],
  progressPct: number,
): UnitProgressSummary {
  return {
    unitId: `id-${unitCode}`,
    unitCode,
    state,
    progressPct,
    lessonsDone: 0,
    exercisesDone: 0,
    bestScore: null,
    lastActivityAt: null,
    completedAt: null,
  };
}

/** Tres etapas, un estado por etapa: dominada, en curso y bloqueada. */
const UNITS: readonly UnitProgressSummary[] = [
  unit("U0.1.1", "MASTERED", 100),
  unit("U0.1.2", "MASTERED", 100),
  unit("U1.1.1", "IN_PROGRESS", 40),
  unit("U2.1.1", "LOCKED", 0),
];

const noProgress = async (): Promise<readonly UnitProgressSummary[]> => [];
const withProgress = async (): Promise<readonly UnitProgressSummary[]> => UNITS;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("summarizeStageProgress", () => {
  it("agrupa por la etapa que codifica el unitCode y promedia el avance", () => {
    const summary = summarizeStageProgress([
      unit("U0.1.1", "MASTERED", 100),
      unit("U0.1.2", "IN_PROGRESS", 50),
      unit("U1.1.1", "LOCKED", 0),
      unit("sin-formato", "LOCKED", 0),
    ]);

    expect(summary.get(0)).toEqual({ status: "inProgress", pct: 75, units: 2 });
    expect(summary.get(1)).toEqual({ status: "locked", pct: 0, units: 1 });
    expect(summary.size).toBe(2);
  });

  it("marca dominada solo cuando todas las unidades lo están", () => {
    expect(summarizeStageProgress([unit("U4.1.1", "MASTERED", 100)]).get(4)).toEqual(
      { status: "mastered", pct: 100, units: 1 },
    );
  });
});

describe("StageCatalog", () => {
  it("anuncia la carga mientras el catálogo llega", () => {
    const loadStages = vi.fn(() => new Promise<StageCatalogPage>(() => undefined));

    render(
      <StageCatalog loadStages={loadStages} loadProgress={withProgress} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando el catálogo de etapas…",
    );
  });

  it("lista las etapas publicadas con enlace a su detalle", async () => {
    const loadStages = vi.fn(async () => page(STAGES));

    render(
      <StageCatalog loadStages={loadStages} loadProgress={noProgress} />,
    );

    const fundamentos = await screen.findByRole("link", {
      name: /Fundamentos de la IA/,
    });

    expect(fundamentos).toHaveAttribute("href", "/learn/stages/0");
    expect(fundamentos).toHaveTextContent("Etapa 1 · Nivel 1");
    expect(fundamentos).toHaveTextContent("3 módulos");
    expect(
      screen.getByRole("link", { name: /Programación asistida/ }),
    ).toHaveTextContent("1 módulo");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("muestra el estado y el avance de etapas dominadas, en curso y bloqueadas", async () => {
    const loadStages = vi.fn(async () => page(STAGES));

    render(
      <StageCatalog loadStages={loadStages} loadProgress={withProgress} />,
    );

    const dominada = await screen.findByRole("link", {
      name: /Fundamentos de la IA/,
    });
    const enCurso = screen.getByRole("link", {
      name: /Programación asistida/,
    });

    expect(within(dominada).getByText("Dominada")).toBeInTheDocument();
    expect(within(enCurso).getByText("En curso")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Avance de la etapa 1" }),
    ).toHaveAttribute("aria-valuenow", "100");
    expect(
      screen.getByRole("progressbar", { name: "Avance de la etapa 2" }),
    ).toHaveAttribute("aria-valuenow", "40");

    const bloqueada = screen.getByRole("article");
    const avanceBloqueada = screen.getByRole("progressbar", {
      name: "Avance de la etapa 3",
    });

    expect(within(bloqueada).getByText("Bloqueada")).toBeInTheDocument();
    expect(avanceBloqueada).toHaveAttribute("aria-valuenow", "0");
    expect(avanceBloqueada).toHaveAttribute("aria-valuemin", "0");
    expect(avanceBloqueada).toHaveAttribute("aria-valuemax", "100");
    expect(bloqueada).toHaveTextContent("Domina antes la etapa 2: Programación asistida.");
    expect(
      screen.queryByRole("link", { name: /Agentes autónomos/ }),
    ).toBeNull();
  });


  it("declara el vacío cuando no hay etapas publicadas", async () => {
    const loadStages = vi.fn(async () => page([]));

    render(<StageCatalog loadStages={loadStages} loadProgress={noProgress} />);

    expect(
      await screen.findByText("Todavía no hay etapas publicadas."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadStages = vi
      .fn<() => Promise<StageCatalogPage>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(page(STAGES));

    render(<StageCatalog loadStages={loadStages} loadProgress={noProgress} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar el catálogo.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fundamentos de la IA/ }),
      ).toBeInTheDocument();
    });
    expect(loadStages).toHaveBeenCalledTimes(2);
  });
});
