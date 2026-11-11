import type { EvaluatorCapabilities } from "../core.js";
import { evaluate, validatePolicy } from "../iam/index.js";
import type { PolicyDocument, RequestContext, Statement } from "../iam/index.js";
import { isRecord, stringList } from "../iam/matching.js";

export const capabilities: EvaluatorCapabilities = {
  name: "s3access",
  version: "0.1.0",
  modeled: [
    "Las cuatro opciones de Block Public Access (BlockPublicAcls, IgnorePublicAcls, BlockPublicPolicy y RestrictPublicBuckets), a nivel de cuenta y de bucket: son independientes y, si difieren, se aplica la combinación más restrictiva de los dos niveles",
    "Una opción que no se configura equivale a desactivada; quitar una opción vuelve a dejar pública una política pública, porque Block Public Access no modifica las políticas existentes",
    "Qué hace pública una política de bucket: se parte de que es pública y solo es no pública si concede el acceso únicamente a valores fijos (sin comodín ni variable de política) de un principal o de claves de condición como aws:PrincipalOrgID, aws:SourceIp, aws:SourceArn, aws:SourceVpc, aws:SourceVpce, aws:SourceOwner, aws:SourceAccount, aws:userid, s3:DataAccessPointArn y s3:DataAccessPointAccount",
    "aws:SourceIp con rangos demasiado amplios (más amplios que /8 en IPv4 o que /32 en IPv6) cuenta como pública",
    "s3:DataAccessPointArn con comodín en el nombre del punto de acceso no hace pública la política si el ID de cuenta es fijo",
    "RestrictPublicBuckets: con una política pública, solo se permite el acceso a los usuarios autorizados de la cuenta propietaria del bucket; se bloquea el acceso anónimo y entre cuentas aunque la política delegue en una cuenta concreta",
    "RestrictPublicBuckets no afecta a una política no pública: sigue en vigor tal como está escrita",
    "Decisión de acceso de la política del bucket con la lógica de evaluación de IAM (evaluador iam): denegación explícita, denegación implícita y Condition",
    "Object Ownership: con BucketOwnerEnforced (valor por defecto) las ACL están desactivadas y el acceso depende solo de las políticas",
  ],
  notModeled: [
    "ACL de bucket y de objeto: no se evalúan los permisos que conceden. La guía solo dice que una ACL es pública si concede permisos a los grupos AllUsers o AuthenticatedUsers, y con BucketOwnerPreferred u ObjectWriter el resultado no las incluye",
    "Efecto de BlockPublicAcls, IgnorePublicAcls y BlockPublicPolicy sobre las llamadas Put (PutBucketAcl, PutObjectAcl, PutObject, PutBucketPolicy): solo se evalúan solicitudes de acceso, no la escritura de ACL ni de políticas",
    "Puntos de acceso y sus políticas, la configuración de Block Public Access de un punto de acceso y las políticas de Block Public Access de AWS Organizations",
    "Principales de servicio de AWS (por ejemplo CloudTrail), que RestrictPublicBuckets sí deja pasar: la solicitud solo puede ser anónima o de un usuario o rol IAM",
    "Sentencias Deny y sentencias sin Principal: no cuentan para decidir si una política es pública, porque la guía habla de conceder acceso",
    "Operadores de condición que no sean StringEquals, StringEqualsIgnoreCase, StringLike, ArnEquals, ArnLike e IpAddress, y los calificadores ForAnyValue y ForAllValues, que se tratan igual que sin calificador: la guía solo ilustra StringEquals y StringLike",
    "Los operadores negados y …IfExists no restringen el acceso, así que no hacen no pública una política",
    "La validación de que la acción exista: la guía indica que Block Public Access considera pública una política con una acción que S3 no admite",
    "Rangos privados RFC 1918 con aws:SourceIp: la guía los excluye de la regla de amplitud y aquí no cambian el resultado",
    "El tamaño, el nombre y la sintaxis de las claves de objeto, y cualquier otra característica de S3 como cifrado, versiones o replicación",
  ],
  sources: [
    "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html",
    "https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html",
  ],
};

export type ObjectOwnership = "BucketOwnerEnforced" | "BucketOwnerPreferred" | "ObjectWriter";

