import { isRecord, matchesResource } from "./matching.js";

export type ConditionOutcome =
  | { result: "true" }
  | { result: "false" }
  | { result: "unmodeled"; operator: string };

type Family = "string" | "stringIgnoreCase" | "numeric" | "bool" | "ip" | "arn" | "date";
type Compare = "equals" | "lessThan" | "lessThanEquals" | "greaterThan" | "greaterThanEquals";

interface OperatorSpec {
  family: Family;
  compare: Compare;
  negated: boolean;
  wildcard: boolean;
  allowsSetQualifier: boolean;
}

const BASE_OPERATORS: Readonly<Record<string, OperatorSpec>> = {
  StringEquals: spec("string", "equals", false, false, true),
  StringNotEquals: spec("string", "equals", true, false, true),
  StringEqualsIgnoreCase: spec("stringIgnoreCase", "equals", false, false, true),
  StringLike: spec("string", "equals", false, true, true),
  StringNotLike: spec("string", "equals", true, true, true),
  NumericEquals: spec("numeric", "equals", false, false, false),
  NumericLessThan: spec("numeric", "lessThan", false, false, false),
  NumericLessThanEquals: spec("numeric", "lessThanEquals", false, false, false),
  NumericGreaterThan: spec("numeric", "greaterThan", false, false, false),
  NumericGreaterThanEquals: spec("numeric", "greaterThanEquals", false, false, false),
  Bool: spec("bool", "equals", false, false, true),
  IpAddress: spec("ip", "equals", false, false, false),
  NotIpAddress: spec("ip", "equals", true, false, false),
  ArnLike: spec("arn", "equals", false, true, true),
  ArnNotLike: spec("arn", "equals", true, true, true),
  DateLessThan: spec("date", "lessThan", false, false, false),
  DateGreaterThan: spec("date", "greaterThan", false, false, false),
};

function spec(
  family: Family,
  compare: Compare,
  negated: boolean,
  wildcard: boolean,
  allowsSetQualifier: boolean,
): OperatorSpec {
  return { family, compare, negated, wildcard, allowsSetQualifier };
}

interface ParsedOperator {
  qualifier: "ForAnyValue" | "ForAllValues" | null;
  base: string;
  ifExists: boolean;
  spec: OperatorSpec | null;
  isNull: boolean;
}

function parseOperator(name: string): ParsedOperator {
  let rest = name;
  let qualifier: ParsedOperator["qualifier"] = null;
  if (rest.startsWith("ForAnyValue:")) {
    qualifier = "ForAnyValue";
    rest = rest.slice("ForAnyValue:".length);
  } else if (rest.startsWith("ForAllValues:")) {
    qualifier = "ForAllValues";
    rest = rest.slice("ForAllValues:".length);
  }
  if (rest === "Null") {
    return { qualifier, base: rest, ifExists: false, spec: null, isNull: qualifier === null };
  }
  let ifExists = false;
  let base = rest;
  if (base.endsWith("IfExists")) {
    ifExists = true;
    base = base.slice(0, -"IfExists".length);
  }
  const found = Object.prototype.hasOwnProperty.call(BASE_OPERATORS, base)
    ? (BASE_OPERATORS[base] ?? null)
    : null;
  return { qualifier, base, ifExists, spec: found, isNull: false };
}

function scalarText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function textList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (const item of value) {
      const text = scalarText(item);
      if (text === null) {
        return null;
      }
      items.push(text);
    }
    return items;
  }
  const single = scalarText(value);
  return single === null ? null : [single];
}

function contextValues(context: unknown, key: string): string[] | null {
  if (!isRecord(context) || !Object.prototype.hasOwnProperty.call(context, key)) {
    return null;
  }
  const values = textList(context[key]);
  if (values === null || values.length === 0) {
    return null;
  }
  return values;
}

function parseIpv4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let result = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) {
      return null;
    }
    result = (result << 8n) | BigInt(part);
  }
  return result;
}

function parseIpv6(text: string): bigint | null {
  if (!/^[0-9a-fA-F:]+$/.test(text) || text.split("::").length > 2) {
    return null;
  }
  const [head = "", tail] = text.split("::");
  const headGroups = head === "" ? [] : head.split(":");
  const tailGroups = tail === undefined || tail === "" ? [] : tail.split(":");
  const compressed = tail !== undefined;
  const total = headGroups.length + tailGroups.length;
  if ((compressed && total > 7) || (!compressed && total !== 8)) {
    return null;
  }
  const groups = [
    ...headGroups,
    ...(compressed ? Array<string>(8 - total).fill("0") : []),
    ...tailGroups,
  ];
  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      return null;
    }
    result = (result << 16n) | BigInt(`0x${group}`);
  }
  return result;
}

interface Address {
  bits: 32 | 128;
  value: bigint;
}

function parseAddress(text: string): Address | null {
  if (text.includes(":")) {
    const value = parseIpv6(text);
    return value === null ? null : { bits: 128, value };
  }
  const value = parseIpv4(text);
  return value === null ? null : { bits: 32, value };
}

