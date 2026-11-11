import type { EvaluatorCapabilities } from "../core.js";
import { contains } from "../cidr/index.js";

export const capabilities: EvaluatorCapabilities = {
  name: "events",
  version: "0.1.0",
  modeled: [
    "Sintaxis del patrón: solo se evalúan los campos que el patrón menciona, el evento debe contener todos con la misma estructura de anidamiento y los campos del evento que el patrón no menciona se ignoran",
    "Cada campo del patrón es un arreglo de valores o reglas: basta que coincida uno (O); varios campos a la vez son una Y",
    "Si el valor del evento es un arreglo, el patrón coincide cuando la intersección con el arreglo del patrón no está vacía",
    "Valores exactos de JSON: cadenas (sensibles a mayúsculas), números, true, false y null; la cadena vacía y null no son intercambiables",
    "prefix y suffix, también combinados con equals-ignore-case",
    "equals-ignore-case",
    "anything-but con cadenas, números, listas de solo cadenas o solo números, y con prefix, suffix, equals-ignore-case y wildcard (un valor o una lista)",
    "numeric: =, >, < y <= con un valor, y el rango > ... <= o > ... < con dos pares",
    "exists: true y false sobre hojas",
    "wildcard: el carácter * y las barras invertidas \\* y \\\\ como literales; no se admiten asteriscos consecutivos",
    "cidr con direcciones IPv4",
    "$or entre varios campos y el límite de 1000 combinaciones (producto de los argumentos de cada arreglo $or)",
    "Si un campo del patrón se repite, solo cuenta el último (como al leer el JSON)",
  ],
  notModeled: [
    "Direcciones IPv6 en el operador cidr",
    "El operador numérico >= : la guía leída no lo ilustra con ejemplos",
    "La comparación de números exactos por su representación en texto (300, 300.0 y 3.0e2): aquí se comparan como números",
    "Enteros fuera de ±2^53 en operaciones numéricas: el patrón se rechaza, y el evento con ese valor no coincide",
    "Claves con puntos, que EventBridge trata igual que el anidamiento",
    "$or junto a otros campos del mismo nivel: el patrón se rechaza",
    "anything-but frente a un campo ausente, y los operadores distintos del valor exacto frente a valores de evento que son arreglos (se coincide si algún elemento cumple)",
    "Patrones de EventBridge Pipes: no admiten wildcard ni varios operadores, pero aquí se evalúan como los de un bus de eventos",
    "Límites de complejidad de wildcard, reglas con exists sobre nodos intermedios y la validación de eventos del bus (tamaño, campos obligatorios)",
    "TestEventPattern, plantillas de entrada y filtros de reglas de otros servicios",
  ],
  sources: [
    "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html",
    "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern.html",
    "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-filtering-data-types.html",
    "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-null-values.html",
    "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-arrays.html",
    "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html",
  ],
};

const MAX_OR_COMBINATIONS = 1000;
const MAX_EXACT_INTEGER = 9007199254740992;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKey(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string");
}

function isNumberList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

/** Divide un valor con `*` en sus tramos literales; `null` si usa un escape o asteriscos no admitidos. */
function wildcardSegments(pattern: string): string[] | null {
  const segments: string[] = [];
  let current = "";
  let previousWasStar = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern.charAt(index);
    if (char === "\\") {
      const next = pattern.charAt(index + 1);
      if (next !== "*" && next !== "\\") {
        return null;
      }
      current += next;
      index += 1;
      previousWasStar = false;
    } else if (char === "*") {
      if (previousWasStar) {
        return null;
      }
      segments.push(current);
      current = "";
      previousWasStar = true;
    } else {
      current += char;
      previousWasStar = false;
    }
  }
  segments.push(current);
  return segments;
}

function wildcardMatches(pattern: string, value: string): boolean {
  const segments = wildcardSegments(pattern);
  if (segments === null) {
    return false;
  }
  if (segments.length === 1) {
    return value === pattern.replace(/\\([*\\])/g, "$1");
  }
  const first = segments[0] ?? "";
  const last = segments[segments.length - 1] ?? "";
  if (value.length < first.length + last.length || !value.startsWith(first) || !value.endsWith(last)) {
    return false;
  }
  const middle = value.slice(first.length, value.length - last.length);
  let position = 0;
  for (const part of segments.slice(1, -1)) {
    const found = middle.indexOf(part, position);
    if (found === -1) {
      return false;
    }
    position = found + part.length;
  }
  return true;
}

