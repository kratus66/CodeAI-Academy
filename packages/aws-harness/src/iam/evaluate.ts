import { isRecord, matchesAction, matchesResource, stringList } from "./matching.js";
import type {
  EvaluationInput,
  EvaluationResult,
  MatchedStatement,
  PolicyDocument,
  Statement,
} from "./types.js";

export const CONDITION_REASON =
  "La sentencia usa condiciones: requiere el evaluador de condiciones";
export const NOT_PRINCIPAL_REASON = "La sentencia usa NotPrincipal: no está modelado";

const VALID_VERSIONS: readonly string[] = ["2008-10-17", "2012-10-17"];
const POLICY_KEYS: readonly string[] = ["Version", "Id", "Statement"];
const STATEMENT_KEYS: readonly string[] = [
  "Sid",
  "Effect",
  "Principal",
  "NotPrincipal",
  "Action",
  "NotAction",
  "Resource",
  "NotResource",
  "Condition",
];
const PRINCIPAL_KEYS: readonly string[] = ["AWS", "Federated", "Service", "CanonicalUser"];

const USER_ARN = /^arn:(aws[a-z-]*):iam::(\d{12}):user\/.+$/;
const ROLE_ARN = /^arn:(aws[a-z-]*):iam::(\d{12}):role\/.+$/;
const SESSION_ARN = /^arn:(aws[a-z-]*):sts::(\d{12}):assumed-role\/([^/]+)\/.+$/;
const ACTION_STRING = /^[^:\s]+:[^:\s]+$/;
const SID_STRING = /^[A-Za-z0-9]+$/;

function validateValueList(
  value: unknown,
  label: string,
  problems: string[],
  pattern: RegExp | null,
): void {
  const list = stringList(value);
  if (list === null || list.length === 0) {
    problems.push(`${label} debe ser una cadena o una lista no vacía de cadenas.`);
    return;
  }
  for (const item of list) {
    if (item === "") {
      problems.push(`${label} no puede contener cadenas vacías.`);
    } else if (pattern !== null && item !== "*" && !pattern.test(item)) {
      problems.push(
        `${label}: «${item}» debe tener el formato servicio:acción (con comodines * o ? si hace falta).`,
      );
    }
  }
}

function validatePrincipal(value: unknown, label: string, problems: string[]): void {
  if (value === "*") {
    return;
  }
  if (!isRecord(value)) {
    problems.push(`${label} debe ser "*" o un objeto con AWS, Federated, Service o CanonicalUser.`);
    return;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    problems.push(`${label} no puede ser un objeto vacío.`);
  }
  for (const key of keys) {
    if (!PRINCIPAL_KEYS.includes(key)) {
      problems.push(`${label}: «${key}» no es un tipo de principal válido.`);
    } else {
      validateValueList(value[key], `${label}.${key}`, problems, null);
    }
  }
}

