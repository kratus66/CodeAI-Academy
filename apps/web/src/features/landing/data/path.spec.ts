import { describe, expect, it } from "vitest";

import {
  LEVELS,
  STAGES,
  TOTAL_HOURS_LABEL,
  stagesByLevel,
} from "@/features/landing/data/path";

describe("ruta curricular de la landing", () => {
  it("mantiene las 12 etapas del currículo maestro en orden", () => {
    expect(STAGES.map((stage) => stage.code)).toEqual([
      "E0",
      "E1",
      "E2",
      "E3",
      "E4",
      "E5",
      "E6",
      "E7",
      "E8",
      "E9",
      "E10",
      "E11",
    ]);
  });

  it("agrupa las etapas en cuatro niveles 4 + 4 + 3 + 1", () => {
    expect(LEVELS.map((level) => level.number)).toEqual([1, 2, 3, 4]);
    expect(stagesByLevel(1).map((stage) => stage.code)).toEqual([
      "E0",
      "E1",
      "E2",
      "E3",
    ]);
    expect(stagesByLevel(2).map((stage) => stage.code)).toEqual([
      "E4",
      "E5",
      "E6",
      "E7",
    ]);
    expect(stagesByLevel(3).map((stage) => stage.code)).toEqual([
      "E8",
      "E9",
      "E10",
    ]);
    expect(stagesByLevel(4).map((stage) => stage.code)).toEqual(["E11"]);

    const total = LEVELS.reduce(
      (count, level) => count + stagesByLevel(level.number).length,
      0,
    );
    expect(total).toBe(STAGES.length);
  });

  it("publica el rango de duración documentado", () => {
    expect(TOTAL_HOURS_LABEL).toBe("685–1.035 h");
  });

  it("referencia solo competencias existentes (C1–C10 obligatorias, C11–C14 avanzadas)", () => {
    const codes = STAGES.flatMap((stage) => stage.competencies);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(code).toMatch(/^C(1[0-4]|[1-9])$/);
    }
    expect(new Set(codes).size).toBe(14);
  });

  it("declara horas para todas las etapas", () => {
    for (const stage of STAGES) {
      expect(stage.hours).toMatch(/\d+\s*–\s*\d+\s*h/);
    }
  });
});