function ipMatches(policyValue: string, requestValue: string): boolean | null {
  const slash = policyValue.indexOf("/");
  const networkText = slash === -1 ? policyValue : policyValue.slice(0, slash);
  const network = parseAddress(networkText);
  const address = parseAddress(requestValue);
  if (network === null || address === null) {
    return null;
  }
  let prefix: number = network.bits;
  if (slash !== -1) {
    const prefixText = policyValue.slice(slash + 1);
    if (!/^\d{1,3}$/.test(prefixText) || Number(prefixText) > network.bits) {
      return null;
    }
    prefix = Number(prefixText);
  }
  if (network.bits !== address.bits) {
    return false;
  }
  const shift = BigInt(network.bits - prefix);
  return network.value >> shift === address.value >> shift;
}

function arnMatches(pattern: string, arn: string): boolean {
  const patternParts = pattern.split(":");
  const arnParts = arn.split(":");
  if (patternParts.length < 6 || arnParts.length < 6) {
    return false;
  }
  const split = (parts: string[]): string[] => [...parts.slice(0, 5), parts.slice(5).join(":")];
  const wanted = split(patternParts);
  const actual = split(arnParts);
  return wanted.every((part, index) => matchesResource(part, actual[index] ?? ""));
}

const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;

function parseInstant(text: string): number | null {
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text) * 1000;
  }
  const parts = ISO_DATE.exec(text);
  if (parts === null) {
    return null;
  }
  const normalized = parts[4] === undefined ? `${text}T00:00:00Z` : text;
  const millis = Date.parse(normalized);
  return Number.isNaN(millis) ? null : millis;
}

function compareNumbers(compare: Compare, left: number, right: number): boolean {
  switch (compare) {
    case "equals":
      return left === right;
    case "lessThan":
      return left < right;
    case "lessThanEquals":
      return left <= right;
    case "greaterThan":
      return left > right;
    case "greaterThanEquals":
      return left >= right;
  }
}

function parseNumber(text: string): number | null {
  if (text.trim() === "") {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** true/false si compara; null si algún valor no se puede interpretar (la comparación no se cumple). */
function pairMatches(operator: OperatorSpec, policyValue: string, requestValue: string): boolean | null {
  switch (operator.family) {
    case "string":
      return operator.wildcard
        ? matchesResource(policyValue, requestValue)
        : policyValue === requestValue;
    case "stringIgnoreCase":
      return policyValue.toLowerCase() === requestValue.toLowerCase();
    case "arn":
      return arnMatches(policyValue, requestValue);
    case "bool":
      return policyValue === requestValue;
    case "ip":
      return ipMatches(policyValue, requestValue);
    case "numeric": {
      const right = parseNumber(policyValue);
      const left = parseNumber(requestValue);
      return left === null || right === null ? null : compareNumbers(operator.compare, left, right);
    }
    case "date": {
      const right = parseInstant(policyValue);
      const left = parseInstant(requestValue);
      return left === null || right === null ? null : compareNumbers(operator.compare, left, right);
    }
  }
}

function anyMatch(
  operator: OperatorSpec,
  policyValues: readonly string[],
  requestValue: string,
): boolean | null {
  let matched = false;
  for (const policyValue of policyValues) {
    const outcome = pairMatches(operator, policyValue, requestValue);
    if (outcome === null) {
      return null;
    }
    matched = matched || outcome;
  }
  return matched;
}

function nullMatches(policyValues: readonly string[], present: boolean): boolean {
  return policyValues.some(
    (value) => (value === "true" && !present) || (value === "false" && present),
  );
}

function evaluateKey(
  parsed: ParsedOperator,
  policyValue: unknown,
  requestValues: string[] | null,
): boolean {
  const policyValues = textList(policyValue);
  if (policyValues === null || policyValues.length === 0) {
    return false;
  }
  if (parsed.isNull) {
    return nullMatches(policyValues, requestValues !== null);
  }
  const operator = parsed.spec;
  if (operator === null) {
    return false;
  }
  if (requestValues === null) {
    if (parsed.ifExists) {
      return true;
    }
    if (parsed.qualifier === "ForAllValues") {
      return !operator.negated;
    }
    if (parsed.qualifier === "ForAnyValue") {
      return false;
    }
    return operator.negated;
  }
  if (parsed.qualifier === null && requestValues.length > 1) {
    return false;
  }
  const results: boolean[] = [];
  for (const requestValue of requestValues) {
    const matched = anyMatch(operator, policyValues, requestValue);
    if (matched === null) {
      return false;
    }
    results.push(operator.negated ? !matched : matched);
  }
  return parsed.qualifier === "ForAnyValue" ? results.some(Boolean) : results.every(Boolean);
}

export function evaluateConditions(condition: unknown, context: unknown): ConditionOutcome {
  if (condition === undefined) {
    return { result: "true" };
  }
  if (!isRecord(condition)) {
    return { result: "false" };
  }
  let unmodeled: string | null = null;
  for (const [name, keys] of Object.entries(condition)) {
    const parsed = parseOperator(name);
    const supported =
      parsed.isNull ||
      (parsed.spec !== null && (parsed.qualifier === null || parsed.spec.allowsSetQualifier));
    if (!supported) {
      unmodeled = unmodeled ?? name;
      continue;
    }
    if (!isRecord(keys)) {
      return { result: "false" };
    }
    for (const [key, policyValue] of Object.entries(keys)) {
      if (!evaluateKey(parsed, policyValue, contextValues(context, key))) {
        return { result: "false" };
      }
    }
  }
  return unmodeled === null ? { result: "true" } : { result: "unmodeled", operator: unmodeled };
}
