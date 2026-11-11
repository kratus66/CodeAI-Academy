import type { EvaluatorCapabilities } from "../core.js";
import { contains, parse } from "../cidr/index.js";

export type Protocol = "tcp" | "udp" | "icmp" | "-1";
export type Direction = "inbound" | "outbound";

export interface Route {
  destination: string;
  target: string;
}

/** Regla de un security group. Solo permite; `cidr` es el origen (entrada) o el destino (salida). */
export interface SgRule {
  direction: Direction;
  protocol: Protocol;
  fromPort?: number;
  toPort?: number;
  cidr: string;
}

/** Regla de una NACL. `number` va de 1 a 32766; `"*"` es la regla final, que deniega. */
export interface NaclRule {
  direction: Direction;
  number: number | "*";
  action: "allow" | "deny";
  protocol: Protocol;
  fromPort?: number;
  toPort?: number;
  cidr: string;
}

/** Tráfico que se evalúa; `peer` es la dirección IPv4 del otro extremo. */
export interface Flow {
  direction: Direction;
  protocol: Protocol;
  port: number;
  peer: string;
}

/** Extremo de una conexión: una dirección IPv4 y los security groups asociados (solo dentro de la VPC). */
export interface Endpoint {
  ip: string;
  securityGroups?: readonly string[];
}

export interface SubnetModel {
  id: string;
  cidr: string;
  routes: Route[];
  nacl: NaclRule[];
}

export interface SecurityGroupModel {
  id: string;
  rules: SgRule[];
}

export interface VpcModel {
  cidr: string;
  subnets: SubnetModel[];
  securityGroups: SecurityGroupModel[];
}

export interface ConnectionRequest {
  from: Endpoint;
  to: Endpoint;
  protocol: Protocol;
  port: number;
  /** Puerto efímero del cliente para el tráfico de retorno. Por defecto, 49152. */
  clientPort?: number;
}

export interface ConnectionResult {
  allowed: boolean;
  reason: string;
  path: string[];
}

export const DEFAULT_CLIENT_PORT = 49152;

const MIN_RULE_NUMBER = 1;
const MAX_RULE_NUMBER = 32766;
const MAX_PORT = 65535;

