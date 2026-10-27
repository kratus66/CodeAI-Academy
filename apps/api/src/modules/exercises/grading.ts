import type { Ladder, SubmissionOutcome } from "@codeai/shared";

/**
 * Evaluador de un envío (`rubricas-evaluacion.md` §2.1 y §3).
 *
 * Función pura: recibe el resultado de las pruebas y devuelve la corrección.
 * No conoce Prisma, ni el sandbox, ni el reloj. La fórmula vive en la ficha
 * del sprint (§4) y este archivo es su única implementación.
 */

export interface GradingTestInput {
  testId: string;
  name: string;
  weight: number;
  isHidden: boolean;
  passed: boolean;
}

export type LevelCapReason = "HINTS" | "EXPLANATION" | "LADDER";

export interface LevelCap {
  reason: LevelCapReason;
  maxLevel: number;
}

export interface GradingInput {
  tests: readonly GradingTestInput[];
  ladder: Ladder;
  /** Niveles de pista usados desde el intento anterior, calculados en el servidor. */
  hintsUsed?: number;
  selfExplanation?: string | null;
  /** El sandbox sólo puede forzar ERROR o TIMEOUT; el resto lo decide el evaluador. */
  sandboxOutcome?: SubmissionOutcome | null;
}

export interface GradingResult {
  outcome: SubmissionOutcome;
  /** Entero 0..100. */
  score: number;
  /** Nivel 1..4 alcanzado, o `null` si no se puede evaluar. */
  achievedLevel: number | null;
  visiblePassed: number;
  visibleTotal: number;
  /** Tope aplicado cuando bajó el nivel base; `null` si no hubo. */
  levelCap: LevelCap | null;
  /** Texto para el estudiante: nunca nombra pruebas ocultas ni incluye código. */
  feedback: string;
}

const MAX_LEVEL = 4;
const HINT_LEVEL_LIMIT = 3;
const HINTS_CAP_LEVEL = 2;
const EMPTY_EXPLANATION_CAP_LEVEL = 2;

/** Nivel máximo certificable por escalón (`banco-ejercicios.md` §4). */
const LADDER_MAX_LEVEL: Readonly<Record<Ladder, number>> = {
  GUIDED: 2,
  SEMI: 3,
  AUTONOMOUS: MAX_LEVEL,
};

const LADDER_LABEL: Readonly<Record<Ladder, string>> = {
  GUIDED: "guiado",
  SEMI: "semi-autónomo",
  AUTONOMOUS: "autónomo",
};

const ERROR_FEEDBACK =
  "Tu código no compiló. Revisa el mensaje del compilador y vuelve a enviar.";
const TIMEOUT_FEEDBACK =
  "Tu solución tardó más de 5 s. Revisa bucles y llamadas repetidas antes de reenviar.";
const NOT_EVALUABLE_FEEDBACK =
  "Este ejercicio no tiene pruebas: no se puede calcular una puntuación.";
const NO_VISIBLE_TESTS_FEEDBACK =
  "Este ejercicio no tiene pruebas visibles: la puntuación se calcula con las pruebas ocultas.";

function sanitizeWeight(weight: number): number {
  return Number.isFinite(weight) ? Math.max(0, weight) : 0;
}

function baseLevel(score: number): number {
  if (score < 70) return 1;
  if (score < 80) return 2;
  if (score < 90) return 3;
  return MAX_LEVEL;
}

function capFor(input: GradingInput): LevelCap {
  const candidates: LevelCap[] = [];

  if ((input.hintsUsed ?? 0) >= HINT_LEVEL_LIMIT) {
    candidates.push({ reason: "HINTS", maxLevel: HINTS_CAP_LEVEL });
  }
  if ((input.selfExplanation ?? "").trim() === "") {
    candidates.push({ reason: "EXPLANATION", maxLevel: EMPTY_EXPLANATION_CAP_LEVEL });
  }
  candidates.push({ reason: "LADDER", maxLevel: LADDER_MAX_LEVEL[input.ladder] });

  // El primero de la lista gana los empates: pistas → explicación → escalón.
  return candidates.reduce((lowest, candidate) =>
    candidate.maxLevel < lowest.maxLevel ? candidate : lowest,
  );
}

function capMessage(cap: LevelCap, ladder: Ladder): string {
  if (cap.reason === "HINTS") {
    return `Nivel máximo ${cap.maxLevel}: usaste pistas de nivel ${HINT_LEVEL_LIMIT}.`;
  }
  if (cap.reason === "EXPLANATION") {
    return `Nivel máximo ${cap.maxLevel}: falta la explicación de tu enfoque.`;
  }
  return `Nivel máximo ${cap.maxLevel}: el ejercicio es ${LADDER_LABEL[ladder]} y el escalón limita el nivel.`;
}

function visibleCounts(tests: readonly GradingTestInput[]): {
  visiblePassed: number;
  visibleTotal: number;
} {
  const visible = tests.filter((test) => !test.isHidden);
  return {
    visiblePassed: visible.filter((test) => test.passed).length,
    visibleTotal: visible.length,
  };
}

export function gradeSubmission(input: GradingInput): GradingResult {
  const counts = visibleCounts(input.tests);

  if (input.sandboxOutcome === "ERROR" || input.sandboxOutcome === "TIMEOUT") {
    return {
      outcome: input.sandboxOutcome,
      score: 0,
      achievedLevel: null,
      ...counts,
      levelCap: null,
      feedback: input.sandboxOutcome === "ERROR" ? ERROR_FEEDBACK : TIMEOUT_FEEDBACK,
    };
  }

  const totalWeight = input.tests.reduce((sum, test) => sum + sanitizeWeight(test.weight), 0);
  if (input.tests.length === 0 || totalWeight <= 0) {
    return {
      outcome: "FAILED",
      score: 0,
      achievedLevel: null,
      ...counts,
      levelCap: null,
      feedback: NOT_EVALUABLE_FEEDBACK,
    };
  }

  const passedWeight = input.tests.reduce(
    (sum, test) => (test.passed ? sum + sanitizeWeight(test.weight) : sum),
    0,
  );
  const ratio = passedWeight / totalWeight;
  const score = Math.round(ratio * 100);

  const outcome: SubmissionOutcome =
    ratio >= 1 ? "PASSED" : passedWeight <= 0 ? "FAILED" : "PARTIAL";

  const base = baseLevel(score);
  const cap = capFor(input);
  const achievedLevel = Math.min(base, cap.maxLevel);
  const levelCap = achievedLevel < base ? cap : null;

  const parts: string[] = [
    counts.visibleTotal > 0
      ? `${counts.visiblePassed} de ${counts.visibleTotal} pruebas visibles superadas.`
      : NO_VISIBLE_TESTS_FEEDBACK,
  ];
  if (outcome === "PARTIAL") {
    parts.push("Revisa los casos que fallan y vuelve a enviar.");
  }
  if (outcome === "FAILED" && counts.visibleTotal > 0) {
    parts.push("Ninguna prueba visible pasa todavía; revisa el enunciado antes de reenviar.");
  }
  if (levelCap) {
    parts.push(capMessage(levelCap, input.ladder));
  }

  return {
    outcome,
    score,
    achievedLevel,
    ...counts,
    levelCap,
    feedback: parts.join(" "),
  };
}
