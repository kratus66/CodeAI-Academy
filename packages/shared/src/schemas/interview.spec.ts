import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERVIEW_RUBRIC,
  INTERVIEW_CRITERIA,
  INTERVIEW_MAX_TURNS,
  INTERVIEW_MESSAGE_MAX,
  INTERVIEW_PHASES,
  INTERVIEW_SCORE_MAX,
  INTERVIEW_STATIC_REPLIES,
  interviewScoresSchema,
  interviewScenarioSchema,
  interviewScenarioSummarySchema,
  interviewSessionSchema,
  interviewTurnResponseSchema,
  reviewInterviewSchema,
  selfReviewSchema,
  sendInterviewMessageSchema,
  startInterviewSessionSchema,
} from "./interview";

const PHASES = INTERVIEW_PHASES.map((phase, index) => ({
  phase,
  maxTurns: index === 0 ? 2 : 1,
  objective: `Objetivo de ${phase}`,
}));

const SUMMARY = {
  slug: "backend-junior",
  title: "Backend junior",
  role: "backend",
  level: "junior",
  language: "ts",
  competencies: ["C4", "C10"],
  phaseCount: PHASES.length,
  estimatedMinutes: 45,
  attempts: 0,
} as const;

const SCORES = {
  razonamiento: 4,
  correctitud: 4,
  comunicacion: 4,
  seguimiento: 4,
  limites: 4,
} as const;

const SESSION = {
  id: "ses_1",
  scenarioSlug: "backend-junior",
  scenarioTitle: "Backend junior",
  status: "COMPLETED",
  phase: "candidate-questions",
  turns: 6,
  startedAt: "2026-10-28T10:00:00.000Z",
  finishedAt: "2026-10-28T10:32:00.000Z",
  durationMinutes: 32,
  score: 85,
  selfScore: 80,
  transcript: [
    {
      role: "interviewer",
      phase: "warmup",
      content: "Cuéntame un problema técnico.",
      at: "2026-10-28T10:00:00.000Z",
    },
  ],
  selfScores: { scores: SCORES, score: 80, reflection: "a".repeat(200) },
  scores: { rubric: DEFAULT_INTERVIEW_RUBRIC, levels: SCORES, score: 85 },
  feedback: "Buen razonamiento.",
  degraded: true,
} as const;

