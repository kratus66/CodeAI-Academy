import type { ExamAttemptStatus, ExamMode, ReadinessCriterion } from "@codeai/shared";

/**
 * Regla pura «listo para presentar» (S15-T5; `curriculo-aws.md` §6).
 *
 * Recibe lo que el servicio ya consultó (unidades, formas sembradas, intentos,
 * retraso del repaso y evidencia profesional) y decide los cuatro criterios sin
 * tocar Prisma, HTTP ni el reloj: las fechas entran en `now` y en
 * `submittedAt`. `ready` solo es verdadero cuando los cuatro están en `met`, y
 * cada criterio dice qué falta en lugar de devolver un simple sí o no.
 *
 * Interpretación fijada por las decisiones del sprint: el criterio de dominio no
 * mira competencias críticas (decisión b) y el de evidencia queda `unavailable`
 * mientras no existan la defensa técnica ni los proyectos de la etapa
 * (decisión c, H7). El de simulacros solo cuenta las formas fijas A/B/C
 * entregadas, no orientativas, con ≥ 80 % y ningún dominio por debajo del 70 %
 * (decisión d).
 */

export interface ReadinessInput {
  readonly now: Date;
  /** Unidades publicadas de la etapa y los códigos que no están en `MASTERED`. */
  readonly units: { readonly total: number; readonly pendingCodes: readonly string[] };
  /** Formas A/B/C sembradas para la certificación. */
  readonly formsAvailable: number;
  readonly attempts: readonly {
    mode: ExamMode;
    status: ExamAttemptStatus;
    orientative: boolean;
    submittedAt: Date | null;
    scorePct: number | null;
    domainPcts: readonly number[];
  }[];
  /** Ítems de la etapa con `dueAt < now − 7 días`. */
  readonly overdueReviewCount: number;
  readonly project: { readonly available: boolean; readonly bestReviewedScore: number | null };
  /** S15: siempre `{ available: false, done: false }` (H7). */
  readonly defense: { readonly available: boolean; readonly done: boolean };
}

export type ReadinessAttempt = ReadinessInput["attempts"][number];

/** Formas fijas del simulacro completo: el aleatorio y el bloque no cuentan. */
const FIXED_FORMS: ReadonlySet<ExamMode> = new Set<ExamMode>(["form-a", "form-b", "form-c"]);

/** Un intento cuenta solo si se entregó; vencer el plazo también es entregar. */
const COUNTED_STATUSES: ReadonlySet<ExamAttemptStatus> = new Set<ExamAttemptStatus>([
  "submitted",
  "expired",
]);

/** Aciertos globales mínimos y suelo por dominio de la decisión (d). */
const MOCK_MIN_SCORE_PCT = 80;
const MOCK_MIN_DOMAIN_PCT = 70;

/** La forma válida más reciente debe tener 14 días o menos; el día 14 cuenta. */
const MOCK_RECENT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Nota mínima del proyecto revisado de la etapa. */
const PROJECT_MIN_SCORE = 70;

/**
 * Un intento es válido para el criterio de simulacros si es una forma fija,
 * está entregado (o vencido), no es orientativo y supera los dos umbrales. Dos
 * intentos de la misma forma cuentan como uno solo porque el criterio pide
 * formas **distintas**.
 */
function isCountedAttempt(attempt: ReadinessAttempt): boolean {
  return (
    FIXED_FORMS.has(attempt.mode) &&
    COUNTED_STATUSES.has(attempt.status) &&
    !attempt.orientative &&
    attempt.scorePct !== null &&
    attempt.scorePct >= MOCK_MIN_SCORE_PCT &&
    attempt.domainPcts.every((pct) => pct >= MOCK_MIN_DOMAIN_PCT)
  );
}

/**
 * Criterio 1: todas las unidades publicadas de la etapa en `MASTERED`. Sin
 * unidades publicadas no hay nada que dominar y el criterio es `unavailable`.
 */
function evaluateMastery(units: ReadinessInput["units"]): ReadinessCriterion {
  if (units.total === 0) {
    return {
      id: "mastery",
      status: "unavailable",
      summary: "La etapa no tiene unidades publicadas",
      missing: ["La etapa aún no tiene unidades publicadas"],
    };
  }

  if (units.pendingCodes.length === 0) {
    return {
      id: "mastery",
      status: "met",
      summary: "Dominio completo de todas las unidades",
      missing: [],
    };
  }

  return {
    id: "mastery",
    status: "missing",
    summary: "Hay unidades sin dominar",
    missing: units.pendingCodes.map((code) => `Unidad ${code} sin dominar`),
  };
}

