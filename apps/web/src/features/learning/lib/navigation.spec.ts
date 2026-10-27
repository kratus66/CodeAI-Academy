import type { ModuleSummary, UnitSummary } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { findUnitNeighbours, flattenStageUnits, resolvePrerequisites } from "./navigation";

function unit(code: string, order: number): UnitSummary {
  return {
    id: `id-${code}`,
    code,
    title: `Unidad ${code}`,
    objective: `Objetivo de ${code}`,
    estimatedMin: 45,
    order,
    stageId: 0,
    moduleCode: "M0.1",
    prerequisiteIds: [],
  };
}

function module(
  code: string,
  order: number,
  units: readonly UnitSummary[],
): ModuleSummary {
  return {
    id: `id-${code}`,
    code,
    title: `Módulo ${code}`,
    order,
    unitCount: units.length,
    units: [...units],
  };
}

const MODULES: readonly ModuleSummary[] = [
  module("M0.1", 1, [unit("U0.1.1", 1), unit("U0.1.2", 2)]),
  module("M0.2", 2, []),
  module("M0.3", 3, [unit("U0.3.1", 1), unit("U0.3.2", 2)]),
];

describe("flattenStageUnits", () => {
  it("recorre la etapa en orden, cruzando módulos y saltando los vacíos", () => {
    expect(flattenStageUnits(MODULES).map((item) => item.code)).toEqual([
      "U0.1.1",
      "U0.1.2",
      "U0.3.1",
      "U0.3.2",
    ]);
  });

  it("devuelve una lista vacía si la etapa no tiene unidades", () => {
    expect(flattenStageUnits([])).toEqual([]);
  });
});

describe("findUnitNeighbours", () => {
  it("enlaza la unidad anterior y la siguiente", () => {
    const { previous, next } = findUnitNeighbours(MODULES, "U0.1.2");

    expect(previous?.code).toBe("U0.1.1");
    expect(next?.code).toBe("U0.3.1");
  });

  it("no ofrece anterior en la primera unidad de la etapa", () => {
    const { previous, next } = findUnitNeighbours(MODULES, "U0.1.1");

    expect(previous).toBeNull();
    expect(next?.code).toBe("U0.1.2");
  });

  it("no ofrece siguiente en la última unidad de la etapa", () => {
    const { previous, next } = findUnitNeighbours(MODULES, "U0.3.2");

    expect(previous?.code).toBe("U0.3.1");
    expect(next).toBeNull();
  });

  it("no inventa vecinos para un código que no está en la etapa", () => {
    const { previous, next } = findUnitNeighbours(MODULES, "U9.9.9");

    expect(previous).toBeNull();
    expect(next).toBeNull();
  });

  it("no inventa vecinos en una etapa sin unidades", () => {
    const { previous, next } = findUnitNeighbours([], "U0.1.1");

    expect(previous).toBeNull();
    expect(next).toBeNull();
  });
});

describe("resolvePrerequisites", () => {
  it("traduce los ids a unidades de la etapa y conserva el orden declarado", () => {
    const resolved = resolvePrerequisites(MODULES, [
      "id-U0.3.1",
      "id-U0.1.2",
    ]);

    expect(resolved.map((item) => item.code)).toEqual(["U0.3.1", "U0.1.2"]);
  });

  it("ignora ids que ya no están publicados en la etapa", () => {
    const resolved = resolvePrerequisites(MODULES, [
      "id-inexistente",
      "id-U0.1.1",
    ]);

    expect(resolved.map((item) => item.code)).toEqual(["U0.1.1"]);
  });

  it("no inventa prerrequisitos cuando la unidad no declara ninguno", () => {
    expect(resolvePrerequisites(MODULES, [])).toEqual([]);
  });
});
