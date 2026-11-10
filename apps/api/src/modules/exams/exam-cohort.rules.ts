import type { CertificationDefinition, ExamAttemptStatus, ExamCohort } from "@codeai/shared";

/**
 * Agregación pura de la cohorte (S15-T12a).
 *
 * Recibe lo que el servicio ya consultó y no toca Prisma, HTTP ni el reloj.
 * Solo cuentan los intentos terminados (entregados o vencidos) y no
 * orientativos. Los dominios salen de más débil a más fuerte y, por
 * privacidad, quedan vacíos con menos de `COHORT_MIN_LEARNERS` personas.
 */

export const COHORT_MIN_LEARNERS = 5;

export interface CohortInput {
  readonly definition: CertificationDefinition;
  readonly from: Date;
  readonly to: Date;
  readonly attempts: readonly {
    userId: string;
    status: ExamAttemptStatus;
    orientative: boolean;
    domainScores: readonly { domain: number; pct: number }[];
  }[];
  readonly realResults: readonly {
    readyAtRegistration: boolean;
    passed: boolean;
  }[];
}

const FINISHED_STATUSES: ReadonlySet<ExamAttemptStatus> = new Set<ExamAttemptStatus>([
  "submitted",
  "expired",
]);

export function aggregateCohort(input: CohortInput): ExamCohort {
  const counted = input.attempts.filter(
    (attempt) => FINISHED_STATUSES.has(attempt.status) && !attempt.orientative,
  );
  const learners = new Set(counted.map((attempt) => attempt.userId)).size;

  const pctsByDomain = new Map<number, number[]>();

  for (const attempt of counted) {
    for (const score of attempt.domainScores) {
      const pcts = pctsByDomain.get(score.domain) ?? [];

      pcts.push(score.pct);
      pctsByDomain.set(score.domain, pcts);
    }
  }

  const domains =
    learners < COHORT_MIN_LEARNERS
      ? []
      : input.definition.domains
          .filter((domain) => pctsByDomain.has(domain.id))
          .map((domain) => {
            const pcts = pctsByDomain.get(domain.id) ?? [];
            const sum = pcts.reduce((total, pct) => total + pct, 0);

            return {
              domain: domain.id,
              name: domain.name,
              avgPct: Math.round(sum / pcts.length),
              attempts: pcts.length,
            };
          })
          .sort((a, b) => a.avgPct - b.avgPct || a.domain - b.domain);

  const readinessVsReal = {
    readyPassed: 0,
    readyFailed: 0,
    notReadyPassed: 0,
    notReadyFailed: 0,
  };

  for (const result of input.realResults) {
    if (result.readyAtRegistration) {
      if (result.passed) {
        readinessVsReal.readyPassed += 1;
      } else {
        readinessVsReal.readyFailed += 1;
      }
    } else if (result.passed) {
      readinessVsReal.notReadyPassed += 1;
    } else {
      readinessVsReal.notReadyFailed += 1;
    }
  }

  return {
    certification: input.definition.code,
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    attempts: counted.length,
    learners,
    domains,
    readinessVsReal,
  };
}