describe("contrato de entrevistas", () => {
  it("declara las seis fases y la réplica estática de cada una", () => {
    expect(INTERVIEW_PHASES).toHaveLength(6);
    expect(Object.keys(INTERVIEW_STATIC_REPLIES)).toEqual([...INTERVIEW_PHASES]);
  });

  it("los pesos por defecto reparten 100 puntos entre los cinco criterios", () => {
    const total = INTERVIEW_CRITERIA.reduce(
      (sum, criterion) => sum + DEFAULT_INTERVIEW_RUBRIC[criterion],
      0,
    );

    expect(total).toBe(100);
  });

  it("acepta un escenario completo y no exige la solución de referencia", () => {
    const parsed = interviewScenarioSchema.safeParse({
      ...SUMMARY,
      phases: PHASES,
      rubric: DEFAULT_INTERVIEW_RUBRIC,
    });

    expect(parsed.success).toBe(true);
  });

  it("rechaza una fase desconocida", () => {
    const parsed = interviewScenarioSchema.safeParse({
      ...SUMMARY,
      phases: [{ ...PHASES[0], phase: "onboarding" }],
      rubric: DEFAULT_INTERVIEW_RUBRIC,
    });

    expect(parsed.success).toBe(false);
  });

  it("rechaza una rúbrica cuyos pesos no suman 100", () => {
    const parsed = interviewScenarioSchema.safeParse({
      ...SUMMARY,
      phases: PHASES,
      rubric: { ...DEFAULT_INTERVIEW_RUBRIC, razonamiento: 29 },
    });

    expect(parsed.success).toBe(false);
  });

  it("un resumen no admite campos ajenos como referenceSolution", () => {
    const parsed = interviewScenarioSummarySchema.safeParse({
      ...SUMMARY,
      referenceSolution: "function solve() {}",
    });

    expect(parsed.success).toBe(false);
  });

  it("rechaza un resumen cuya phaseCount no coincide con las fases", () => {
    const parsed = interviewScenarioSchema.safeParse({
      ...SUMMARY,
      phaseCount: 3,
      phases: PHASES,
      rubric: DEFAULT_INTERVIEW_RUBRIC,
    });

    expect(parsed.success).toBe(false);
  });

  it("exige los cinco criterios y niveles enteros de 0 a 4", () => {
    expect(interviewScoresSchema.safeParse(SCORES).success).toBe(true);

    const incomplete = interviewScoresSchema.safeParse({
      razonamiento: 4,
      correctitud: 3,
      comunicacion: 3,
      seguimiento: 3,
    });

    expect(incomplete.success).toBe(false);

    const outOfRange = interviewScoresSchema.safeParse({
      ...SCORES,
      limites: INTERVIEW_SCORE_MAX + 1,
    });

    expect(outOfRange.success).toBe(false);

    const fractional = interviewScoresSchema.safeParse({
      ...SCORES,
      limites: 3.5,
    });

    expect(fractional.success).toBe(false);
  });

  it("acepta una sesión completa con transcripción y evaluación", () => {
    expect(interviewSessionSchema.safeParse(SESSION).success).toBe(true);
  });

  it("rechaza una autoevaluación sin reflexión suficiente", () => {
    const parsed = interviewSessionSchema.safeParse({
      ...SESSION,
      selfScores: { scores: SCORES, score: 80, reflection: "corta" },
    });

    expect(parsed.success).toBe(false);
  });

  it("rechaza una transcripción con un rol desconocido", () => {
    const parsed = interviewSessionSchema.safeParse({
      ...SESSION,
      transcript: [{ ...SESSION.transcript[0], role: "system" }],
    });

    expect(parsed.success).toBe(false);
  });

  it("rechaza un turno por encima del tope de la sesión", () => {
    const parsed = interviewSessionSchema.safeParse({
      ...SESSION,
      turns: INTERVIEW_MAX_TURNS + 1,
    });

    expect(parsed.success).toBe(false);
  });

  it("arranca con un slug de escenario válido", () => {
    expect(
      startInterviewSessionSchema.safeParse({ scenarioSlug: "backend-junior" })
        .success,
    ).toBe(true);
    expect(
      startInterviewSessionSchema.safeParse({ scenarioSlug: "Backend Junior" })
        .success,
    ).toBe(false);
  });

  it("rechaza un mensaje vacío y otro de 2 001 caracteres", () => {
    expect(sendInterviewMessageSchema.safeParse({ message: "" }).success).toBe(
      false,
    );
    expect(
      sendInterviewMessageSchema.safeParse({
        message: "a".repeat(INTERVIEW_MESSAGE_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      sendInterviewMessageSchema.safeParse({
        message: "a".repeat(INTERVIEW_MESSAGE_MAX),
      }).success,
    ).toBe(true);
  });

  it("rechaza un mensaje con más de 400 líneas", () => {
    const parsed = sendInterviewMessageSchema.safeParse({
      message: Array.from({ length: 401 }, (_, index) => `linea ${index}`).join(
        "\n",
      ),
    });

    expect(parsed.success).toBe(false);
  });

  it("una respuesta de turno declara fase, turno y degradación", () => {
    expect(
      interviewTurnResponseSchema.safeParse({
        reply: "¿Qué complejidad esperas?",
        phase: "conceptual",
        turn: 3,
        turnsRemaining: 37,
        degraded: false,
        budgetRemainingUsd: 4.82,
      }).success,
    ).toBe(true);
    expect(
      interviewTurnResponseSchema.safeParse({
        reply: "",
        phase: "conceptual",
        turn: 3,
        turnsRemaining: 37,
        degraded: false,
        budgetRemainingUsd: 4.82,
      }).success,
    ).toBe(false);
  });

  it("la autoevaluación exige 200 caracteres de reflexión", () => {
    expect(
      selfReviewSchema.safeParse({
        scores: SCORES,
        reflection: "a".repeat(199),
      }).success,
    ).toBe(false);
    expect(
      selfReviewSchema.safeParse({
        scores: SCORES,
        reflection: "a".repeat(200),
      }).success,
    ).toBe(true);
  });

  it("la revisión exige retroalimentación salvo que invalide la sesión", () => {
    expect(reviewInterviewSchema.safeParse({ scores: SCORES }).success).toBe(
      false,
    );
    expect(
      reviewInterviewSchema.safeParse({
        scores: SCORES,
        feedback: "   ",
      }).success,
    ).toBe(false);
    expect(
      reviewInterviewSchema.safeParse({
        scores: SCORES,
        feedback: "Buen cierre.",
      }).success,
    ).toBe(true);
    expect(
      reviewInterviewSchema.safeParse({
        scores: SCORES,
        invalidate: true,
      }).success,
    ).toBe(true);
  });
});