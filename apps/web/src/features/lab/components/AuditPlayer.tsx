"use client";

import type { AuditAnswerInput, AuditAnswerResult, ExerciseDetail } from "@codeai/shared";
import { AUDIT_DECISIONS, AUDIT_SEVERITIES } from "@codeai/shared";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";

/**
 * Auditoría de código generado por IA (`banco-ejercicios.md` §3.6, S14-T12b).
 *
 * El estudiante revisa el artefacto completo, marca los hallazgos que cree
 * defectos con su severidad y decide qué hacer con él. Antes de enviar solo ve
 * etiquetas neutras: ni la severidad real, ni cuáles son defectos, ni las
 * explicaciones llegan con `GET …/exercises/:id`; todo eso viene con la
 * corrección de `POST …/audit-answers` (T11c), igual que en los quizzes.
 */

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const COPY_BUTTON =
  "inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const SELECT_CLASSES =
  "rounded-lg border border-line/70 bg-ink-card px-2 py-1 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Mismo texto que el quiz cuando el fallo no lo explica la API. */
const UNEXPECTED_GRADE_MESSAGE = "No pudimos corregir tu auditoría. Inténtalo de nuevo.";

const MISSING_ARTIFACT_MESSAGE = "Esta auditoría no tiene artefacto disponible.";

type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];
type AuditDecision = (typeof AUDIT_DECISIONS)[number];
type AuditOutcome = AuditAnswerResult["outcome"];

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const DECISION_LABEL: Record<AuditDecision, string> = {
  accept: "Aceptar",
  fix: "Corregir",
  discard: "Descartar",
};

const OUTCOME_LABEL: Record<AuditOutcome, string> = {
  PASSED: "Aprobada",
  PARTIAL: "Parcial",
  FAILED: "No aprobada",
};

const OUTCOME_TONE: Record<AuditOutcome, string> = {
  PASSED: "text-emerald-300",
  PARTIAL: "text-amber-300",
  FAILED: "text-rose-300",
};

export interface AuditPlayerProps {
  readonly exercise: ExerciseDetail;
  /** Inyectable en pruebas; por defecto `exercisesApi.submitAudit`. */
  readonly submitAudit?: (id: string, body: AuditAnswerInput) => Promise<AuditAnswerResult>;
}

interface AuditCandidate {
  readonly id: string;
  readonly label: string;
  readonly lines: readonly [number, number];
}

