import type { EvaluatorCapabilities } from "../core.js";

export interface ParsedCidr {
  network: string;
  prefix: number;
  first: string;
  last: string;
  size: number;
}

export interface SubnetPlan {
  vpc: string;
  subnets: { name: string; cidr: string }[];
}

interface Range {
  start: number;
  end: number;
  prefix: number;
}

const MIN_PREFIX = 16;
const MAX_PREFIX = 28;
const MAX_SPLIT_RESULTS = 65536;

const FORBIDDEN_VPC_RANGES: readonly { cidr: string; label: string }[] = [
  { cidr: "0.0.0.0/8", label: "0.0.0.0/8" },
  { cidr: "127.0.0.0/8", label: "127.0.0.0/8 (rango de loopback del host)" },
  { cidr: "169.254.0.0/16", label: "169.254.0.0/16 (rango de enlace local)" },
  { cidr: "224.0.0.0/4", label: "224.0.0.0/4 (rango multicast)" },
];

export const capabilities: EvaluatorCapabilities = {
  name: "cidr",
  version: "1.0.0",
  modeled: [
    "Análisis de bloques CIDR IPv4 y forma canónica (100.68.0.18/18 pasa a 100.68.0.0/18)",
    "Contención, solape y división de bloques IPv4",
    "Tamaño permitido de un CIDR de VPC y de una subred IPv4: de /16 a /28",
    "Rangos que no se pueden usar como CIDR de una VPC: 0.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16 y 224.0.0.0/4",
    "Cinco direcciones IPv4 reservadas por subred: las cuatro primeras y la última",
    "Plan de subredes: dentro de la VPC y sin solapes entre subredes",
  ],
  notModeled: [
    "IPv6",
    "CIDR secundarios de una VPC y sus restricciones de asociación",
    "Restricciones de rangos de direcciones al asociar CIDR que no están en la guía leída",
    "Conflictos con rutas existentes en las tablas de rutas de la VPC",
    "Cuotas de la VPC y requisitos propios de cada servicio de AWS",
    "Rangos importados con BYOIP, donde se pueden usar todas las direcciones",
    "División en más de 65536 bloques (split devuelve una lista vacía)",
  ],
  sources: [
    "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html",
    "https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html",
  ],
};

