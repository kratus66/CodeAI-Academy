import {
  PROJECT_EVIDENCE_MIN_SCORE,
  projectRubricSchema,
  type ProjectCriterion,
  type ProjectRubric,
  type ProjectRubricScores,
} from "@codeai/shared";

import { scoreLevels } from "../../common/scoring/weighted-score";

/**
 * Motor de nota de un proyecto (`sprint-09-proyectos-rubricas.md` §4 y
 * `rubricas-evaluacion.md` §1).
 *
 * Función pura: recibe el `Json` guardado en `Project.rubric` y los niveles que
 * el instructor asignó; no conoce Prisma, ni el reloj, ni el HTTP. El servicio
 * (T9) decide qué hacer con el resultado: persistir la nota o responder `422`.
 *
 * Fórmula del contrato:
 *
 *     nota(criterio) = peso(criterio) × nivel(criterio) / 4
 *     score          = round(Σ nota, 2)
 *
 * Dos reglas duras, en este orden:
 *
 * 1. `correctitud = 0` invalida el entregable: no hay nota y la revisión no se
 *    persiste (no se compensa con el resto de criterios).
 * 2. Sin explicación propia, `justificacion` vale 0 aunque el instructor lo
 *    puntúe: resta el 15 % completo, no una fracción.
 */

/** La rúbrica guardada no cumple el contrato: es un error del servidor, no del alumno. */
export class InvalidRubricError extends Error {
  readonly code = "INVALID_RUBRIC";

  constructor(
    message: string,
    readonly issues: readonly string[] = [],
  ) {
    super(message);
    this.name = "InvalidRubricError";
  }
}

/** Motivo por el que una revisión no produce nota. */
export type ScoreRejectionReason = "CORRECTITUD_ZERO";

export interface ScoreSubmissionInput {
  /** Contenido de `Project.rubric`; se valida con `readRubric` antes de puntuar. */
  rubric: unknown;
  /** Niveles 0–4 de los cinco criterios. */
  scores: ProjectRubricScores;
  /** Explicación propia de la entrega; vacía o sólo espacios fuerza `justificacion = 0`. */
  notes?: string | null;
}

export interface ScoreSubmissionResult {
  valid: boolean;
  /** 0–100 con dos decimales; `null` cuando la entrega no es evaluable. */
  score: number | null;
  /** Niveles aplicados, con la corrección de `justificacion`; `null` si no es válida. */
  rubricScores: ProjectRubricScores | null;
  /** Motivo del rechazo; `null` cuando la nota es válida. */
  rejection: ScoreRejectionReason | null;
  /** `true` si la nota alcanza `PROJECT_EVIDENCE_MIN_SCORE` (80). */
  grantsEvidence: boolean;
}

/**
 * Valida el `Json` almacenado en `Project.rubric`.
 *
 * Se ejecuta al sembrar el proyecto y otra vez al revisar: la base no garantiza
 * la forma del `Json`, así que nunca se puntúa con una rúbrica sin comprobar.
 * Los errores llevan rutas (`criteria.0.weight`) para que el log sea accionable.
 */
export function readRubric(value: unknown): ProjectRubric {
  const parsed = projectRubricSchema.safeParse(value);

  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`,
    );

    throw new InvalidRubricError(
      `Rúbrica inválida: ${issues.length} problema(s) de contrato`,
      issues,
    );
  }

  return parsed.data;
}

function weightByCriterion(rubric: ProjectRubric): Record<ProjectCriterion, number> {
  const weights = {} as Record<ProjectCriterion, number>;

  for (const criterion of rubric.criteria) {
    weights[criterion.criterion] = criterion.weight;
  }

  return weights;
}

/** Sin texto propio no hay justificación, aunque el instructor la puntúe. */
function hasOwnExplanation(notes: string | null | undefined): boolean {
  return (notes ?? "").trim().length > 0;
}

/**
 * Calcula la nota de una revisión.
 *
 * @throws {InvalidRubricError} si `input.rubric` no cumple `projectRubricSchema`.
 */
export function scoreSubmission(
  input: ScoreSubmissionInput,
): ScoreSubmissionResult {
  const rubric = readRubric(input.rubric);
  const scores: ProjectRubricScores = { ...input.scores };

  if (!hasOwnExplanation(input.notes)) {
    scores.justificacion = 0;
  }

  // La puerta se evalúa después de aplicar la justificación: un 0 en correctitud
  // invalida el entregable aunque el resto esté perfecto.
  if (scores.correctitud === 0) {
    return {
      valid: false,
      score: null,
      rubricScores: null,
      rejection: "CORRECTITUD_ZERO",
      grantsEvidence: false,
    };
  }

  const score = scoreLevels(weightByCriterion(rubric), scores);

  return {
    valid: true,
    score,
    rubricScores: scores,
    rejection: null,
    grantsEvidence: score >= PROJECT_EVIDENCE_MIN_SCORE,
  };
}
