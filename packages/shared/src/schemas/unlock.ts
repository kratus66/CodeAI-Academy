import { z } from "zod";

import type { InterviewLevel } from "./interview";

/**
 * Desbloqueo por nivel: proyectos y entrevistas se abren según lo que el
 * estudiante ya domina, no por orden de llegada. La regla vive aquí para que la
 * API la aplique y la web la explique con las mismas cifras.
 */

/** Porcentaje de unidades dominadas de una etapa que abre su proyecto. */
export const PROJECT_UNLOCK_MASTERY_PCT = 60;

/**
 * Etapa en curso mínima para cada nivel de entrevista. `currentStage` es la
 * etapa de la primera unidad no dominada, así que `7` significa «las etapas
 * 0–6 están dominadas».
 */
export const INTERVIEW_MIN_STAGE: Readonly<Record<InterviewLevel, number>> = {
  junior: 7,
  "semi-senior": 9,
  senior: 11,
};

export const unlockStatusSchema = z.object({
  unlocked: z.boolean(),
  /** Qué falta para abrirlo; `null` si ya está abierto. */
  reason: z.string().min(1).nullable(),
});

export type UnlockStatus = z.infer<typeof unlockStatusSchema>;

export interface StageMastery {
  readonly stageId: number;
  readonly total: number;
  readonly mastered: number;
}

export interface UnlockContext {
  readonly currentStage: number;
  readonly stages: readonly StageMastery[];
  /** Instructores y administradores no se bloquean: revisan y prueban todo. */
  readonly bypass: boolean;
}

const OPEN: UnlockStatus = { unlocked: true, reason: null };

function masteryPct(stage: StageMastery | undefined): number {
  if (!stage || stage.total === 0) {
    return 0;
  }

  return Math.floor((stage.mastered / stage.total) * 100);
}

/** El proyecto de la etapa N abre al dominar el 60 % de ella o al superarla. */
export function projectUnlock(stageId: number, context: UnlockContext): UnlockStatus {
  if (context.bypass || context.currentStage > stageId) {
    return OPEN;
  }

  if (context.currentStage < stageId) {
    return {
      unlocked: false,
      reason: `Completa la etapa ${context.currentStage} para llegar a la etapa ${stageId}.`,
    };
  }

  const pct = masteryPct(context.stages.find((stage) => stage.stageId === stageId));

  return pct >= PROJECT_UNLOCK_MASTERY_PCT
    ? OPEN
    : {
        unlocked: false,
        reason: `Domina el ${PROJECT_UNLOCK_MASTERY_PCT} % de la etapa ${stageId} (llevas ${pct} %).`,
      };
}

/** La entrevista de cada nivel exige haber completado las etapas anteriores. */
export function interviewUnlock(
  level: InterviewLevel,
  context: UnlockContext,
): UnlockStatus {
  const required = INTERVIEW_MIN_STAGE[level];

  if (context.bypass || context.currentStage >= required) {
    return OPEN;
  }

  return {
    unlocked: false,
    reason: `Completa las etapas 0 a ${required - 1} para abrir las entrevistas de nivel ${level} (vas en la etapa ${context.currentStage}).`,
  };
}
