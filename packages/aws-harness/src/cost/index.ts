import type { EvaluatorCapabilities } from "../core.js";
import { isRecord } from "../iam/matching.js";

export const capabilities: EvaluatorCapabilities = {
  name: "cost",
  version: "0.1.0",
  modeled: [
    "Cálculo con la tabla de precios que trae el enunciado: el evaluador no conoce ningún precio de AWS, porque los precios cambian y cada ejemplo publicado indica los suyos",
    "Cada línea es cantidad facturable por precio unitario, con la cantidad facturable igual a la cantidad usada menos el nivel gratuito (freeTierQuantity), sin bajar de cero",
    "Escalones por volumen opcionales (from, to, pricePerUnitUsd) sobre la cantidad facturable: cada tramo se factura a su precio y genera su propia línea",
    "Aritmética exacta en decimal (enteros de 10^-12 USD y BigInt), sin errores de coma flotante",
    "Redondeo a céntimos de dólar, mitad hacia arriba, aplicado a cada línea; el total es la suma de las líneas ya redondeadas, como en los ejemplos de cálculo de las páginas oficiales de precios",
    "Entradas inválidas (uso sin precio, cantidades negativas o no finitas, tabla mal formada, escalones con huecos) se informan en problems en español, sin lanzar excepciones",
  ],
  notModeled: [
    "Los precios, las regiones, las monedas y los descuentos de AWS (Savings Plans, Reserved Instances, créditos, precios por volumen de cuenta u Organizations): solo cuenta la tabla del enunciado",
    "Impuestos, transferencia de datos y cualquier concepto que la tabla no incluya como elemento",
    "Conversión de unidades (por ejemplo MB a GB o milisegundos a segundos): las cantidades de uso deben venir ya en la unidad de la tabla; el enunciado indica cómo calcularlas",
    "Precios o cantidades con más de 12 decimales (se redondean a 12 decimales) y valores de 10^15 o más (se rechazan)",
    "Periodos de facturación, prorrateo y mínimos de facturación: la cantidad de uso ya debe incluirlos",
  ],
  sources: ["https://aws.amazon.com/lambda/pricing/"],
};

export interface PriceTier {
  readonly from: number;
  readonly to?: number | null;
  readonly pricePerUnitUsd: number;
}

export interface PriceTableEntry {
  readonly item: string;
  readonly unit: string;
  readonly pricePerUnitUsd: number;
  readonly freeTierQuantity?: number;
  readonly tiers?: readonly PriceTier[];
}

export interface UsageEntry {
  readonly item: string;
  readonly quantity: number;
}

export interface CostInput {
  readonly priceTable: readonly PriceTableEntry[];
  readonly usage: readonly UsageEntry[];
}

export interface CostLine {
  readonly item: string;
  readonly quantity: number;
  readonly billableQuantity: number;
  readonly unitPriceUsd: number;
  readonly subtotalUsd: number;
}

export interface CostEstimate {
  readonly lines: CostLine[];
  readonly totalUsd: number;
  readonly problems: string[];
}

const DECIMALS = 12;
const SCALE = 10n ** BigInt(DECIMALS);
const CENT_DIVISOR = 10n ** BigInt(2 * DECIMALS - 2);
const MAX_ABS = 1e15;

function toScaled(value: unknown): bigint | null {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) >= MAX_ABS) {
    return null;
  }
  const negative = value < 0;
  const [whole = "0", fraction = ""] = Math.abs(value).toFixed(DECIMALS).split(".");
  const scaled = BigInt(whole) * SCALE + BigInt(fraction.padEnd(DECIMALS, "0"));
  return negative ? -scaled : scaled;
}

function fromScaled(value: bigint): number {
  const digits = value.toString().padStart(DECIMALS + 1, "0");
  const cut = digits.length - DECIMALS;
  return Number(`${digits.slice(0, cut)}.${digits.slice(cut)}`);
}

function centsOf(product: bigint): bigint {
  return (product + CENT_DIVISOR / 2n) / CENT_DIVISOR;
}

