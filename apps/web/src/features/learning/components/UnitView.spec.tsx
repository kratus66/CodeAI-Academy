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

  it("enlaza cada ejercicio con su laboratorio", async () => {
    const base = contentOf("U0.1.1");

    render(
      <UnitView
        code="U0.1.1"
        loadUnit={() =>
          Promise.resolve({
            stage: base.stage,
            unit: {
              ...base.unit,
              exercises: [
                {
                  id: "ex_1",
                  slug: "suma-segura",
                  type: "LAB",
                  title: "Suma segura",
                  statement: "Implementa una suma que valide sus entradas.",
                  ladder: "GUIDED",
                  difficulty: 2,
                  concepts: [],
                  competencies: [],
                  estimatedMin: 30,
                  order: 1,
                },
              ],
            },
          })
        }
      />,
    );

    expect(
      await screen.findByRole("link", { name: /Suma segura/ }),
    ).toHaveAttribute("href", "/learn/units/U0.1.1/exercises/suma-segura");
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

describe("UnitView: estado de los ejercicios", () => {
  const exercise = (id: string, title: string) => ({
    id,
    slug: id,
    type: "QUIZ" as const,
    title,
    statement: `Enunciado de ${title}`,
    difficulty: 1,
    ladder: "GUIDED" as const,
    estimatedMin: 2,
    concepts: ["general"],
    competencies: ["C1"],
    order: 1,
  });
  const withExercises = (code: string): Promise<UnitViewContent> => {
    const content = contentOf(code);

    return Promise.resolve({
      ...content,
      unit: {
        ...content.unit,
        exercises: [exercise("ex1", "Primero"), exercise("ex2", "Segundo"), exercise("ex3", "Tercero")],
      },
    });
  };

  it("marca superado en verde, por mejorar en rojo y deja sin marca el que no se intentó", async () => {
    render(
      <UnitView
        code="U0.1.1"
        loadUnit={withExercises}
        loadProgress={() =>
          Promise.resolve([
            { exerciseId: "ex1", status: "PASSED", attempts: 1, bestScore: 100 },
            { exerciseId: "ex2", status: "FAILED", attempts: 3, bestScore: 0 },
          ])
        }
      />,
    );

    const first = (await screen.findByRole("link", { name: /Primero/ })) as HTMLElement;
    const second = screen.getByRole("link", { name: /Segundo/ });
    const third = screen.getByRole("link", { name: /Tercero/ });

    expect(await within(first).findByText(/Superado/)).toBeInTheDocument();
    expect(first.className).toContain("emerald");
    expect(within(second).getByText(/Por mejorar/)).toBeInTheDocument();
    expect(within(second).getByText(/3 intentos/)).toBeInTheDocument();
    expect(second.className).toContain("rose");
    expect(within(third).queryByText(/Superado|Por mejorar|En curso/)).not.toBeInTheDocument();
    expect(third.className).not.toContain("emerald");
    expect(screen.getByText(/1 de\s+3 superados/)).toBeInTheDocument();
  });

  it("si el estado no carga, la lista se ve igual y sin colores", async () => {
    render(
      <UnitView code="U0.1.1" loadUnit={withExercises} loadProgress={() => Promise.reject(new Error("sin red"))} />,
    );

    const first = await screen.findByRole("link", { name: /Primero/ });

    expect(first.className).not.toContain("emerald");
    expect(screen.queryByText(/superados/)).not.toBeInTheDocument();
  });
});
