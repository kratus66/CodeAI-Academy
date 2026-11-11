import { describe, expect, it } from "vitest";
import { estimate } from "./index.js";
import type { PriceTableEntry } from "./index.js";

const COMPUTE_PRICE = 0.0000166667;

function totals(result: ReturnType<typeof estimate>): number[] {
  return result.lines.map((line) => line.subtotalUsd);
}

describe("cost: ejemplos de cálculo de la página oficial de precios de AWS Lambda (leída el 2026-11-11, región US East N. Virginia)", () => {
  // Fuente: https://aws.amazon.com/lambda/pricing/ (Pricing, Example 1: Mobile application backend)
  it("ejemplo 1, backend de una aplicación móvil: 140 000 GB-s facturables y 2 M de solicitudes facturables suman 2,73 USD", () => {
    const priceTable: PriceTableEntry[] = [
      { item: "compute", unit: "GB-s", pricePerUnitUsd: COMPUTE_PRICE, freeTierQuantity: 400000 },
      { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2, freeTierQuantity: 1 },
    ];
    const result = estimate({
      priceTable,
      usage: [
        { item: "compute", quantity: 540000 },
        { item: "requests", quantity: 3 },
      ],
    });
    expect(result.problems).toEqual([]);
    expect(result.lines[0]?.billableQuantity).toBe(140000);
    expect(result.lines[1]?.billableQuantity).toBe(2);
    expect(totals(result)).toEqual([2.33, 0.4]);
    expect(result.totalUsd).toBe(2.73);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (Pricing, Example 2: Enriching streaming telemetry with additional metadata)
  it("ejemplo 2, telemetría en streaming: 7,44 M de solicitudes y 14,88 M de GB-s suman 249,49 USD", () => {
    const result = estimate({
      priceTable: [
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2 },
        { item: "compute", unit: "GB-s", pricePerUnitUsd: COMPUTE_PRICE },
      ],
      usage: [
        { item: "requests", quantity: 7.44 },
        { item: "compute", quantity: 14880000 },
      ],
    });
    expect(totals(result)).toEqual([1.49, 248]);
    expect(result.totalUsd).toBe(249.49);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (Pricing, Example 3: Performing ML on customer support tickets)
  it("ejemplo 3, inferencia de ML con almacenamiento efímero: 105,33 + 1,00 + 0,08 = 106,41 USD", () => {
    const result = estimate({
      priceTable: [
        { item: "compute", unit: "GB-s", pricePerUnitUsd: COMPUTE_PRICE, freeTierQuantity: 400000 },
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2, freeTierQuantity: 1 },
        { item: "ephemeral", unit: "GB-s", pricePerUnitUsd: 0.0000000309 },
      ],
      usage: [
        { item: "compute", quantity: 6720000 },
        { item: "requests", quantity: 6 },
        { item: "ephemeral", quantity: 2520000 },
      ],
    });
    expect(result.lines[0]?.billableQuantity).toBe(6320000);
    expect(result.lines[1]?.billableQuantity).toBe(5);
    expect(totals(result)).toEqual([105.33, 1, 0.08]);
    expect(result.totalUsd).toBe(106.41);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (Provisioned Concurrency Pricing, Example 1: Mobile application launch)
  it("Provisioned Concurrency, ejemplo 1: 18 + 0,40 + 0,73 + 0,83 = 19,96 USD", () => {
    const result = estimate({
      priceTable: [
        { item: "provisioned", unit: "GB-s", pricePerUnitUsd: 0.0000041667 },
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2, freeTierQuantity: 1 },
        { item: "computePc", unit: "GB-s", pricePerUnitUsd: 0.0000097222 },
        { item: "compute", unit: "GB-s", pricePerUnitUsd: COMPUTE_PRICE, freeTierQuantity: 400000 },
      ],
      usage: [
        { item: "provisioned", quantity: 4320000 },
        { item: "requests", quantity: 3 },
        { item: "computePc", quantity: 75000 },
        { item: "compute", quantity: 450000 },
      ],
    });
    expect(totals(result)).toEqual([18, 0.4, 0.73, 0.83]);
    expect(result.totalUsd).toBe(19.96);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (Provisioned Concurrency Pricing, Example 2: Routing customers during Cyber Monday)
  it("Provisioned Concurrency, ejemplo 2: 10,08 + 21,78 + 0,40 = 32,26 USD", () => {
    const result = estimate({
      priceTable: [
        { item: "provisioned", unit: "GB-s", pricePerUnitUsd: 0.0000041667 },
        { item: "computePc", unit: "GB-s", pricePerUnitUsd: 0.0000097222 },
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2 },
      ],
      usage: [
        { item: "provisioned", quantity: 2419200 },
        { item: "computePc", quantity: 2240000 },
        { item: "requests", quantity: 2 },
      ],
    });
    expect(totals(result)).toEqual([10.08, 21.78, 0.4]);
    expect(result.totalUsd).toBe(32.26);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (HTTP response streaming, Pricing Example: Streaming Server Side Rendered Web Content)
  it("respuesta en streaming: la página suma las líneas ya redondeadas (30,83 + 0,40 + 7,81 = 39,04), no el total exacto (39,05)", () => {
    const result = estimate({
      priceTable: [
        { item: "compute", unit: "GB-s", pricePerUnitUsd: COMPUTE_PRICE, freeTierQuantity: 400000 },
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2, freeTierQuantity: 1 },
        { item: "streamed", unit: "GB", pricePerUnitUsd: 0.008 },
      ],
      usage: [
        { item: "compute", quantity: 2250000 },
        { item: "requests", quantity: 3 },
        { item: "streamed", quantity: 976.56 },
      ],
    });
    expect(result.lines[0]?.billableQuantity).toBe(1850000);
    expect(totals(result)).toEqual([30.83, 0.4, 7.81]);
    expect(result.totalUsd).toBe(39.04);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (Provisioned Mode for Event Source Mapping, Pricing Example 2: Amazon SQS)
  it("Provisioned Mode para SQS: 500 + 6 + 74 = 580 USD", () => {
    const result = estimate({
      priceTable: [
        { item: "compute", unit: "GB-s", pricePerUnitUsd: COMPUTE_PRICE },
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2 },
        { item: "epu", unit: "EPU-hora", pricePerUnitUsd: 0.00925 },
      ],
      usage: [
        { item: "compute", quantity: 30000000 },
        { item: "requests", quantity: 30 },
        { item: "epu", quantity: 8000 },
      ],
    });
    expect(totals(result)).toEqual([500, 6, 74]);
    expect(result.totalUsd).toBe(580);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (Provisioned Mode for Event Source Mapping, Pricing Example 3: multiple Kafka ESMs)
  it("Provisioned Mode con 10 ESM de Kafka: 1 000 + 60 + 133,20 = 1 193,20 USD", () => {
    const result = estimate({
      priceTable: [
        { item: "compute", unit: "GB-s", pricePerUnitUsd: COMPUTE_PRICE },
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2 },
        { item: "epu", unit: "EPU-hora", pricePerUnitUsd: 0.185 },
      ],
      usage: [
        { item: "compute", quantity: 60000000 },
        { item: "requests", quantity: 300 },
        { item: "epu", quantity: 720 },
      ],
    });
    expect(totals(result)).toEqual([1000, 60, 133.2]);
    expect(result.totalUsd).toBe(1193.2);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (Lambda durable functions, Pricing Example: insurance claim processing)
  it("funciones durables: 421,34 + 0,20 + 32,00 + 26,00 + 10,92 = 490,46 USD", () => {
    const result = estimate({
      priceTable: [
        { item: "compute", unit: "GB-s", pricePerUnitUsd: 0.0000133334, freeTierQuantity: 400000 },
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2, freeTierQuantity: 1 },
        { item: "operations", unit: "millón de operaciones", pricePerUnitUsd: 8 },
        { item: "written", unit: "GB", pricePerUnitUsd: 0.25 },
        { item: "retained", unit: "GB-mes", pricePerUnitUsd: 0.15 },
      ],
      usage: [
        { item: "compute", quantity: 32000000 },
        { item: "requests", quantity: 2 },
        { item: "operations", quantity: 4 },
        { item: "written", quantity: 104 },
        { item: "retained", quantity: 72.8 },
      ],
    });
    expect(result.lines[0]?.billableQuantity).toBe(31600000);
    expect(totals(result)).toEqual([421.34, 0.2, 32, 26, 10.92]);
    expect(result.totalUsd).toBe(490.46);
  });

  // Fuente: https://aws.amazon.com/lambda/pricing/ (Lambda Managed Instances, Pricing Example: High-throughput API service)
  it("Lambda Managed Instances: 20 + 91,40 + 48,96 = 160,36 USD", () => {
    const result = estimate({
      priceTable: [
        { item: "requests", unit: "millón de solicitudes", pricePerUnitUsd: 0.2 },
        { item: "instance", unit: "hora", pricePerUnitUsd: 0.0457 },
        { item: "management", unit: "hora", pricePerUnitUsd: 0.02448 },
      ],
      usage: [
        { item: "requests", quantity: 100 },
        { item: "instance", quantity: 2000 },
        { item: "management", quantity: 2000 },
      ],
    });
    expect(totals(result)).toEqual([20, 91.4, 48.96]);
    expect(result.totalUsd).toBe(160.36);
  });
});