function validateStatement(value: unknown, index: number, problems: string[]): void {
  const label = `Sentencia ${index + 1}`;
  if (!isRecord(value)) {
    problems.push(`${label} debe ser un objeto.`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!STATEMENT_KEYS.includes(key)) {
      problems.push(`${label}: el elemento «${key}» no existe en la gramática de políticas.`);
    }
  }
  if (value["Effect"] !== "Allow" && value["Effect"] !== "Deny") {
    problems.push(`${label}: Effect debe ser "Allow" o "Deny" (distingue mayúsculas).`);
  }
  if (value["Sid"] !== undefined) {
    const sid = value["Sid"];
    if (typeof sid !== "string" || !SID_STRING.test(sid)) {
      problems.push(`${label}: Sid solo admite letras y números ASCII.`);
    }
  }
  const hasPrincipal = value["Principal"] !== undefined;
  const hasNotPrincipal = value["NotPrincipal"] !== undefined;
  if (hasPrincipal && hasNotPrincipal) {
    problems.push(`${label}: no puede tener Principal y NotPrincipal a la vez.`);
  }
  if (hasPrincipal) {
    validatePrincipal(value["Principal"], `${label}: Principal`, problems);
  }
  if (hasNotPrincipal) {
    validatePrincipal(value["NotPrincipal"], `${label}: NotPrincipal`, problems);
  }
  const hasAction = value["Action"] !== undefined;
  const hasNotAction = value["NotAction"] !== undefined;
  if (hasAction === hasNotAction) {
    problems.push(`${label}: debe tener exactamente uno de Action o NotAction.`);
  }
  if (hasAction) {
    validateValueList(value["Action"], `${label}: Action`, problems, ACTION_STRING);
  }
  if (hasNotAction) {
    validateValueList(value["NotAction"], `${label}: NotAction`, problems, ACTION_STRING);
  }
  const hasResource = value["Resource"] !== undefined;
  const hasNotResource = value["NotResource"] !== undefined;
  if (hasResource === hasNotResource) {
    problems.push(`${label}: debe tener exactamente uno de Resource o NotResource.`);
  }
  if (hasResource) {
    validateValueList(value["Resource"], `${label}: Resource`, problems, null);
  }
  if (hasNotResource) {
    validateValueList(value["NotResource"], `${label}: NotResource`, problems, null);
  }
  if (value["Condition"] !== undefined) {
    const condition = value["Condition"];
    if (!isRecord(condition)) {
      problems.push(`${label}: Condition debe ser un objeto.`);
    } else {
      for (const [operator, keys] of Object.entries(condition)) {
        if (!isRecord(keys)) {
          problems.push(
            `${label}: el operador «${operator}» de Condition debe contener un objeto clave-valor.`,
          );
        }
      }
    }
  }
}

export function validatePolicy(doc: unknown): string[] {
  if (!isRecord(doc)) {
    return ["La política debe ser un objeto JSON."];
  }
  const problems: string[] = [];
  for (const key of Object.keys(doc)) {
    if (!POLICY_KEYS.includes(key)) {
      problems.push(`El elemento «${key}» no existe en la gramática de políticas.`);
    }
  }
  const version = doc["Version"];
  if (version !== undefined && (typeof version !== "string" || !VALID_VERSIONS.includes(version))) {
    problems.push('Version debe ser "2008-10-17" o "2012-10-17".');
  }
  if (doc["Id"] !== undefined && typeof doc["Id"] !== "string") {
    problems.push("Id debe ser una cadena.");
  }
  const statement = doc["Statement"];
  if (statement === undefined) {
    problems.push("Falta el elemento Statement.");
    return problems;
  }
  const statements: unknown[] = Array.isArray(statement) ? statement : [statement];
  if (statements.length === 0) {
    problems.push("Statement debe contener al menos una sentencia.");
  }
  statements.forEach((item, index) => validateStatement(item, index, problems));
  return problems;
}

type Grant = "direct" | "indirect";
type PrincipalKind = "user" | "role" | "roleSession";

interface PrincipalInfo {
  kind: PrincipalKind;
  arn: string;
  accountId: string;
  roleArn: string | null;
}

interface Hit {
  source: string;
  sid: string | undefined;
  effect: "Allow" | "Deny";
  grant: Grant | null;
  undecidable: string | null;
}

interface Labeled {
  source: string;
  doc: PolicyDocument;
}

interface Collected {
  scps: Hit[][];
  rcps: Hit[][];
  resource: Hit[];
  identity: Hit[];
  boundary: Hit[] | null;
  session: Hit[] | null;
  sameAccount: boolean;
  principal: PrincipalInfo;
}

function asStatements(doc: PolicyDocument): Statement[] {
  return Array.isArray(doc.Statement) ? doc.Statement : [doc.Statement];
}

function parsePrincipal(arn: string, accountId: string): PrincipalInfo | string {
  const session = SESSION_ARN.exec(arn);
  if (session !== null) {
    const [, partition, account, roleName] = session;
    if (account !== accountId) {
      return "La cuenta del ARN del principal no coincide con principal.accountId.";
    }
    return {
      kind: "roleSession",
      arn,
      accountId,
      roleArn: `arn:${partition ?? "aws"}:iam::${account}:role/${roleName ?? ""}`,
    };
  }
  const user = USER_ARN.exec(arn);
  if (user !== null) {
    if (user[2] !== accountId) {
      return "La cuenta del ARN del principal no coincide con principal.accountId.";
    }
    return { kind: "user", arn, accountId, roleArn: null };
  }
  const role = ROLE_ARN.exec(arn);
  if (role !== null) {
    if (role[2] !== accountId) {
      return "La cuenta del ARN del principal no coincide con principal.accountId.";
    }
    return { kind: "role", arn, accountId, roleArn: null };
  }
  return `Tipo de principal no modelado: «${arn}». Solo se modelan usuarios IAM, roles y sesiones de rol.`;
}

