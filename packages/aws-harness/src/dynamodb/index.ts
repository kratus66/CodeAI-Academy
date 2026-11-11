import type { EvaluatorCapabilities } from "../core.js";

export const capabilities: EvaluatorCapabilities = {
  name: "dynamodb",
  version: "0.1.0",
  modeled: [
    "Clave primaria simple (clave de partición) y compuesta (clave de partición y de ordenación)",
    "GetItem solo sobre la tabla y con la clave primaria completa en igualdad; GetItem no se puede usar en un índice secundario",
    "Query sobre la tabla o sobre un índice secundario global (GSI) o local (LSI), nunca Scan",
    "Condición de clave: igualdad obligatoria en la clave de partición y, opcionalmente, una única condición sobre la clave de ordenación con =, <, <=, >, >=, between o begins_with",
    "Una condición de clave no puede usar atributos que no son claves de la tabla o del índice",
    "Índices: un GSI tiene su propia clave de partición y, opcionalmente, de ordenación; un LSI comparte la clave de partición de la tabla y tiene una clave de ordenación distinta de las de la tabla (máximo cinco LSI)",
    "Proyecciones KEYS_ONLY, INCLUDE y ALL: las claves de la tabla y del índice siempre están en el índice; los atributos requeridos fuera de la proyección se señalan como problema",
    "Un patrón que solo se resolvería con Scan devuelve operación nula y un problema que lo explica",
  ],
  notModeled: [
    "Scan: el evaluador nunca lo propone",
    "Claves de varios atributos en los GSI (multi-attribute keys)",
    "Una Query con igualdad en las dos claves de la tabla también es válida; el evaluador propone GetItem, que lee un solo elemento",
    "Expresiones de filtro, de proyección y de condición, y el operador de condición de clave como texto de KeyConditionExpression",
    "Tipos de datos de las claves, tamaños y límites de longitud de los valores",
    "Cuotas distintas del máximo de cinco LSI, y el límite de 100 atributos proyectados por tabla",
    "Capacidad, lecturas consistentes, paginación, costes y distribución de las claves de partición",
    "Índices dispersos: un elemento sin los atributos de clave del índice no aparece en él",
  ],
  sources: [
    "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html",
    "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html",
    "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html",
    "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html",
    "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html",
  ],
};

export type ProjectionType = "KEYS_ONLY" | "INCLUDE" | "ALL";

export interface IndexProjection {
  readonly type: ProjectionType;
  readonly attributes?: readonly string[];
}

export interface GlobalIndexModel {
  readonly name: string;
  readonly partitionKey: string;
  readonly sortKey?: string;
  readonly projection: IndexProjection;
}

export interface LocalIndexModel {
  readonly name: string;
  readonly sortKey: string;
  readonly projection: IndexProjection;
}

export interface TableModel {
  readonly partitionKey: string;
  readonly sortKey?: string;
  readonly gsis?: readonly GlobalIndexModel[];
  readonly lsis?: readonly LocalIndexModel[];
}

export type KeyOperator = "=" | "<" | "<=" | ">" | ">=" | "between" | "begins_with";

export interface KeyConditionClause {
  readonly attribute: string;
  readonly operator: KeyOperator;
}

export interface AccessPattern {
  readonly name: string;
  readonly index?: string;
  readonly keyCondition: readonly KeyConditionClause[];
  readonly requiredAttributes?: readonly string[];
}

export interface AccessPlan {
  operation: "GetItem" | "Query" | null;
  index: string | null;
  problems: string[];
}

const OPERATORS: readonly string[] = ["=", "<", "<=", ">", ">=", "between", "begins_with"];
const PROJECTION_TYPES: readonly string[] = ["KEYS_ONLY", "INCLUDE", "ALL"];
const MAX_LSIS = 5;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

interface Target {
  readonly index: string | null;
  readonly kind: "table" | "gsi" | "lsi";
  readonly partitionKey: string;
  readonly sortKey: string | null;
  readonly available: ReadonlySet<string> | null;
}

function describeTarget(target: Target): string {
  if (target.kind === "table") {
    return "la tabla";
  }
  return target.kind === "gsi"
    ? `el índice global «${target.index ?? ""}»`
    : `el índice local «${target.index ?? ""}»`;
}

