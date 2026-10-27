"use client";

import type { SubmissionOutcome, SubmissionSummary } from "@codeai/shared";
import { useCallback, useEffect, useRef } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError, exercisesApi } from "@/lib/api-client";

export const OUTCOME_LABEL: Record<SubmissionOutcome, string> = {
  PASSED: "Superado",
  PARTIAL: "Parcial",
  FAILED: "Fallido",
  ERROR: "Error de ejecución",
  TIMEOUT: "Tiempo agotado",
};

const BUTTON_CLASSES =
  "mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const PANEL_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4";

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

export type LoadHistory = (
  exerciseId: string,
  signal: AbortSignal,
) => Promise<SubmissionSummary[]>;

/** Referencia de módulo: el loader del hook debe ser estable entre renders. */
const defaultLoadHistory: LoadHistory = (exerciseId, signal) =>
  exercisesApi.listSubmissions(exerciseId, signal);

export interface AttemptHistoryProps {
  readonly exerciseId: string;
  /** Cambia cuando se envía un intento nuevo: el historial se vuelve a pedir. */
  readonly refreshToken?: number;
  /** Inyectable en pruebas; por defecto `exercisesApi.listSubmissions`. */
  readonly loadHistory?: LoadHistory;
}

function formatDate(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? iso : DATE_FORMAT.format(date);
}

/**
 * Historial propio de intentos del ejercicio (`GET /api/exercises/:id/submissions`).
 * La API los devuelve del más reciente al más antiguo y aquí no se reordenan;
 * `results` ya llega filtrado a pruebas visibles y no se pinta.
 */
export function AttemptHistory({
  exerciseId,
  refreshToken = 0,
  loadHistory = defaultLoadHistory,
}: AttemptHistoryProps) {
  const load = useCallback(
    (signal: AbortSignal) => loadHistory(exerciseId, signal),
    [exerciseId, loadHistory],
  );
  const { state, reload } = useContentLoader(load);
  const previousToken = useRef(refreshToken);

  useEffect(() => {
    if (previousToken.current !== refreshToken) {
      previousToken.current = refreshToken;
      reload();
    }
  }, [refreshToken, reload]);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando tu historial…
      </p>
    );
  }

  if (state.status === "error") {
    const expired =
      state.error instanceof ApiError && state.error.code === "UNAUTHENTICATED";

    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        {expired ? (
          <p>
            No pudimos cargar tu historial. Tu sesión caducó: vuelve a iniciar
            sesión.
          </p>
        ) : (
          <>
            <p>No pudimos cargar tu historial.</p>
            <button type="button" className={BUTTON_CLASSES} onClick={reload}>
              Reintentar
            </button>
          </>
        )}
      </div>
    );
  }

  const submissions = state.data;

  if (submissions.length === 0) {
    return (
      <div className={PANEL_CLASSES}>
        <p className="text-sm font-medium text-slate-200">
          Todavía no has enviado este ejercicio.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Tu primer envío aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="historial" className="space-y-3">
      <h2
        id="historial"
        className="text-lg font-semibold tracking-tight text-white"
      >
        Historial de intentos
      </h2>
      <ol className="list-none space-y-3 p-0">
        {submissions.map((submission, index) => (
          <li key={submission.id} className={PANEL_CLASSES}>
            <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium text-slate-100">
              <span>Intento {submissions.length - index}</span>
              <time
                dateTime={submission.createdAt}
                className="text-xs font-normal text-slate-500"
              >
                {formatDate(submission.createdAt)}
              </time>
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {OUTCOME_LABEL[submission.outcome]} · {submission.score}/100 ·{" "}
              <span className="text-accent">
                {submission.achievedLevel === null
                  ? "sin nivel"
                  : `Nivel ${submission.achievedLevel}`}
              </span>{" "}
              ·{" "}
              {submission.hintsUsed === 1
                ? "1 pista"
                : `${submission.hintsUsed} pistas`}
            </p>
            <p className="mt-1 text-xs text-slate-400">{submission.feedback}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