function principalGrant(element: unknown, principal: PrincipalInfo): Grant | null {
  if (element === "*") {
    return "indirect";
  }
  if (!isRecord(element)) {
    return null;
  }
  const values = stringList(element["AWS"]);
  if (values === null) {
    return null;
  }
  let result: Grant | null = null;
  for (const value of values) {
    if (value === principal.arn && principal.kind !== "role") {
      return "direct";
    }
    const accountRoot = new RegExp(`^arn:aws[a-z-]*:iam::${principal.accountId}:root$`);
    if (
      value === "*" ||
      value === principal.accountId ||
      accountRoot.test(value) ||
      value === principal.arn ||
      (principal.roleArn !== null && value === principal.roleArn)
    ) {
      result = "indirect";
    }
  }
  return result;
}

function actionApplies(statement: Statement, action: string): boolean {
  if (statement.Action !== undefined) {
    const patterns = stringList(statement.Action) ?? [];
    return patterns.some((pattern) => matchesAction(pattern, action));
  }
  const excluded = stringList(statement.NotAction) ?? [];
  return !excluded.some((pattern) => matchesAction(pattern, action));
}

function resourceApplies(statement: Statement, arn: string): boolean {
  if (statement.Resource !== undefined) {
    const patterns = stringList(statement.Resource) ?? [];
    return patterns.some((pattern) => matchesResource(pattern, arn));
  }
  const excluded = stringList(statement.NotResource) ?? [];
  return !excluded.some((pattern) => matchesResource(pattern, arn));
}

function hitsOf(
  entry: Labeled,
  action: string,
  resourceArn: string,
  principal: PrincipalInfo,
  withPrincipal: boolean,
): Hit[] {
  const hits: Hit[] = [];
  for (const statement of asStatements(entry.doc)) {
    if (!actionApplies(statement, action) || !resourceApplies(statement, resourceArn)) {
      continue;
    }
    let grant: Grant | null = null;
    let undecidable: string | null = null;
    if (withPrincipal) {
      if (statement.NotPrincipal !== undefined) {
        undecidable = NOT_PRINCIPAL_REASON;
      } else if (statement.Principal === undefined) {
        continue;
      } else {
        grant = principalGrant(statement.Principal, principal);
        if (grant === null) {
          continue;
        }
      }
    }
    if (undecidable === null && statement.Condition !== undefined) {
      undecidable = CONDITION_REASON;
    }
    hits.push({
      source: entry.source,
      sid: statement.Sid,
      effect: statement.Effect,
      grant,
      undecidable,
    });
  }
  return hits;
}

function readOne(value: unknown, name: string): Labeled | null | string {
  if (value === undefined || value === null) {
    return null;
  }
  const problems = validatePolicy(value);
  if (problems.length > 0) {
    return `La política ${name} no es válida: ${problems[0] ?? ""}`;
  }
  return { source: name, doc: value as PolicyDocument };
}

function readList(value: unknown, name: string): Labeled[] | string {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return `«${name}» debe ser una lista de políticas.`;
  }
  const result: Labeled[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = readOne(value[index] ?? undefined, `${name}[${index}]`);
    if (typeof entry === "string") {
      return entry;
    }
    if (entry === null) {
      return `La política ${name}[${index}] no es válida: falta el documento.`;
    }
    result.push(entry);
  }
  return result;
}

function readLevels(value: unknown, name: string): Labeled[][] | string {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return `«${name}» debe ser una lista de niveles, cada uno con una lista de políticas.`;
  }
  const levels: Labeled[][] = [];
  for (let index = 0; index < value.length; index += 1) {
    const level = readList(value[index] ?? undefined, `${name}[${index}]`);
    if (typeof level === "string") {
      return level;
    }
    levels.push(level);
  }
  return levels;
}