export interface BlockPublicAccessSettings {
  readonly BlockPublicAcls?: boolean;
  readonly IgnorePublicAcls?: boolean;
  readonly BlockPublicPolicy?: boolean;
  readonly RestrictPublicBuckets?: boolean;
}

export interface BlockPublicAccessConfig {
  readonly account?: BlockPublicAccessSettings | null;
  readonly bucket?: BlockPublicAccessSettings | null;
}

export interface EffectiveBlockPublicAccess {
  readonly BlockPublicAcls: boolean;
  readonly IgnorePublicAcls: boolean;
  readonly BlockPublicPolicy: boolean;
  readonly RestrictPublicBuckets: boolean;
}

export type S3Principal =
  | { readonly type: "anonymous" }
  | {
      readonly type: "iam";
      readonly arn: string;
      readonly accountId: string;
      readonly identityPolicies?: readonly PolicyDocument[];
    };

export interface S3Request {
  readonly principal: S3Principal;
  readonly action: string;
  readonly resource: { readonly arn: string; readonly accountId: string };
  readonly context?: RequestContext["context"];
}

export interface S3AccessInput {
  readonly blockPublicAccess?: BlockPublicAccessConfig | null;
  readonly bucketPolicy?: PolicyDocument | null;
  readonly objectOwnership?: ObjectOwnership;
  readonly request: S3Request;
}

export interface S3AccessResult {
  allowed: boolean;
  isPublic: boolean;
  reasons: string[];
}

const SETTING_NAMES = [
  "BlockPublicAcls",
  "IgnorePublicAcls",
  "BlockPublicPolicy",
  "RestrictPublicBuckets",
] as const;

const OWNERSHIP_VALUES: readonly string[] = [
  "BucketOwnerEnforced",
  "BucketOwnerPreferred",
  "ObjectWriter",
];

const FIXED_VALUE_KEYS: readonly string[] = [
  "aws:principalorgid",
  "aws:sourcearn",
  "aws:sourcevpc",
  "aws:sourcevpce",
  "aws:sourceowner",
  "aws:sourceaccount",
  "aws:userid",
  "s3:dataaccesspointaccount",
];

const RESTRICTING_OPERATORS: readonly string[] = [
  "stringequals",
  "stringequalsignorecase",
  "stringlike",
  "arnequals",
  "arnlike",
  "ipaddress",
];

const ACCESS_POINT_ARN = /^arn:[^:*$]+:s3:[^:*$]+:\d{12}:accesspoint\/.+$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-fA-F:.]*:[0-9a-fA-F:.]*$/;
const ALLOW_ALL_POLICY: PolicyDocument = {
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }],
};

function isFixed(value: string): boolean {
  return !value.includes("*") && !value.includes("${");
}

function readSettings(value: unknown, label: string, problems: string[]): EffectiveBlockPublicAccess {
  const result = {
    BlockPublicAcls: false,
    IgnorePublicAcls: false,
    BlockPublicPolicy: false,
    RestrictPublicBuckets: false,
  };
  if (value === undefined || value === null) {
    return result;
  }
  if (!isRecord(value)) {
    problems.push(`blockPublicAccess.${label} debe ser un objeto con las cuatro opciones.`);
    return result;
  }
  for (const key of Object.keys(value)) {
    if (!(SETTING_NAMES as readonly string[]).includes(key)) {
      problems.push(`blockPublicAccess.${label}: «${key}» no es una opción de Block Public Access.`);
    }
  }
  for (const name of SETTING_NAMES) {
    const setting = value[name];
    if (setting === undefined) {
      continue;
    }
    if (typeof setting !== "boolean") {
      problems.push(`blockPublicAccess.${label}.${name} debe ser verdadero o falso.`);
    } else {
      result[name] = setting;
    }
  }
  return result;
}

export function effectiveBlockPublicAccess(
  config: BlockPublicAccessConfig | null | undefined,
): EffectiveBlockPublicAccess {
  const ignored: string[] = [];
  const record = isRecord(config) ? config : {};
  const account = readSettings(record["account"], "account", ignored);
  const bucket = readSettings(record["bucket"], "bucket", ignored);
  return {
    BlockPublicAcls: account.BlockPublicAcls || bucket.BlockPublicAcls,
    IgnorePublicAcls: account.IgnorePublicAcls || bucket.IgnorePublicAcls,
    BlockPublicPolicy: account.BlockPublicPolicy || bucket.BlockPublicPolicy,
    RestrictPublicBuckets: account.RestrictPublicBuckets || bucket.RestrictPublicBuckets,
  };
}

