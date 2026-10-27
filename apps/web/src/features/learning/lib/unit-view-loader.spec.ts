import { beforeEach, describe, expect, it, vi } from "vitest";

import { contentApi } from "@/lib/api-client";
import type { StageDetail, UnitDetail } from "@codeai/shared";

import { loadUnitView } from "./unit-view-loader";

vi.mock("@/lib/api-client", () => ({
  contentApi: { getUnit: vi.fn(), getStage: vi.fn() },
}));

const UNIT: UnitDetail = {
  id: "unit_1",
  code: "U0.1.1",
  title: "Qué es la inteligencia artificial",
  objective: "Distinguir IA de automatización clásica.",
  estimatedMin: 90,
  order: 1,
  stageId: 0,
  moduleCode: "M0.1",
  prerequisiteIds: [],
  lessons: [
    {
      id: "lesson_1",
      slug: "que-es-la-ia",
      title: "Qué es la IA",
      estimatedMin: 30,
      order: 1,
    },
  ],
  exercises: [],
};

const STAGE: StageDetail = {
  id: 0,
  slug: "e0-fundamentos",
  title: "Fundamentos de la IA",
  objective: "Entender qué es la IA.",
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
      unitCount: 1,
      units: [UNIT],
    },
  ],
};

const getUnit = vi.mocked(contentApi.getUnit);
const getStage = vi.mocked(contentApi.getStage);

beforeEach(() => {
  getUnit.mockReset();
  getStage.mockReset();
});

describe("loadUnitView", () => {
  it("compone la unidad con la etapa a la que pertenece", async () => {
    const signal = new AbortController().signal;
    getUnit.mockResolvedValue(UNIT);
    getStage.mockResolvedValue(STAGE);

    await expect(loadUnitView("U0.1.1", signal)).resolves.toEqual({
      unit: UNIT,
      stage: STAGE,
    });
    expect(getUnit).toHaveBeenCalledWith("U0.1.1", signal);
    expect(getStage).toHaveBeenCalledWith(0, signal);
  });

  it("no pide la etapa si la unidad no existe", async () => {
    getUnit.mockRejectedValue(new Error("unidad no encontrada"));

    await expect(loadUnitView("U9.9.9")).rejects.toThrow("unidad no encontrada");
    expect(getStage).not.toHaveBeenCalled();
  });

  it("propaga el fallo de la etapa sin devolver una vista a medias", async () => {
    getUnit.mockResolvedValue(UNIT);
    getStage.mockRejectedValue(new Error("etapa caída"));

    await expect(loadUnitView("U0.1.1")).rejects.toThrow("etapa caída");
  });
});