function implicit(reason: string): EvaluationResult {
  return { decision: "ImplicitDeny", reason, matched: [] };
}

function toMatched(hits: readonly Hit[]): MatchedStatement[] {
  return hits.map((hit) => (hit.sid === undefined ? { source: hit.source } : { source: hit.source, sid: hit.sid }));
}

function describeHit(hit: Hit): string {
  return hit.sid === undefined ? hit.source : `${hit.source} (Sid ${hit.sid})`;
}

function usable(hits: readonly Hit[], effect: "Allow" | "Deny", optimistic: boolean): Hit[] {
  return hits.filter((hit) => {
    if (hit.effect !== effect) {
      return false;
    }
    if (hit.undecidable === null) {
      return true;
    }
    return effect === "Allow" ? optimistic : !optimistic;
  });
}

function decide(collected: Collected, optimistic: boolean): EvaluationResult {
  const denySources: readonly (readonly Hit[])[] = [
    ...collected.scps,
    ...collected.rcps,
    collected.resource,
    collected.identity,
    collected.boundary ?? [],
    collected.session ?? [],
  ];
  const denies = denySources.flatMap((hits) => usable(hits, "Deny", optimistic));
  const firstDeny = denies[0];
  if (firstDeny !== undefined) {
    return {
      decision: "ExplicitDeny",
      reason: `Denegación explícita en ${describeHit(firstDeny)}: una denegación explícita prevalece sobre cualquier permiso.`,
      matched: toMatched(denies),
    };
  }

  const rcpMatched: Hit[] = [];
  for (let level = 0; level < collected.rcps.length; level += 1) {
    const allows = usable(collected.rcps[level] ?? [], "Allow", optimistic);
    if (allows.length === 0) {
      return implicit(
        `Las RCP del nivel ${level + 1} (raíz, UO, cuenta) no permiten la acción: falta un Allow aplicable.`,
      );
    }
    rcpMatched.push(...allows);
  }
  const scpMatched: Hit[] = [];
  for (let level = 0; level < collected.scps.length; level += 1) {
    const allows = usable(collected.scps[level] ?? [], "Allow", optimistic);
    if (allows.length === 0) {
      return implicit(
        `Las SCP del nivel ${level + 1} (raíz, UO, cuenta) no permiten la acción: falta un Allow aplicable.`,
      );
    }
    scpMatched.push(...allows);
  }

  const resourceAllows = usable(collected.resource, "Allow", optimistic);
  const identityAllows = usable(collected.identity, "Allow", optimistic);
  const orgMatched = [...rcpMatched, ...scpMatched];

  if (collected.sameAccount) {
    const direct = resourceAllows.filter((hit) => hit.grant === "direct");
    if (direct.length > 0) {
      return {
        decision: "Allow",
        reason:
          "La política de recurso de la misma cuenta concede el permiso directamente al usuario o a la sesión: no le afecta una denegación implícita de identidad, límite o sesión.",
        matched: toMatched([...orgMatched, ...direct]),
      };
    }
    if (identityAllows.length === 0 && resourceAllows.length === 0) {
      return implicit("Ninguna política de identidad ni de recurso permite la acción: denegación implícita.");
    }
  } else {
    if (identityAllows.length === 0) {
      return implicit(
        "La política de identidad de la cuenta del principal no permite la acción: denegación implícita.",
      );
    }
    if (resourceAllows.length === 0) {
      return implicit(
        "La política de recurso de la cuenta del recurso no concede el permiso al principal: denegación implícita.",
      );
    }
  }

  const boundaryAllows =
    collected.boundary === null ? [] : usable(collected.boundary, "Allow", optimistic);
  if (collected.boundary !== null && boundaryAllows.length === 0) {
    return implicit("El límite de permisos no permite la acción: denegación implícita.");
  }
  const sessionAllows = collected.session === null ? [] : usable(collected.session, "Allow", optimistic);
  if (collected.session !== null && sessionAllows.length === 0) {
    return implicit("Las políticas de sesión no permiten la acción: denegación implícita.");
  }

  return {
    decision: "Allow",
    reason: collected.sameAccount
      ? "Una política de identidad o de recurso permite la acción y ninguna política que la limite la deniega."
      : "Las dos cuentas permiten la acción: la identidad del principal y la política de recurso.",
    matched: toMatched([
      ...orgMatched,
      ...identityAllows,
      ...resourceAllows,
      ...boundaryAllows,
      ...sessionAllows,
    ]),
  };
}

