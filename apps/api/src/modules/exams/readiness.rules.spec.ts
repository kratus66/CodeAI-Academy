import type { ReadinessCriterion, ReadinessCriterionId } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { evaluateReadiness, type ReadinessAttempt, type ReadinessInput } from "./readiness.rules";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Un intento válido por defecto: forma A entregada hace 3 días con margen. */
function attempt(overrides: Partial<ReadinessAttempt> = {}): ReadinessAttempt {
  return {
    mode: "form-a",
    status: "submitted",
    orientative: false,
    submittedAt: new Date(NOW.getTime() - 3 * DAY_MS),
    scorePct: 85,
    domainPcts: [90, 80, 75, 85],
    ...overrides,
  };
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

/** Entrada que cumple los cuatro criterios si no se sobrescribe nada. */
function input(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    now: NOW,
    units: { total: 4, pendingCodes: [] },
    formsAvailable: 3,
    attempts: [attempt(), attempt({ mode: "form-b", submittedAt: daysAgo(10) })],
    overdueReviewCount: 0,
    project: { available: true, bestReviewedScore: 85 },
    defense: { available: true, done: true },
    ...overrides,
  };
}

function criterion(
  result: { criteria: ReadinessCriterion[] },
  id: ReadinessCriterionId,
): ReadinessCriterion {
  const found = result.criteria.find((entry) => entry.id === id);

  if (found === undefined) {
    throw new Error(`Falta el criterio «${id}»`);
  }

  return found;
}

const NOT_TWO_FORMS =
  "Aprueba dos formas distintas con ≥ 80 % y ningún dominio por debajo del 70 % (llevas 1)";

describe("evaluateReadiness — dominio", () => {
  it("está en met cuando todas las unidades de la etapa están dominadas", () => {
    expect(criterion(evaluateReadiness(input()), "mastery")).toEqual({
      id: "mastery",
      status: "met",
      summary: "Dominio completo de todas las unidades",
      missing: [],
    });
  });

  it("enumera las unidades que faltan por dominar", () => {
    const result = evaluateReadiness(
      input({ units: { total: 4, pendingCodes: ["a1-u1", "a1-u3"] } }),
    );

    expect(criterion(result, "mastery")).toMatchObject({
      status: "missing",
      missing: ["Unidad a1-u1 sin dominar", "Unidad a1-u3 sin dominar"],
    });
    expect(result.ready).toBe(false);
  });

  it("es unavailable cuando la etapa no tiene unidades publicadas", () => {
    const result = evaluateReadiness(input({ units: { total: 0, pendingCodes: [] } }));

    expect(criterion(result, "mastery")).toEqual({
      id: "mastery",
      status: "unavailable",
      summary: "La etapa no tiene unidades publicadas",
      missing: ["La etapa aún no tiene unidades publicadas"],
    });
    expect(result.ready).toBe(false);
  });
});

