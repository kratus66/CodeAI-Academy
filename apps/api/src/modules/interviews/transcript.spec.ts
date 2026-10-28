import {
  DEFAULT_INTERVIEW_RUBRIC,
  INTERVIEW_PHASES,
  type InterviewScores,
} from "@codeai/shared";
import { describe, expect, it } from "vitest";

import {
  InvalidInterviewDataError,
  readInterviewPhases,
  readInterviewRubric,
  readInterviewScores,
  readSelfReview,
  readTranscript,
  scoreInterview,
} from "./transcript";

const TRANSCRIPT = [
  {
    role: "interviewer",
    phase: "warmup",
    content: "Cuéntame un problema técnico.",
    at: "2026-10-28T10:00:00.000Z",
  },
  {
    role: "candidate",
    phase: "warmup",
    content: "Resolví una cola con reintentos.",
    at: "2026-10-28T10:01:00.000Z",
  },
];

const LEVELS: InterviewScores = {
  razonamiento: 4,
  correctitud: 3,
  comunicacion: 3,
  seguimiento: 3,
  limites: 3,
};

const PHASES = INTERVIEW_PHASES.map((phase) => ({
  phase,
  maxTurns: 2,
  objective: `Objetivo de ${phase}`,
}));

describe("readTranscript", () => {
  it("devuelve la transcripción completa, con roles y fase", () => {
    expect(readTranscript(TRANSCRIPT)).toHaveLength(2);
  });

  it("rechaza un rol que no sea interviewer o candidate", () => {
    expect(() =>
      readTranscript([{ ...TRANSCRIPT[0], role: "system" }]),
    ).toThrow(InvalidInterviewDataError);
  });

  it("rechaza campos ajenos al contrato", () => {
    expect(() =>
      readTranscript([{ ...TRANSCRIPT[0], hidden: true }]),
    ).toThrow(InvalidInterviewDataError);
  });

  it("rechaza un valor que no sea una lista", () => {
    expect(() => readTranscript("transcripción")).toThrow(
      InvalidInterviewDataError,
    );
    expect(() => readTranscript(null)).toThrow(InvalidInterviewDataError);
  });
});

describe("readInterviewScores", () => {
  it("acepta una evaluación completa con su rúbrica aplicada", () => {
    const evaluation = readInterviewScores({
      rubric: DEFAULT_INTERVIEW_RUBRIC,
      levels: LEVELS,
      score: 82.5,
    });

    expect(evaluation?.score).toBe(82.5);
  });

  it("devuelve null mientras no hay revisión", () => {
    expect(readInterviewScores(null)).toBeNull();
    expect(readInterviewScores(undefined)).toBeNull();
  });

  it("rechaza una evaluación con criterios incompletos", () => {
    expect(() =>
      readInterviewScores({
        rubric: DEFAULT_INTERVIEW_RUBRIC,
        levels: { razonamiento: 4 },
        score: 85,
      }),
    ).toThrow(InvalidInterviewDataError);
  });
});

describe("readSelfReview", () => {
  it("exige la reflexión dentro del mismo dato", () => {
    expect(() =>
      readSelfReview({ scores: LEVELS, score: 82.5, reflection: "corta" }),
    ).toThrow(InvalidInterviewDataError);
  });

  it("acepta una autoevaluación con 200 caracteres de reflexión", () => {
    const record = readSelfReview({
      scores: LEVELS,
      score: 82.5,
      reflection: "a".repeat(200),
    });

    expect(record?.score).toBe(82.5);
  });
});

describe("readInterviewRubric", () => {
  it("acepta los pesos de §2.6", () => {
    expect(readInterviewRubric(DEFAULT_INTERVIEW_RUBRIC)).toEqual(
      DEFAULT_INTERVIEW_RUBRIC,
    );
  });

  it("rechaza pesos que no suman 100", () => {
    expect(() =>
      readInterviewRubric({ ...DEFAULT_INTERVIEW_RUBRIC, limites: 11 }),
    ).toThrow(InvalidInterviewDataError);
  });
});

describe("readInterviewPhases", () => {
  it("acepta las seis fases del guion", () => {
    expect(readInterviewPhases(PHASES)).toHaveLength(6);
  });

  it("rechaza fases repetidas y listas vacías", () => {
    expect(() =>
      readInterviewPhases([PHASES[0], PHASES[0]]),
    ).toThrow(InvalidInterviewDataError);
    expect(() => readInterviewPhases([])).toThrow(InvalidInterviewDataError);
  });
});

describe("scoreInterview", () => {
  it("aplica la fórmula de S9 con dos decimales", () => {
    const result = scoreInterview({
      rubric: DEFAULT_INTERVIEW_RUBRIC,
      levels: LEVELS,
    });

    expect(result).toMatchObject({
      valid: true,
      score: 82.5,
      rejection: null,
      grantsEvidence: true,
    });
  });

  it("una nota de 80 deja evidencia y 76.25 no", () => {
    const approved = scoreInterview({
      rubric: DEFAULT_INTERVIEW_RUBRIC,
      levels: { ...LEVELS, seguimiento: 3, limites: 2 },
    });
    const rejected = scoreInterview({
      rubric: DEFAULT_INTERVIEW_RUBRIC,
      levels: { ...LEVELS, seguimiento: 2, limites: 2 },
    });

    expect(approved.score).toBe(80);
    expect(approved.grantsEvidence).toBe(true);
    expect(rejected.score).toBe(76.25);
    expect(rejected.grantsEvidence).toBe(false);
  });

  it("correctitud 0 invalida la sesión aunque el resto esté perfecto", () => {
    const result = scoreInterview({
      rubric: DEFAULT_INTERVIEW_RUBRIC,
      levels: { ...LEVELS, correctitud: 0 },
    });

    expect(result).toEqual({
      valid: false,
      score: null,
      levels: null,
      rejection: "CORRECTITUD_ZERO",
      grantsEvidence: false,
    });
  });
});
