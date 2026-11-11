import type { CloudEvidenceInput, CloudEvidenceResult } from "@codeai/shared";

/**
 * Evaluación pura de la evidencia de un `CLOUD_LAB` (`S16-T10a`).
 *
 * No lanza, no hace E/S y no conoce HTTP ni Prisma. Recibe el `config` y la
 * `solution` del ejercicio tal como llegan de la base (`unknown`, se leen con
 * *narrowing*) y el cuerpo ya validado por `cloudEvidenceSchema`.
 *
 * Orden: contenido roto (error del servidor) → credenciales → comprobaciones
 * desconocidas o repetidas → JSON válido → operadores. Las credenciales cortan
 * antes de evaluar: nada se evalúa ni se guarda. La salida en bruto nunca sale
 * de esta función: ni `storedSummary` ni `maskedSummary` la contienen.
 */

export const CREDENTIALS_DETECTED = "La evidencia parece contener credenciales: no la envíes";
export const invalidJson = (checkId: string): string =>
  `La salida de la comprobación ${checkId} no es JSON válido`;
export const unknownCheck = (checkId: string): string =>
  `La comprobación ${checkId} no existe en este laboratorio`;
export const duplicatedEvidence = (checkId: string): string =>
  `La comprobación ${checkId} está repetida en la evidencia`;
export const missingEvidence = (checkId: string): string =>
  `Falta la evidencia de la comprobación ${checkId}`;

const CREDENTIAL_PATTERN = /AKIA[0-9A-Z]{16}|aws_secret_access_key/i;
const ACCESS_KEY_PATTERN = /AKIA[0-9A-Z]{16}/g;
const ACCOUNT_PATTERN = /(?<!\d)\d{12}(?!\d)/g;

/**
 * Enmascara identificadores: ids de acceso `AKIA…` → `[credencial eliminada]` y
 * cualquier número de 12 dígitos (cuentas, también dentro de un ARN) → `************`.
 */
export function maskIdentifiers(text: string): string {
  return text
    .replace(ACCESS_KEY_PATTERN, "[credencial eliminada]")
    .replace(ACCOUNT_PATTERN, "************");
}

type Op = "equals" | "exists" | "absent" | "matches" | "lengthAtLeast" | "lengthEquals";
const OPS: readonly Op[] = [
  "equals",
  "exists",
  "absent",
  "matches",
  "lengthAtLeast",
  "lengthEquals",
];

type PathToken = string | number;

interface Expectation {
  readonly path: readonly PathToken[];
  readonly op: Op;
  readonly value: unknown;
  readonly regex: RegExp | null;
}

interface CheckSpec {
  readonly id: string;
  readonly label: string;
  readonly expect: readonly Expectation[];
}

export type CloudEvidenceEvaluation =
  | {
      readonly status: "graded";
      readonly result: CloudEvidenceResult;
      readonly storedSummary: string;
    }
  | { readonly status: "invalid-answer"; readonly message: string }
  | { readonly status: "broken-content" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Camino tipo `Budgets[0].BudgetLimit.Amount`: propiedades con punto e índices `[n]`. */
function parsePath(path: string): PathToken[] | null {
  const tokens: PathToken[] = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]/y;
  let position = 0;
  let expectSeparator = false;
  while (position < path.length) {
    if (path[position] === "." && expectSeparator && position + 1 < path.length) {
      position += 1;
      expectSeparator = false;
      continue;
    }
    pattern.lastIndex = position;
    const match = pattern.exec(path);
    if (match === null) return null;
    if (match[1] !== undefined) {
      if (expectSeparator) return null;
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(Number(match[2]));
    }
    position = pattern.lastIndex;
    expectSeparator = true;
  }
  return tokens.length > 0 ? tokens : null;
}

function readPath(root: unknown, path: readonly PathToken[]): unknown {
  let current: unknown = root;
  for (const token of path) {
    if (typeof token === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[token];
    } else {
      if (!isRecord(current) || !Object.hasOwn(current, token)) return undefined;
      current = current[token];
    }
  }
  return current;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, i) => deepEqual(item, right[i]));
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]))
    );
  }
  return false;
}

function parseExpectation(raw: unknown): Expectation | null {
  if (!isRecord(raw) || typeof raw["path"] !== "string" || typeof raw["op"] !== "string") {
    return null;
  }
  const op = OPS.find((candidate) => candidate === raw["op"]);
  if (op === undefined) return null;
  const path = parsePath(raw["path"]);
  if (path === null) return null;
  const value = raw["value"];
  if (op === "equals" && value === undefined) return null;
  let regex: RegExp | null = null;
  if (op === "matches") {
    if (typeof value !== "string") return null;
    try {
      regex = new RegExp(value);
    } catch {
      return null;
    }
  }
  if (op === "lengthAtLeast" || op === "lengthEquals") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  }
  return { path, op, value, regex };
}

