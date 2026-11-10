import { CERTIFICATION_REGISTRY, examCohortSchema } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { aggregateCohort, type CohortInput } from "./exam-cohort.rules";

const DEFINITION = CERTIFICATION_REGISTRY["SAA-C03"];
const FROM = new Date("2026-10-01T00:00:00.000Z");
const TO = new Date("2026-11-01T00:00:00.000Z");

type CohortAttempt = CohortInput["attempts"][number];

function scores(d1: number, d2: number): CohortAttempt["domainScores"] {
  return [
    { domain: 1, pct: d1 },
    { domain: 2, pct: d2 },
  ];
}

function attempt(userId: string, overrides: Partial<CohortAttempt> = {}): CohortAttempt {
  return {
    userId,
    status: "submitted",
    orientative: false,
    domainScores: scores(80, 60),
    ...overrides,
  };
}

function run(attempts: CohortAttempt[], realResults: CohortInput["realResults"] = []) {
  return aggregateCohort({
    definition: DEFINITION,
    from: FROM,
    to: TO,
    attempts,
    realResults,
  });
}

describe("aggregateCohort", () => {
  it("con tres personas deja domains vacío pero devuelve los contadores", () => {
    const cohort = run([attempt("a"), attempt("b"), attempt("c"), attempt("c")]);

    expect(cohort.domains).toEqual([]);
    expect(cohort.learners).toBe(3);
    expect(cohort.attempts).toBe(4);
  });

  it("con cinco personas calcula medias redondeadas y ordena de más débil a más fuerte", () => {
    const cohort = run([
      attempt("a", { domainScores: scores(90, 50) }),
      attempt("b", { domainScores: scores(85, 55) }),
      attempt("c", { domainScores: scores(80, 60) }),
      attempt("d", { domainScores: scores(70, 61) }),
      attempt("e", { domainScores: scores(75, 66) }),
    ]);

    expect(cohort.learners).toBe(5);
    expect(cohort.domains).toEqual([
      { domain: 2, name: DEFINITION.domains[1]?.name, avgPct: 58, attempts: 5 },
      { domain: 1, name: DEFINITION.domains[0]?.name, avgPct: 80, attempts: 5 },
    ]);
  });

  it("excluye los orientativos y los intentos en curso", () => {
    const cohort = run([
      attempt("a"),
      attempt("b", { orientative: true }),
      attempt("c", { status: "in-progress" }),
      attempt("d", { status: "expired" }),
    ]);

    expect(cohort.attempts).toBe(2);
    expect(cohort.learners).toBe(2);
  });

  it("los orientativos no suman personas para el umbral de privacidad", () => {
    const cohort = run([
      attempt("a"),
      attempt("b"),
      attempt("c"),
      attempt("d"),
      attempt("e", { orientative: true }),
    ]);

    expect(cohort.learners).toBe(4);
    expect(cohort.domains).toEqual([]);
  });

  it("cuenta la tabla de resultados reales", () => {
    const cohort = run(
      [],
      [
        { readyAtRegistration: true, passed: true },
        { readyAtRegistration: true, passed: true },
        { readyAtRegistration: true, passed: false },
        { readyAtRegistration: false, passed: true },
        { readyAtRegistration: false, passed: false },
        { readyAtRegistration: false, passed: false },
      ],
    );

    expect(cohort.readinessVsReal).toEqual({
      readyPassed: 2,
      readyFailed: 1,
      notReadyPassed: 1,
      notReadyFailed: 2,
    });
  });

  it("devuelve fechas ISO y cumple el contrato compartido", () => {
    const cohort = run([attempt("a")]);

    expect(cohort.from).toBe("2026-10-01T00:00:00.000Z");
    expect(cohort.to).toBe("2026-11-01T00:00:00.000Z");
    expect(cohort.certification).toBe("SAA-C03");
    expect(examCohortSchema.safeParse(cohort).success).toBe(true);
  });
});
