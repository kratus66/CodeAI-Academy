import type { QuizGradeResult, QuizKind, QuizSubmissionInput } from "@codeai/shared";
import { QUIZ_KINDS } from "@codeai/shared";

/**
 * Corrector puro de las cuatro variantes de quiz (`S14-T7a`).
 *
 * No lanza, no conoce HTTP ni Prisma y no persiste nada: recibe el `config` y la
 * `solution` del ejercicio tal como llegan de la base (`unknown`, se leen con
 * *narrowing*) y la respuesta ya validada por `quizSubmissionSchema`, y devuelve
 * la corrección. El servicio (T7b) traduce cada estado a una respuesta HTTP.
 *
 * Orden de las comprobaciones: primero el contenido roto (un ejercicio mal
 * sembrado es un error del servidor, no del estudiante), después la forma de la
 * respuesta y por último las reglas de la variante. Todo o nada: no existe el
 * acierto parcial (`S14`, regla 2).
 */

export const UNKNOWN_OPTION = "La opción no existe en este quiz";
export const WRONG_ANSWER_SHAPE = "La respuesta no corresponde al tipo de pregunta";
export const UNKNOWN_ITEM = "El elemento no existe en esta pregunta";
export const incompleteSelection = (count: number): string =>
  `Selecciona exactamente ${count} opciones`;
export const INCOMPLETE_ORDER = "Ordena todos los elementos, sin repetir ninguno";
export const INCOMPLETE_PAIRS = "Empareja cada elemento con una opción distinta";

/** Límites de `quizGradeResultSchema`: un contenido fuera de ellos no se puede servir. */
const MIN_CORRECT_OPTIONS = 2;
const MAX_CORRECT_OPTIONS = 3;
const MIN_ORDERING_ITEMS = 3;
const MAX_ORDERING_ITEMS = 6;

export type QuizGrading =
  | { readonly status: "graded"; readonly result: QuizGradeResult; readonly submissionCode: string }
  | { readonly status: "invalid-answer"; readonly message: string }
  | { readonly status: "broken-content" };

export interface SingleQuiz {
  readonly kind: "single";
  readonly optionIds: readonly string[];
  readonly correctOptionId: string;
  readonly explanations: Readonly<Record<string, string>>;
}

export interface MultipleQuiz {
  readonly kind: "multiple";
  readonly optionIds: readonly string[];
  readonly selectCount: number;
  readonly correctOptionIds: readonly string[];
  readonly explanations: Readonly<Record<string, string>>;
}

export interface OrderingQuiz {
  readonly kind: "ordering";
  readonly itemIds: readonly string[];
  readonly correctOrder: readonly string[];
  readonly explanations: Readonly<Record<string, string>>;
}

export interface MatchingQuiz {
  readonly kind: "matching";
  readonly leftIds: readonly string[];
  readonly rightIds: readonly string[];
  readonly correctPairs: Readonly<Record<string, string>>;
  readonly explanations: Readonly<Record<string, string>>;
}

export type QuizContent = SingleQuiz | MultipleQuiz | OrderingQuiz | MatchingQuiz;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isEmptyRecord(record: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(record).length === 0;
}

function isQuizKind(value: unknown): value is QuizKind {
  return typeof value === "string" && QUIZ_KINDS.some((kind) => kind === value);
}

/** Ids de una lista de elementos `[{ id, text }]`; `null` si falta, viene vacía o repite. */
function readElementIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const ids: string[] = [];

  for (const entry of value) {
    const id = asRecord(entry).id;

    if (typeof id !== "string" || id.length === 0) {
      return null;
    }

    ids.push(id);
  }

  return new Set(ids).size === ids.length ? ids : null;
}

/** Lista de ids (texto) sin repetir; `null` si falta, viene vacía o repite. */
function readIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const ids: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string" || entry.length === 0) {
      return null;
    }

    ids.push(entry);
  }

  return new Set(ids).size === ids.length ? ids : null;
}

/** `explanations`: cada entrada debe ser un texto no vacío. */
function readExplanations(value: unknown): Record<string, string> | null {
  const record = asRecord(value);
  const explanations: Record<string, string> = {};

  for (const [id, text] of Object.entries(record)) {
    if (typeof text !== "string" || text.length === 0) {
      return null;
    }

    explanations[id] = text;
  }

  return isEmptyRecord(explanations) ? null : explanations;
}

/** Parejas izquierda → derecha: cada valor debe ser un texto no vacío. */
function readPairs(value: unknown): Record<string, string> | null {
  const record = asRecord(value);
  const pairs: Record<string, string> = {};

  for (const [left, right] of Object.entries(record)) {
    if (typeof right !== "string" || right.length === 0) {
      return null;
    }

    pairs[left] = right;
  }

  return isEmptyRecord(pairs) ? null : pairs;
}

function hasExplanations(
  explanations: Readonly<Record<string, string>>,
  ids: readonly string[],
): boolean {
  return ids.every((id) => typeof explanations[id] === "string");
}

/** Texto de un id ya validado: el `?? ""` sustituye al `!` y no se alcanza. */
function valueAt(record: Readonly<Record<string, string>>, key: string): string {
  return record[key] ?? "";
}

