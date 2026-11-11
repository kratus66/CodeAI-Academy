import type { Issue } from "../cfn/index.js";
import type { EvaluatorCapabilities } from "../core.js";

export type { Issue };

export const capabilities: EvaluatorCapabilities = {
  name: "asl",
  version: "0.1.0",
  modeled: [
    "Estructura de la máquina de estados: StartAt (cadena que coincide con el nombre de un estado), States (objeto de estados), Comment, QueryLanguage (JSONPath o JSONata) y la regla de que la máquina tenga algún estado terminal",
    "Tipos de estado: Task, Pass, Choice, Wait, Succeed, Fail, Parallel y Map",
    "Transiciones: Next debe nombrar un estado existente, Next y End son excluyentes, y los estados que no son terminales necesitan uno de los dos",
    "Succeed, Fail y Choice no admiten Next ni End (Choice usa Next solo dentro de Choices)",
    "Choice con JSONPath: Choices no vacío, una comparación por regla (Variable con ruta de referencia y un operador de comparación con el tipo de valor que le corresponde, incluidas las variantes Path), And y Or con listas no vacías de reglas, Not con una sola regla, Next solo en las reglas de primer nivel y Default existente (su ausencia se avisa)",
    "Wait: exactamente uno entre Seconds, Timestamp, SecondsPath y TimestampPath, con Seconds entero entre 0 y 99.999.999",
    "Task: Resource obligatorio, TimeoutSeconds y HeartbeatSeconds enteros positivos, HeartbeatSeconds menor que TimeoutSeconds y exclusión entre cada campo y su variante Path",
    "Fail: Cause y CausePath no pueden convivir, ni Error y ErrorPath",
    "Retry y Catch (solo en Task, Parallel y Map): ErrorEquals no vacío con nombres de error, States.ALL solo y en el último retrier o catcher, nombres States.* conocidos, Next existente en los catchers, y IntervalSeconds, MaxAttempts, BackoffRate, MaxDelaySeconds y JitterStrategy con sus rangos y valores",
    "Parallel con Branches y Map con ItemProcessor (o el campo obsoleto Iterator): cada sub-máquina se valida de forma recursiva y aislada, sin transiciones hacia fuera, e inalcanzables incluidos",
    "Estados inalcanzables desde StartAt, siguiendo Next, Choices, Default y Catch, y reachableStates(def) con los estados alcanzables del primer nivel",
  ],
  notModeled: [
    "JSONata: en las máquinas o estados con QueryLanguage JSONata solo se validan la estructura, las transiciones, Retry, Catch y las sub-máquinas; no se evalúan las expresiones {% %}, Condition, Arguments, Output ni Assign",
    "Rutas de JSONPath e intrínsecas (States.Format…): solo se comprueba que las rutas de referencia empiecen por $, no su sintaxis ni su resolución",
    "Entrada y salida de cada estado: InputPath, OutputPath, ResultPath, ResultSelector, Parameters, ItemSelector y Result no se evalúan",
    "Map en modo Distributed (ItemReader, ResultWriter, ToleratedFailure…) y los límites de tamaño de la definición",
    "Los ARN de Resource y las integraciones de servicio, Credentials y los permisos del rol de ejecución",
    "TimeoutSeconds de la máquina, Version y la precisión de las marcas de tiempo más allá de su formato general",
    "Comportamiento en ejecución: qué errores captura States.ALL (no States.DataLimitExceeded ni States.Runtime), reintentos agotados, concurrencia y límites de espera",
  ],
  sources: [
    "https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/statemachine-structure.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/state-task.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/state-choice.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/state-parallel.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/state-map-inline.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/state-pass.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/state-wait.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/state-succeed.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/state-fail.html",
    "https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html",
  ],
};

type JsonRecord = Record<string, unknown>;
type ValueKind = "string" | "number" | "boolean" | "timestamp" | "flag";