export const capabilities: EvaluatorCapabilities = {
  name: "network",
  version: "0.1.0",
  modeled: [
    "Tabla de rutas: gana la ruta más específica (prefijo más largo) y la ruta local cubre el CIDR de la VPC",
    "Security groups: solo reglas de permitir, denegación implícita, varias reglas se agregan y son con estado (la respuesta vuelve sin regla)",
    "NACL: reglas de permitir y denegar, evaluadas en orden ascendente por número (1 a 32766), la primera coincidencia decide y la regla * deniega",
    "NACL sin estado: el tráfico de retorno se evalúa con las reglas de la dirección contraria, con el puerto efímero del cliente",
    "Las NACL se evalúan al entrar y salir de la subred, no dentro de la misma subred",
    "Conexión extremo a extremo en una sola VPC: ruta de ida, SG de salida, NACL de salida y de entrada, SG de entrada y NACL de retorno",
    "Protocolos tcp, udp, icmp y -1 (todos), con rangos de puertos para tcp y udp",
  ],
  notModeled: [
    "Transit Gateway",
    "Peering de VPC y conexiones entre varias VPC",
    "Listas de prefijos",
    "IPv6",
    "Endpoints de VPC (de interfaz y de puerta de enlace) y AWS PrivateLink",
    "Referencias de un security group a otro security group como origen o destino",
    "Tipos y códigos de ICMP (las reglas ICMP se tratan como todo el ICMP)",
    "Prioridad entre rutas estáticas, propagadas y de listas de prefijos con el mismo prefijo (gana la primera de la lista)",
    "Rutas blackhole, VPN, Direct Connect, interfaces de red e instancias como destino de ruta",
    "Traducción de direcciones públicas y elásticas: se usa la dirección que se indique en cada extremo",
    "Seguimiento de conexiones, tráfico que los SG y las NACL no filtran (DNS, DHCP, metadatos), balanceadores y firewalls",
    "Asociación de varias NACL o varias tablas de rutas: cada subred tiene una sola tabla y una sola NACL",
  ],
  sources: [
    "https://docs.aws.amazon.com/vpc/latest/userguide/route-tables-priority.html",
    "https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html",
    "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html",
    "https://docs.aws.amazon.com/vpc/latest/userguide/nacl-basics.html",
    "https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html",
    "https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs-records-examples.html",
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPort(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_PORT;
}

function isProtocol(value: unknown): value is Protocol {
  return value === "tcp" || value === "udp" || value === "icmp" || value === "-1";
}

function addressCidr(ip: unknown): string | null {
  if (typeof ip !== "string" || ip.includes("/")) {
    return null;
  }
  const candidate = `${ip}/32`;
  return parse(candidate) === null ? null : candidate;
}

function inCidr(cidr: unknown, ip: unknown): boolean {
  const address = addressCidr(ip);
  return typeof cidr === "string" && address !== null && contains(cidr, address);
}

function portsMatch(rule: Record<string, unknown>, protocol: Protocol, port: unknown): boolean {
  if (rule.protocol === "-1" || rule.protocol === "icmp") {
    return true;
  }
  if (protocol !== rule.protocol || !isPort(port)) {
    return false;
  }
  const { fromPort, toPort } = rule;
  return isPort(fromPort) && isPort(toPort) && fromPort <= port && port <= toPort;
}

function ruleMatches(rule: Record<string, unknown>, flow: Record<string, unknown>): boolean {
  if (!isProtocol(rule.protocol) || !isProtocol(flow.protocol)) {
    return false;
  }
  if (rule.protocol !== "-1" && rule.protocol !== flow.protocol) {
    return false;
  }
  return portsMatch(rule, flow.protocol, flow.port) && inCidr(rule.cidr, flow.peer);
}

/** Devuelve el destino de la ruta más específica que contiene `ip`, o `null` si ninguna aplica. */
export function routeFor(table: Route[], ip: string): string | null {
  const address = addressCidr(ip);
  if (address === null || !Array.isArray(table)) {
    return null;
  }
  let best: { prefix: number; target: string } | null = null;
  for (const route of table as unknown[]) {
    if (!isRecord(route) || typeof route.target !== "string" || typeof route.destination !== "string") {
      continue;
    }
    const parsed = parse(route.destination);
    if (parsed === null || !contains(route.destination, address)) {
      continue;
    }
    if (best === null || parsed.prefix > best.prefix) {
      best = { prefix: parsed.prefix, target: route.target };
    }
  }
  return best === null ? null : best.target;
}

/** Los security groups solo permiten: hay acceso si alguna regla de la dirección coincide. */
export function securityGroupAllows(rules: SgRule[], flow: Flow): boolean {
  const input: unknown = flow;
  if (!Array.isArray(rules) || !isRecord(input)) {
    return false;
  }
  return (rules as unknown[]).some(
    (rule) =>
      isRecord(rule) && rule.direction === input.direction && ruleMatches(rule, input),
  );
}

/** Evalúa las reglas de la dirección del flujo por número ascendente; la primera coincidencia decide. */
export function naclAllows(
  rules: NaclRule[],
  flow: Flow,
): { allowed: boolean; ruleNumber: number | "*" } {
  const input: unknown = flow;
  const fallback = { allowed: false, ruleNumber: "*" as const };
  if (!Array.isArray(rules) || !isRecord(input)) {
    return fallback;
  }
  const numbered: { number: number; rule: Record<string, unknown> }[] = [];
  for (const rule of rules as unknown[]) {
    if (!isRecord(rule) || rule.direction !== input.direction) {
      continue;
    }
    const number = rule.number;
    if (
      typeof number === "number" &&
      Number.isInteger(number) &&
      number >= MIN_RULE_NUMBER &&
      number <= MAX_RULE_NUMBER &&
      (rule.action === "allow" || rule.action === "deny")
    ) {
      numbered.push({ number, rule });
    }
  }
  numbered.sort((a, b) => a.number - b.number);
  for (const item of numbered) {
    if (ruleMatches(item.rule, input)) {
      return { allowed: item.rule.action === "allow", ruleNumber: item.number };
    }
  }
  return fallback;
}

function subnetOf(model: VpcModel, ip: string): SubnetModel | null {
  for (const subnet of model.subnets) {
    if (inCidr(subnet.cidr, ip)) {
      return subnet;
    }
  }
  return null;
}

function rulesOf(model: VpcModel, endpoint: Endpoint): SgRule[] | string {
  const rules: SgRule[] = [];
  for (const id of endpoint.securityGroups ?? []) {
    const group = model.securityGroups.find((item) => item.id === id);
    if (group === undefined) {
      return `El security group «${String(id)}» no existe en el modelo.`;
    }
    rules.push(...group.rules);
  }
  return rules;
}

function describeFlow(protocol: Protocol, port: number): string {
  return protocol === "tcp" || protocol === "udp" ? `${protocol}/${port}` : protocol;
}

function validModel(model: unknown): model is VpcModel {
  return (
    isRecord(model) &&
    typeof model.cidr === "string" &&
    parse(model.cidr) !== null &&
    Array.isArray(model.subnets) &&
    Array.isArray(model.securityGroups) &&
    (model.subnets as unknown[]).every(
      (subnet) =>
        isRecord(subnet) &&
        typeof subnet.id === "string" &&
        typeof subnet.cidr === "string" &&
        Array.isArray(subnet.routes) &&
        Array.isArray(subnet.nacl),
    ) &&
    (model.securityGroups as unknown[]).every(
      (group) => isRecord(group) && typeof group.id === "string" && Array.isArray(group.rules),
    )
  );
}

/**
 * Decide si `from` puede abrir una conexión hacia `to` y recibir la respuesta.
 *
 * Supone:
 * - una sola VPC, con una tabla de rutas y una NACL por subred;
 * - un IGW o un NAT gateway (destinos de ruta `igw-…` y `nat-…`) como salida a Internet; cualquier otro
 *   destino de ruta que no sea `local` se rechaza;
 * - un extremo cuya dirección no está en el CIDR de la VPC es un host de Internet; solo puede
 *   iniciar la conexión si la tabla de la subred de destino lo enruta por un IGW (un NAT no admite
 *   conexiones iniciadas desde fuera);
 * - la respuesta usa `clientPort` (puerto efímero del cliente, 49152 por defecto) hacia el cliente;
 * - los security groups de un extremo se agregan y los extremos de Internet no tienen SG ni NACL.
 *
 * Pasos: ruta de ida, SG de salida del origen (con estado), NACL de salida del origen, NACL de entrada
 * del destino, SG de entrada del destino y NACL de retorno (salida del destino y entrada del origen).
 * No se evalúan las NACL dentro de la misma subred. Lo demás está en `capabilities.notModeled`.
 */
export function canConnect(model: VpcModel, flow: ConnectionRequest): ConnectionResult {
  const path: string[] = [];
  const deny = (reason: string): ConnectionResult => ({ allowed: false, reason, path });
  const input: unknown = flow;
  if (
    !validModel(model) ||
    !isRecord(input) ||
    !isRecord(input.from) ||
    !isRecord(input.to) ||
    !isProtocol(input.protocol)
  ) {
    return deny("El modelo de la VPC o el flujo no tiene el formato esperado.");
  }
  const { from, to, protocol, port } = flow;
  if (addressCidr(from.ip) === null || addressCidr(to.ip) === null) {
    return deny("Las direcciones de origen y destino deben ser IPv4 válidas.");
  }
  if ((protocol === "tcp" || protocol === "udp") && !isPort(port)) {
    return deny("El puerto debe ser un entero entre 0 y 65535.");
  }
  const clientPort = flow.clientPort ?? DEFAULT_CLIENT_PORT;
  if (!isPort(clientPort)) {
    return deny("El puerto efímero del cliente debe ser un entero entre 0 y 65535.");
  }
  const label = describeFlow(protocol, port);

  const fromInside = inCidr(model.cidr, from.ip);
  const toInside = inCidr(model.cidr, to.ip);
  if (!fromInside && !toInside) {
    return deny("Ningún extremo está dentro de la VPC.");
  }
  const fromSubnet = fromInside ? subnetOf(model, from.ip) : null;
  const toSubnet = toInside ? subnetOf(model, to.ip) : null;
  if (fromInside && fromSubnet === null) {
    return deny(`El origen ${from.ip} no pertenece a ninguna subred de la VPC.`);
  }
  if (toInside && toSubnet === null) {
    return deny(`El destino ${to.ip} no pertenece a ninguna subred de la VPC.`);
  }
  const sameSubnet = fromSubnet !== null && fromSubnet === toSubnet;

  if (fromSubnet !== null) {
    const target = routeFor(fromSubnet.routes, to.ip);
    if (target === null) {
      return deny(`Sin ruta: la subred ${fromSubnet.id} no tiene ninguna ruta hacia ${to.ip}.`);
    }
    if (toInside) {
      if (target !== "local") {
        return deny(
          `Ruta no válida: la subred ${fromSubnet.id} enruta ${to.ip} por «${target}», no por la ruta local.`,
        );
      }
    } else if (!target.startsWith("igw-") && !target.startsWith("nat-")) {
      return deny(
        `Destino de ruta no modelado: la subred ${fromSubnet.id} enruta ${to.ip} por «${target}», y solo se modelan igw- y nat-.`,
      );
    }
    path.push(`Ruta de ida en ${fromSubnet.id}: ${to.ip} por ${target}`);
  } else if (toSubnet !== null) {
    const target = routeFor(toSubnet.routes, from.ip);
    if (target === null || !target.startsWith("igw-")) {
      return deny(
        `Sin acceso desde Internet: la subred ${toSubnet.id} no enruta ${from.ip} por un internet gateway.`,
      );
    }
    path.push(`Ruta en ${toSubnet.id}: ${from.ip} por ${target}`);
  }

  if (fromSubnet !== null) {
    const rules = rulesOf(model, from);
    if (typeof rules === "string") {
      return deny(rules);
    }
    if (!securityGroupAllows(rules, { direction: "outbound", protocol, port, peer: to.ip })) {
      return deny(`El security group de salida del origen no permite ${label} hacia ${to.ip}.`);
    }
    path.push("SG de salida del origen");
  }

  if (fromSubnet !== null && !sameSubnet) {
    const result = naclAllows(fromSubnet.nacl, {
      direction: "outbound",
      protocol,
      port,
      peer: to.ip,
    });
    if (!result.allowed) {
      return deny(
        `La NACL de salida de ${fromSubnet.id} deniega ${label} hacia ${to.ip} (regla ${String(result.ruleNumber)}).`,
      );
    }
    path.push(`NACL de salida de ${fromSubnet.id} (regla ${String(result.ruleNumber)})`);
  }

  if (toSubnet !== null && !sameSubnet) {
    const result = naclAllows(toSubnet.nacl, {
      direction: "inbound",
      protocol,
      port,
      peer: from.ip,
    });
    if (!result.allowed) {
      return deny(
        `La NACL de entrada de ${toSubnet.id} deniega ${label} desde ${from.ip} (regla ${String(result.ruleNumber)}).`,
      );
    }
    path.push(`NACL de entrada de ${toSubnet.id} (regla ${String(result.ruleNumber)})`);
  }

  if (toSubnet !== null) {
    const rules = rulesOf(model, to);
    if (typeof rules === "string") {
      return deny(rules);
    }
    if (!securityGroupAllows(rules, { direction: "inbound", protocol, port, peer: from.ip })) {
      return deny(`El security group de entrada del destino no permite ${label} desde ${from.ip}.`);
    }
    path.push("SG de entrada del destino");
  }

  if (toSubnet !== null && !sameSubnet) {
    const result = naclAllows(toSubnet.nacl, {
      direction: "outbound",
      protocol,
      port: clientPort,
      peer: from.ip,
    });
    if (!result.allowed) {
      return deny(
        `La NACL de salida de ${toSubnet.id} deniega la respuesta hacia ${from.ip} por el puerto efímero ${clientPort} (regla ${String(result.ruleNumber)}).`,
      );
    }
    path.push(`NACL de retorno, salida de ${toSubnet.id} (regla ${String(result.ruleNumber)})`);
  }

  if (fromSubnet !== null && !sameSubnet) {
    const result = naclAllows(fromSubnet.nacl, {
      direction: "inbound",
      protocol,
      port: clientPort,
      peer: to.ip,
    });
    if (!result.allowed) {
      return deny(
        `La NACL de entrada de ${fromSubnet.id} deniega la respuesta desde ${to.ip} por el puerto efímero ${clientPort} (regla ${String(result.ruleNumber)}).`,
      );
    }
    path.push(`NACL de retorno, entrada de ${fromSubnet.id} (regla ${String(result.ruleNumber)})`);
  }

  return { allowed: true, reason: "La conexión y su respuesta están permitidas.", path };
}

export function canary(): boolean {
  const table: Route[] = [
    { destination: "10.0.0.0/16", target: "local" },
    { destination: "172.31.0.0/16", target: "pcx-11223344556677889" },
    { destination: "0.0.0.0/0", target: "igw-12345678901234567" },
  ];
  if (
    routeFor(table, "172.31.5.5") !== "pcx-11223344556677889" ||
    routeFor(table, "10.0.3.4") !== "local" ||
    routeFor(table, "8.8.8.8") !== "igw-12345678901234567"
  ) {
    return false;
  }
  const nacl: NaclRule[] = [
    { direction: "inbound", number: 100, action: "allow", protocol: "tcp", fromPort: 80, toPort: 80, cidr: "0.0.0.0/0" },
    { direction: "inbound", number: 110, action: "allow", protocol: "tcp", fromPort: 443, toPort: 443, cidr: "0.0.0.0/0" },
  ];
  const https = naclAllows(nacl, { direction: "inbound", protocol: "tcp", port: 443, peer: "198.51.100.7" });
  const netbios = naclAllows(nacl, { direction: "inbound", protocol: "tcp", port: 139, peer: "198.51.100.7" });
  if (!https.allowed || https.ruleNumber !== 110 || netbios.allowed || netbios.ruleNumber !== "*") {
    return false;
  }
  const sg: SgRule[] = [
    { direction: "inbound", protocol: "tcp", fromPort: 22, toPort: 22, cidr: "203.0.113.0/24" },
  ];
  return (
    securityGroupAllows(sg, { direction: "inbound", protocol: "tcp", port: 22, peer: "203.0.113.9" }) &&
    !securityGroupAllows(sg, { direction: "outbound", protocol: "tcp", port: 22, peer: "203.0.113.9" })
  );
}
