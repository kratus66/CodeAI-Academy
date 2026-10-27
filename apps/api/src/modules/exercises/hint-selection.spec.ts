import { describe, expect, it } from "vitest";

import { selectHint } from "./hint-selection";

describe("selectHint — progresión obligatoria", () => {
  it("sirve el nivel 1 sin uso previo y avisa de que hay siguiente", () => {
    const result = selectHint({ requestedLevel: 1, availableLevels: [1, 2, 3], usedLevels: [] });

    expect(result).toEqual({ ok: true, nextLevelAvailable: true });
  });

  it("rechaza el nivel 2 si no se usó el 1", () => {
    const result = selectHint({ requestedLevel: 2, availableLevels: [1, 2, 3], usedLevels: [] });

    expect(result).toEqual({ ok: false, reason: "PROGRESSION_REQUIRED" });
  });

  it("rechaza el nivel 3 habiendo usado sólo el 1", () => {
    const result = selectHint({ requestedLevel: 3, availableLevels: [1, 2, 3], usedLevels: [1] });

    expect(result).toEqual({ ok: false, reason: "PROGRESSION_REQUIRED" });
  });

  it("rechaza el nivel 3 habiendo usado sólo el 2", () => {
    const result = selectHint({ requestedLevel: 3, availableLevels: [1, 2, 3], usedLevels: [2] });

    expect(result).toEqual({ ok: false, reason: "PROGRESSION_REQUIRED" });
  });

  it("sirve el nivel 3 habiendo usado 1 y 2, sin siguiente nivel", () => {
    const result = selectHint({
      requestedLevel: 3,
      availableLevels: [1, 2, 3],
      usedLevels: [1, 2],
    });

    expect(result).toEqual({ ok: true, nextLevelAvailable: false });
  });

  it("permite pedir el nivel 1 por segunda vez con el mismo resultado", () => {
    const first = selectHint({ requestedLevel: 1, availableLevels: [1, 2, 3], usedLevels: [] });
    const second = selectHint({ requestedLevel: 1, availableLevels: [1, 2, 3], usedLevels: [1] });

    expect(second.ok).toBe(true);
    expect(second).toEqual(first);
  });
});

describe("selectHint — disponibilidad", () => {
  it("devuelve NOT_AVAILABLE si el catálogo sólo tiene el nivel 1", () => {
    const result = selectHint({ requestedLevel: 2, availableLevels: [1], usedLevels: [1] });

    expect(result).toEqual({ ok: false, reason: "NOT_AVAILABLE" });
  });

  it.each([0, -1, 1.5, Number.NaN])("devuelve NOT_AVAILABLE para el nivel %s", (requestedLevel) => {
    const result = selectHint({ requestedLevel, availableLevels: [1, 2, 3], usedLevels: [1, 2] });

    expect(result).toEqual({ ok: false, reason: "NOT_AVAILABLE" });
  });

  it("marca nextLevelAvailable en false si el catálogo tiene un hueco", () => {
    const result = selectHint({ requestedLevel: 1, availableLevels: [1, 3], usedLevels: [] });

    expect(result).toEqual({ ok: true, nextLevelAvailable: false });
  });

  it("marca nextLevelAvailable en true si el siguiente nivel existe", () => {
    const result = selectHint({ requestedLevel: 1, availableLevels: [1, 2], usedLevels: [] });

    expect(result).toEqual({ ok: true, nextLevelAvailable: true });
  });
});

describe("selectHint — pureza", () => {
  it("no muta los arrays de entrada", () => {
    const availableLevels = [3, 1, 2];
    const usedLevels = [2, 1];

    selectHint({ requestedLevel: 3, availableLevels, usedLevels });

    expect(availableLevels).toEqual([3, 1, 2]);
    expect(usedLevels).toEqual([2, 1]);
  });
});
