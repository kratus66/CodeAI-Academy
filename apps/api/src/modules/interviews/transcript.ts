import {
  INTERVIEW_EVIDENCE_MIN_SCORE,
  interviewEvaluationSchema,
  interviewRubricSchema,
  interviewScenarioPhaseSchema,
  interviewSelfReviewRecordSchema,
  interviewScoresSchema,
  interviewTranscriptEntrySchema,
  type InterviewEvaluation,
  type InterviewRubric,
  type InterviewSelfReviewRecord,
  type InterviewScores,
  type InterviewTranscriptEntry,
} from "@codeai/shared";
import { z } from "zod";

import { scoreLevels } from "../../common/scoring/weighted-score";

/**
 * Lectores del `Json` guardado en `InterviewSession` y motor de nota de una
 * entrevista (`sprint-10-entrevistas.md` T4, §3.4 y §3.5).
 *
 * La base no garantiza la forma de un `Json`: una fila corrupta lanza
 * `InvalidInterviewDataError` y el servicio responde `422 RULE_VIOLATION`, sin
 * tumbar el proceso ni recalcular con la rúbrica actual.
 */

/** El `Json` almacenado no cumple el contrato del sprint. */
export class InvalidInterviewDataError extends Error {
  readonly code = "INVALID_INTERVIEW_DATA";

  constructor(
    message: string,
    readonly issues: readonly string[] = [],
  ) {
    super(message);
    this.name = "InvalidInterviewDataError";
  }
}

/** Una fase del guion, ya validada. */
export type InterviewPhases = z.infer<typeof interviewScenarioPhaseSchema>[];

function fail(label: string, issues: readonly string[]): never {
  throw new InvalidInterviewDataError(
    `${label}: ${issues.length} problema(s) de contrato`,
    issues,
  );
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`,
  );
}

/** Lista completa de turnos; una transcripción corrupta nunca se sirve a medias. */
export function readTranscript(value: unknown): InterviewTranscriptEntry[] {
  const parsed = z.array(interviewTranscriptEntrySchema).safeParse(value);

  if (!parsed.success) {
    fail("Transcripción inválida", issuesOf(parsed.error));
  }

  return parsed.data;
}

/** Rúbrica aplicada en el escenario; se exige antes de puntuar. */
export function readInterviewRubric(value: unknown): InterviewRubric {
  const parsed = interviewRubricSchema.safeParse(value);

  if (!parsed.success) {
    fail("Rúbrica inválida", issuesOf(parsed.error));
  }

  return parsed.data;
}

/** Fases del guion; el servicio avanza por conteo, nunca por lo que diga el modelo. */
export function readInterviewPhases(value: unknown): InterviewPhases {
  const parsed = z.array(interviewScenarioPhaseSchema).min(1).safeParse(value);

  if (!parsed.success) {
    fail("Fases inválidas", issuesOf(parsed.error));
  }

  const unique = new Set(parsed.data.map((phase) => phase.phase));

  if (unique.size !== parsed.data.length) {
    fail("Fases inválidas", ["phases: cada fase debe aparecer una sola vez"]);
  }

  return parsed.data;
}

/** `null` mientras no hay revisión; si hay fila, debe cumplir el contrato. */
export function readInterviewScores(
  value: unknown,
): InterviewEvaluation | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = interviewEvaluationSchema.safeParse(value);

  if (!parsed.success) {
    fail("Evaluación inválida", issuesOf(parsed.error));
  }

  return parsed.data;
}

/** `null` mientras no hay autoevaluación; la reflexión forma parte del dato. */
export function readSelfReview(value: unknown): InterviewSelfReviewRecord | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = interviewSelfReviewRecordSchema.safeParse(value);

  if (!parsed.success) {
    fail("Autoevaluación inválida", issuesOf(parsed.error));
  }

  return parsed.data;
}

/** Motivo por el que una entrevista no produce nota. */
export type InterviewScoreRejection = "CORRECTITUD_ZERO";

export interface InterviewScoreInput {
  /** Rúbrica ya validada con `readInterviewRubric`. */
  rubric: InterviewRubric;
  levels: InterviewScores;
}

export interface InterviewScoreResult {
  valid: boolean;
  /** 0–100 con dos decimales; `null` cuando la sesión no es evaluable. */
  score: number | null;
  /** Niveles aplicados; `null` si no es válida. */
  levels: InterviewScores | null;
  rejection: InterviewScoreRejection | null;
  /** `true` si la nota alcanza `INTERVIEW_EVIDENCE_MIN_SCORE` (80). */
  grantsEvidence: boolean;
}

/**
 * Misma fórmula que S9 (`peso × nivel / 4`, dos decimales) con la puerta de
 * correctitud: un 0 en correctitud invalida la sesión y no deja evidencia.
 */
export function scoreInterview(
  input: InterviewScoreInput,
): InterviewScoreResult {
  const levels = interviewScoresSchema.parse(input.levels);

  if (levels.correctitud === 0) {
    return {
      valid: false,
      score: null,
      levels: null,
      rejection: "CORRECTITUD_ZERO",
      grantsEvidence: false,
    };
  }

  const score = scoreLevels(input.rubric, levels);

  return {
    valid: true,
    score,
    levels,
    rejection: null,
    grantsEvidence: score >= INTERVIEW_EVIDENCE_MIN_SCORE,
  };
}
