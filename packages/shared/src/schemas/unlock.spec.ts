import { describe, expect, it } from "vitest";

import type { UnlockContext } from "./unlock";
import {
  INTERVIEW_MIN_STAGE,
  PROJECT_UNLOCK_MASTERY_PCT,
  interviewUnlock,
  projectUnlock,
} from "./unlock";

function context(overrides: Partial<UnlockContext> = {}): UnlockContext {
  return { currentStage: 0, stages: [], bypass: false, ...overrides };
}

describe("projectUnlock", () => {
  it("bloquea el proyecto de una etapa que aún no se alcanza", () => {
    const status = projectUnlock(3, context({ currentStage: 1 }));

    expect(status.unlocked).toBe(false);
    expect(status.reason).toContain("etapa 1");
  });

  it("exige el porcentaje de dominio en la etapa en curso", () => {
    const stages = [{ stageId: 2, total: 10, mastered: 5 }];
    const status = projectUnlock(2, context({ currentStage: 2, stages }));

    expect(status.unlocked).toBe(false);
    expect(status.reason).toContain(`${PROJECT_UNLOCK_MASTERY_PCT} %`);
    expect(status.reason).toContain("llevas 50 %");
  });

  it("abre el proyecto al llegar al umbral", () => {
    const stages = [{ stageId: 2, total: 10, mastered: 6 }];

    expect(projectUnlock(2, context({ currentStage: 2, stages }))).toEqual({
      unlocked: true,
      reason: null,
    });
  });

  it("deja abiertos los proyectos de etapas ya superadas", () => {
    expect(projectUnlock(1, context({ currentStage: 4 })).unlocked).toBe(true);
  });

  it("no bloquea a quien tiene bypass", () => {
    expect(projectUnlock(9, context({ bypass: true })).unlocked).toBe(true);
  });
});

describe("interviewUnlock", () => {
  it("bloquea cada nivel hasta completar sus etapas previas", () => {
    expect(interviewUnlock("junior", context({ currentStage: 6 })).unlocked).toBe(false);
    expect(interviewUnlock("junior", context({ currentStage: 7 })).unlocked).toBe(true);
    expect(interviewUnlock("semi-senior", context({ currentStage: 8 })).unlocked).toBe(false);
    expect(interviewUnlock("senior", context({ currentStage: 10 })).unlocked).toBe(false);
    expect(interviewUnlock("senior", context({ currentStage: 11 })).unlocked).toBe(true);
  });

  it("explica qué etapas faltan", () => {
    const status = interviewUnlock("semi-senior", context({ currentStage: 3 }));

    expect(status.reason).toContain(`0 a ${INTERVIEW_MIN_STAGE["semi-senior"] - 1}`);
    expect(status.reason).toContain("etapa 3");
  });

  it("no bloquea a quien tiene bypass", () => {
    expect(interviewUnlock("senior", context({ bypass: true })).unlocked).toBe(true);
  });
});