function readProjection(
  value: unknown,
  label: string,
  problems: string[],
): { type: ProjectionType; attributes: string[] } | null {
  if (!isRecord(value) || typeof value.type !== "string" || !PROJECTION_TYPES.includes(value.type)) {
    problems.push(`${label}: la proyección debe ser KEYS_ONLY, INCLUDE o ALL.`);
    return null;
  }
  const type = value.type as ProjectionType;
  const attributes = value.attributes;
  if (type === "INCLUDE") {
    if (!isStringArray(attributes) || attributes.length === 0 || !attributes.every(isName)) {
      problems.push(`${label}: la proyección INCLUDE necesita una lista no vacía de atributos.`);
      return null;
    }
    return { type, attributes: [...attributes] };
  }
  return { type, attributes: [] };
}

function buildTargets(table: unknown): { problems: string[]; targets: Target[] } {
  const problems: string[] = [];
  const targets: Target[] = [];
  if (!isRecord(table)) {
    return { problems: ["La tabla debe ser un objeto con partitionKey."], targets };
  }
  const partitionKey = table.partitionKey;
  if (!isName(partitionKey)) {
    problems.push("La tabla necesita una clave de partición (partitionKey) con nombre.");
    return { problems, targets };
  }
  let tableSortKey: string | null = null;
  if (table.sortKey !== undefined) {
    if (!isName(table.sortKey)) {
      problems.push("La clave de ordenación de la tabla (sortKey) debe ser un nombre de atributo.");
    } else if (table.sortKey === partitionKey) {
      problems.push("La clave de ordenación de la tabla no puede ser el mismo atributo que la clave de partición.");
    } else {
      tableSortKey = table.sortKey;
    }
  }
  targets.push({ index: null, kind: "table", partitionKey, sortKey: tableSortKey, available: null });
  const tableKeys = [partitionKey, ...(tableSortKey === null ? [] : [tableSortKey])];
  const seen = new Set<string>();

  const readIndexes = (value: unknown, kind: "gsi" | "lsi"): void => {
    if (value === undefined) {
      return;
    }
    const noun = kind === "gsi" ? "gsis" : "lsis";
    if (!Array.isArray(value)) {
      problems.push(`La propiedad ${noun} debe ser una lista de índices.`);
      return;
    }
    if (kind === "lsi" && value.length > MAX_LSIS) {
      problems.push(`Una tabla admite como máximo ${MAX_LSIS} índices secundarios locales.`);
    }
    for (const entry of value) {
      if (!isRecord(entry) || !isName(entry.name)) {
        problems.push(`Cada elemento de ${noun} debe ser un objeto con nombre.`);
        continue;
      }
      const name = entry.name;
      const label = kind === "gsi" ? `Índice global «${name}»` : `Índice local «${name}»`;
      if (seen.has(name)) {
        problems.push(`${label}: el nombre del índice está repetido.`);
        continue;
      }
      seen.add(name);
      const projection = readProjection(entry.projection, label, problems);
      let indexPartition = partitionKey;
      let indexSort: string | null = null;
      let valid = projection !== null;
      if (kind === "gsi") {
        if (!isName(entry.partitionKey)) {
          problems.push(`${label}: necesita una clave de partición (partitionKey).`);
          valid = false;
        } else {
          indexPartition = entry.partitionKey;
        }
        if (entry.sortKey !== undefined) {
          if (!isName(entry.sortKey)) {
            problems.push(`${label}: la clave de ordenación debe ser un nombre de atributo.`);
            valid = false;
          } else if (entry.sortKey === indexPartition) {
            problems.push(`${label}: la clave de ordenación no puede ser la misma que la de partición.`);
            valid = false;
          } else {
            indexSort = entry.sortKey;
          }
        }
      } else {
        if (entry.partitionKey !== undefined && entry.partitionKey !== partitionKey) {
          problems.push(`${label}: un índice local comparte la clave de partición de la tabla («${partitionKey}»).`);
          valid = false;
        }
        if (!isName(entry.sortKey)) {
          problems.push(`${label}: necesita una clave de ordenación (sortKey) de un único atributo.`);
          valid = false;
        } else if (tableKeys.includes(entry.sortKey)) {
          problems.push(`${label}: su clave de ordenación debe ser un atributo que no sea clave de la tabla.`);
          valid = false;
        } else {
          indexSort = entry.sortKey;
        }
      }
      if (!valid || projection === null) {
        continue;
      }
      const available: Set<string> | null =
        projection.type === "ALL"
          ? null
          : new Set([...tableKeys, indexPartition, ...(indexSort === null ? [] : [indexSort]), ...projection.attributes]);
      targets.push({ index: name, kind, partitionKey: indexPartition, sortKey: indexSort, available });
    }
  };

  readIndexes(table.gsis, "gsi");
  readIndexes(table.lsis, "lsi");
  return { problems, targets };
}

