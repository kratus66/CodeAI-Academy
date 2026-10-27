import type { StageDetail, UnitDetail } from "@codeai/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import type { UnitViewContent } from "../lib/unit-view-loader";
import { UnitView } from "./UnitView";

const UNITS: readonly UnitDetail[] = ["U0.1.1", "U0.1.2", "U0.1.3"].map(
  (code, index) => ({
    id: `unit_${index + 1}`,
    code,
    title: `Unidad ${code}`,
    objective: `Objetivo de ${code}`,
    estimatedMin: 90,
    order: index + 1,
    stageId: 0,
    moduleCode: "M0.1",
    prerequisiteIds: index === 0 ? [] : [`unit_${index}`],
    lessons: [
      {
        id: `lesson_${index + 1}`,
        slug: `leccion-${index + 1}`,
        title: `Lección de ${code}`,
        estimatedMin: 30,
        order: 1,
      },
    ],
    exercises: [],
  }),
);

const STAGE: StageDetail = {
  id: 0,
  slug: "e0-fundamentos",
  title: "Fundamentos de la IA",
  objective: "Entender qué es la inteligencia artificial.",
  level: 1,
  estimatedMin: 900,
  order: 1,
  moduleCount: 1,
  modules: [
    {
      id: "module_1",
      code: "M0.1",
      title: "Pensamiento computacional",
      order: 1,
      unitCount: UNITS.length,
      units: [...UNITS],
    },
  ],
};

function contentOf(code: string): UnitViewContent {
  const unit = UNITS.find((item) => item.code === code);

  if (!unit) {
    throw new Error(`Fixture inexistente: ${code}`);
  }

  return { unit, stage: STAGE };
}

const loadUnit = (code: string): Promise<UnitViewContent> =>
  Promise.resolve(contentOf(code));

describe("UnitView", () => {
  it("anuncia la carga de la unidad", () => {
    render(
      <UnitView
        code="U0.1.1"
        loadUnit={() => new Promise<UnitViewContent>(() => undefined)}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando la unidad…");
  });

  it("muestra el objetivo y los prerrequisitos de la unidad", async () => {
    const loader = vi.fn(loadUnit);

    render(<UnitView code="U0.1.2" loadUnit={loader} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Unidad U0.1.2" }),
    ).toBeInTheDocument();
    expect(loader).toHaveBeenCalledWith("U0.1.2", expect.any(AbortSignal));
    expect(screen.getByText("Objetivo de U0.1.2")).toBeInTheDocument();

    const prerequisites = screen.getByRole("region", { name: "Prerrequisitos" });
    expect(
      within(prerequisites).getByRole("link", { name: /U0\.1\.1/ }),
    ).toHaveAttribute("href", "/learn/units/U0.1.1");
    expect(
      screen.getByRole("link", { name: /Lección de U0\.1\.2/ }),
    ).toHaveAttribute("href", "/learn/lessons/leccion-2");
  });

  it("deshabilita «Anterior» en la primera unidad de la etapa", async () => {
    render(<UnitView code="U0.1.1" loadUnit={loadUnit} />);

    expect(
      await screen.findByRole("button", { name: /Anterior/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: /Siguiente: U0\.1\.2/ }),
    ).toHaveAttribute("href", "/learn/units/U0.1.2");
  });

  it("enlaza anterior y siguiente en una unidad del medio", async () => {
    render(<UnitView code="U0.1.2" loadUnit={loadUnit} />);

    expect(
      await screen.findByRole("link", { name: /Anterior: U0\.1\.1/ }),
    ).toHaveAttribute("href", "/learn/units/U0.1.1");
    expect(
      screen.getByRole("link", { name: /Siguiente: U0\.1\.3/ }),
    ).toHaveAttribute("href", "/learn/units/U0.1.3");
  });

  it("declara la unidad sin lecciones publicadas", async () => {
    render(
      <UnitView
        code="U0.1.1"
        loadUnit={() =>
          Promise.resolve({
            ...contentOf("U0.1.1"),
            unit: { ...contentOf("U0.1.1").unit, lessons: [] },
          })
        }
      />,
    );

    expect(
      await screen.findByText("Esta unidad aún no tiene lecciones publicadas."),
    ).toBeInTheDocument();
  });

  it("trata el 404 como unidad inexistente con vuelta al catálogo", async () => {
    render(
      <UnitView
        code="U9.9.9"
        loadUnit={() =>
          Promise.reject(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: "La unidad no existe o no está publicada",
              traceId: "trace-unidad",
            }),
          )
        }
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos esta unidad.",
    );
    expect(
      screen.getByRole("link", { name: "Volver al catálogo" }),
    ).toHaveAttribute("href", "/learn");
    expect(screen.getByText("Referencia: trace-unidad")).toBeInTheDocument();
  });
});