describe("evaluateReadiness — simulacros", () => {
  it("está en met con dos formas distintas entregadas en los últimos 14 días", () => {
    expect(criterion(evaluateReadiness(input()), "mock-exams")).toEqual({
      id: "mock-exams",
      status: "met",
      summary: "Dos formas distintas aprobadas en los últimos 14 días",
      missing: [],
    });
  });

  it("un intento vencido cuenta como entregado", () => {
    const result = evaluateReadiness(
      input({
        attempts: [attempt(), attempt({ mode: "form-b", status: "expired" })],
      }),
    );

    expect(criterion(result, "mock-exams").status).toBe("met");
  });

  it("no cuenta dos veces la misma forma", () => {
    const result = evaluateReadiness(
      input({ attempts: [attempt(), attempt({ submittedAt: daysAgo(1) })] }),
    );

    expect(criterion(result, "mock-exams").missing).toEqual([NOT_TWO_FORMS]);
  });

  it("no cuenta un intento orientativo", () => {
    const result = evaluateReadiness(
      input({ attempts: [attempt(), attempt({ mode: "form-b", orientative: true })] }),
    );

    expect(criterion(result, "mock-exams").missing).toEqual([NOT_TWO_FORMS]);
  });

  it("no cuenta el aleatorio ni el bloque por dominio", () => {
    const result = evaluateReadiness(
      input({
        attempts: [
          attempt(),
          attempt({ mode: "random", scorePct: 95 }),
          attempt({ mode: "domain", scorePct: 95 }),
        ],
      }),
    );

    expect(criterion(result, "mock-exams").missing).toEqual([NOT_TWO_FORMS]);
  });

  it("no cuenta un intento sin entregar", () => {
    const result = evaluateReadiness(
      input({
        attempts: [
          attempt(),
          attempt({ mode: "form-b", status: "in-progress", submittedAt: null, scorePct: null }),
        ],
      }),
    );

    expect(criterion(result, "mock-exams").missing).toEqual([NOT_TWO_FORMS]);
  });

  it("un dominio al 69 % invalida el intento", () => {
    const result = evaluateReadiness(
      input({
        attempts: [attempt(), attempt({ mode: "form-b", domainPcts: [100, 69] })],
      }),
    );

    expect(criterion(result, "mock-exams").missing).toEqual([NOT_TWO_FORMS]);
  });

  it("menos de 80 % de aciertos invalida el intento", () => {
    const result = evaluateReadiness(
      input({ attempts: [attempt(), attempt({ mode: "form-b", scorePct: 79 })] }),
    );

    expect(criterion(result, "mock-exams").missing).toEqual([NOT_TWO_FORMS]);
  });

  it("el día 14 cuenta y el 15 no", () => {
    const day14 = evaluateReadiness(
      input({
        attempts: [attempt({ submittedAt: daysAgo(14) }), attempt({ mode: "form-b", submittedAt: daysAgo(20) })],
      }),
    );
    const day15 = evaluateReadiness(
      input({
        attempts: [attempt({ submittedAt: daysAgo(15) }), attempt({ mode: "form-b", submittedAt: daysAgo(20) })],
      }),
    );

    expect(criterion(day14, "mock-exams")).toMatchObject({ status: "met", missing: [] });
    expect(criterion(day15, "mock-exams")).toMatchObject({
      status: "missing",
      missing: ["Tu último simulacro válido tiene más de 14 días"],
    });
  });

  it("es unavailable con menos de dos formas sembradas", () => {
    const result = evaluateReadiness(input({ formsAvailable: 1 }));

    expect(criterion(result, "mock-exams")).toEqual({
      id: "mock-exams",
      status: "unavailable",
      summary: "Faltan formas de simulacro",
      missing: ["Esta certificación aún no tiene dos formas de simulacro"],
    });
    expect(result.ready).toBe(false);
  });
});

describe("evaluateReadiness — repaso", () => {
  it("está en met sin ítems atrasados", () => {
    expect(criterion(evaluateReadiness(input()), "review")).toEqual({
      id: "review",
      status: "met",
      summary: "Repaso al día",
      missing: [],
    });
  });

  it("cuenta los ítems que llevan más de 7 días de retraso", () => {
    const result = evaluateReadiness(input({ overdueReviewCount: 3 }));

    expect(criterion(result, "review")).toMatchObject({
      status: "missing",
      missing: ["3 ítems de repaso llevan más de 7 días de retraso"],
    });
    expect(result.ready).toBe(false);
  });
});