function allHits(collected: Collected): Hit[] {
  return [
    ...collected.scps.flat(),
    ...collected.rcps.flat(),
    ...collected.resource,
    ...collected.identity,
    ...(collected.boundary ?? []),
    ...(collected.session ?? []),
  ];
}

function evaluateCollected(collected: Collected): EvaluationResult {
  const optimistic = decide(collected, true);
  if (optimistic.decision !== "Allow") {
    return optimistic;
  }
  const pessimistic = decide(collected, false);
  if (pessimistic.decision === "Allow") {
    return pessimistic;
  }
  const undecided = allHits(collected).filter((hit) => hit.undecidable !== null);
  return {
    decision: "ImplicitDeny",
    reason: undecided[0]?.undecidable ?? CONDITION_REASON,
    matched: toMatched(undecided),
  };
}

function readAccount(value: unknown): { arn: string; accountId: string } | null {
  if (!isRecord(value)) {
    return null;
  }
  const arn = value["arn"];
  const accountId = value["accountId"];
  if (typeof arn !== "string" || arn === "" || typeof accountId !== "string" || accountId === "") {
    return null;
  }
  return { arn, accountId };
}

function evaluateUnsafe(input: unknown): EvaluationResult {
  if (!isRecord(input) || !isRecord(input["request"])) {
    return implicit("Entrada no válida: falta la solicitud (request).");
  }
  const request = input["request"];
  const principalAccount = readAccount(request["principal"]);
  const resourceAccount = readAccount(request["resource"]);
  const action = request["action"];
  if (principalAccount === null || resourceAccount === null || typeof action !== "string" || action === "") {
    return implicit(
      "Entrada no válida: la solicitud necesita principal, acción y recurso con arn y accountId.",
    );
  }
  const principal = parsePrincipal(principalAccount.arn, principalAccount.accountId);
  if (typeof principal === "string") {
    return implicit(principal);
  }

  const identity = readList(input["identityPolicies"], "identityPolicies");
  if (typeof identity === "string") {
    return implicit(identity);
  }
  const resourcePolicy = readOne(input["resourcePolicy"], "resourcePolicy");
  if (typeof resourcePolicy === "string") {
    return implicit(resourcePolicy);
  }
  const boundary = readOne(input["permissionsBoundary"], "permissionsBoundary");
  if (typeof boundary === "string") {
    return implicit(boundary);
  }
  const scps = readLevels(input["scps"], "scps");
  if (typeof scps === "string") {
    return implicit(scps);
  }
  const rcps = readLevels(input["rcps"], "rcps");
  if (typeof rcps === "string") {
    return implicit(rcps);
  }
  const session = readList(input["sessionPolicies"], "sessionPolicies");
  if (typeof session === "string") {
    return implicit(session);
  }

  const hits = (entries: Labeled[], withPrincipal: boolean): Hit[] =>
    entries.flatMap((entry) => hitsOf(entry, action, resourceAccount.arn, principal, withPrincipal));
  const collected: Collected = {
    scps: scps.map((level) => hits(level, false)),
    rcps: rcps.map((level) => hits(level, true)),
    resource: resourcePolicy === null ? [] : hits([resourcePolicy], true),
    identity: hits(identity, false),
    boundary: boundary === null ? null : hits([boundary], false),
    session: principal.kind === "roleSession" && session.length > 0 ? hits(session, false) : null,
    sameAccount: principal.accountId === resourceAccount.accountId,
    principal,
  };
  return evaluateCollected(collected);
}

export function evaluate(input: EvaluationInput): EvaluationResult {
  try {
    return evaluateUnsafe(input);
  } catch {
    return implicit("Entrada no válida: la evaluación no pudo completarse.");
  }
}
