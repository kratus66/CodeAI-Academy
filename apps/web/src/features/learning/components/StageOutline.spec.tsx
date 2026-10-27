import type { StageDetail } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { StageOutline } from "./StageOutline";

const STAGE: StageDetail = {
  id: 0,
  slug: "e0-fundamentos",
  title: "Fundamentos de la IA",
  objective: "Entender qué es la inteligencia artificial y qué no lo es.",
  level: 1,
  estimatedMin: 900,
  order: 1,
  moduleCount: 2,
  modules: [
    {
      id: "module_1",
      code: "M0.1",
      title: "Pensamiento computacional",
      order: 1,
      unitCount: 2,
      units: [
        {
          id: "unit_1",
          code: "U0.1.1",
          title: "Qué es la inteligencia artificial",
          objective: "Distinguir IA de automatización clásica.",
          estimatedMin: 90,
          order: 1,
          stageId: 0,
          moduleCode: "M0.1",
          prerequisiteIds: [],
        },
        {
          id: "unit_2",
          code: "U0.1.2",
          title: "Qué es un algoritmo",
          objective: "Describir un algoritmo con precisión.",
          estimatedMin: 45,
          order: 2,
          stageId: 0,
          moduleCode: "M0.1",
          prerequisiteIds: ["unit_1"],
        },
      ],
    },
    {
      id: "module_2",
      code: "M0.2",
      title: "Datos y representación",
      order: 2,
      unitCount: 0,
      units: [],
    },
  ],
};

const loadStage = (): Promise<StageDetail> => Promise.resolve(STAGE);

describe("StageOutline", () => {
  it("anuncia la carga de la etapa", () => {
    render(
      <StageOutline
        stageId={0}
        loadStage={() => new Promise<StageDetail>(() => undefined)}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando la etapa…");
  });

  it("pide la etapa por su id y enlaza cada unidad", async () => {
    const loader = vi.fn(loadStage);

    render(<StageOutline stageId={0} loadStage={loader} />);

    const unit = await screen.findByRole("link", {
      name: /Qué es la inteligencia artificial/,
    });

    expect(loader).toHaveBeenCalledWith(0, expect.any(AbortSignal));
    expect(unit).toHaveAttribute("href", "/learn/units/U0.1.1");
    expect(unit).toHaveTextContent("1 h 30 min");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Fundamentos de la IA",
    );
    expect(screen.getByText("M0.1")).toBeInTheDocument();
    expect(screen.getByText(/Duración estimada/)).toHaveTextContent("15 h");
  });

  it("declara el módulo sin unidades publicadas", async () => {
    render(<StageOutline stageId={0} loadStage={loadStage} />);

    expect(
      await screen.findByText("Este módulo aún no tiene unidades publicadas."),
    ).toBeInTheDocument();
  });

  it("trata el 404 como etapa inexistente, sin reintento inútil", async () => {
    render(
      <StageOutline
        stageId={9}
        loadStage={() =>
          Promise.reject(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: "La etapa no existe o no está publicada",
              traceId: "trace-404",
            }),
          )
        }
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos esta etapa.",
    );
    expect(
      screen.getByRole("link", { name: "Volver al catálogo" }),
    ).toHaveAttribute("href", "/learn");
    expect(screen.getByText("Referencia: trace-404")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });

  it("ofrece reintentar cuando la API falla por otra razón", async () => {
    const loader = vi
      .fn<(id: number | string, signal?: AbortSignal) => Promise<StageDetail>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(STAGE);

    render(<StageOutline stageId={0} loadStage={loader} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar la etapa.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Fundamentos de la IA" }),
      ).toBeInTheDocument();
    });
  });
});