function validateWildcard(path: string, value: unknown, problems: string[]): void {
  if (typeof value !== "string") {
    problems.push(`«${path}»: wildcard necesita una cadena.`);
  } else if (wildcardSegments(value) === null) {
    problems.push(
      `«${path}»: el valor de wildcard «${value}» no es válido: no se admiten asteriscos consecutivos ni otras barras invertidas que \\* y \\\\.`,
    );
  }
}

function validateNumericValue(path: string, value: unknown, problems: string[]): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    problems.push(`«${path}»: numeric necesita números.`);
    return false;
  }
  if (Number.isInteger(value) && Math.abs(value) > MAX_EXACT_INTEGER) {
    problems.push(`«${path}»: los enteros de numeric deben estar entre -2^53 y 2^53.`);
    return false;
  }
  return true;
}

function validateNumeric(path: string, args: unknown, problems: string[]): void {
  if (!Array.isArray(args) || (args.length !== 2 && args.length !== 4)) {
    problems.push(`«${path}»: numeric necesita un par [operador, número] o dos pares como [">", 0, "<=", 5].`);
    return;
  }
  const operators = [args[0], args[2]];
  const first = args[0];
  if (args.length === 2) {
    if (first !== "=" && first !== ">" && first !== "<" && first !== "<=") {
      problems.push(
        `«${path}»: el operador numérico ${JSON.stringify(first)} no está modelado; usa =, >, < o <=.`,
      );
    }
    validateNumericValue(path, args[1], problems);
    return;
  }
  if (operators[0] !== ">" || (operators[1] !== "<" && operators[1] !== "<=")) {
    problems.push(`«${path}»: un rango numeric debe ser > un mínimo y después < o <= un máximo.`);
  }
  validateNumericValue(path, args[1], problems);
  validateNumericValue(path, args[3], problems);
}

function validateCaseInsensitive(path: string, name: string, value: unknown, problems: string[]): void {
  if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value["equals-ignore-case"] !== "string") {
    problems.push(`«${path}»: ${name} necesita una cadena o { "equals-ignore-case": "texto" }.`);
  }
}

function validateAnythingBut(path: string, value: unknown, problems: string[]): void {
  if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
    return;
  }
  if (Array.isArray(value)) {
    if (!isStringList(value) && !isNumberList(value)) {
      problems.push(`«${path}»: la lista de anything-but debe ser no vacía y de solo cadenas o solo números.`);
    }
    return;
  }
  if (isRecord(value) && Object.keys(value).length === 1) {
    const kind = Object.keys(value)[0] ?? "";
    const arg = value[kind];
    if (kind === "prefix" || kind === "suffix" || kind === "equals-ignore-case") {
      if (typeof arg !== "string" && !isStringList(arg)) {
        problems.push(`«${path}»: anything-but con ${kind} necesita una cadena o una lista de cadenas.`);
      }
      return;
    }
    if (kind === "wildcard") {
      if (isStringList(arg)) {
        for (const item of arg) {
          validateWildcard(path, item, problems);
        }
      } else {
        validateWildcard(path, arg, problems);
      }
      return;
    }
  }
  problems.push(
    `«${path}»: anything-but admite cadenas, números, listas, o prefix, suffix, equals-ignore-case y wildcard.`,
  );
}

function validateOperator(path: string, operator: JsonRecord, problems: string[]): void {
  const keys = Object.keys(operator);
  const name = keys[0] ?? "";
  if (keys.length !== 1) {
    problems.push(`«${path}»: cada regla debe tener exactamente un operador.`);
    return;
  }
  const arg = operator[name];
  switch (name) {
    case "prefix":
    case "suffix":
      if (typeof arg !== "string") {
        validateCaseInsensitive(path, name, arg, problems);
      }
      return;
    case "equals-ignore-case":
      if (typeof arg !== "string") {
        problems.push(`«${path}»: equals-ignore-case necesita una cadena.`);
      }
      return;
    case "anything-but":
      validateAnythingBut(path, arg, problems);
      return;
    case "numeric":
      validateNumeric(path, arg, problems);
      return;
    case "exists":
      if (typeof arg !== "boolean") {
        problems.push(`«${path}»: exists necesita true o false.`);
      }
      return;
    case "wildcard":
      validateWildcard(path, arg, problems);
      return;
    case "cidr":
      if (typeof arg !== "string" || arg.indexOf(":") !== -1 || !validIpv4Cidr(arg)) {
        problems.push(`«${path}»: cidr necesita un bloque IPv4 válido; IPv6 no está modelado.`);
      }
      return;
    default:
      problems.push(`«${path}»: el operador «${name}» no está modelado.`);
  }
}

function validIpv4Cidr(value: string): boolean {
  return contains(value, value);
}

