import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import { canary, capabilities, estimate } from "./index.js";
import type { CostInput, PriceTableEntry } from "./index.js";

const storage: PriceTableEntry = {
  item: "almacenamiento",
  unit: "GB",
  pricePerUnitUsd: 0,
  tiers: [
    { from: 0, to: 100, pricePerUnitUsd: 0.5 },
    { from: 100, to: 400, pricePerUnitUsd: 0.25 },
    { from: 400, pricePerUnitUsd: 0.1 },
  ],
};

function invalid(value: unknown): CostInput {
  return value as CostInput;
}

describe("cost: contrato y aritmética", () => {
  it("expone capabilities, canario y registro en el arnés", () => {
    expect(capabilities.name).toBe("cost");
    expect(capabilities.modeled.length).toBeGreaterThan(0);
    expect(capabilities.notModeled.length).toBeGreaterThan(0);
    expect(canary()).toBe(true);
    expect(selfTest()).toBe(true);
    expect(aws.cost.estimate).toBe(estimate);
    expect(listCapabilities().some((item) => item.name === "cost")).toBe(true);
  });

  it("no acumula errores de coma flotante: 3 x 0,1 son exactamente 0,30 y 0,1 + 0,2 no da 0,30000000000000004", () => {
    const result = estimate({
      priceTable: [{ item: "a", unit: "u", pricePerUnitUsd: 0.1 }],
      usage: [{ item: "a", quantity: 3 }],
    });
    expect(result.totalUsd).toBe(0.3);
    const sum = estimate({
      priceTable: [
        { item: "a", unit: "u", pricePerUnitUsd: 0.1 },
        { item: "b", unit: "u", pricePerUnitUsd: 0.2 },
      ],
      usage: [
        { item: "a", quantity: 1 },
        { item: "b", quantity: 1 },
      ],
    });
    expect(sum.totalUsd).toBe(0.3);
  });

  it("redondea cada línea a céntimos con la mitad hacia arriba", () => {
    const table = [{ item: "a", unit: "u", pricePerUnitUsd: 1 }];
    expect(estimate({ priceTable: table, usage: [{ item: "a", quantity: 0.005 }] }).totalUsd).toBe(0.01);
    expect(estimate({ priceTable: table, usage: [{ item: "a", quantity: 0.0049 }] }).totalUsd).toBe(0);
    expect(estimate({ priceTable: table, usage: [{ item: "a", quantity: 1.005 }] }).totalUsd).toBe(1.01);
    expect(estimate({ priceTable: table, usage: [{ item: "a", quantity: 2.675 }] }).totalUsd).toBe(2.68);
  });

  it("el total es la suma de las líneas ya redondeadas", () => {
    const result = estimate({
      priceTable: [
        { item: "a", unit: "u", pricePerUnitUsd: 0.004 },
        { item: "b", unit: "u", pricePerUnitUsd: 0.004 },
      ],
      usage: [
        { item: "a", quantity: 1 },
        { item: "b", quantity: 1 },
      ],
    });
    expect(result.lines.map((line) => line.subtotalUsd)).toEqual([0, 0]);
    expect(result.totalUsd).toBe(0);
  });

  it("el nivel gratuito se descuenta de la cantidad y nunca deja la cantidad facturable por debajo de cero", () => {
    const table = [{ item: "a", unit: "u", pricePerUnitUsd: 2, freeTierQuantity: 100 }];
    const partly = estimate({ priceTable: table, usage: [{ item: "a", quantity: 130 }] });
    expect(partly.lines).toEqual([
      { item: "a", quantity: 130, billableQuantity: 30, unitPriceUsd: 2, subtotalUsd: 60 },
    ]);
    const inside = estimate({ priceTable: table, usage: [{ item: "a", quantity: 40 }] });
    expect(inside.lines).toEqual([
      { item: "a", quantity: 40, billableQuantity: 0, unitPriceUsd: 2, subtotalUsd: 0 },
    ]);
    expect(inside.totalUsd).toBe(0);
  });

  it("los escalones por volumen generan una línea por tramo y el nivel gratuito se descuenta antes", () => {
    const result = estimate({ priceTable: [storage], usage: [{ item: "almacenamiento", quantity: 450 }] });
    expect(result.problems).toEqual([]);
    expect(result.lines).toEqual([
      { item: "almacenamiento", quantity: 450, billableQuantity: 100, unitPriceUsd: 0.5, subtotalUsd: 50 },
      { item: "almacenamiento", quantity: 450, billableQuantity: 300, unitPriceUsd: 0.25, subtotalUsd: 75 },
      { item: "almacenamiento", quantity: 450, billableQuantity: 50, unitPriceUsd: 0.1, subtotalUsd: 5 },
    ]);
    expect(result.totalUsd).toBe(130);

    const withFree = estimate({
      priceTable: [{ ...storage, freeTierQuantity: 50 }],
      usage: [{ item: "almacenamiento", quantity: 150 }],
    });
    expect(withFree.lines.map((line) => line.billableQuantity)).toEqual([100]);
    expect(withFree.totalUsd).toBe(50);
  });

  it("en el límite exacto de un escalón no se genera el tramo siguiente", () => {
    const result = estimate({ priceTable: [storage], usage: [{ item: "almacenamiento", quantity: 100 }] });
    expect(result.lines).toHaveLength(1);
    expect(result.totalUsd).toBe(50);
  });

  it("suma los usos repetidos de un mismo elemento y lo avisa", () => {
    const result = estimate({
      priceTable: [{ item: "a", unit: "u", pricePerUnitUsd: 1, freeTierQuantity: 5 }],
      usage: [
        { item: "a", quantity: 4 },
        { item: "a", quantity: 6 },
      ],
    });
    expect(result.lines).toHaveLength(1);
    expect(result.totalUsd).toBe(5);
    expect(result.problems).toEqual(["El uso de «a» aparece 2 veces; se suman las cantidades."]);
  });

  it("una cantidad cero no cuesta nada y un uso vacío da cero", () => {
    expect(estimate({ priceTable: [], usage: [] })).toEqual({ lines: [], totalUsd: 0, problems: [] });
    const zero = estimate({
      priceTable: [{ item: "a", unit: "u", pricePerUnitUsd: 1 }],
      usage: [{ item: "a", quantity: 0 }],
    });
    expect(zero.totalUsd).toBe(0);
    expect(zero.problems).toEqual([]);
  });

  it("es determinista y no modifica la entrada", () => {
    const input: CostInput = {
      priceTable: [storage],
      usage: [{ item: "almacenamiento", quantity: 250 }],
    };
    const copy = JSON.stringify(input);
    expect(estimate(input)).toEqual(estimate(input));
    expect(JSON.stringify(input)).toBe(copy);
  });
});

