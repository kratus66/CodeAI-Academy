import type { StageDetail, UnitProgressSummary } from "@codeai/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LabHubData } from "./LabHub";
import { LabHub } from "./LabHub";

const STAGE: StageDetail = {
  id: 1,
  slug: "e1-logica",
  title: "Lógica de programación",
  objective: "Resolver problemas con lógica.",
  level: 1,
  estimatedMin: 900,
  order: 2,
  moduleCount: 1,
  modules: [
    {
      id: "module_1",
      code: "M1.1",
      title: "Algoritmos",
      order: 1,
      unitCount: 2,
      units: [
        {
          id: "unit_1",
          code: "U1.1.1",
          title: "Variables y tipos",
          objective: "Declarar y usar variables.",
          estimatedMin: 60,
          order: 1,
          stageId: 1,
          moduleCode: "M1.1",
          prerequisiteIds: [],
        },
        {
          id: "unit_2",
          code: "U1.1.2",
          title: "Condicionales",
          objective: "Decidir con if y switch.",
          estimatedMin: 60,
          order: 2,
          stageId: 1,
          moduleCode: "M1.1",
          prerequisiteIds: ["unit_1"],
        },
      ],
    },
  ],
};

function progress(unitCode: string, state: UnitProgressSummary["state"]): UnitProgressSummary {
  return {
    unitId: unitCode,
    unitCode,
    state,
    progressPct: 0,
    lessonsDone: 0,
    exercisesDone: 0,
    bestScore: null,
    lastActivityAt: null,
    completedAt: null,
  };
}

const DATA: LabHubData = {
  currentStage: 1,
  stage: STAGE,
  units: [progress("U1.1.1", "AVAILABLE"), progress("U1.1.2", "LOCKED")],
};

describe("LabHub", () => {
  it("anuncia la carga", () => {
    render(<LabHub loadHub={() => new Promise(() => undefined)} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu laboratorio…");
  });

  it("enlaza los ejercicios de una unidad abierta", async () => {
    render(<LabHub loadHub={async () => DATA} />);

    const link = await screen.findByRole("link", { name: "Abrir ejercicios" });

    expect(link).toHaveAttribute("href", "/learn/units/U1.1.1#ejercicios");
    expect(screen.getByText("Disponible")).toBeInTheDocument();
  });

  it("no ofrece el laboratorio de una unidad bloqueada y explica por qué", async () => {
    render(<LabHub loadHub={async () => DATA} />);

    await screen.findByText("Condicionales");

    expect(screen.getAllByRole("link", { name: "Abrir ejercicios" })).toHaveLength(1);
    expect(screen.getByText(/Domina los prerrequisitos/)).toBeInTheDocument();
    expect(screen.getByText(/Bloqueada/)).toBeInTheDocument();
  });

  it("ofrece reintentar cuando falla la carga", async () => {
    const loadHub = vi
      .fn<() => Promise<LabHubData>>()
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValue(DATA);

    render(<LabHub loadHub={loadHub} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Variables y tipos")).toBeInTheDocument();
  });
});