const STATE_TYPES: readonly string[] = ["Task", "Choice", "Parallel", "Map", "Pass", "Wait", "Succeed", "Fail"];
const RETRY_CATCH_TYPES: readonly string[] = ["Task", "Parallel", "Map"];
const QUERY_LANGUAGES: readonly string[] = ["JSONPath", "JSONata"];
const KNOWN_STATES_ERRORS: readonly string[] = [
  "States.ALL",
  "States.DataLimitExceeded",
  "States.ExceedToleratedFailureThreshold",
  "States.HeartbeatTimeout",
  "States.Http.Socket",
  "States.ItemReaderFailed",
  "States.Permissions",
  "States.ResultWriterFailed",
  "States.Runtime",
  "States.TaskFailed",
  "States.Timeout",
];
const JITTER_STRATEGIES: readonly string[] = ["FULL", "NONE"];
const MAP_MODES: readonly string[] = ["INLINE", "DISTRIBUTED"];
const MAX_SECONDS = 99999999;
const MAX_DELAY_EXCLUSIVE = 31622401;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function buildComparisons(): Readonly<Record<string, ValueKind>> {
  const table: Record<string, ValueKind> = {
    StringMatches: "string",
    IsBoolean: "flag",
    IsNull: "flag",
    IsNumeric: "flag",
    IsPresent: "flag",
    IsString: "flag",
    IsTimestamp: "flag",
    BooleanEquals: "boolean",
    BooleanEqualsPath: "string",
  };
  const kinds: ReadonlyArray<readonly [string, ValueKind]> = [
    ["String", "string"],
    ["Numeric", "number"],
    ["Timestamp", "timestamp"],
  ];
  const suffixes = ["Equals", "GreaterThan", "GreaterThanEquals", "LessThan", "LessThanEquals"];
  for (const [prefix, kind] of kinds) {
    for (const suffix of suffixes) {
      table[`${prefix}${suffix}`] = kind;
      table[`${prefix}${suffix}Path`] = "string";
    }
  }
  return table;
}

const COMPARISONS = buildComparisons();
const LOGICAL_OPERATORS: readonly string[] = ["And", "Or", "Not"];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isExpression(value: unknown): boolean {
  return typeof value === "string" && value.trimStart().startsWith("{%");
}

function has(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined;
}

function at(path: string): string {
  return path === "" ? "$" : path;
}