describe("cost: entradas inválidas (devuelve problemas, no lanza)", () => {
  it("un uso sin precio en la tabla", () => {
    const result = estimate({ priceTable: [], usage: [{ item: "s3", quantity: 1 }] });
    expect(result.problems).toEqual(["El uso «s3» no figura en la tabla de precios."]);
    expect(result.lines).toEqual([]);
    expect(result.totalUsd).toBe(0);
  });

  it("cantidades negativas, no finitas o de otro tipo", () => {
    const table = [{ item: "a", unit: "u", pricePerUnitUsd: 1 }];
    for (const quantity of [-1, Number.NaN, Number.POSITIVE_INFINITY, "3", null, 1e15]) {
      const result = estimate(invalid({ priceTable: table, usage: [{ item: "a", quantity }] }));
      expect(result.problems).toEqual(["La cantidad de «a» debe ser un número mayor o igual que cero."]);
      expect(result.totalUsd).toBe(0);
    }
  });

  it("precios y niveles gratuitos inválidos descartan solo ese elemento", () => {
    const result = estimate(
      invalid({
        priceTable: [
          { item: "malo", unit: "u", pricePerUnitUsd: -1 },
          { item: "gratis", unit: "u", pricePerUnitUsd: 1, freeTierQuantity: -5 },
          { item: "bueno", unit: "u", pricePerUnitUsd: 1 },
        ],
        usage: [
          { item: "malo", quantity: 1 },
          { item: "gratis", quantity: 1 },
          { item: "bueno", quantity: 2 },
        ],
      }),
    );
    expect(result.problems).toEqual([
      "El precio de «malo» debe ser un número mayor o igual que cero.",
      "El nivel gratuito de «gratis» debe ser un número mayor o igual que cero.",
    ]);
    expect(result.totalUsd).toBe(2);
  });

  it("entradas de la tabla mal formadas y elementos duplicados", () => {
    const result = estimate(
      invalid({
        priceTable: [
          null,
          { unit: "u", pricePerUnitUsd: 1 },
          { item: "sinUnidad", pricePerUnitUsd: 1 },
          { item: "a", unit: "u", pricePerUnitUsd: 1 },
          { item: "a", unit: "u", pricePerUnitUsd: 2 },
        ],
        usage: [{ item: "a", quantity: 1 }],
      }),
    );
    expect(result.problems).toEqual([
      "La entrada 1 de la tabla de precios no es un objeto válido.",
      "La entrada 2 de la tabla de precios no tiene un item válido.",
      "El precio de «sinUnidad» no indica la unidad (unit).",
      "El item «a» aparece más de una vez en la tabla de precios.",
    ]);
    expect(result.totalUsd).toBe(1);
  });

  it("usos mal formados", () => {
    const result = estimate(
      invalid({
        priceTable: [{ item: "a", unit: "u", pricePerUnitUsd: 1 }],
        usage: [null, { quantity: 1 }, { item: "", quantity: 1 }],
      }),
    );
    expect(result.problems).toEqual([
      "El uso 1 no tiene un item válido.",
      "El uso 2 no tiene un item válido.",
      "El uso 3 no tiene un item válido.",
    ]);
  });

  it("escalones con huecos, solapes, sin tramo abierto o desordenados", () => {
    const cases: [unknown[], string][] = [
      [[{ from: 10, pricePerUnitUsd: 1 }], "Los escalones de «a» deben empezar en 0 y ser contiguos: el escalón 1 no encaja."],
      [
        [
          { from: 0, to: 10, pricePerUnitUsd: 1 },
          { from: 20, pricePerUnitUsd: 1 },
        ],
        "Los escalones de «a» deben empezar en 0 y ser contiguos: el escalón 2 no encaja.",
      ],
      [[{ from: 0, to: 10, pricePerUnitUsd: 1 }], "El último escalón de «a» debe quedar abierto (sin to) para cubrir cualquier cantidad."],
      [
        [
          { from: 0, pricePerUnitUsd: 1 },
          { from: 10, pricePerUnitUsd: 1 },
        ],
        "Solo el último escalón de «a» puede quedar abierto (sin to).",
      ],
      [[{ from: 0, to: 0, pricePerUnitUsd: 1 }], "El escalón 1 de «a» termina antes de empezar."],
      [[{ from: 0, pricePerUnitUsd: -1 }], "El escalón 1 de «a» tiene valores no válidos (from, to o pricePerUnitUsd)."],
      [["x"], "El escalón 1 de «a» no es un objeto válido."],
      [[], "Los escalones de «a» deben ser una lista con al menos un escalón."],
    ];
    for (const [tiers, message] of cases) {
      const result = estimate(
        invalid({
          priceTable: [{ item: "a", unit: "u", pricePerUnitUsd: 1, tiers }],
          usage: [{ item: "a", quantity: 5 }],
        }),
      );
      expect(result.problems).toEqual([message]);
      expect(result.lines).toEqual([]);
      expect(result.totalUsd).toBe(0);
    }
  });

  it("entradas que no son objetos ni listas no lanzan excepciones", () => {
    for (const value of [null, undefined, 3, "x", [], {}, { priceTable: [] }, { usage: [] }, { priceTable: {}, usage: {} }]) {
      const result = estimate(invalid(value));
      expect(result.problems).toEqual(["La entrada debe incluir priceTable y usage como listas."]);
      expect(result.totalUsd).toBe(0);
    }
  });
});