interface AuditConfig {
  readonly artifact: { readonly language: string; readonly content: string };
  readonly candidates: readonly AuditCandidate[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isSeverity(value: unknown): value is AuditSeverity {
  return typeof value === "string" && AUDIT_SEVERITIES.some((severity) => severity === value);
}

/** Rango de líneas 1-based e inclusivo, como lo siembra la ficha del banco. */
function readLines(value: unknown): readonly [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const [start, end] = value;

  if (typeof start !== "number" || typeof end !== "number") {
    return null;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return null;
  }

  return [start, end];
}

/**
 * Configuración mínima que se puede pintar: un artefacto con contenido y al
 * menos un candidato con id, etiqueta y rango válidos. Cualquier otra cosa deja
 * la pantalla en el aviso, sin enseñar un artefacto a medias.
 */
function readConfig(config: Record<string, unknown>): AuditConfig | null {
  const artifact = asRecord(config.artifact);
  const rawCandidates = config.candidates;

  if (artifact === null || !Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    return null;
  }

  const { language, content } = artifact;

  if (typeof language !== "string" || typeof content !== "string" || content.length === 0) {
    return null;
  }

  const candidates: AuditCandidate[] = [];

  for (const raw of rawCandidates) {
    const record = asRecord(raw);
    const lines = record === null ? null : readLines(record.lines);

    if (record === null || lines === null) {
      return null;
    }

    if (typeof record.id !== "string" || typeof record.label !== "string") {
      return null;
    }

    candidates.push({ id: record.id, label: record.label, lines });
  }

  return { artifact: { language, content }, candidates };
}

/** «líneas 12–14», o «línea 12» cuando el hallazgo ocupa una sola línea. */
function formatLines([start, end]: readonly [number, number]): string {
  return start === end ? `línea ${start}` : `líneas ${start}–${end}`;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === "UNAUTHENTICATED"
      ? "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando."
      : error.message;
  }

  return UNEXPECTED_GRADE_MESSAGE;
}

function readSeverity(
  severities: Readonly<Record<string, AuditSeverity | null>>,
  id: string,
): AuditSeverity | null {
  const value = severities[id];

  return isSeverity(value) ? value : null;
}

type AuditFinding = AuditAnswerResult["findings"][number];

/** Los hallazgos llegan con su `id`; la etiqueta neutra vive en la config. */
function labelFor(candidates: readonly AuditCandidate[], id: string): string {
  const candidate = candidates.find((item) => item.id === id);

  return candidate === undefined ? id : candidate.label;
}

function describeRealFinding(finding: AuditFinding): string {
  if (!finding.isDefect) {
    return "No era un defecto";
  }

  return finding.severity === null
    ? "Era un defecto real (sin severidad declarada)"
    : `Era un defecto real · severidad ${SEVERITY_LABEL[finding.severity]}`;
}

function describeMark(finding: AuditFinding): string {
  const marked = finding.marked
    ? finding.chosenSeverity === null
      ? "Lo marcaste sin severidad"
      : `Lo marcaste como ${SEVERITY_LABEL[finding.chosenSeverity]}`
    : "No lo marcaste";

  if (finding.severityCorrect === null) {
    return marked;
  }

  return finding.severityCorrect ? `${marked} · severidad acertada` : `${marked} · severidad distinta`;
}

export function AuditPlayer({
  exercise,
  submitAudit = (id, body) => exercisesApi.submitAudit(id, body),
}: AuditPlayerProps) {
  const decisionName = useId();
  const config = readConfig(exercise.config);
  const [severities, setSeverities] = useState<Readonly<Record<string, AuditSeverity | null>>>({});
  const [decision, setDecision] = useState<AuditDecision | null>(null);
  const [result, setResult] = useState<AuditAnswerResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (config === null) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        {MISSING_ARTIFACT_MESSAGE}
      </p>
    );
  }

  const { artifact, candidates } = config;
  const markedCandidates = candidates.filter((candidate) => candidate.id in severities);
  const everySeverityChosen = markedCandidates.every(
    (candidate) => readSeverity(severities, candidate.id) !== null,
  );
  const complete = decision !== null && everySeverityChosen;

  function toggleMark(candidateId: string): void {
    setSeverities((current) => {
      const next: Record<string, AuditSeverity | null> = { ...current };

      if (candidateId in next) {
        delete next[candidateId];
      } else {
        next[candidateId] = null;
      }

      return next;
    });
  }

  function chooseSeverity(candidateId: string, value: string): void {
    setSeverities((current) => ({ ...current, [candidateId]: isSeverity(value) ? value : null }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!complete || decision === null || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const body: AuditAnswerInput = {
        marks: markedCandidates.flatMap((candidate) => {
          const severity = readSeverity(severities, candidate.id);

          return severity === null ? [] : [{ findingId: candidate.id, severity }];
        }),
        decision,
      };

      setResult(await submitAudit(exercise.id, body));
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  function retry(): void {
    setSeverities({});
    setDecision(null);
    setResult(null);
    setError(null);
  }

  /** El artefacto se copia entero, sin los números de línea que se pintan al lado. */
  async function copyArtifact(): Promise<void> {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-slate-300">{exercise.statement}</p>
        <p className="text-xs text-slate-400">
          Revisa el artefacto, marca cada hallazgo que creas un defecto con su severidad y decide qué
          hacer con él. La corrección llega después del intento.
        </p>
      </div>

      <section aria-label="Artefacto a auditar" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Artefacto · {artifact.language}
          </p>
          <button type="button" onClick={() => void copyArtifact()} className={COPY_BUTTON}>
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <pre className="max-h-96 overflow-auto rounded-xl border border-line/70 bg-ink-card px-4 py-3 font-mono text-xs leading-relaxed text-slate-200">
          <code>
            {artifact.content.split("\n").map((text, index) => (
              <span key={index} className="grid grid-cols-[2.5rem_1fr]">
                <span aria-hidden="true" className="select-none pr-3 text-right text-slate-500">
                  {index + 1}
                </span>
                <span className="whitespace-pre">{text === "" ? " " : text}</span>
              </span>
            ))}
          </code>
        </pre>
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" aria-busy={pending}>
        <fieldset className="space-y-3" disabled={result !== null || pending}>
          <legend className="text-base font-medium text-white">Hallazgos</legend>
          <ul className="space-y-3">
            {candidates.map((candidate) => {
              const isMarked = candidate.id in severities;
              const severity = readSeverity(severities, candidate.id);

              return (
                <li
                  key={candidate.id}
                  className={cn(
                    "space-y-2 rounded-xl border px-4 py-3 transition",
                    isMarked ? "border-accent bg-accent/10" : "border-line/70 bg-ink-card/40",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-slate-200">{candidate.label}</p>
                    <p className="font-mono text-xs text-slate-400">{formatLines(candidate.lines)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={isMarked}
                        aria-label={`Es un defecto: ${candidate.label}`}
                        onChange={() => toggleMark(candidate.id)}
                      />
                      Es un defecto
                    </label>
                    {isMarked ? (
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <span>Severidad</span>
                        <select
                          aria-label={`Severidad: ${candidate.label}`}
                          value={severity ?? ""}
                          onChange={(event) => chooseSeverity(candidate.id, event.target.value)}
                          className={SELECT_CLASSES}
                        >
                          <option value="">Elige severidad</option>
                          {AUDIT_SEVERITIES.map((value) => (
                            <option key={value} value={value}>
                              {SEVERITY_LABEL[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset className="space-y-3" disabled={result !== null || pending}>
          <legend className="text-base font-medium text-white">¿Qué haces con el artefacto?</legend>
          <div className="flex flex-wrap gap-4">
            {AUDIT_DECISIONS.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name={decisionName}
                  value={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                {DECISION_LABEL[value]}
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {result === null ? (
          <button type="submit" className={PRIMARY_BUTTON} disabled={!complete || pending}>
            {pending ? "Enviando…" : "Enviar auditoría"}
          </button>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="space-y-4 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="text-2xl font-semibold text-white">{result.score} / 100</p>
              <p className={cn("font-semibold", OUTCOME_TONE[result.outcome])}>
                {OUTCOME_LABEL[result.outcome]}
              </p>
            </div>
            <div>
              <p className="text-slate-200">
                Defectos encontrados: {result.detectedDefects} de {result.totalDefects}
              </p>
              <p className="text-slate-200">Falsos positivos: {result.falsePositives}</p>
              <p className="text-xs text-slate-400">Cada falso positivo resta nota</p>
            </div>
            <p className="text-slate-200">
              {result.decisionCorrect
                ? `Acertaste la decisión: «${DECISION_LABEL[result.verdict]}».`
                : `La decisión correcta era «${DECISION_LABEL[result.verdict]}».`}
            </p>
            <ul className="space-y-3">
              {result.findings.map((finding) => (
                <li
                  key={finding.id}
                  className="space-y-1 rounded-xl border border-line/70 bg-ink-card/60 px-4 py-3"
                >
                  <p className="font-medium text-slate-100">{labelFor(candidates, finding.id)}</p>
                  <p className="text-xs text-slate-400">{describeRealFinding(finding)}</p>
                  <p className="text-xs text-slate-400">{describeMark(finding)}</p>
                  <p className="text-slate-300">{finding.explanation}</p>
                </li>
              ))}
            </ul>
            <button type="button" className={SECONDARY_BUTTON} onClick={retry}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