function child(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function statesPath(path: string): string {
  return child(path, "States");
}

function add(issues: Issue[], path: string, message: string): void {
  issues.push({ path: at(path), message });
}

function targetsOf(state: unknown): string[] {
  if (!isRecord(state)) {
    return [];
  }
  const targets: string[] = [];
  if (state.Type !== "Choice" && typeof state.Next === "string") {
    targets.push(state.Next);
  }
  if (Array.isArray(state.Choices)) {
    for (const rule of state.Choices) {
      if (isRecord(rule) && typeof rule.Next === "string") {
        targets.push(rule.Next);
      }
    }
  }
  if (typeof state.Default === "string") {
    targets.push(state.Default);
  }
  if (Array.isArray(state.Catch)) {
    for (const catcher of state.Catch) {
      if (isRecord(catcher) && typeof catcher.Next === "string") {
        targets.push(catcher.Next);
      }
    }
  }
  return targets;
}

function reachableIn(startAt: unknown, states: JsonRecord): string[] {
  if (typeof startAt !== "string" || !has(states, startAt)) {
    return [];
  }
  const seen: string[] = [startAt];
  for (let index = 0; index < seen.length; index += 1) {
    const current = seen[index];
    if (current === undefined) {
      continue;
    }
    for (const target of targetsOf(states[current])) {
      if (has(states, target) && !seen.includes(target)) {
        seen.push(target);
      }
    }
  }
  return seen;
}

function checkErrorEquals(value: unknown, path: string, position: number, total: number, issues: Issue[]): void {
  const where = child(path, "ErrorEquals");
  if (!Array.isArray(value) || value.length === 0) {
    add(issues, where, "ErrorEquals es obligatorio y debe ser una lista no vacía de nombres de error.");
    return;
  }
  for (let index = 0; index < value.length; index += 1) {
    const name: unknown = value[index];
    if (typeof name !== "string") {
      add(issues, `${where}[${index}]`, "Cada nombre de error debe ser una cadena.");
    } else if (name.startsWith("States.") && !KNOWN_STATES_ERRORS.includes(name)) {
      add(
        issues,
        `${where}[${index}]`,
        `«${name}» no es un nombre de error predefinido: los nombres propios no pueden empezar por «States.».`,
      );
    }
  }
  if (value.includes("States.ALL")) {
    if (value.length > 1) {
      add(issues, where, "States.ALL debe aparecer solo en ErrorEquals.");
    }
    if (position < total - 1) {
      add(issues, where, "States.ALL debe aparecer en el último elemento de la lista.");
    }
  }
}

function checkRetry(retry: unknown, path: string, issues: Issue[]): void {
  const where = child(path, "Retry");
  if (!Array.isArray(retry)) {
    add(issues, where, "Retry debe ser una lista de retriers.");
    return;
  }
  retry.forEach((item: unknown, index) => {
    const here = `${where}[${index}]`;
    if (!isRecord(item)) {
      add(issues, here, "Cada retrier debe ser un objeto.");
      return;
    }
    checkErrorEquals(item.ErrorEquals, here, index, retry.length, issues);
    if (has(item, "IntervalSeconds") && !(isInteger(item.IntervalSeconds) && item.IntervalSeconds >= 1 && item.IntervalSeconds <= MAX_SECONDS)) {
      add(issues, child(here, "IntervalSeconds"), "IntervalSeconds debe ser un entero positivo de hasta 99999999.");
    }
    if (has(item, "MaxAttempts") && !(isInteger(item.MaxAttempts) && item.MaxAttempts >= 0 && item.MaxAttempts <= MAX_SECONDS)) {
      add(issues, child(here, "MaxAttempts"), "MaxAttempts debe ser un entero entre 0 y 99999999.");
    }
    if (has(item, "BackoffRate") && (typeof item.BackoffRate !== "number" || !Number.isFinite(item.BackoffRate))) {
      add(issues, child(here, "BackoffRate"), "BackoffRate debe ser un número.");
    }
    if (has(item, "MaxDelaySeconds") && !(isInteger(item.MaxDelaySeconds) && item.MaxDelaySeconds > 0 && item.MaxDelaySeconds < MAX_DELAY_EXCLUSIVE)) {
      add(issues, child(here, "MaxDelaySeconds"), "MaxDelaySeconds debe ser un entero mayor que 0 y menor que 31622401.");
    }
    if (has(item, "JitterStrategy") && !(typeof item.JitterStrategy === "string" && JITTER_STRATEGIES.includes(item.JitterStrategy))) {
      add(issues, child(here, "JitterStrategy"), "JitterStrategy debe ser FULL o NONE.");
    }
  });
}

function checkCatch(catchers: unknown, path: string, names: ReadonlySet<string>, issues: Issue[]): void {
  const where = child(path, "Catch");
  if (!Array.isArray(catchers)) {
    add(issues, where, "Catch debe ser una lista de catchers.");
    return;
  }
  catchers.forEach((item: unknown, index) => {
    const here = `${where}[${index}]`;
    if (!isRecord(item)) {
      add(issues, here, "Cada catcher debe ser un objeto.");
      return;
    }
    checkErrorEquals(item.ErrorEquals, here, index, catchers.length, issues);
    if (typeof item.Next !== "string") {
      add(issues, child(here, "Next"), "Next es obligatorio en un catcher y debe ser el nombre de un estado.");
    } else if (!names.has(item.Next)) {
      add(issues, child(here, "Next"), `Next apunta a «${item.Next}», que no existe en este bloque de estados.`);
    }
  });
}

function checkRule(rule: unknown, path: string, topLevel: boolean, names: ReadonlySet<string>, issues: Issue[]): void {
  if (!isRecord(rule)) {
    add(issues, path, "Cada regla de Choice debe ser un objeto.");
    return;
  }
  if (topLevel) {
    if (typeof rule.Next !== "string") {
      add(issues, child(path, "Next"), "Cada regla de primer nivel necesita Next con el nombre de un estado.");
    } else if (!names.has(rule.Next)) {
      add(issues, child(path, "Next"), `Next apunta a «${rule.Next}», que no existe en este bloque de estados.`);
    }
  } else if (has(rule, "Next")) {
    add(issues, child(path, "Next"), "Next solo puede aparecer en una regla de primer nivel, no dentro de And, Or o Not.");
  }
  const operators = Object.keys(rule).filter(
    (key) => LOGICAL_OPERATORS.includes(key) || Object.prototype.hasOwnProperty.call(COMPARISONS, key),
  );
  if (operators.length === 0) {
    add(issues, path, "La regla no tiene ningún operador de comparación (And, Or, Not o uno de comparación).");
    return;
  }
  if (operators.length > 1) {
    add(issues, path, `La regla combina varios operadores (${operators.join(", ")}): solo se admite uno.`);
    return;
  }
  const operator = operators[0] ?? "";
  const value = rule[operator];
  const here = child(path, operator);
  if (operator === "And" || operator === "Or") {
    if (!Array.isArray(value) || value.length === 0) {
      add(issues, here, `${operator} debe ser una lista no vacía de reglas.`);
      return;
    }
    value.forEach((inner: unknown, index) => checkRule(inner, `${here}[${index}]`, false, names, issues));
    return;
  }
  if (operator === "Not") {
    if (!isRecord(value)) {
      add(issues, here, "Not debe ser una única regla.");
      return;
    }
    checkRule(value, here, false, names, issues);
    return;
  }
  if (typeof rule.Variable !== "string" || !rule.Variable.startsWith("$")) {
    add(issues, child(path, "Variable"), "Variable es obligatoria en una comparación y debe ser una ruta de referencia que empiece por $.");
  }
  const kind = COMPARISONS[operator];
  if (kind === "string" && operator.endsWith("Path")) {
    if (typeof value !== "string" || !value.startsWith("$")) {
      add(issues, here, `${operator} debe ser una ruta de referencia que empiece por $.`);
    }
  } else if (kind === "string") {
    if (typeof value !== "string") {
      add(issues, here, `${operator} debe ser una cadena.`);
    }
  } else if (kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      add(issues, here, `${operator} debe ser un número.`);
    }
  } else if (kind === "boolean" || kind === "flag") {
    if (typeof value !== "boolean") {
      add(issues, here, `${operator} debe ser true o false.`);
    }
  } else if (kind === "timestamp") {
    if (typeof value !== "string" || !TIMESTAMP.test(value)) {
      add(issues, here, `${operator} debe ser una marca de tiempo RFC3339 con T mayúscula, por ejemplo 2001-01-01T12:00:00Z.`);
    }
  }
}

