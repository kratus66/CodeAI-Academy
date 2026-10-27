import type {
  ExerciseDetail,
  ExerciseListItem,
  SandboxLanguage,
  SubmissionSummary,
  SubmissionTestResult,
} from "@codeai/shared";

import type { ExerciseRow, SubmissionRow } from "./exercises.repository";

/**
 * Traducciones fila → contrato del laboratorio. Es el **único** punto donde se
 * decide qué sale al cliente: `solution` y las pruebas con `isHidden: true` no
 * atraviesan estas funciones, así que ningún endpoint puede filtrarlas por su
 * cuenta ni olvidarse de hacerlo.
 */

const SANDBOX_LANGUAGES: readonly string[] = ["typescript", "javascript", "sql"];

/** Un lenguaje desconocido en la base se sirve como `null`, no rompe el contrato. */
function toLanguage(value: string | null): SandboxLanguage | null {
  return value !== null && SANDBOX_LANGUAGES.includes(value)
    ? (value as SandboxLanguage)
    : null;
}

function toConfig(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** `starterCode` vive dentro de `config`, que es libre por tipo de ejercicio. */
function readStarterCode(config: Record<string, unknown>): string | null {
  const value = config.starterCode;

  return typeof value === "string" ? value : null;
}

export function toExerciseListItem(row: ExerciseRow): ExerciseListItem {
  return {
    id: row.id,
    unitId: row.unitId,
    unitCode: row.unitCode,
    type: row.type,
    title: row.title,
    ladder: row.ladder,
    difficulty: row.difficulty,
    estimatedMin: row.estimatedMin,
    language: toLanguage(row.language),
    competencies: [...row.competencies],
  };
}

/**
 * El detalle añade enunciado, configuración y pruebas **visibles**. La solución
 * y los tests ocultos se descartan aquí aunque la fila los traiga.
 */
export function toExerciseDetail(row: ExerciseRow): ExerciseDetail {
  const config = toConfig(row.config);

  return {
    ...toExerciseListItem(row),
    statement: row.statement,
    config,
    publicTests: row.tests
      .filter((test) => !test.isHidden)
      .map((test) => ({ testId: test.id, name: test.name })),
    hintsAvailable: row.hintLevels.length,
    starterCode: readStarterCode(config),
  };
}

/**
 * `feedback` no se guarda: se deriva de las pruebas para que un envío antiguo
 * siga siendo coherente aunque cambie el texto de la interfaz.
 */
function feedbackFor(results: readonly SubmissionTestResult[]): string {
  if (results.length === 0) {
    return "La ejecución no tenía pruebas visibles.";
  }

  const passed = results.filter((result) => result.passed).length;

  return `${passed} de ${results.length} pruebas visibles superadas.`;
}

/**
 * Con 3 niveles de pista usados la progresión obligatoria implica el nivel 3,
 * así que el historial puede reconstruir el motivo del tope sin guardarlo.
 */
function historyFeedback(
  row: SubmissionRow,
  results: readonly SubmissionTestResult[],
): string {
  const base = feedbackFor(results);

  return row.hintsUsed >= 3
    ? `${base} Nivel máximo 2: usaste pistas de nivel 3.`
    : base;
}

/**
 * `feedback` del evaluador se usa tal cual (es el único con el motivo del tope
 * de nivel); sin él (historial) se deriva de las pruebas persistidas.
 */
export function toSubmissionSummary(
  row: SubmissionRow,
  feedback?: string,
): SubmissionSummary {
  const results: SubmissionTestResult[] = row.results.map((result) => ({
    testId: result.testId,
    name: result.name,
    passed: result.passed,
    ...(result.durationMs === null ? {} : { durationMs: result.durationMs }),
  }));

  return {
    id: row.id,
    outcome: row.outcome,
    score: row.score,
    achievedLevel: row.achievedLevel,
    hintsUsed: row.hintsUsed,
    results,
    feedback: feedback ?? historyFeedback(row, results),
    createdAt: row.createdAt.toISOString(),
  };
}