function parsePrefix(text: string | undefined, max: number): number | null {
  if (text === undefined) {
    return max;
  }
  if (!/^\d{1,3}$/.test(text)) {
    return null;
  }
  const prefix = Number(text);
  return prefix <= max ? prefix : null;
}

function ipRangeIsNarrow(value: string): boolean {
  const [address = "", prefixText, ...rest] = value.split("/");
  if (rest.length > 0) {
    return false;
  }
  const v4 = IPV4.exec(address);
  if (v4 !== null) {
    if ([v4[1], v4[2], v4[3], v4[4]].some((octet) => Number(octet) > 255)) {
      return false;
    }
    const prefix = parsePrefix(prefixText, 32);
    return prefix !== null && prefix >= 8;
  }
  if (IPV6.test(address)) {
    const prefix = parsePrefix(prefixText, 128);
    return prefix !== null && prefix >= 32;
  }
  return false;
}

function conditionRestricts(key: string, values: readonly string[]): boolean {
  if (values.length === 0) {
    return false;
  }
  const name = key.toLowerCase();
  if (name === "aws:sourceip") {
    return values.every(ipRangeIsNarrow);
  }
  if (name === "s3:dataaccesspointarn") {
    return values.every((value) => {
      if (isFixed(value)) {
        return true;
      }
      const marker = value.indexOf(":accesspoint/");
      return (
        ACCESS_POINT_ARN.test(value) &&
        marker >= 0 &&
        isFixed(value.slice(0, marker)) &&
        !value.includes("${")
      );
    });
  }
  if (FIXED_VALUE_KEYS.includes(name)) {
    return values.every(isFixed);
  }
  return false;
}

function conditionIsRestrictive(condition: unknown): boolean {
  if (!isRecord(condition)) {
    return false;
  }
  for (const [rawOperator, keys] of Object.entries(condition)) {
    const operator = rawOperator
      .replace(/^(ForAnyValue|ForAllValues):/i, "")
      .toLowerCase();
    if (!RESTRICTING_OPERATORS.includes(operator) || !isRecord(keys)) {
      continue;
    }
    for (const [key, value] of Object.entries(keys)) {
      const raw = Array.isArray(value) ? value : [value];
      const values = raw.map((item) => (typeof item === "string" ? item : null));
      if (values.every((item): item is string => item !== null) && conditionRestricts(key, values)) {
        return true;
      }
    }
  }
  return false;
}

function principalIsFixed(principal: unknown): boolean {
  if (!isRecord(principal)) {
    return false;
  }
  const keys = Object.keys(principal);
  if (keys.length === 0) {
    return false;
  }
  for (const key of keys) {
    const values = stringList(principal[key]);
    if (values === null || values.length === 0 || !values.every(isFixed)) {
      return false;
    }
  }
  return true;
}

function statementIsPublic(statement: Statement): boolean {
  if (statement.Effect !== "Allow") {
    return false;
  }
  if (statement.Principal === undefined && statement.NotPrincipal === undefined) {
    return false;
  }
  if (statement.Principal !== undefined && principalIsFixed(statement.Principal)) {
    return false;
  }
  return !conditionIsRestrictive(statement.Condition);
}

export function isPolicyPublic(policy: unknown): boolean {
  try {
    if (policy === undefined || policy === null) {
      return false;
    }
    if (validatePolicy(policy).length > 0) {
      return true;
    }
    const doc = policy as PolicyDocument;
    const statements = Array.isArray(doc.Statement) ? doc.Statement : [doc.Statement];
    return statements.some(statementIsPublic);
  } catch {
    return true;
  }
}

function describeSettings(settings: EffectiveBlockPublicAccess): string {
  const active = SETTING_NAMES.filter((name) => settings[name]);
  return active.length === 0 ? "ninguna activada" : `activadas: ${active.join(", ")}`;
}

function invalid(problems: string[]): S3AccessResult {
  return { allowed: false, isPublic: false, reasons: problems };
}