function validateLeaf(path: string, list: unknown[], problems: string[]): void {
  if (list.length === 0) {
    problems.push(`«${path}»: la lista de valores no puede estar vacía.`);
    return;
  }
  for (const item of list) {
    if (isRecord(item)) {
      validateOperator(path, item, problems);
    } else if (
      item !== null &&
      typeof item !== "string" &&
      typeof item !== "boolean" &&
      !(typeof item === "number" && Number.isFinite(item))
    ) {
      problems.push(`«${path}»: los valores deben ser cadenas, números, true, false, null u operadores.`);
    }
  }
}

function validateNode(node: JsonRecord, path: string, problems: string[], combinations: { total: number }): void {
  for (const [key, value] of Object.entries(node)) {
    const here = path === "" ? key : `${path}.${key}`;
    if (key === "$or") {
      if (Object.keys(node).length > 1) {
        problems.push(`«${here}»: $or junto a otros campos del mismo nivel no está modelado.`);
      }
      if (!Array.isArray(value) || value.length === 0 || !value.every((item) => isRecord(item))) {
        problems.push(`«${here}»: $or necesita un arreglo no vacío de objetos.`);
        continue;
      }
      combinations.total *= value.length;
      for (const alternative of value) {
        if (isRecord(alternative)) {
          validateNode(alternative, path, problems, combinations);
        }
      }
    } else if (Array.isArray(value)) {
      validateLeaf(here, value, problems);
    } else if (isRecord(value)) {
      validateNode(value, here, problems, combinations);
    } else {
      problems.push(`«${here}»: el valor debe ser un arreglo de valores o un objeto con más campos.`);
    }
  }
}

/** Explica por qué un patrón no es válido o no está modelado; `[]` si se puede evaluar. Nunca lanza. */
export function validatePattern(pattern: unknown): string[] {
  const problems: string[] = [];
  try {
    if (!isRecord(pattern)) {
      return ["El patrón debe ser un objeto JSON."];
    }
    const combinations = { total: 1 };
    validateNode(pattern, "", problems, combinations);
    if (combinations.total > MAX_OR_COMBINATIONS) {
      problems.push(
        `El uso de $or produce ${combinations.total} combinaciones y el máximo es ${MAX_OR_COMBINATIONS}.`,
      );
    }
  } catch {
    problems.push("El patrón no se pudo analizar.");
  }
  return problems;
}

function stringsOf(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function matchesText(
  value: string,
  arg: unknown,
  test: (text: string, expected: string) => boolean,
): boolean {
  if (typeof arg === "string") {
    return test(value, arg);
  }
  if (isRecord(arg) && typeof arg["equals-ignore-case"] === "string") {
    return test(value.toLowerCase(), arg["equals-ignore-case"].toLowerCase());
  }
  return false;
}

function matchesNumeric(value: unknown, args: unknown): boolean {
  if (typeof value !== "number" || !Number.isFinite(value) || !Array.isArray(args)) {
    return false;
  }
  if (Number.isInteger(value) && Math.abs(value) > MAX_EXACT_INTEGER) {
    return false;
  }
  const compare = (operator: unknown, limit: unknown): boolean => {
    if (typeof limit !== "number") {
      return false;
    }
    switch (operator) {
      case "=":
        return value === limit;
      case ">":
        return value > limit;
      case "<":
        return value < limit;
      case "<=":
        return value <= limit;
      default:
        return false;
    }
  };
  return compare(args[0], args[1]) && (args.length === 2 || compare(args[2], args[3]));
}

function matchesAnythingBut(value: unknown, arg: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") {
    return false;
  }
  if (typeof arg === "string" || typeof arg === "number") {
    return value !== arg;
  }
  if (Array.isArray(arg)) {
    return !arg.some((item) => item === value);
  }
  if (!isRecord(arg) || typeof value !== "string") {
    return false;
  }
  const keys = Object.keys(arg);
  const kind = keys[0] ?? "";
  const items = stringsOf(arg[kind]);
  switch (kind) {
    case "prefix":
      return !items.some((item) => value.startsWith(item));
    case "suffix":
      return !items.some((item) => value.endsWith(item));
    case "equals-ignore-case":
      return !items.some((item) => value.toLowerCase() === item.toLowerCase());
    case "wildcard":
      return !items.some((item) => wildcardMatches(item, value));
    default:
      return false;
  }
}

