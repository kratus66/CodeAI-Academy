"use client";

import type { CloudEvidenceInput, CloudEvidenceResult, ExerciseDetail } from "@codeai/shared";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";

/**
 * Laboratorio en tu cuenta de AWS (`metodo-aws.md` §4.2, S16-T11b).
 *
 * El estudiante ejecuta comandos de solo lectura en su propia cuenta y pega la
 * salida JSON. Nunca se piden claves; el servidor valida y enmascara la
 * evidencia y no concede nivel 3.
 */

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const COPY_BUTTON =
  "inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const TEXTAREA_CLASSES =
  "w-full rounded-lg border border-line/70 bg-ink-card px-3 py-2 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";

const UNEXPECTED_MESSAGE = "No pudimos revisar tu evidencia. Inténtalo de nuevo.";

const MISSING_CONFIG_MESSAGE = "Este laboratorio no tiene configuración disponible.";

const SECURITY_NOTICE = "Nunca pegues claves ni secretos. Usa una cuenta de práctica con MFA y presupuesto";

const LEVEL_NOTICE = "Esta práctica no certifica nivel 3";

const EVIDENCE_LABEL = "Pega la salida JSON";

const CLEANUP_LABEL = "He eliminado los recursos del laboratorio";

type CloudOutcome = CloudEvidenceResult["outcome"];

const OUTCOME_LABEL: Record<CloudOutcome, string> = {
  PASSED: "Aprobada",
  PARTIAL: "Parcial",
  FAILED: "No aprobada",
};

const OUTCOME_TONE: Record<CloudOutcome, string> = {
  PASSED: "text-emerald-300",
  PARTIAL: "text-amber-300",
  FAILED: "text-rose-300",
};

export interface CloudLabPlayerProps {
  readonly exercise: ExerciseDetail;
  /** Inyectable en pruebas; por defecto `exercisesApi.submitCloudEvidence`. */
  readonly submitEvidence?: (id: string, body: CloudEvidenceInput) => Promise<CloudEvidenceResult>;
}

interface CloudCheck {
  readonly id: string;
  readonly label: string;
  readonly phase: "build" | "cleanup";
  readonly command: string;
}

interface CloudLabConfig {
  readonly region: string;
  readonly tag: string;
  readonly cost: {
    readonly expectedUsd: number;
    readonly freeTier: string;
    readonly source: string;
    readonly checkedOn: string;
  };
  readonly prerequisites: readonly string[];
  readonly steps: readonly { readonly title: string; readonly instructions: string }[];
  readonly checks: readonly CloudCheck[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStrings(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    items.push(item);
  }

  return items;
}

function readCost(value: unknown): CloudLabConfig["cost"] | null {
  const cost = asRecord(value);

  if (cost === null) {
    return null;
  }

  const { expectedUsd, freeTier, source, checkedOn } = cost;

  if (
    typeof expectedUsd !== "number" ||
    typeof freeTier !== "string" ||
    typeof source !== "string" ||
    typeof checkedOn !== "string"
  ) {
    return null;
  }

  return { expectedUsd, freeTier, source, checkedOn };
}

function readSteps(value: unknown): CloudLabConfig["steps"] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const steps: { title: string; instructions: string }[] = [];

  for (const raw of value) {
    const step = asRecord(raw);

    if (step === null || typeof step.title !== "string" || typeof step.instructions !== "string") {
      return null;
    }

    steps.push({ title: step.title, instructions: step.instructions });
  }

  return steps;
}

function readChecks(value: unknown): readonly CloudCheck[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const checks: CloudCheck[] = [];

  for (const raw of value) {
    const check = asRecord(raw);

    if (
      check === null ||
      typeof check.id !== "string" ||
      typeof check.label !== "string" ||
      typeof check.command !== "string" ||
      (check.phase !== "build" && check.phase !== "cleanup")
    ) {
      return null;
    }

    checks.push({ id: check.id, label: check.label, phase: check.phase, command: check.command });
  }

  return checks;
}