function usdOf(cents: bigint): number {
  const digits = cents.toString().padStart(3, "0");
  return Number(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
}

interface Segment {
  readonly from: bigint;
  readonly to: bigint | null;
  readonly price: bigint;
  readonly priceUsd: number;
}

interface ValidEntry {
  readonly item: string;
  readonly free: bigint;
  readonly segments: readonly Segment[];
}

function buildTierSegments(item: string, tiers: readonly unknown[], problems: string[]): Segment[] | null {
  const segments: Segment[] = [];
  let expectedFrom = 0n;
  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    const position = index + 1;
    if (!isRecord(tier)) {
      problems.push(`El escalón ${position} de «${item}» no es un objeto válido.`);
      return null;
    }
    const from = toScaled(tier.from);
    const price = toScaled(tier.pricePerUnitUsd);
    const open = tier.to === undefined || tier.to === null;
    const to = open ? null : toScaled(tier.to);
    if (from === null || from < 0n || price === null || price < 0n || (!open && to === null)) {
      problems.push(`El escalón ${position} de «${item}» tiene valores no válidos (from, to o pricePerUnitUsd).`);
      return null;
    }
    if (from !== expectedFrom) {
      problems.push(`Los escalones de «${item}» deben empezar en 0 y ser contiguos: el escalón ${position} no encaja.`);
      return null;
    }
    if (to !== null && to <= from) {
      problems.push(`El escalón ${position} de «${item}» termina antes de empezar.`);
      return null;
    }
    if (to === null && index !== tiers.length - 1) {
      problems.push(`Solo el último escalón de «${item}» puede quedar abierto (sin to).`);
      return null;
    }
    segments.push({ from, to, price, priceUsd: tier.pricePerUnitUsd as number });
    expectedFrom = to ?? expectedFrom;
  }
  const last = segments[segments.length - 1];
  if (last !== undefined && last.to !== null) {
    problems.push(`El último escalón de «${item}» debe quedar abierto (sin to) para cubrir cualquier cantidad.`);
    return null;
  }
  return segments;
}

function buildEntry(raw: unknown, index: number, problems: string[]): ValidEntry | null {
  if (!isRecord(raw)) {
    problems.push(`La entrada ${index + 1} de la tabla de precios no es un objeto válido.`);
    return null;
  }
  const item = raw.item;
  if (typeof item !== "string" || item.trim() === "") {
    problems.push(`La entrada ${index + 1} de la tabla de precios no tiene un item válido.`);
    return null;
  }
  if (typeof raw.unit !== "string" || raw.unit.trim() === "") {
    problems.push(`El precio de «${item}» no indica la unidad (unit).`);
    return null;
  }
  const free = raw.freeTierQuantity === undefined ? 0n : toScaled(raw.freeTierQuantity);
  if (free === null || free < 0n) {
    problems.push(`El nivel gratuito de «${item}» debe ser un número mayor o igual que cero.`);
    return null;
  }
  if (raw.tiers !== undefined && raw.tiers !== null) {
    if (!Array.isArray(raw.tiers) || raw.tiers.length === 0) {
      problems.push(`Los escalones de «${item}» deben ser una lista con al menos un escalón.`);
      return null;
    }
    const segments = buildTierSegments(item, raw.tiers as readonly unknown[], problems);
    return segments === null ? null : { item, free, segments };
  }
  const price = toScaled(raw.pricePerUnitUsd);
  if (price === null || price < 0n) {
    problems.push(`El precio de «${item}» debe ser un número mayor o igual que cero.`);
    return null;
  }
  return { item, free, segments: [{ from: 0n, to: null, price, priceUsd: raw.pricePerUnitUsd as number }] };
}