function pickAnonymousAccount(bucketPolicy: unknown, ownerAccount: string): string {
  const text = JSON.stringify(bucketPolicy ?? null);
  const candidates = ["111111111111", "222222222222", "333333333333", "444444444444"];
  return (
    candidates.find((account) => account !== ownerAccount && !text.includes(account)) ??
    "555555555555"
  );
}

function readRequest(value: unknown, problems: string[]): S3Request | null {
  if (!isRecord(value)) {
    problems.push("Entrada no válida: falta la solicitud (request).");
    return null;
  }
  const principal = value["principal"];
  const resource = value["resource"];
  const action = value["action"];
  if (typeof action !== "string" || action === "") {
    problems.push("La solicitud necesita una acción (por ejemplo «s3:GetObject»).");
  }
  if (
    !isRecord(resource) ||
    typeof resource["arn"] !== "string" ||
    resource["arn"] === "" ||
    typeof resource["accountId"] !== "string" ||
    resource["accountId"] === ""
  ) {
    problems.push("La solicitud necesita un recurso con arn y accountId (la cuenta propietaria del bucket).");
  }
  if (!isRecord(principal) || (principal["type"] !== "anonymous" && principal["type"] !== "iam")) {
    problems.push("El principal debe ser { type: \"anonymous\" } o { type: \"iam\", arn, accountId }.");
  } else if (
    principal["type"] === "iam" &&
    (typeof principal["arn"] !== "string" ||
      principal["arn"] === "" ||
      typeof principal["accountId"] !== "string" ||
      principal["accountId"] === "")
  ) {
    problems.push("Un principal de tipo iam necesita arn y accountId.");
  }
  if (problems.length > 0) {
    return null;
  }
  return value as unknown as S3Request;
}

function evaluateUnsafe(input: unknown): S3AccessResult {
  if (!isRecord(input)) {
    return invalid(["Entrada no válida: se esperaba un objeto."]);
  }
  const problems: string[] = [];
  const config = input["blockPublicAccess"];
  if (config !== undefined && config !== null && !isRecord(config)) {
    problems.push("blockPublicAccess debe ser un objeto con account y bucket.");
  }
  const configRecord = isRecord(config) ? config : {};
  const account = readSettings(configRecord["account"], "account", problems);
  const bucket = readSettings(configRecord["bucket"], "bucket", problems);

  const policy = input["bucketPolicy"];
  if (policy !== undefined && policy !== null) {
    const policyProblems = validatePolicy(policy);
    if (policyProblems.length > 0) {
      problems.push(`La política del bucket no es válida: ${policyProblems[0] ?? ""}`);
    }
  }
  const ownership = input["objectOwnership"] ?? "BucketOwnerEnforced";
  if (typeof ownership !== "string" || !OWNERSHIP_VALUES.includes(ownership)) {
    problems.push("objectOwnership debe ser BucketOwnerEnforced, BucketOwnerPreferred u ObjectWriter.");
  }
  const request = readRequest(input["request"], problems);
  if (problems.length > 0 || request === null) {
    return invalid(problems);
  }

  const effective: EffectiveBlockPublicAccess = {
    BlockPublicAcls: account.BlockPublicAcls || bucket.BlockPublicAcls,
    IgnorePublicAcls: account.IgnorePublicAcls || bucket.IgnorePublicAcls,
    BlockPublicPolicy: account.BlockPublicPolicy || bucket.BlockPublicPolicy,
    RestrictPublicBuckets: account.RestrictPublicBuckets || bucket.RestrictPublicBuckets,
  };
  const reasons: string[] = [
    `Block Public Access efectivo (la combinación más restrictiva de cuenta y bucket): ${describeSettings(effective)}.`,
  ];
  if (ownership === "BucketOwnerEnforced") {
    reasons.push("Las ACL están desactivadas (BucketOwnerEnforced): el acceso depende solo de las políticas.");
  } else if (!effective.IgnorePublicAcls) {
    reasons.push(
      `Las ACL están habilitadas (${String(ownership)}): este evaluador no modela los permisos que conceden las ACL.`,
    );
  }

  const bucketPolicy = policy === undefined || policy === null ? null : (policy as PolicyDocument);
  const policyPublic = isPolicyPublic(bucketPolicy);
  const restricted = policyPublic && effective.RestrictPublicBuckets;
  const isPublic = policyPublic && !effective.RestrictPublicBuckets;
  if (bucketPolicy === null) {
    reasons.push("El bucket no tiene política: no hay nada que conceda acceso.");
  } else if (policyPublic) {
    reasons.push("La política del bucket es pública: concede acceso sin limitarlo a valores fijos.");
    if (effective.BlockPublicPolicy) {
      reasons.push(
        "BlockPublicPolicy solo rechaza guardar políticas públicas nuevas: no modifica la política que ya existe.",
      );
    }
  } else {
    reasons.push("La política del bucket no es pública: solo concede acceso a valores fijos.");
  }

  const principal = request.principal;
  const crossAccount =
    principal.type === "anonymous" || principal.accountId !== request.resource.accountId;
  if (restricted && crossAccount) {
    reasons.push(
      "RestrictPublicBuckets bloquea el acceso anónimo y entre cuentas derivado de una política pública, aunque la política delegue en una cuenta concreta.",
    );
    return { allowed: false, isPublic, reasons };
  }
  if (restricted) {
    reasons.push(
      "RestrictPublicBuckets está activada, pero la solicitud viene de la cuenta propietaria del bucket: se evalúa con normalidad.",
    );
  }

  const owner = request.resource.accountId;
  const anonymousAccount = pickAnonymousAccount(bucketPolicy, owner);
  const outcome = evaluate({
    request: {
      principal:
        principal.type === "anonymous"
          ? { arn: `arn:aws:iam::${anonymousAccount}:user/anonimo`, accountId: anonymousAccount }
          : { arn: principal.arn, accountId: principal.accountId },
      action: request.action,
      resource: { arn: request.resource.arn, accountId: owner },
      ...(request.context === undefined ? {} : { context: request.context }),
    },
    identityPolicies:
      principal.type === "anonymous"
        ? [ALLOW_ALL_POLICY]
        : [...(principal.identityPolicies ?? [])],
    resourcePolicy: bucketPolicy,
  });

  if (outcome.decision === "Allow") {
    reasons.push(
      principal.type === "anonymous"
        ? "La política del bucket concede la acción a cualquier solicitante, incluido el anónimo."
        : outcome.reason,
    );
    return { allowed: true, isPublic, reasons };
  }
  if (outcome.decision === "ExplicitDeny") {
    reasons.push(outcome.reason);
  } else if (principal.type === "anonymous") {
    reasons.push(
      "Ninguna sentencia de la política del bucket concede la acción a solicitudes anónimas: denegación implícita.",
    );
  } else {
    reasons.push(outcome.reason);
  }
  return { allowed: false, isPublic, reasons };
}

