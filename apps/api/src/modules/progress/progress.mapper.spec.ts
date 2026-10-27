import { describe, expect, it } from "vitest";

import {
  toCompetencyProgress,
  toProgressUnitRow,
  toUnitProgressRecord,
  toUnitProgressSummary,
} from "./progress.mapper";
import type { ProgressUnitRow, UnitProgressRecord } from "./progress.repository";

const unit: ProgressUnitRow = {
  id: "unit-1",
  code: "U1.1.1",
  stageId: 1,
  moduleCode: "M1.1",
  order: 1,
  prerequisiteCodes: [],
  lessonsTotal: 2,
};

const record: UnitProgressRecord = {
  unitId: "unit-1",
  state: "IN_PROGRESS",
  progressPct: 50,
  lessonsDone: 1,
  exercisesDone: 3,
  bestScore: 88.5,
  completedLessonIds: ["lesson-1"],
  lastActivityAt: new Date("2026-10-20T10:00:00.000Z"),
  completedAt: null,
};

describe("toProgressUnitRow", () => {
  it("aplana el módulo y toma las lecciones publicadas como total", () => {
    expect(
      toProgressUnitRow({
        id: "unit-1",
        code: "U1.1.1",
        order: 2,
        prerequisiteIds: ["U1.0.1"],
        module: { code: "M1.1", stageId: 1 },
        _count: { lessons: 4 },
      }),
    ).toEqual({
      id: "unit-1",
      code: "U1.1.1",
      stageId: 1,
      moduleCode: "M1.1",
      order: 2,
      prerequisiteCodes: ["U1.0.1"],
      lessonsTotal: 4,
    });
  });

  it("copia los prerrequisitos para no compartir el arreglo de la fila", () => {
    const prerequisites = ["U1.0.1"];
    const row = toProgressUnitRow({
      id: "unit-1",
      code: "U1.1.1",
      order: 1,
      prerequisiteIds: prerequisites,
      module: { code: "M1.1", stageId: 1 },
      _count: { lessons: 0 },
    });

    prerequisites.push("U9.9.9");

    expect(row.prerequisiteCodes).toEqual(["U1.0.1"]);
  });
});

describe("toUnitProgressRecord", () => {
  it("conserva los valores guardados y copia la clave de idempotencia", () => {
    const lessonIds = ["lesson-1"];
    const mapped = toUnitProgressRecord({
      ...record,
      completedLessonIds: lessonIds,
    });

    lessonIds.push("lesson-2");

    expect(mapped).toEqual(record);
    expect(mapped.completedLessonIds).toEqual(["lesson-1"]);
  });
});

describe("toUnitProgressSummary", () => {
  it("sin fila guardada publica ceros y nulos", () => {
    expect(toUnitProgressSummary(unit, null, "AVAILABLE", 0)).toEqual({
      unitId: "unit-1",
      unitCode: "U1.1.1",
      state: "AVAILABLE",
      progressPct: 0,
      lessonsDone: 0,
      exercisesDone: 0,
      bestScore: null,
      lastActivityAt: null,
      completedAt: null,
    });
  });

  it("serializa las fechas a ISO y conserva el resto", () => {
    expect(toUnitProgressSummary(unit, record, "IN_PROGRESS", 50)).toEqual({
      unitId: "unit-1",
      unitCode: "U1.1.1",
      state: "IN_PROGRESS",
      progressPct: 50,
      lessonsDone: 1,
      exercisesDone: 3,
      bestScore: 88.5,
      lastActivityAt: "2026-10-20T10:00:00.000Z",
      completedAt: null,
    });
  });

  it("sirve el estado calculado, no el guardado", () => {
    const summary = toUnitProgressSummary(unit, { ...record, state: "LOCKED" }, "AVAILABLE", 0);

    expect(summary.state).toBe("AVAILABLE");
    expect(summary.progressPct).toBe(0);
  });
});

describe("toCompetencyProgress", () => {
  it("publica la competencia como code", () => {
    expect(
      toCompetencyProgress({ competency: "C4", level: 2, evidenceCount: 6 }),
    ).toEqual({ code: "C4", level: 2, evidenceCount: 6 });
  });
});