function checkChoice(state: JsonRecord, path: string, jsonata: boolean, names: ReadonlySet<string>, issues: Issue[]): void {
  const choices = state.Choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    add(issues, child(path, "Choices"), "Choices es obligatorio y debe tener al menos una regla.");
  } else {
    choices.forEach((rule: unknown, index) => {
      const here = `${child(path, "Choices")}[${index}]`;
      if (jsonata) {
        if (!isRecord(rule) || typeof rule.Next !== "string") {
          add(issues, here, "Cada regla de Choice necesita Next con el nombre de un estado.");
        } else if (!names.has(rule.Next)) {
          add(issues, child(here, "Next"), `Next apunta a «${rule.Next}», que no existe en este bloque de estados.`);
        }
      } else {
        checkRule(rule, here, true, names, issues);
      }
    });
  }
  if (!has(state, "Default")) {
    add(issues, path, "Advertencia: el Choice no tiene Default; si ninguna regla se cumple, la máquina falla al no poder hacer la transición.");
  } else if (typeof state.Default !== "string") {
    add(issues, child(path, "Default"), "Default debe ser el nombre de un estado.");
  } else if (!names.has(state.Default)) {
    add(issues, child(path, "Default"), `Default apunta a «${state.Default}», que no existe en este bloque de estados.`);
  }
}