/** Explicaciones de los ids indicados, en ese orden y sin añadir ninguna más. */
function pickExplanations(
  explanations: Readonly<Record<string, string>>,
  ids: readonly string[],
): Record<string, string> {
  const picked: Record<string, string> = {};

  for (const id of ids) {
    picked[id] = valueAt(explanations, id);
  }

  return picked;
}

function readSingle(
  config: Readonly<Record<string, unknown>>,
  solution: Readonly<Record<string, unknown>>,
): SingleQuiz | null {
  const optionIds = readElementIds(config.options);
  const explanations = readExplanations(solution.explanations);
  const correctOptionId = solution.correctOptionId;

  if (
    optionIds === null ||
    explanations === null ||
    typeof correctOptionId !== "string" ||
    !optionIds.includes(correctOptionId) ||
    !hasExplanations(explanations, optionIds)
  ) {
    return null;
  }

  return { kind: "single", optionIds, correctOptionId, explanations };
}

function readMultiple(
  config: Readonly<Record<string, unknown>>,
  solution: Readonly<Record<string, unknown>>,
): MultipleQuiz | null {
  const optionIds = readElementIds(config.options);
  const explanations = readExplanations(solution.explanations);
  const selectCount = config.selectCount;
  const correctOptionIds = readIds(solution.correctOptionIds);

  if (
    optionIds === null ||
    explanations === null ||
    correctOptionIds === null ||
    typeof selectCount !== "number" ||
    !Number.isInteger(selectCount) ||
    correctOptionIds.length < MIN_CORRECT_OPTIONS ||
    correctOptionIds.length > MAX_CORRECT_OPTIONS ||
    selectCount !== correctOptionIds.length ||
    correctOptionIds.some((id) => !optionIds.includes(id)) ||
    !hasExplanations(explanations, optionIds)
  ) {
    return null;
  }

  return { kind: "multiple", optionIds, selectCount, correctOptionIds, explanations };
}

function readOrdering(
  config: Readonly<Record<string, unknown>>,
  solution: Readonly<Record<string, unknown>>,
): OrderingQuiz | null {
  const itemIds = readElementIds(config.items);
  const explanations = readExplanations(solution.explanations);
  const correctOrder = readIds(solution.correctOrder);

  if (
    itemIds === null ||
    explanations === null ||
    correctOrder === null ||
    itemIds.length < MIN_ORDERING_ITEMS ||
    itemIds.length > MAX_ORDERING_ITEMS ||
    correctOrder.length !== itemIds.length ||
    correctOrder.some((id) => !itemIds.includes(id)) ||
    !hasExplanations(explanations, itemIds)
  ) {
    return null;
  }

  return { kind: "ordering", itemIds, correctOrder, explanations };
}

function readMatching(
  config: Readonly<Record<string, unknown>>,
  solution: Readonly<Record<string, unknown>>,
): MatchingQuiz | null {
  const leftIds = readElementIds(config.left);
  const rightIds = readElementIds(config.right);
  const explanations = readExplanations(solution.explanations);
  const correctPairs = readPairs(solution.correctPairs);

  if (leftIds === null || rightIds === null || explanations === null || correctPairs === null) {
    return null;
  }

  const pairKeys = Object.keys(correctPairs);
  const pairValues = Object.values(correctPairs);

  if (
    pairKeys.length !== leftIds.length ||
    leftIds.some((id) => !pairKeys.includes(id)) ||
    pairValues.some((id) => !rightIds.includes(id)) ||
    new Set(pairValues).size !== pairValues.length ||
    !hasExplanations(explanations, leftIds)
  ) {
    return null;
  }

  return { kind: "matching", leftIds, rightIds, correctPairs, explanations };
}

/**
 * Lee `config` y `solution` sin confiar en su forma (`S14-T5`). `null` significa
 * contenido roto: falta una pieza, la solución apunta a un id que no existe, los
 * dos `kind` no coinciden o falta alguna explicación.
 *
 * Se exporta para que el simulador revele la respuesta correcta de las preguntas
 * sin responder (`S15-T4b`); el corrector de unidades no cambia.
 */
export function readQuizContent(config: unknown, solution: unknown): QuizContent | null {
  const configRecord = asRecord(config);
  const solutionRecord = asRecord(solution);

  if (isEmptyRecord(configRecord) || isEmptyRecord(solutionRecord)) {
    return null;
  }

  const declaredKind = configRecord.kind;
  const kind = declaredKind === undefined ? "single" : declaredKind;

  if (!isQuizKind(kind)) {
    return null;
  }

  if (solutionRecord.kind !== undefined && solutionRecord.kind !== kind) {
    return null;
  }

  switch (kind) {
    case "single":
      return readSingle(configRecord, solutionRecord);
    case "multiple":
      return readMultiple(configRecord, solutionRecord);
    case "ordering":
      return readOrdering(configRecord, solutionRecord);
    case "matching":
      return readMatching(configRecord, solutionRecord);
  }
}

function invalidAnswer(message: string): QuizGrading {
  return { status: "invalid-answer", message };
}

