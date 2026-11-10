import { describe, expect, it, vi } from "vitest";
import {
  deepFreeze,
} from "./core.js";
import type * as Core from "./core.js";
import type { EvaluatorCapabilities } from "./core.js";

function capabilitiesOf(name: string): EvaluatorCapabilities {
  return { name, version: "1.0.0", modeled: [], notModeled: [], sources: [] };
}

describe("deepFreeze", () => {
  it("congela objetos anidados", () => {
    const value = deepFreeze({ a: { b: { c: 1 } } });
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.a)).toBe(true);
    expect(Object.isFrozen(value.a.b)).toBe(true);
  });

  it("congela arrays y sus elementos", () => {
    const value = deepFreeze({ list: [{ x: 1 }, [2, 3]] });
    expect(Object.isFrozen(value.list)).toBe(true);
    expect(Object.isFrozen(value.list[0])).toBe(true);
    expect(Object.isFrozen(value.list[1])).toBe(true);
  });

  it("rechaza la mutación en modo estricto", () => {
    "use strict";
    const value = deepFreeze({ a: { n: 1 }, list: [1] });
    expect(() => {
      (value as { a: { n: number } }).a.n = 2;
    }).toThrow(TypeError);
    expect(() => {
      (value.list as number[]).push(2);
    }).toThrow(TypeError);
    expect(() => {
      delete (value as { a?: unknown }).a;
    }).toThrow(TypeError);
  });

  it("devuelve los primitivos y null sin cambios", () => {
    expect(deepFreeze(5)).toBe(5);
    expect(deepFreeze("a")).toBe("a");
    expect(deepFreeze(null)).toBeNull();
  });

  it("admite referencias circulares", () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(Object.isFrozen(deepFreeze(value))).toBe(true);
  });
});

describe("selfTest y registro", () => {
  async function loadCore(): Promise<typeof Core> {
    vi.resetModules();
    return import("./core.js");
  }

  it("es verdadero sin evaluadores", async () => {
    const core = await loadCore();
    expect(core.HARNESS_VERSION).toBe("0.1.0");
    expect(core.selfTest()).toBe(true);
    expect(core.listCapabilities()).toEqual([]);
  });

  it("es verdadero si todos los canarios devuelven true", async () => {
    const core = await loadCore();
    core.registerEvaluator({ capabilities: capabilitiesOf("ok"), canary: () => true });
    expect(core.selfTest()).toBe(true);
    expect(core.listCapabilities().map((c) => c.name)).toEqual(["ok"]);
  });

  it("es falso si un canario devuelve falso", async () => {
    const core = await loadCore();
    core.registerEvaluator({ capabilities: capabilitiesOf("a"), canary: () => true });
    core.registerEvaluator({ capabilities: capabilitiesOf("b"), canary: () => false });
    expect(core.selfTest()).toBe(false);
  });

  it("es falso si un canario lanza", async () => {
    const core = await loadCore();
    core.registerEvaluator({
      capabilities: capabilitiesOf("lanza"),
      canary: () => {
        throw new Error("fallo");
      },
    });
    expect(core.selfTest()).toBe(false);
  });
});