export function validateTable(table: unknown): string[] {
  return buildTargets(table).problems;
}

function patternProblems(pattern: unknown): string[] {
  if (!isRecord(pattern)) {
    return ["El patrón de acceso debe ser un objeto."];
  }
  const problems: string[] = [];
  if (!isName(pattern.name)) {
    problems.push("El patrón de acceso necesita un nombre.");
  }
  if (pattern.index !== undefined && pattern.index !== null && typeof pattern.index !== "string") {
    problems.push("El índice del patrón debe ser el nombre de un índice.");
  }
  if (!Array.isArray(pattern.keyCondition) || pattern.keyCondition.length === 0) {
    problems.push("La condición de clave debe ser una lista con al menos una condición.");
  } else {
    for (const clause of pattern.keyCondition) {
      if (!isRecord(clause) || !isName(clause.attribute)) {
        problems.push("Cada condición de clave necesita el nombre del atributo.");
      } else if (typeof clause.operator !== "string" || !OPERATORS.includes(clause.operator)) {
        problems.push(
          `Operador «${String(clause.operator)}» no válido en una condición de clave: use =, <, <=, >, >=, between o begins_with.`,
        );
      }
    }
  }
  if (
    pattern.requiredAttributes !== undefined &&
    (!isStringArray(pattern.requiredAttributes) || !pattern.requiredAttributes.every(isName))
  ) {
    problems.push("Los atributos requeridos deben ser una lista de nombres.");
  }
  return problems;
}

function keyConditionProblems(target: Target, clauses: readonly KeyConditionClause[]): string[] {
  const where = describeTarget(target);
  const problems: string[] = [];
  const onPartition = clauses.filter((clause) => clause.attribute === target.partitionKey);
  if (onPartition.length === 0) {
    problems.push(
      `Falta la condición de igualdad sobre la clave de partición «${target.partitionKey}» de ${where}.`,
    );
  } else if (onPartition.length > 1) {
    problems.push(`La clave de partición «${target.partitionKey}» de ${where} admite una única condición de igualdad.`);
  } else if (onPartition[0]?.operator !== "=") {
    problems.push(
      `La clave de partición «${target.partitionKey}» de ${where} solo admite igualdad (=), no «${onPartition[0]?.operator ?? ""}».`,
    );
  }
  if (target.sortKey !== null) {
    const onSort = clauses.filter((clause) => clause.attribute === target.sortKey);
    if (onSort.length > 1) {
      problems.push(
        `La clave de ordenación «${target.sortKey}» de ${where} admite un único operador, pero hay ${onSort.length} condiciones.`,
      );
    }
  }
  for (const clause of clauses) {
    if (clause.attribute !== target.partitionKey && clause.attribute !== target.sortKey) {
      problems.push(
        `«${clause.attribute}» no es una clave de ${where}: una condición de clave no puede usar atributos que no son claves.`,
      );
    }
  }
  return problems;
}

function missingAttributes(target: Target, required: readonly string[]): string[] {
  if (target.available === null) {
    return [];
  }
  const available = target.available;
  return required.filter((attribute) => !available.has(attribute));
}

function chooseOperation(target: Target, clauses: readonly KeyConditionClause[]): "GetItem" | "Query" {
  if (target.kind !== "table") {
    return "Query";
  }
  if (target.sortKey === null) {
    return "GetItem";
  }
  const onSort = clauses.find((clause) => clause.attribute === target.sortKey);
  return onSort?.operator === "=" ? "GetItem" : "Query";
}

