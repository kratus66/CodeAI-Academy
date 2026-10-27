import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StageCatalogPage } from "@/lib/api-client";

import { StageCatalog } from "./StageCatalog";

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
] as const;

function page(stages: readonly unknown[]): StageCatalogPage {
  return {
    stages: stages as unknown as StageCatalogPage["stages"],
    meta: { page: 1, pageSize: 20, total: stages.length, totalPages: 1 },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StageCatalog", () => {
  it("anuncia la carga mientras el catálogo llega", () => {
    const loadStages = vi.fn(() => new Promise<StageCatalogPage>(() => undefined));

    render(<StageCatalog loadStages={loadStages} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando el catálogo de etapas…",
    );
  });

  it("lista las etapas publicadas con enlace a su detalle", async () => {
    const loadStages = vi.fn(async () => page(STAGES));

    render(<StageCatalog loadStages={loadStages} />);

    const fundamentos = await screen.findByRole("link", {
      name: /Fundamentos de la IA/,
    });

    expect(fundamentos).toHaveAttribute("href", "/learn/stages/0");
    expect(fundamentos).toHaveTextContent("Etapa 1 · Nivel 1");
    expect(fundamentos).toHaveTextContent("3 módulos");
    expect(
      screen.getByRole("link", { name: /Programación asistida/ }),
    ).toHaveTextContent("1 módulo");
  });

  it("declara el vacío cuando no hay etapas publicadas", async () => {
    const loadStages = vi.fn(async () => page([]));

    render(<StageCatalog loadStages={loadStages} />);

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

    render(<StageCatalog loadStages={loadStages} />);

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