function matchesValue(rule: unknown, value: unknown): boolean {
  if (!isRecord(rule)) {
    return rule === value;
  }
  const name = Object.keys(rule)[0] ?? "";
  const arg = rule[name];
  switch (name) {
    case "prefix":
      return typeof value === "string" && matchesText(value, arg, (text, expected) => text.startsWith(expected));
    case "suffix":
      return typeof value === "string" && matchesText(value, arg, (text, expected) => text.endsWith(expected));
    case "equals-ignore-case":
      return typeof value === "string" && typeof arg === "string" && value.toLowerCase() === arg.toLowerCase();
    case "anything-but":
      return matchesAnythingBut(value, arg);
    case "numeric":
      return matchesNumeric(value, arg);
    case "wildcard":
      return typeof value === "string" && typeof arg === "string" && wildcardMatches(arg, value);
    case "cidr":
      return typeof value === "string" && typeof arg === "string" && value.indexOf("/") === -1 && contains(arg, `${value}/32`);
    default:
      return false;
  }
}

function matchesLeaf(rules: unknown[], present: boolean, value: unknown): boolean {
  return rules.some((rule) => {
    if (isRecord(rule) && hasKey(rule, "exists")) {
      return rule.exists === present;
    }
    if (!present) {
      return false;
    }
    return Array.isArray(value) ? value.some((item) => matchesValue(rule, item)) : matchesValue(rule, value);
  });
}

function matchesNode(pattern: JsonRecord, event: JsonRecord): boolean {
  for (const [key, expected] of Object.entries(pattern)) {
    if (key === "$or") {
      const alternatives = Array.isArray(expected) ? expected : [];
      if (!alternatives.some((alternative) => isRecord(alternative) && matchesNode(alternative, event))) {
        return false;
      }
      continue;
    }
    const present = hasKey(event, key);
    const actual = present ? event[key] : undefined;
    if (Array.isArray(expected)) {
      if (!matchesLeaf(expected, present, actual)) {
        return false;
      }
    } else if (isRecord(expected)) {
      const children = !present ? [{}] : Array.isArray(actual) ? actual : [actual];
      if (!children.some((child) => isRecord(child) && matchesNode(expected, child))) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

/** `true` si el evento cumple el patrón. Un patrón inválido o un evento que no es un objeto dan `false`; nunca lanza. */
export function matches(pattern: unknown, event: unknown): boolean {
  try {
    if (validatePattern(pattern).length > 0 || !isRecord(pattern) || !isRecord(event)) {
      return false;
    }
    return matchesNode(pattern, event);
  } catch {
    return false;
  }
}

export function canary(): boolean {
  const event = {
    source: "aws.ec2",
    "detail-type": "EC2 Instance State-change Notification",
    time: "2017-10-02T18:43:48Z",
    resources: ["arn:aws:ec2:us-east-1:123456789012:instance/i-abcd1111"],
    detail: { state: "pending", FileName: "Dir/Photo.PNG", ip: "10.0.0.77", count: 3 },
  };
  return (
    matches({ source: ["aws.ec2", "aws.fargate"], detail: { state: ["pending"] } }, event) &&
    !matches({ source: ["aws.s3"] }, event) &&
    matches({ time: [{ prefix: "2017-10-02" }] }, event) &&
    !matches({ time: [{ prefix: "2018" }] }, event) &&
    matches({ detail: { FileName: [{ suffix: { "equals-ignore-case": ".png" } }] } }, event) &&
    !matches({ detail: { FileName: [{ suffix: ".png" }] } }, event) &&
    matches({ detail: { state: [{ "anything-but": ["stopped", "overloaded"] }] } }, event) &&
    !matches({ detail: { state: [{ "anything-but": "pending" }] } }, event) &&
    matches({ detail: { count: [{ numeric: [">", 0, "<=", 5] }] } }, event) &&
    !matches({ detail: { count: [{ numeric: ["<", 3] }] } }, event) &&
    matches({ detail: { missing: [{ exists: false }], state: [{ exists: true }] } }, event) &&
    matches({ detail: { FileName: [{ wildcard: "Dir/*.PNG" }] } }, event) &&
    !matches({ detail: { FileName: [{ wildcard: "*/lib/*" }] } }, event) &&
    matches({ detail: { ip: [{ cidr: "10.0.0.0/24" }] } }, event) &&
    !matches({ detail: { ip: [{ cidr: "10.0.1.0/24" }] } }, event) &&
    matches({ resources: ["arn:aws:ec2:us-east-1:123456789012:instance/i-abcd1111", "otro"] }, event) &&
    matches({ detail: { $or: [{ state: ["running"] }, { count: [3] }] } }, event) &&
    !matches({ detail: { $or: [{ state: ["running"] }, { count: [4] }] } }, event) &&
    validatePattern({ source: "aws.ec2" }).length === 1
  );
}