export function evaluateS3Access(input: S3AccessInput): S3AccessResult {
  try {
    return evaluateUnsafe(input);
  } catch {
    return invalid(["Entrada no válida: la evaluación no pudo completarse."]);
  }
}

const CANARY_PUBLIC_POLICY: PolicyDocument = {
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Principal: "*", Action: "s3:GetObject", Resource: "arn:aws:s3:::amzn-s3-demo-bucket/*" }],
};

const CANARY_VPC_POLICY: PolicyDocument = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: "*",
      Action: "s3:PutObject",
      Resource: "*",
      Condition: { StringEquals: { "aws:SourceVpc": "vpc-91237329" } },
    },
  ],
};

export function canary(): boolean {
  const request: S3Request = {
    principal: { type: "anonymous" },
    action: "s3:GetObject",
    resource: { arn: "arn:aws:s3:::amzn-s3-demo-bucket/a.txt", accountId: "111122223333" },
  };
  const open = evaluateS3Access({ blockPublicAccess: {}, bucketPolicy: CANARY_PUBLIC_POLICY, request });
  const restricted = evaluateS3Access({
    blockPublicAccess: { bucket: { RestrictPublicBuckets: true } },
    bucketPolicy: CANARY_PUBLIC_POLICY,
    request,
  });
  const accountWins = effectiveBlockPublicAccess({
    account: { IgnorePublicAcls: true },
    bucket: { IgnorePublicAcls: false },
  });
  return (
    open.allowed &&
    open.isPublic &&
    !restricted.allowed &&
    !restricted.isPublic &&
    accountWins.IgnorePublicAcls &&
    isPolicyPublic(CANARY_PUBLIC_POLICY) &&
    !isPolicyPublic(CANARY_VPC_POLICY) &&
    !isPolicyPublic(null)
  );
}
