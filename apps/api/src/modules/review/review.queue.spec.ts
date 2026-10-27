import { describe, expect, it } from "vitest";

import {
  MIN_INTERLEAVED_RATIO,
  distinctAdjacentRatio,
  interleaveByConcept,
} from "./review.queue";

const item = (id: string, concept: string) => ({ id, concept });

describe("interleaveByConcept", () => {
  it("devuelve una cola vacía o de un solo ítem sin tocarla", () => {
    expect(interleaveByConcept([])).toEqual([]);
    expect(interleaveByConcept([item("a", "promesas")])).toEqual([
      item("a", "promesas"),
    ]);
  });

  it("conserva la cola intacta cuando todos los ítems comparten concepto", () => {
    const items = [item("a1", "promesas"), item("a2", "promesas")];

    expect(interleaveByConcept(items)).toEqual(items);
  });

  it("alterna dos conceptos y respeta el orden relativo de cada uno", () => {
    const result = interleaveByConcept([
      item("a1", "promesas"),
      item("a2", "promesas"),
      item("a3", "promesas"),
      item("b1", "funciones"),
      item("b2", "funciones"),
    ]);

    expect(result.map((entry) => entry.id)).toEqual([
      "a1",
      "b1",
      "a2",
      "b2",
      "a3",
    ]);
    expect(distinctAdjacentRatio(result)).toBeGreaterThanOrEqual(
      MIN_INTERLEAVED_RATIO,
    );
  });

  it("mantiene al menos el 30 % de parejas distintas con tres conceptos desiguales", () => {
    const source = [
      ...Array.from({ length: 6 }, (_, index) => item(`a${index}`, "promesas")),
      ...Array.from({ length: 2 }, (_, index) => item(`b${index}`, "funciones")),
      item("c0", "errores"),
    ];

    const result = interleaveByConcept(source);
    const positions = new Map(source.map((entry, index) => [entry.id, index]));

    expect(result).toHaveLength(source.length);
    expect(distinctAdjacentRatio(result)).toBeGreaterThanOrEqual(
      MIN_INTERLEAVED_RATIO,
    );

    for (const concept of ["promesas", "funciones", "errores"]) {
      const order = result
        .filter((entry) => entry.concept === concept)
        .map((entry) => positions.get(entry.id) ?? -1);
      const sorted = [...order].sort((left, right) => left - right);

      expect(order).toEqual(sorted);
    }
  });

  it("no muta la colección de entrada", () => {
    const items = [item("a1", "promesas"), item("b1", "funciones")];
    const snapshot = [...items];

    interleaveByConcept(items);

    expect(items).toEqual(snapshot);
  });
});

describe("distinctAdjacentRatio", () => {
  it("vale 0 con menos de dos ítems y 1 con conceptos alternos", () => {
    expect(distinctAdjacentRatio([])).toBe(0);
    expect(distinctAdjacentRatio([item("a", "x")])).toBe(0);
    expect(
      distinctAdjacentRatio([
        item("a", "x"),
        item("b", "y"),
        item("c", "x"),
      ]),
    ).toBe(1);
  });
});