function checkWait(state: JsonRecord, path: string, jsonata: boolean, issues: Issue[]): void {
  const fields = ["Seconds", "Timestamp", "SecondsPath", "TimestampPath"].filter((key) => has(state, key));
  if (fields.length !== 1) {
    add(issues, path, "Wait debe tener exactamente uno entre Seconds, Timestamp, SecondsPath y TimestampPath.");
  }
  const seconds = state.Seconds;
  if (
    has(state, "Seconds") &&
    !(isInteger(seconds) && seconds >= 0 && seconds <= MAX_SECONDS) &&
    !(jsonata && isExpression(seconds))
  ) {
    add(issues, child(path, "Seconds"), "Seconds debe ser un entero entre 0 y 99999999.");
  }
  const timestamp = state.Timestamp;
  if (has(state, "Timestamp") && !(typeof timestamp === "string" && (TIMESTAMP.test(timestamp) || (jsonata && isExpression(timestamp))))) {
    add(issues, child(path, "Timestamp"), "Timestamp debe ser una marca de tiempo RFC3339 con T mayúscula, por ejemplo 2024-08-18T17:33:00Z.");
  }
  for (const key of ["SecondsPath", "TimestampPath"]) {
    const value = state[key];
    if (has(state, key) && !(typeof value === "string" && value.startsWith("$"))) {
      add(issues, child(path, key), `${key} debe ser una ruta de referencia que empiece por $.`);
    }
  }
}

function checkPositiveInteger(state: JsonRecord, key: string, path: string, jsonata: boolean, issues: Issue[]): void {
  const value = state[key];
  if (has(state, key) && !(isInteger(value) && value >= 1) && !(jsonata && isExpression(value))) {
    add(issues, child(path, key), `${key} debe ser un entero positivo distinto de cero.`);
  }
}

function checkTask(state: JsonRecord, path: string, jsonata: boolean, issues: Issue[]): void {
  if (typeof state.Resource !== "string" || state.Resource === "") {
    add(issues, child(path, "Resource"), "Resource es obligatorio en un Task y debe ser una cadena (por ejemplo, un ARN).");
  }
  checkPositiveInteger(state, "TimeoutSeconds", path, jsonata, issues);
  checkPositiveInteger(state, "HeartbeatSeconds", path, jsonata, issues);
  if (has(state, "TimeoutSeconds") && has(state, "TimeoutSecondsPath")) {
    add(issues, path, "Un Task no puede tener TimeoutSeconds y TimeoutSecondsPath a la vez.");
  }
  if (has(state, "HeartbeatSeconds") && has(state, "HeartbeatSecondsPath")) {
    add(issues, path, "Un Task no puede tener HeartbeatSeconds y HeartbeatSecondsPath a la vez.");
  }
  const timeout = state.TimeoutSeconds;
  const heartbeat = state.HeartbeatSeconds;
  if (isInteger(timeout) && isInteger(heartbeat) && heartbeat >= 1 && heartbeat >= timeout) {
    add(issues, child(path, "HeartbeatSeconds"), "HeartbeatSeconds debe ser menor que TimeoutSeconds.");
  }
}

function checkFail(state: JsonRecord, path: string, issues: Issue[]): void {
  if (has(state, "Cause") && has(state, "CausePath")) {
    add(issues, path, "Un Fail puede tener Cause o CausePath, pero no ambos.");
  }
  if (has(state, "Error") && has(state, "ErrorPath")) {
    add(issues, path, "Un Fail puede tener Error o ErrorPath, pero no ambos.");
  }
}

function checkTransition(state: JsonRecord, type: string, path: string, names: ReadonlySet<string>, issues: Issue[]): void {
  if (type === "Succeed" || type === "Fail" || type === "Choice") {
    if (has(state, "Next")) {
      add(issues, child(path, "Next"), `Un estado ${type} no admite Next${type === "Choice" ? " fuera de Choices" : ""}.`);
    }
    if (has(state, "End")) {
      add(issues, child(path, "End"), `Un estado ${type} no admite End.`);
    }
    return;
  }
  const end = state.End;
  if (has(state, "End") && typeof end !== "boolean") {
    add(issues, child(path, "End"), "End debe ser true o false.");
  }
  if (has(state, "Next")) {
    if (end === true) {
      add(issues, path, "Un estado solo puede tener Next o End, no ambos.");
    }
    if (typeof state.Next !== "string") {
      add(issues, child(path, "Next"), "Next debe ser el nombre de un estado.");
    } else if (!names.has(state.Next)) {
      add(issues, child(path, "Next"), `Next apunta a «${state.Next}», que no existe en este bloque de estados.`);
    }
  } else if (end !== true) {
    add(issues, path, "El estado no tiene Next ni End: true, así que la ejecución no sabría cómo continuar.");
  }
}