/** Une `config.checks` con `solution.checks`; `null` si alguna de las dos formas está rota. */
function readChecks(solution: unknown, config: unknown): CheckSpec[] | null {
  if (!isRecord(config) || !isRecord(solution)) return null;
  const configChecks = config["checks"];
  const solutionChecks = solution["checks"];
  if (!Array.isArray(configChecks) || !Array.isArray(solutionChecks)) return null;
  if (configChecks.length === 0) return null;

  const expectsById = new Map<string, readonly Expectation[]>();
  for (const raw of solutionChecks) {
    if (!isRecord(raw) || typeof raw["id"] !== "string" || !Array.isArray(raw["expect"])) {
      return null;
    }
    if (raw["expect"].length === 0 || expectsById.has(raw["id"])) return null;
    const expectations: Expectation[] = [];
    for (const item of raw["expect"]) {
      const parsed = parseExpectation(item);
      if (parsed === null) return null;
      expectations.push(parsed);
    }
    expectsById.set(raw["id"], expectations);
  }

  const specs: CheckSpec[] = [];
  const seen = new Set<string>();
  for (const raw of configChecks) {
    if (
      !isRecord(raw) ||
      typeof raw["id"] !== "string" ||
      typeof raw["label"] !== "string" ||
      typeof raw["command"] !== "string" ||
      (raw["phase"] !== "build" && raw["phase"] !== "cleanup")
    ) {
      return null;
    }
    const expectations = expectsById.get(raw["id"]);
    if (expectations === undefined || seen.has(raw["id"])) return null;
    seen.add(raw["id"]);
    specs.push({ id: raw["id"], label: raw["label"], expect: expectations });
  }
  return specs;
}

function describePath(path: readonly PathToken[]): string {
  return path.reduce<string>((text, token) => {
    if (typeof token === "number") return `${text}[${token}]`;
    return text === "" ? token : `${text}.${token}`;
  }, "");
}

/** Texto del problema: nombra el camino y el operador, nunca el valor leído ni el esperado. */
function problemFor(expectation: Expectation): string {
  return `No se cumple «${expectation.op}» en ${describePath(expectation.path)}`;
}

function holds(expectation: Expectation, actual: unknown): boolean {
  switch (expectation.op) {
    case "equals":
      return deepEqual(actual, expectation.value);
    case "exists":
      return actual !== undefined;
    case "absent":
      return actual === undefined;
    case "matches":
      return (
        expectation.regex !== null &&
        (typeof actual === "string" || typeof actual === "number" || typeof actual === "boolean") &&
        expectation.regex.test(String(actual))
      );
    case "lengthAtLeast":
      return (
        (Array.isArray(actual) || typeof actual === "string") &&
        typeof expectation.value === "number" &&
        actual.length >= expectation.value
      );
    case "lengthEquals":
      return (
        (Array.isArray(actual) || typeof actual === "string") &&
        typeof expectation.value === "number" &&
        actual.length === expectation.value
      );
  }
}

function parseJson(
  output: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    return { ok: true, value: JSON.parse(output) as unknown };
  } catch {
    return { ok: false };
  }
}

export function evaluateCloudEvidence(
  solution: unknown,
  config: unknown,
  body: CloudEvidenceInput,
): CloudEvidenceEvaluation {
  const specs = readChecks(solution, config);
  if (specs === null) return { status: "broken-content" };

  if (body.evidence.some((item) => CREDENTIAL_PATTERN.test(item.output))) {
    return { status: "invalid-answer", message: CREDENTIALS_DETECTED };
  }

  const outputs = new Map<string, string>();
  for (const item of body.evidence) {
    if (!specs.some((spec) => spec.id === item.checkId)) {
      return { status: "invalid-answer", message: unknownCheck(item.checkId) };
    }
    if (outputs.has(item.checkId)) {
      return { status: "invalid-answer", message: duplicatedEvidence(item.checkId) };
    }
    outputs.set(item.checkId, item.output);
  }

  const parsed = new Map<string, unknown>();
  for (const spec of specs) {
    const output = outputs.get(spec.id);
    if (output === undefined) continue;
    const json = parseJson(output);
    if (!json.ok) return { status: "invalid-answer", message: invalidJson(spec.id) };
    parsed.set(spec.id, json.value);
  }

  const checks = specs.map((spec) => {
    if (!parsed.has(spec.id)) {
      return {
        checkId: spec.id,
        label: spec.label,
        passed: false,
        problems: [missingEvidence(spec.id)],
      };
    }
    const root = parsed.get(spec.id);
    const problems = spec.expect
      .filter((expectation) => !holds(expectation, readPath(root, expectation.path)))
      .map(problemFor);
    return { checkId: spec.id, label: spec.label, passed: problems.length === 0, problems };
  });

  const allPassed = checks.every((check) => check.passed);
  let outcome: CloudEvidenceResult["outcome"] = "FAILED";
  if (allPassed && body.cleanupConfirmed) outcome = "PASSED";
  else if (checks.some((check) => check.passed)) outcome = "PARTIAL";

  const lines = checks.map(
    (check) =>
      `${check.checkId} · ${check.label}: ${check.passed ? "superada" : "no superada"}` +
      check.problems.map((problem) => `\n  - ${problem}`).join(""),
  );
  lines.push(`Limpieza: ${body.cleanupConfirmed ? "confirmada" : "sin confirmar"}`);

  const storedSummary = JSON.stringify(
    checks.map((check) => ({
      checkId: check.checkId,
      passed: check.passed,
      problems: check.problems.length,
    })),
  );

  return {
    status: "graded",
    result: {
      outcome,
      checks,
      cleanupConfirmed: body.cleanupConfirmed,
      maskedSummary: maskIdentifiers(lines.join("\n")),
    },
    storedSummary,
  };
}