/**
 * Criterio 2: dos formas fijas distintas aprobadas, la más reciente dentro de
 * los 14 días previos (decisión d). Con menos de dos formas sembradas la
 * certificación no puede evaluarlo.
 */
function evaluateMockExams(
  input: ReadinessInput,
  attempts: readonly ReadinessAttempt[],
): ReadinessCriterion {
  if (input.formsAvailable < 2) {
    return {
      id: "mock-exams",
      status: "unavailable",
      summary: "Faltan formas de simulacro",
      missing: ["Esta certificación aún no tiene dos formas de simulacro"],
    };
  }

  const counted = attempts.filter(isCountedAttempt);
  const distinctForms = new Set(counted.map((attempt) => attempt.mode)).size;
  const latestSubmittedMs = counted.reduce<number | null>((latest, attempt) => {
    if (attempt.submittedAt === null) {
      return latest;
    }

    const submittedMs = attempt.submittedAt.getTime();

    return latest === null || submittedMs > latest ? submittedMs : latest;
  }, null);

  const recent =
    latestSubmittedMs !== null &&
    input.now.getTime() - latestSubmittedMs <= MOCK_RECENT_DAYS * DAY_MS;
  const missing: string[] = [];

  if (distinctForms < 2) {
    missing.push(
      `Aprueba dos formas distintas con ≥ 80 % y ningún dominio por debajo del 70 % (llevas ${distinctForms})`,
    );
  }

  if (latestSubmittedMs !== null && !recent) {
    missing.push("Tu último simulacro válido tiene más de 14 días");
  }

  if (missing.length === 0) {
    return {
      id: "mock-exams",
      status: "met",
      summary: "Dos formas distintas aprobadas en los últimos 14 días",
      missing: [],
    };
  }

  return { id: "mock-exams", status: "missing", summary: "Faltan simulacros válidos", missing };
}

/** Criterio 3: ningún ítem de la etapa con más de 7 días de retraso en el repaso. */
function evaluateReview(overdueReviewCount: number): ReadinessCriterion {
  if (overdueReviewCount === 0) {
    return { id: "review", status: "met", summary: "Repaso al día", missing: [] };
  }

  return {
    id: "review",
    status: "missing",
    summary: "Tienes repaso atrasado",
    missing: [`${overdueReviewCount} ítems de repaso llevan más de 7 días de retraso`],
  };
}

/**
 * Criterio 4: proyecto de la etapa revisado con ≥ 70 y defensa técnica hecha.
 * Mientras falte una de las dos piezas en la plataforma, el criterio es
 * `unavailable` y nadie sale «listo» (decisión c).
 */
function evaluateEvidence(input: ReadinessInput): ReadinessCriterion {
  const unavailable: string[] = [];

  if (!input.project.available) {
    unavailable.push("El proyecto de la etapa todavía no está disponible");
  }

  if (!input.defense.available) {
    unavailable.push("La defensa técnica de AWS llega en S26");
  }

  if (unavailable.length > 0) {
    return {
      id: "evidence",
      status: "unavailable",
      summary: "La evidencia profesional no se puede evaluar todavía",
      missing: unavailable,
    };
  }

  const missing: string[] = [];
  const projectScore = input.project.bestReviewedScore;

  if (projectScore === null || projectScore < PROJECT_MIN_SCORE) {
    missing.push("Falta el proyecto de la etapa aprobado con ≥ 70");
  }

  if (!input.defense.done) {
    missing.push("Falta la defensa técnica");
  }

  if (missing.length === 0) {
    return {
      id: "evidence",
      status: "met",
      summary: "Proyecto y defensa técnica completados",
      missing: [],
    };
  }

  return { id: "evidence", status: "missing", summary: "Falta evidencia profesional", missing };
}

/**
 * Evalúa los cuatro criterios en el orden de `READINESS_CRITERIA` y declara
 * `ready` solo cuando todos están en `met`.
 */
export function evaluateReadiness(input: ReadinessInput): {
  ready: boolean;
  criteria: ReadinessCriterion[];
} {
  const criteria: ReadinessCriterion[] = [
    evaluateMastery(input.units),
    evaluateMockExams(input, input.attempts),
    evaluateReview(input.overdueReviewCount),
    evaluateEvidence(input),
  ];

  return { ready: criteria.every((criterion) => criterion.status === "met"), criteria };
}