function checkState(
  name: string,
  state: unknown,
  path: string,
  names: ReadonlySet<string>,
  machineLanguage: string,
  issues: Issue[],
): void {
  if (!isRecord(state)) {
    add(issues, path, `El estado «${name}» debe ser un objeto.`);
    return;
  }
  const type = state.Type;
  if (typeof type !== "string" || !STATE_TYPES.includes(type)) {
    add(
      issues,
      child(path, "Type"),
      `Type es obligatorio y debe ser uno de: ${STATE_TYPES.join(", ")}.`,
    );
    return;
  }
  let language = machineLanguage;
  if (has(state, "QueryLanguage")) {
    const declared = state.QueryLanguage;
    if (typeof declared !== "string" || !QUERY_LANGUAGES.includes(declared)) {
      add(issues, child(path, "QueryLanguage"), "QueryLanguage debe ser JSONPath o JSONata.");
    } else if (machineLanguage === "JSONata" && declared === "JSONPath") {
      add(issues, child(path, "QueryLanguage"), "Una máquina con QueryLanguage JSONata no puede mezclar estados JSONPath.");
    } else {
      language = declared;
    }
  }
  const jsonata = language === "JSONata";
  checkTransition(state, type, path, names, issues);
  if (type === "Task") {
    checkTask(state, path, jsonata, issues);
  } else if (type === "Choice") {
    checkChoice(state, path, jsonata, names, issues);
  } else if (type === "Wait") {
    checkWait(state, path, jsonata, issues);
  } else if (type === "Fail") {
    checkFail(state, path, issues);
  } else if (type === "Parallel") {
    if (!Array.isArray(state.Branches)) {
      add(issues, child(path, "Branches"), "Branches es obligatorio en un Parallel y debe ser una lista de sub-máquinas.");
    } else {
      state.Branches.forEach((branch: unknown, index) => {
        checkMachine(branch, `${child(path, "Branches")}[${index}]`, language, false, issues);
      });
    }
  } else if (type === "Map") {
    checkMap(state, path, language, issues);
  }
  if (RETRY_CATCH_TYPES.includes(type)) {
    if (has(state, "Retry")) {
      checkRetry(state.Retry, path, issues);
    }
    if (has(state, "Catch")) {
      checkCatch(state.Catch, path, names, issues);
    }
  } else {
    for (const key of ["Retry", "Catch"]) {
      if (has(state, key)) {
        add(issues, child(path, key), `${key} solo está disponible en los estados Task, Parallel y Map.`);
      }
    }
  }
}

function checkMap(state: JsonRecord, path: string, language: string, issues: Issue[]): void {
  const field = has(state, "ItemProcessor") ? "ItemProcessor" : "Iterator";
  if (!has(state, "ItemProcessor") && !has(state, "Iterator")) {
    add(issues, child(path, "ItemProcessor"), "ItemProcessor es obligatorio en un Map (el campo Iterator está obsoleto).");
  } else {
    checkMachine(state[field], child(path, field), language, false, issues);
    const processor = state[field];
    if (isRecord(processor) && has(processor, "ProcessorConfig")) {
      const config = processor.ProcessorConfig;
      if (isRecord(config) && has(config, "Mode") && !(typeof config.Mode === "string" && MAP_MODES.includes(config.Mode))) {
        add(issues, child(child(path, field), "ProcessorConfig.Mode"), "Mode debe ser INLINE o DISTRIBUTED.");
      }
    }
  }
  const concurrency = state.MaxConcurrency;
  if (has(state, "MaxConcurrency") && !(isInteger(concurrency) && concurrency >= 0) && !(language === "JSONata" && isExpression(concurrency))) {
    add(issues, child(path, "MaxConcurrency"), "MaxConcurrency debe ser un entero no negativo.");
  }
  if (has(state, "MaxConcurrency") && has(state, "MaxConcurrencyPath")) {
    add(issues, path, "Un Map no puede tener MaxConcurrency y MaxConcurrencyPath a la vez.");
  }
}

