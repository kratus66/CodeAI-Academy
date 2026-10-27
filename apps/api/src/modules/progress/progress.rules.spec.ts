import type { UnitState } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import {
  countUnitsByState,
  isPrerequisiteSatisfied,
  isUnitUnlocked,
  overallProgressPct,
  resolveUnitState,
  stateAfterLessonSeen,
  unitProgressPct,
} from "./progress.rules";

const unlock = (
  prerequisiteCodes: readonly string[],
  prerequisiteStates: Record<string, UnitState | undefined>,
) => ({ prerequisiteCodes, prerequisiteStates });

describe("isPrerequisiteSatisfied", () => {
  it("solo MASTERED cuenta como prerrequisito cumplido", () => {
    expect(isPrerequisiteSatisfied("MASTERED")).toBe(true);
    expect(isPrerequisiteSatisfied("NEEDS_REVIEW")).toBe(false);
    expect(isPrerequisiteSatisfied("IN_PROGRESS")).toBe(false);
    expect(isPrerequisiteSatisfied("AVAILABLE")).toBe(false);
    expect(isPrerequisiteSatisfied("LOCKED")).toBe(false);
  });

  it("un código desconocido no cumple", () => {
    expect(isPrerequisiteSatisfied(undefined)).toBe(false);
  });
});

describe("isUnitUnlocked", () => {
  it("una unidad sin prerrequisitos está desbloqueada", () => {
    expect(isUnitUnlocked(unlock([], {}))).toBe(true);
  });

  it("exige que todos los prerrequisitos estén MASTERED", () => {
    expect(
      isUnitUnlocked(unlock(["U1.1.1", "U1.1.2"], { "U1.1.1": "MASTERED", "U1.1.2": "MASTERED" })),
    ).toBe(true);
    expect(
      isUnitUnlocked(unlock(["U1.1.1", "U1.1.2"], { "U1.1.1": "MASTERED", "U1.1.2": "IN_PROGRESS" })),
    ).toBe(false);
    expect(isUnitUnlocked(unlock(["U1.1.1"], {}))).toBe(false);
  });
});

describe("resolveUnitState", () => {
  it("sin prerrequisitos y sin actividad se sirve AVAILABLE", () => {
    expect(resolveUnitState({ ...unlock([], {}), currentState: null })).toBe("AVAILABLE");
  });

  it("con un prerrequisito MASTERED se sirve AVAILABLE", () => {
    expect(
      resolveUnitState({
        ...unlock(["U1.1.1"], { "U1.1.1": "MASTERED" }),
        currentState: null,
      }),
    ).toBe("AVAILABLE");
  });

  it("con un prerrequisito pendiente se sirve LOCKED", () => {
    expect(
      resolveUnitState({
        ...unlock(["U1.1.1"], { "U1.1.1": "IN_PROGRESS" }),
        currentState: null,
      }),
    ).toBe("LOCKED");
  });

  it("un prerrequisito inexistente no desbloquea", () => {
    expect(
      resolveUnitState({ ...unlock(["U9.9.9"], {}), currentState: null }),
    ).toBe("LOCKED");
  });

  it("una fila LOCKED obsoleta se sirve AVAILABLE si ya cumple prerrequisitos", () => {
    expect(
      resolveUnitState({
        ...unlock(["U1.1.1"], { "U1.1.1": "MASTERED" }),
        currentState: "LOCKED",
      }),
    ).toBe("AVAILABLE");
  });

  it("conserva el estado de actividad cuando está desbloqueada", () => {
    const states: UnitState[] = ["IN_PROGRESS", "NEEDS_REVIEW", "MASTERED"];

    for (const currentState of states) {
      expect(resolveUnitState({ ...unlock([], {}), currentState })).toBe(currentState);
    }
  });

  it("el bloqueo manda sobre cualquier estado guardado", () => {
    expect(
      resolveUnitState({
        ...unlock(["U1.1.1"], { "U1.1.1": "NEEDS_REVIEW" }),
        currentState: "MASTERED",
      }),
    ).toBe("LOCKED");
  });
});

describe("unitProgressPct", () => {
  it("sin lecciones publicadas el avance es 0", () => {
    expect(unitProgressPct(0, 0)).toBe(0);
  });

  it("calcula la proporción de lecciones vistas", () => {
    expect(unitProgressPct(2, 4)).toBe(50);
    expect(unitProgressPct(1, 3)).toBe(33.3);
  });

  it("acota entre 0 y 100", () => {
    expect(unitProgressPct(10, 4)).toBe(100);
    expect(unitProgressPct(-2, 4)).toBe(0);
  });

  it("ignora valores no finitos", () => {
    expect(unitProgressPct(Number.NaN, 4)).toBe(0);
    expect(unitProgressPct(1, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("stateAfterLessonSeen", () => {
  it("pasa a IN_PROGRESS con avance y no acredita MASTERED", () => {
    expect(stateAfterLessonSeen("AVAILABLE", 25)).toBe("IN_PROGRESS");
    expect(stateAfterLessonSeen("AVAILABLE", 100)).toBe("IN_PROGRESS");
  });

  it("no degrada una unidad aprobada o en repaso", () => {
    expect(stateAfterLessonSeen("MASTERED", 100)).toBe("MASTERED");
    expect(stateAfterLessonSeen("NEEDS_REVIEW", 60)).toBe("NEEDS_REVIEW");
  });
});

describe("countUnitsByState", () => {
  it("pliega AVAILABLE en inProgress para no romper los cuatro campos del contrato", () => {
    const counts = countUnitsByState([
      { state: "MASTERED" },
      { state: "IN_PROGRESS" },
      { state: "AVAILABLE" },
      { state: "AVAILABLE" },
      { state: "NEEDS_REVIEW" },
      { state: "LOCKED" },
    ]);

    expect(counts).toEqual({ mastered: 1, inProgress: 3, needsReview: 1, locked: 1 });
  });

  it("sin unidades todos los contadores son 0", () => {
    expect(countUnitsByState([])).toEqual({
      mastered: 0,
      inProgress: 0,
      needsReview: 0,
      locked: 0,
    });
  });
});

describe("overallProgressPct", () => {
  it("es la media del avance de las unidades", () => {
    expect(overallProgressPct([{ progressPct: 100 }, { progressPct: 50 }, { progressPct: 0 }])).toBe(
      50,
    );
  });

  it("redondea a un decimal", () => {
    expect(overallProgressPct([{ progressPct: 33.3 }, { progressPct: 33.3 }, { progressPct: 33.4 }])).toBe(
      33.3,
    );
    expect(overallProgressPct([{ progressPct: 50 }, { progressPct: 0 }, { progressPct: 0 }])).toBe(
      16.7,
    );
  });

  it("sin unidades es 0", () => {
    expect(overallProgressPct([])).toBe(0);
  });
});