function planPattern(targets: readonly Target[], pattern: unknown): AccessPlan {
  const shape = patternProblems(pattern);
  if (shape.length > 0 || !isRecord(pattern)) {
    return { operation: null, index: null, problems: shape };
  }
  const clauses = pattern.keyCondition as KeyConditionClause[];
  const required = Array.isArray(pattern.requiredAttributes) ? (pattern.requiredAttributes as string[]) : [];
  const requested = typeof pattern.index === "string" ? pattern.index : null;

  let chosen: Target | null = null;
  if (requested !== null) {
    const found = targets.find((target) => target.index === requested);
    if (found === undefined) {
      return {
        operation: null,
        index: null,
        problems: [`El índice «${requested}» no existe en la tabla o no es válido.`],
      };
    }
    const reasons = keyConditionProblems(found, clauses);
    if (reasons.length > 0) {
      return { operation: null, index: null, problems: reasons };
    }
    chosen = found;
  } else {
    const fitting = targets.filter((target) => keyConditionProblems(target, clauses).length === 0);
    chosen = fitting.find((target) => missingAttributes(target, required).length === 0) ?? fitting[0] ?? null;
    if (chosen === null) {
      const closest =
        targets.find((target) => clauses.some((clause) => clause.attribute === target.partitionKey)) ?? targets[0];
      return {
        operation: null,
        index: null,
        problems: [
          "Este patrón solo se resolvería con Scan: ninguna clave de la tabla ni de sus índices admite esta condición de clave con Query.",
          ...(closest === undefined ? [] : keyConditionProblems(closest, clauses)),
        ],
      };
    }
  }

  const problems: string[] = [];
  const missing = missingAttributes(chosen, required);
  if (missing.length > 0) {
    const list = missing.map((attribute) => `«${attribute}»`).join(", ");
    problems.push(
      chosen.kind === "lsi"
        ? `Los atributos ${list} no están proyectados en ${describeTarget(chosen)}: DynamoDB los leería de la tabla con mayor latencia y coste. Proyéctelos en el índice.`
        : `Los atributos ${list} no están proyectados en ${describeTarget(chosen)}: habría que consultar además la tabla base. Proyéctelos en el índice.`,
    );
  }
  return { operation: chooseOperation(chosen, clauses), index: chosen.index, problems };
}

export function planAccessPatterns(table: TableModel, patterns: readonly AccessPattern[]): AccessPlan[] {
  if (!Array.isArray(patterns)) {
    return [];
  }
  const { problems, targets } = buildTargets(table);
  if (problems.length > 0) {
    return patterns.map(() => ({ operation: null, index: null, problems: [...problems] }));
  }
  return patterns.map((pattern) => planPattern(targets, pattern));
}

export function canary(): boolean {
  const table: TableModel = {
    partitionKey: "UserId",
    sortKey: "GameTitle",
    gsis: [
      {
        name: "GameTitleIndex",
        partitionKey: "GameTitle",
        sortKey: "TopScore",
        projection: { type: "KEYS_ONLY" },
      },
    ],
  };
  const plans = planAccessPatterns(table, [
    {
      name: "item",
      keyCondition: [
        { attribute: "UserId", operator: "=" },
        { attribute: "GameTitle", operator: "=" },
      ],
    },
    { name: "porUsuario", keyCondition: [{ attribute: "UserId", operator: "=" }] },
    {
      name: "ranking",
      keyCondition: [
        { attribute: "GameTitle", operator: "=" },
        { attribute: "TopScore", operator: ">=" },
      ],
    },
    { name: "soloPuntos", keyCondition: [{ attribute: "TopScore", operator: "=" }] },
  ]);
  return (
    plans[0]?.operation === "GetItem" &&
    plans[0].index === null &&
    plans[1]?.operation === "Query" &&
    plans[2]?.operation === "Query" &&
    plans[2].index === "GameTitleIndex" &&
    plans[3]?.operation === null &&
    plans[3].problems.length > 0
  );
}
