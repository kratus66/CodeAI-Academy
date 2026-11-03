import type { StageDetail, UnitProgressSummary } from "@codeai/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  practice: {
    "U1.1.1": [
      { slug: "suma-segura", title: "Suma segura", type: "LAB", difficulty: 2 },
      { slug: "memoria-tipos", title: "Memoria de tipos", type: "MEMORY", difficulty: 1 },
    ],
  },
};

describe("LabHub", () => {
  it("anuncia la carga", () => {
    render(<LabHub loadHub={() => new Promise(() => undefined)} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu laboratorio…");
  });

  it("lista la práctica de manos a la obra de una unidad abierta, no los quizzes", async () => {
    render(<LabHub loadHub={async () => DATA} />);

    const lab = await screen.findByRole("link", { name: /Suma segura/ });
    const game = screen.getByRole("link", { name: /Memoria de tipos/ });

    expect(lab).toHaveAttribute("href", "/learn/units/U1.1.1/exercises/suma-segura");
    expect(game).toHaveAttribute("href", "/learn/units/U1.1.1/exercises/memoria-tipos");
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: /Práctica de/ })).getAllByRole("link")).toHaveLength(2);
  });

  it("enlaza a Aprender para los quizzes y las tarjetas de la unidad", async () => {
    render(<LabHub loadHub={async () => DATA} />);

    const link = await screen.findByRole("link", { name: "Ver quizzes y tarjetas en Aprender" });

    expect(link).toHaveAttribute("href", "/learn/units/U1.1.1#ejercicios");
  });

  it("dice con claridad cuando la unidad no tiene práctica de código", async () => {
    render(<LabHub loadHub={async () => ({ ...DATA, practice: { "U1.1.1": [] } })} />);

    expect(await screen.findByText(/todavía no tiene práctica de código ni juegos/)).toBeInTheDocument();
  });

  it("avisa a nivel de etapa cuando ninguna unidad tiene práctica de código", async () => {
    render(<LabHub loadHub={async () => ({ ...DATA, practice: { "U1.1.1": [] } })} />);

    expect(await screen.findByRole("note")).toHaveTextContent(
      "Esta etapa todavía no tiene ejercicios de código ni juegos",
    );
  });

  it("no muestra ese aviso si alguna unidad sí tiene práctica", async () => {
    render(<LabHub loadHub={async () => DATA} />);

    await screen.findByText("Variables y tipos");

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("no ofrece el laboratorio de una unidad bloqueada y explica por qué", async () => {
    render(<LabHub loadHub={async () => DATA} />);

    await screen.findByText("Condicionales");

    expect(screen.getAllByRole("link", { name: "Ver quizzes y tarjetas en Aprender" })).toHaveLength(1);
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