function checkMachine(machine: unknown, path: string, inheritedLanguage: string, topLevel: boolean, issues: Issue[]): void {
  if (!isRecord(machine)) {
    add(issues, path, topLevel ? "La definición debe ser un objeto JSON." : "La sub-máquina debe ser un objeto con StartAt y States.");
    return;
  }
  let language = inheritedLanguage;
  if (topLevel) {
    if (has(machine, "QueryLanguage")) {
      const declared = machine.QueryLanguage;
      if (typeof declared !== "string" || !QUERY_LANGUAGES.includes(declared)) {
        add(issues, child(path, "QueryLanguage"), "QueryLanguage debe ser JSONPath o JSONata.");
      } else {
        language = declared;
      }
    }
    if (has(machine, "Comment") && typeof machine.Comment !== "string") {
      add(issues, child(path, "Comment"), "Comment debe ser una cadena.");
    }
  }
  const states = machine.States;
  if (!isRecord(states)) {
    add(issues, child(path, "States"), "States es obligatorio y debe ser un objeto con los estados.");
  }
  const names = new Set<string>(isRecord(states) ? Object.keys(states) : []);
  const startAt = machine.StartAt;
  if (typeof startAt !== "string") {
    add(issues, child(path, "StartAt"), "StartAt es obligatorio y debe ser el nombre de un estado.");
  } else if (isRecord(states) && !names.has(startAt)) {
    add(issues, child(path, "StartAt"), `StartAt apunta a «${startAt}», que no existe en States.`);
  }
  if (!isRecord(states)) {
    return;
  }
  let terminal = false;
  for (const name of names) {
    const state = states[name];
    checkState(name, state, child(statesPath(path), name), names, language, issues);
    if (isRecord(state) && (state.Type === "Succeed" || state.Type === "Fail" || state.End === true)) {
      terminal = true;
    }
  }
  if (names.size > 0 && !terminal) {
    add(issues, statesPath(path), "Ningún estado es terminal: hace falta un Succeed, un Fail o un estado con End: true.");
  }
  if (typeof startAt === "string" && names.has(startAt)) {
    const reachable = reachableIn(startAt, states);
    for (const name of names) {
      if (!reachable.includes(name)) {
        add(issues, child(statesPath(path), name), `El estado «${name}» es inalcanzable desde StartAt «${startAt}».`);
      }
    }
  }
}

/** Valida una máquina de estados en JSONPath; devuelve la lista de problemas (vacía si no hay ninguno). */
export function validateStateMachine(def: unknown): Issue[] {
  const issues: Issue[] = [];
  checkMachine(def, "", "JSONPath", true, issues);
  return issues;
}

/** Nombres de los estados del primer nivel alcanzables desde StartAt, en orden de descubrimiento. */
export function reachableStates(def: unknown): string[] {
  if (!isRecord(def) || !isRecord(def.States)) {
    return [];
  }
  return reachableIn(def.StartAt, def.States);
}

export function canary(): boolean {
  const machine = {
    Comment: "Ejemplo con Choice",
    StartAt: "Lookup",
    States: {
      Lookup: {
        Type: "Task",
        Resource: "arn:aws:lambda:region:123456789012:function:FUNCTION_NAME",
        Retry: [{ ErrorEquals: ["States.Timeout"], MaxAttempts: 0 }, { ErrorEquals: ["States.ALL"] }],
        Catch: [{ ErrorEquals: ["States.ALL"], Next: "Failed" }],
        Next: "Decide",
      },
      Decide: {
        Type: "Choice",
        Choices: [{ Variable: "$.foo", NumericEquals: 1, Next: "Done" }],
        Default: "Failed",
      },
      Done: { Type: "Succeed" },
      Failed: { Type: "Fail", Error: "ErrorA", Cause: "Respuesta no válida" },
    },
  };
  const reachable = reachableStates(machine);
  if (validateStateMachine(machine).length !== 0 || reachable.length !== 4 || reachable[0] !== "Lookup") {
    return false;
  }
  const broken = {
    StartAt: "Missing",
    States: {
      A: { Type: "Pass", Next: "Nowhere" },
      B: { Type: "Pass", End: true },
    },
  };
  const found = validateStateMachine(broken);
  return found.length === 2 && validateStateMachine(null).length === 1 && reachableStates(null).length === 0;
}
