import type { AuditAnswerInput, AuditAnswerResult } from "@codeai/shared";
import { AUDIT_DECISIONS, AUDIT_SEVERITIES } from "@codeai/shared";

/**
 * Corrector puro de las auditorías de código (`S14-T11b`).
 *
 * No lanza, no conoce HTTP ni Prisma y no persiste nada: recibe la `solution`
 * del ejercicio tal como llega de la base (`unknown`, se lee con *narrowing*) y
 * la respuesta ya validada por `auditAnswerSchema`, y devuelve la corrección. El
 * servicio (T11c) traduce cada estado a una respuesta HTTP.
 *
 * Orden de las comprobaciones: primero el contenido roto (un ejercicio mal
 * sembrado es un error del servidor, no del estudiante) y después la forma de la
 * respuesta. La auditoría sí admite acierto parcial: el estudiante marca los
 * hallazgos que cree defectos, elige severidad y decide; los puntos se prorratean
 * sobre los defectos reales y los falsos positivos restan.
 */

export const UNKNOWN_FINDING = (id: string): string => `El hallazgo ${id} no existe en esta auditoría`;

export type AuditGrading =
  | { readonly status: "graded"; readonly result: AuditAnswerResult; readonly submissionCode: string }
  | { readonly status: "invalid-answer"; readonly message: string }
  | { readonly status: "broken-content" };

type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];
type AuditDecision = (typeof AUDIT_DECISIONS)[number];
type AuditMark = AuditAnswerInput["marks"][number];

/** Pesos del baremo (`banco-ejercicios.md` §3.6). No se cambian sin la ficha. */
const FINDINGS_WEIGHT = 0.8;
const DECISION_WEIGHT = 0.2;
const FALSE_POSITIVE_PENALTY = 0.15;
const EXACT_SEVERITY_POINTS = 1;
const CLOSE_SEVERITY_POINTS = 0.5;
const PASS_MARK = 70;

interface SolutionFinding {
  readonly id: string;
  readonly isDefect: boolean;
  readonly severity: AuditSeverity | null;
  readonly explanation: string;
}

interface AuditContent {
  readonly findings: readonly SolutionFinding[];
  readonly verdict: AuditDecision;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isSeverity(value: unknown): value is AuditSeverity {
  return typeof value === "string" && AUDIT_SEVERITIES.some((severity) => severity === value);
}

function isDecision(value: unknown): value is AuditDecision {
  return typeof value === "string" && AUDIT_DECISIONS.some((decision) => decision === value);
}

/** Un hallazgo de la solución; `null` si le falta cualquier campo o lo trae mal. */
function readFinding(value: unknown): SolutionFinding | null {
  const record = asRecord(value);
  const { id, isDefect, explanation } = record;
  const rawSeverity = record.severity;
  const severity = rawSeverity === undefined ? null : rawSeverity;

  if (typeof id !== "string" || id.length === 0 || typeof isDefect !== "boolean") {
    return null;
  }

  if (typeof explanation !== "string" || explanation.length === 0) {
    return null;
  }

  if (severity !== null && !isSeverity(severity)) {
    return null;
  }

  return { id, isDefect, severity, explanation };
}

/**
 * Solución sembrada: `{ findings, verdict }` (T10b). `null` si está malformada,
 * repite ids o no declara ningún defecto: sin defectos no hay nada que auditar.
 */
function readContent(solution: unknown): AuditContent | null {
  const content = asRecord(solution);
  const rawFindings = content.findings;

  if (!Array.isArray(rawFindings) || rawFindings.length === 0) {
    return null;
  }

  const findings: SolutionFinding[] = [];

  for (const rawFinding of rawFindings) {
    const finding = readFinding(rawFinding);

    if (finding === null) {
      return null;
    }

    findings.push(finding);
  }

  if (new Set(findings.map((finding) => finding.id)).size !== findings.length) {
    return null;
  }

  if (!findings.some((finding) => finding.isDefect)) {
    return null;
  }

  if (!isDecision(content.verdict)) {
    return null;
  }

  return { findings, verdict: content.verdict };
}

function invalidAnswer(message: string): AuditGrading {
  return { status: "invalid-answer", message };
}

/** Marcas en el orden del código de envío: por `findingId`, sin depender del idioma. */
function byFindingId(left: AuditMark, right: AuditMark): number {
  if (left.findingId === right.findingId) {
    return 0;
  }

  return left.findingId < right.findingId ? -1 : 1;
}

function outcomeFor(score: number): AuditAnswerResult["outcome"] {
  if (score >= PASS_MARK) {
    return "PASSED";
  }

  return score > 0 ? "PARTIAL" : "FAILED";
}

/**
 * Corrige una auditoría ya recibida: nunca lanza, siempre devuelve un estado.
 * Una marca con un `findingId` que no existe se rechaza antes de calcular nada.
 */
export function gradeAudit(solution: unknown, answer: AuditAnswerInput): AuditGrading {
  const content = readContent(solution);

  if (content === null) {
    return { status: "broken-content" };
  }

  const knownIds = new Set(content.findings.map((finding) => finding.id));

  for (const mark of answer.marks) {
    if (!knownIds.has(mark.findingId)) {
      return invalidAnswer(UNKNOWN_FINDING(mark.findingId));
    }
  }

  const chosenSeverities = new Map(answer.marks.map((mark) => [mark.findingId, mark.severity]));
  const totalDefects = content.findings.filter((finding) => finding.isDefect).length;

  let detectedDefects = 0;
  let falsePositives = 0;
  let severityPoints = 0;

  for (const finding of content.findings) {
    const chosen = chosenSeverities.get(finding.id);

    if (chosen === undefined) {
      continue;
    }

    if (!finding.isDefect) {
      falsePositives += 1;
      continue;
    }

    detectedDefects += 1;
    severityPoints += chosen === finding.severity ? EXACT_SEVERITY_POINTS : CLOSE_SEVERITY_POINTS;
  }

  const findingsRatio = severityPoints / totalDefects;
  const decisionCorrect = answer.decision === content.verdict;
  const decisionPoints = detectedDefects >= 1 && decisionCorrect ? 1 : 0;
  const raw =
    FINDINGS_WEIGHT * findingsRatio + DECISION_WEIGHT * decisionPoints - FALSE_POSITIVE_PENALTY * falsePositives;
  const score = Math.round(100 * Math.min(1, Math.max(0, raw)));

  const findings = content.findings.map((finding) => {
    const chosen = chosenSeverities.get(finding.id);
    const marked = chosen !== undefined;

    return {
      id: finding.id,
      isDefect: finding.isDefect,
      severity: finding.severity,
      marked,
      chosenSeverity: chosen ?? null,
      /** `null` si no estaba marcado o no era defecto. */
      severityCorrect: marked && finding.isDefect ? chosen === finding.severity : null,
      explanation: finding.explanation,
    };
  });

  return {
    status: "graded",
    result: {
      score,
      outcome: outcomeFor(score),
      detectedDefects,
      totalDefects,
      falsePositives,
      decisionCorrect,
      verdict: content.verdict,
      findings,
    },
    submissionCode: JSON.stringify({
      marks: [...answer.marks].sort(byFindingId),
      decision: answer.decision,
    }),
  };
}