describe("evaluateReadiness — evidencia", () => {
  it("está en met con el proyecto aprobado y la defensa hecha", () => {
    expect(criterion(evaluateReadiness(input()), "evidence")).toEqual({
      id: "evidence",
      status: "met",
      summary: "Proyecto y defensa técnica completados",
      missing: [],
    });
  });

  it("acepta el proyecto justo con 70", () => {
    const result = evaluateReadiness(input({ project: { available: true, bestReviewedScore: 70 } }));

    expect(criterion(result, "evidence").status).toBe("met");
  });

  it("pide el proyecto con una nota de al menos 70", () => {
    const result = evaluateReadiness(input({ project: { available: true, bestReviewedScore: 69 } }));

    expect(criterion(result, "evidence")).toMatchObject({
      status: "missing",
      missing: ["Falta el proyecto de la etapa aprobado con ≥ 70"],
    });
  });

  it("pide la defensa técnica", () => {
    const result = evaluateReadiness(input({ defense: { available: true, done: false } }));

    expect(criterion(result, "evidence")).toMatchObject({
      status: "missing",
      missing: ["Falta la defensa técnica"],
    });
  });

  it("pide las dos piezas cuando faltan ambas", () => {
    const result = evaluateReadiness(
      input({
        project: { available: true, bestReviewedScore: 69 },
        defense: { available: true, done: false },
      }),
    );

    expect(criterion(result, "evidence").missing).toEqual([
      "Falta el proyecto de la etapa aprobado con ≥ 70",
      "Falta la defensa técnica",
    ]);
  });

  it("es unavailable mientras la defensa técnica no exista", () => {
    const result = evaluateReadiness(input({ defense: { available: false, done: false } }));

    expect(criterion(result, "evidence")).toEqual({
      id: "evidence",
      status: "unavailable",
      summary: "La evidencia profesional no se puede evaluar todavía",
      missing: ["La defensa técnica de AWS llega en S26"],
    });
    expect(result.ready).toBe(false);
  });

  it("es unavailable mientras la etapa no tenga proyecto", () => {
    const result = evaluateReadiness(
      input({ project: { available: false, bestReviewedScore: null } }),
    );

    expect(criterion(result, "evidence")).toEqual({
      id: "evidence",
      status: "unavailable",
      summary: "La evidencia profesional no se puede evaluar todavía",
      missing: ["El proyecto de la etapa todavía no está disponible"],
    });
  });
});

describe("evaluateReadiness — decisión final", () => {
  it("declara lista a la persona con los cuatro criterios en met", () => {
    const result = evaluateReadiness(input());

    expect(result.ready).toBe(true);
    expect(result.criteria.map((entry) => entry.id)).toEqual([
      "mastery",
      "mock-exams",
      "review",
      "evidence",
    ]);
    expect(result.criteria.map((entry) => entry.status)).toEqual(["met", "met", "met", "met"]);
    expect(result.criteria.every((entry) => entry.missing.length === 0)).toBe(true);
    expect(result.criteria.every((entry) => entry.summary.length > 0)).toBe(true);
  });

  it("no está lista con un solo criterio en missing", () => {
    const result = evaluateReadiness(input({ overdueReviewCount: 1 }));

    expect(result.criteria.map((entry) => entry.status)).toEqual([
      "met",
      "met",
      "missing",
      "met",
    ]);
    expect(result.ready).toBe(false);
  });

  it("no está lista con la defensa técnica en unavailable aunque lo demás se cumpla", () => {
    const result = evaluateReadiness(input({ defense: { available: false, done: false } }));

    expect(result.criteria.map((entry) => entry.status)).toEqual([
      "met",
      "met",
      "met",
      "unavailable",
    ]);
    expect(result.ready).toBe(false);
  });

  it("no está lista nada más empezar la etapa", () => {
    const result = evaluateReadiness(
      input({
        units: { total: 0, pendingCodes: [] },
        formsAvailable: 0,
        attempts: [],
        overdueReviewCount: 5,
        project: { available: false, bestReviewedScore: null },
        defense: { available: false, done: false },
      }),
    );

    expect(result.criteria.map((entry) => entry.status)).toEqual([
      "unavailable",
      "unavailable",
      "missing",
      "unavailable",
    ]);
    expect(result.ready).toBe(false);
  });
});