export function estimate(input: CostInput): CostEstimate {
  const problems: string[] = [];
  const lines: CostLine[] = [];
  const raw: unknown = input;
  if (!isRecord(raw) || !Array.isArray(raw.priceTable) || !Array.isArray(raw.usage)) {
    problems.push("La entrada debe incluir priceTable y usage como listas.");
    return { lines, totalUsd: 0, problems };
  }

  const table = new Map<string, ValidEntry>();
  const invalidItems = new Set<string>();
  (raw.priceTable as readonly unknown[]).forEach((entry, index) => {
    const item = isRecord(entry) && typeof entry.item === "string" ? entry.item : null;
    if (item !== null && (table.has(item) || invalidItems.has(item))) {
      problems.push(`El item «${item}» aparece más de una vez en la tabla de precios.`);
      return;
    }
    const built = buildEntry(entry, index, problems);
    if (built !== null) {
      table.set(built.item, built);
    } else if (item !== null) {
      invalidItems.add(item);
    }
  });

  const quantities = new Map<string, { quantity: bigint; count: number }>();
  (raw.usage as readonly unknown[]).forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.item !== "string" || entry.item.trim() === "") {
      problems.push(`El uso ${index + 1} no tiene un item válido.`);
      return;
    }
    const item = entry.item;
    const quantity = toScaled(entry.quantity);
    if (quantity === null || quantity < 0n) {
      problems.push(`La cantidad de «${item}» debe ser un número mayor o igual que cero.`);
      return;
    }
    if (invalidItems.has(item)) {
      return;
    }
    if (!table.has(item)) {
      problems.push(`El uso «${item}» no figura en la tabla de precios.`);
      return;
    }
    const previous = quantities.get(item);
    quantities.set(item, {
      quantity: (previous?.quantity ?? 0n) + quantity,
      count: (previous?.count ?? 0) + 1,
    });
  });

  let totalCents = 0n;
  for (const [item, used] of quantities) {
    const entry = table.get(item);
    if (entry === undefined) {
      continue;
    }
    if (used.count > 1) {
      problems.push(`El uso de «${item}» aparece ${used.count} veces; se suman las cantidades.`);
    }
    const billable = used.quantity > entry.free ? used.quantity - entry.free : 0n;
    let emitted = false;
    for (const segment of entry.segments) {
      if (billable <= segment.from) {
        continue;
      }
      const upper = segment.to !== null && billable > segment.to ? segment.to : billable;
      const inSegment = upper - segment.from;
      const cents = centsOf(inSegment * segment.price);
      totalCents += cents;
      emitted = true;
      lines.push({
        item,
        quantity: fromScaled(used.quantity),
        billableQuantity: fromScaled(inSegment),
        unitPriceUsd: segment.priceUsd,
        subtotalUsd: usdOf(cents),
      });
    }
    if (!emitted) {
      const first = entry.segments[0];
      lines.push({
        item,
        quantity: fromScaled(used.quantity),
        billableQuantity: 0,
        unitPriceUsd: first === undefined ? 0 : first.priceUsd,
        subtotalUsd: 0,
      });
    }
  }
  return { lines, totalUsd: usdOf(totalCents), problems };
}

export function canary(): boolean {
  const lambda = estimate({
    priceTable: [
      { item: "compute", unit: "GB-s", pricePerUnitUsd: 0.0000166667, freeTierQuantity: 400000 },
      { item: "requests", unit: "millón", pricePerUnitUsd: 0.2, freeTierQuantity: 1 },
    ],
    usage: [
      { item: "compute", quantity: 540000 },
      { item: "requests", quantity: 3 },
    ],
  });
  const tiered = estimate({
    priceTable: [
      {
        item: "almacenamiento",
        unit: "GB",
        pricePerUnitUsd: 0,
        tiers: [
          { from: 0, to: 100, pricePerUnitUsd: 0.5 },
          { from: 100, pricePerUnitUsd: 0.25 },
        ],
      },
    ],
    usage: [{ item: "almacenamiento", quantity: 150 }],
  });
  const missing = estimate({ priceTable: [], usage: [{ item: "x", quantity: 1 }] });
  return (
    lambda.totalUsd === 2.73 &&
    lambda.problems.length === 0 &&
    tiered.totalUsd === 62.5 &&
    tiered.lines.length === 2 &&
    missing.problems.length === 1 &&
    missing.totalUsd === 0
  );
}