/** `single`: igual que antes de las variantes, con `kind` en el resultado. */
function gradeSingle(quiz: SingleQuiz, answer: QuizSubmissionInput): QuizGrading {
  const optionId = answer.optionId;

  if (typeof optionId !== "string") {
    return invalidAnswer(WRONG_ANSWER_SHAPE);
  }

  if (!quiz.optionIds.includes(optionId)) {
    return invalidAnswer(UNKNOWN_OPTION);
  }

  return {
    status: "graded",
    result: {
      kind: "single",
      correct: optionId === quiz.correctOptionId,
      correctOptionId: quiz.correctOptionId,
      explanation: valueAt(quiz.explanations, optionId),
      correctExplanation: valueAt(quiz.explanations, quiz.correctOptionId),
    },
    submissionCode: optionId,
  };
}

/** `multiple`: el conjunto elegido debe ser exactamente el correcto. */
function gradeMultiple(quiz: MultipleQuiz, answer: QuizSubmissionInput): QuizGrading {
  const selected = answer.optionIds;

  if (selected === undefined) {
    return invalidAnswer(WRONG_ANSWER_SHAPE);
  }

  if (selected.length !== quiz.selectCount) {
    return invalidAnswer(incompleteSelection(quiz.selectCount));
  }

  if (selected.some((id) => !quiz.optionIds.includes(id))) {
    return invalidAnswer(UNKNOWN_OPTION);
  }

  const selectedSet = new Set(selected);
  const correct =
    selectedSet.size === quiz.correctOptionIds.length &&
    quiz.correctOptionIds.every((id) => selectedSet.has(id));

  return {
    status: "graded",
    result: {
      kind: "multiple",
      correct,
      correctOptionIds: [...quiz.correctOptionIds],
      selectedOptionIds: [...selected],
      explanations: pickExplanations(quiz.explanations, [
        ...new Set([...selected, ...quiz.correctOptionIds]),
      ]),
    },
    submissionCode: [...selected].sort().join(","),
  };
}

/**
 * `ordering`: la secuencia debe ser exactamente la correcta. Un id que no existe
 * se informa antes que los elementos que faltan: sin él no se puede evaluar la
 * completitud (prioridad fijada en `S14-T7a`).
 */
function gradeOrdering(quiz: OrderingQuiz, answer: QuizSubmissionInput): QuizGrading {
  const order = answer.order;

  if (order === undefined) {
    return invalidAnswer(WRONG_ANSWER_SHAPE);
  }

  if (order.some((id) => !quiz.itemIds.includes(id))) {
    return invalidAnswer(UNKNOWN_ITEM);
  }

  if (order.length !== quiz.itemIds.length || new Set(order).size !== order.length) {
    return invalidAnswer(INCOMPLETE_ORDER);
  }

  return {
    status: "graded",
    result: {
      kind: "ordering",
      correct: order.every((id, index) => quiz.correctOrder[index] === id),
      correctOrder: [...quiz.correctOrder],
      explanations: pickExplanations(quiz.explanations, quiz.itemIds),
    },
    submissionCode: order.join(">"),
  };
}

/** `matching`: una clave por elemento de la izquierda y todas las parejas correctas. */
function gradeMatching(quiz: MatchingQuiz, answer: QuizSubmissionInput): QuizGrading {
  const pairs = answer.pairs;

  if (pairs === undefined) {
    return invalidAnswer(WRONG_ANSWER_SHAPE);
  }

  const keys = Object.keys(pairs);
  const values = Object.values(pairs);

  if (keys.some((id) => !quiz.leftIds.includes(id))) {
    return invalidAnswer(UNKNOWN_ITEM);
  }

  if (values.some((id) => !quiz.rightIds.includes(id))) {
    return invalidAnswer(UNKNOWN_ITEM);
  }

  if (
    keys.length !== quiz.leftIds.length ||
    quiz.leftIds.some((id) => !keys.includes(id)) ||
    new Set(values).size !== values.length
  ) {
    return invalidAnswer(INCOMPLETE_PAIRS);
  }

  return {
    status: "graded",
    result: {
      kind: "matching",
      correct: quiz.leftIds.every((id) => valueAt(pairs, id) === valueAt(quiz.correctPairs, id)),
      correctPairs: { ...quiz.correctPairs },
      explanations: pickExplanations(quiz.explanations, quiz.leftIds),
    },
    submissionCode: [...keys]
      .sort()
      .map((id) => `${id}=${valueAt(pairs, id)}`)
      .join(","),
  };
}

/** Corrige una respuesta ya recibida: nunca lanza, siempre devuelve un estado. */
export function gradeQuizAnswer(
  exercise: { readonly config: unknown; readonly solution: unknown },
  answer: QuizSubmissionInput,
): QuizGrading {
  const quiz = readQuizContent(exercise.config, exercise.solution);

  if (quiz === null) {
    return { status: "broken-content" };
  }

  switch (quiz.kind) {
    case "single":
      return gradeSingle(quiz, answer);
    case "multiple":
      return gradeMultiple(quiz, answer);
    case "ordering":
      return gradeOrdering(quiz, answer);
    case "matching":
      return gradeMatching(quiz, answer);
  }
}