/** Cualquier configuración incompleta deja la pantalla en el aviso. */
function readConfig(config: Record<string, unknown>): CloudLabConfig | null {
  const cost = readCost(config.cost);
  const prerequisites = readStrings(config.prerequisites);
  const steps = readSteps(config.steps);
  const checks = readChecks(config.checks);

  if (
    cost === null ||
    prerequisites === null ||
    steps === null ||
    checks === null ||
    typeof config.region !== "string" ||
    typeof config.tag !== "string"
  ) {
    return null;
  }

  return { region: config.region, tag: config.tag, cost, prerequisites, steps, checks };
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === "UNAUTHENTICATED"
      ? "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando."
      : error.message;
  }

  return UNEXPECTED_MESSAGE;
}

function isSafeUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

interface CheckFieldProps {
  readonly check: CloudCheck;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}

function CheckField({ check, value, disabled, onChange }: CheckFieldProps) {
  const fieldId = useId();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");

  /** Sin portapapeles disponible, se deja el comando seleccionable a mano. */
  async function copyCommand(): Promise<void> {
    try {
      await navigator.clipboard.writeText(check.command);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }

  return (
    <li className="space-y-2 rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3">
      <p className="text-sm font-medium text-slate-100">{check.label}</p>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line/70 bg-ink-card px-3 py-2 font-mono text-xs text-slate-200">
          <code>{check.command}</code>
        </pre>
        <button type="button" onClick={() => void copyCommand()} className={COPY_BUTTON}>
          {copyState === "copied" ? "Comando copiado" : "Copiar comando"}
        </button>
      </div>
      {copyState === "manual" ? (
        <p role="status" className="text-xs text-amber-200">
          No pudimos copiar automáticamente: selecciona el comando y cópialo a mano.
        </p>
      ) : null}
      <label htmlFor={fieldId} className="block text-sm text-slate-300">
        {EVIDENCE_LABEL}
        <span className="sr-only"> de «{check.label}»</span>
      </label>
      <textarea
        id={fieldId}
        rows={5}
        value={value}
        disabled={disabled}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className={TEXTAREA_CLASSES}
      />
    </li>
  );
}

export function CloudLabPlayer({
  exercise,
  submitEvidence = (id, body) => exercisesApi.submitCloudEvidence(id, body),
}: CloudLabPlayerProps) {
  const cleanupId = useId();
  const config = readConfig(exercise.config);
  const [outputs, setOutputs] = useState<Readonly<Record<string, string>>>({});
  const [cleanupConfirmed, setCleanupConfirmed] = useState(false);
  const [result, setResult] = useState<CloudEvidenceResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (config === null) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        {MISSING_CONFIG_MESSAGE}
      </p>
    );
  }

  const { cost, checks } = config;
  const buildChecks = checks.filter((check) => check.phase === "build");
  const cleanupChecks = checks.filter((check) => check.phase === "cleanup");
  const filled = checks.filter((check) => (outputs[check.id] ?? "").trim().length >= 2);
  const complete = filled.length > 0;
  const locked = result !== null || pending;

  function setOutput(checkId: string, value: string): void {
    setOutputs((current) => ({ ...current, [checkId]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!complete || locked) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const body: CloudEvidenceInput = {
        evidence: filled.map((check) => ({ checkId: check.id, output: outputs[check.id] ?? "" })),
        cleanupConfirmed,
      };

      setResult(await submitEvidence(exercise.id, body));
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  function retry(): void {
    setOutputs({});
    setCleanupConfirmed(false);
    setResult(null);
    setError(null);
  }

  function renderChecks(list: readonly CloudCheck[]) {
    return (
      <ul className="space-y-3">
        {list.map((check) => (
          <CheckField
            key={check.id}
            check={check}
            value={outputs[check.id] ?? ""}
            disabled={locked}
            onChange={(value) => setOutput(check.id, value)}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-slate-300">{exercise.statement}</p>
        <p className="text-xs text-slate-400">
          Región {config.region} · etiqueta de recursos {config.tag}
        </p>
      </div>

      <section aria-label="Avisos" className="space-y-3">
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Costo estimado</p>
          <p>Costo esperado: {cost.expectedUsd} USD</p>
          <p>Capa gratuita: {cost.freeTier}</p>
          <p>
            Fuente:{" "}
            {isSafeUrl(cost.source) ? (
              <a
                href={cost.source}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {cost.source}
              </a>
            ) : (
              cost.source
            )}
          </p>
          <p>Verificado el {cost.checkedOn}</p>
        </div>
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">
          {SECURITY_NOTICE}
        </p>
        <p className="rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 text-sm text-slate-200">
          {LEVEL_NOTICE}
        </p>
      </section>

      <section aria-label="Prerrequisitos" className="space-y-2">
        <h2 className="text-base font-medium text-white">Prerrequisitos</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          {config.prerequisites.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Pasos" className="space-y-2">
        <h2 className="text-base font-medium text-white">Pasos</h2>
        <ol className="space-y-3">
          {config.steps.map((step, index) => (
            <li key={index} className="space-y-1 rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3">
              <p className="text-sm font-medium text-slate-100">
                {index + 1}. {step.title}
              </p>
              <p className="whitespace-pre-line text-sm text-slate-300">{step.instructions}</p>
            </li>
          ))}
        </ol>
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6" aria-busy={pending}>
        <section aria-label="Comprobaciones" className="space-y-3">
          <h2 className="text-base font-medium text-white">Comprobaciones</h2>
          {renderChecks(buildChecks)}
        </section>

        <section aria-label="Limpieza" className="space-y-3">
          <h2 className="text-base font-medium text-white">Limpieza</h2>
          {renderChecks(cleanupChecks)}
          <label htmlFor={cleanupId} className="flex items-center gap-2 text-sm text-slate-300">
            <input
              id={cleanupId}
              type="checkbox"
              checked={cleanupConfirmed}
              disabled={locked}
              onChange={(event) => setCleanupConfirmed(event.target.checked)}
            />
            {CLEANUP_LABEL}
          </label>
        </section>

        {error ? (
          <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {result === null ? (
          <button type="submit" className={PRIMARY_BUTTON} disabled={!complete || pending}>
            {pending ? "Enviando…" : "Enviar evidencia"}
          </button>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="space-y-4 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm"
          >
            <p className={cn("text-lg font-semibold", OUTCOME_TONE[result.outcome])}>
              {OUTCOME_LABEL[result.outcome]}
            </p>
            <p className="text-slate-200">
              {result.cleanupConfirmed
                ? "Limpieza confirmada."
                : "Limpieza sin confirmar: elimina los recursos del laboratorio."}
            </p>
            <ul className="space-y-3">
              {result.checks.map((item) => (
                <li
                  key={item.checkId}
                  className="space-y-1 rounded-xl border border-line/70 bg-ink-card/60 px-4 py-3"
                >
                  <p className="font-medium text-slate-100">{item.label}</p>
                  <p className={cn("text-xs font-semibold", item.passed ? "text-emerald-300" : "text-rose-300")}>
                    {item.passed ? "Cumple" : "No cumple"}
                  </p>
                  {item.problems.length > 0 ? (
                    <ul className="list-disc pl-5 text-slate-300">
                      {item.problems.map((problem, index) => (
                        <li key={index}>{problem}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
            {result.maskedSummary.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Resumen enmascarado
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-line/70 bg-ink-card px-3 py-2 font-mono text-xs text-slate-200">
                  {result.maskedSummary}
                </pre>
              </div>
            ) : null}
            <button type="button" className={SECONDARY_BUTTON} onClick={retry}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