function parseOctet(text: string): number | null {
  if (!/^(0|[1-9][0-9]{0,2})$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return value <= 255 ? value : null;
}

function parseAddress(text: string): number | null {
  const parts = text.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    const octet = parseOctet(part);
    if (octet === null) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value;
}

function formatAddress(value: number): string {
  const octets: number[] = [];
  let rest = value;
  for (let index = 0; index < 4; index += 1) {
    octets.unshift(rest % 256);
    rest = Math.floor(rest / 256);
  }
  return octets.join(".");
}

function toRange(cidr: unknown): Range | null {
  if (typeof cidr !== "string") {
    return null;
  }
  const pieces = cidr.split("/");
  if (pieces.length !== 2) {
    return null;
  }
  const [addressText, prefixText] = pieces as [string, string];
  if (!/^(0|[1-9][0-9]?)$/.test(prefixText)) {
    return null;
  }
  const prefix = Number(prefixText);
  const address = parseAddress(addressText);
  if (address === null || prefix > 32) {
    return null;
  }
  const size = 2 ** (32 - prefix);
  const start = Math.floor(address / size) * size;
  return { start, end: start + size - 1, prefix };
}

function describe(cidr: unknown): string {
  return typeof cidr === "string" ? `«${cidr}»` : "el valor indicado";
}

function canonical(range: Range): string {
  return `${formatAddress(range.start)}/${range.prefix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parse(cidr: string): ParsedCidr | null {
  const range = toRange(cidr);
  if (range === null) {
    return null;
  }
  return {
    network: formatAddress(range.start),
    prefix: range.prefix,
    first: formatAddress(range.start),
    last: formatAddress(range.end),
    size: range.end - range.start + 1,
  };
}

export function contains(outer: string, inner: string): boolean {
  const a = toRange(outer);
  const b = toRange(inner);
  if (a === null || b === null) {
    return false;
  }
  return b.start >= a.start && b.end <= a.end;
}

export function overlaps(a: string, b: string): boolean {
  const first = toRange(a);
  const second = toRange(b);
  if (first === null || second === null) {
    return false;
  }
  return first.start <= second.end && second.start <= first.end;
}

export function split(cidr: string, newPrefix: number): string[] {
  const range = toRange(cidr);
  if (
    range === null ||
    typeof newPrefix !== "number" ||
    !Number.isInteger(newPrefix) ||
    newPrefix < range.prefix ||
    newPrefix > 32
  ) {
    return [];
  }
  const count = 2 ** (newPrefix - range.prefix);
  if (count > MAX_SPLIT_RESULTS) {
    return [];
  }
  const step = 2 ** (32 - newPrefix);
  const blocks: string[] = [];
  for (let index = 0; index < count; index += 1) {
    blocks.push(`${formatAddress(range.start + index * step)}/${newPrefix}`);
  }
  return blocks;
}

export function reservedAddresses(subnet: string): string[] {
  const range = toRange(subnet);
  if (range === null || range.prefix < MIN_PREFIX || range.prefix > MAX_PREFIX) {
    return [];
  }
  return [
    formatAddress(range.start),
    formatAddress(range.start + 1),
    formatAddress(range.start + 2),
    formatAddress(range.start + 3),
    formatAddress(range.end),
  ];
}

export function usableAddresses(subnet: string): number {
  const range = toRange(subnet);
  if (range === null) {
    return 0;
  }
  return Math.max(0, range.end - range.start + 1 - 5);
}

export function validateVpcCidr(cidr: string): string[] {
  const range = toRange(cidr);
  if (range === null) {
    return [`${describe(cidr)} no es un bloque CIDR IPv4 válido.`];
  }
  const problems: string[] = [];
  if (range.prefix < MIN_PREFIX || range.prefix > MAX_PREFIX) {
    problems.push(
      `El tamaño de ${describe(cidr)} no está permitido: el CIDR de una VPC debe estar entre /16 y /28.`,
    );
  }
  for (const forbidden of FORBIDDEN_VPC_RANGES) {
    if (contains(forbidden.cidr, canonical(range))) {
      problems.push(
        `${describe(cidr)} está dentro de ${forbidden.label}, un rango que no se puede usar en una VPC.`,
      );
    }
  }
  return problems;
}

export function validateSubnetPlan(plan: SubnetPlan): string[] {
  const input: unknown = plan;
  if (!isRecord(input) || !Array.isArray(input.subnets)) {
    return ["El plan debe indicar la VPC y una lista de subredes."];
  }
  const problems: string[] = [];
  const vpcRange = toRange(input.vpc);
  const vpcProblems =
    typeof input.vpc === "string"
      ? validateVpcCidr(input.vpc)
      : ["La VPC debe indicarse como un bloque CIDR IPv4 en texto."];
  for (const problem of vpcProblems) {
    problems.push(`VPC: ${problem}`);
  }

  const valid: { name: string; cidr: string }[] = [];
  const subnets: unknown[] = input.subnets;
  subnets.forEach((item, index) => {
    if (!isRecord(item)) {
      problems.push(`La subred ${index + 1} no tiene nombre ni CIDR.`);
      return;
    }
    const name =
      typeof item.name === "string" && item.name !== "" ? item.name : `${index + 1}`;
    const range = toRange(item.cidr);
    if (range === null || typeof item.cidr !== "string") {
      problems.push(
        `Subred ${name}: ${describe(item.cidr)} no es un bloque CIDR IPv4 válido.`,
      );
      return;
    }
    const cidr = item.cidr;
    if (range.prefix < MIN_PREFIX || range.prefix > MAX_PREFIX) {
      problems.push(
        `Subred ${name}: el tamaño de ${describe(cidr)} no está permitido; debe estar entre /16 y /28.`,
      );
    }
    if (vpcRange !== null && !(range.start >= vpcRange.start && range.end <= vpcRange.end)) {
      problems.push(`Subred ${name}: ${describe(cidr)} queda fuera del CIDR de la VPC.`);
    }
    valid.push({ name, cidr });
  });

  for (let i = 0; i < valid.length; i += 1) {
    for (let j = i + 1; j < valid.length; j += 1) {
      const a = valid[i];
      const b = valid[j];
      if (a !== undefined && b !== undefined && overlaps(a.cidr, b.cidr)) {
        problems.push(`Las subredes ${a.name} (${a.cidr}) y ${b.name} (${b.cidr}) se solapan.`);
      }
    }
  }
  return problems;
}

export function canary(): boolean {
  const parsed = parse("100.68.0.18/18");
  if (
    parsed === null ||
    parsed.network !== "100.68.0.0" ||
    parsed.prefix !== 18 ||
    parsed.last !== "100.68.63.255" ||
    parsed.size !== 16384
  ) {
    return false;
  }
  if (
    reservedAddresses("10.0.0.0/24").join(",") !==
    "10.0.0.0,10.0.0.1,10.0.0.2,10.0.0.3,10.0.0.255"
  ) {
    return false;
  }
  if (split("10.0.0.0/24", 25).join(",") !== "10.0.0.0/25,10.0.0.128/25") {
    return false;
  }
  return (
    validateVpcCidr("10.0.0.0/16").length === 0 &&
    validateVpcCidr("10.0.0.0/15").length > 0 &&
    validateVpcCidr("10.0.0.0/29").length > 0 &&
    overlaps("10.0.0.0/24", "10.0.0.128/25") &&
    !overlaps("10.0.0.0/25", "10.0.0.128/25") &&
    contains("10.0.0.0/16", "10.0.1.0/24")
  );
}
