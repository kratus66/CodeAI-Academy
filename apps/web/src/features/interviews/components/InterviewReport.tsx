"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  INTERVIEW_CRITERIA,
  INTERVIEW_CRITERION_LABELS,
  INTERVIEW_PHASE_LABELS,
  INTERVIEW_REFLECTION_MIN,
} from "@codeai/shared";
import type {
  InterviewCriterion,
  InterviewHistoryResponse,
  InterviewScores,
  InterviewSession,
  ReviewInterviewInput,
  SelfReviewInput,
} from "@codeai/shared";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { interviewsApi } from "@/lib/api-client";

const BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const CARD_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-200";

const STATUS_LABELS: Record<InterviewSession["status"], string> = {
  IN_PROGRESS: "En curso",
  COMPLETED: "Cerrada, pendiente de autoevaluación",
  REVIEWED: "Revisada",
  ABANDONED: "Abandonada",
};

const DEFAULT_SCORES: InterviewScores = {
  razonamiento: 2,
  correctitud: 2,
  comunicacion: 2,
  seguimiento: 2,
  limites: 2,
};

interface InterviewReportProps {
  readonly sessionId: string;
  /** Muestra el formulario de revisión (sólo instructores/admin). */
  readonly instructor?: boolean;
  readonly loadSession?: (
    sessionId: string,
    signal?: AbortSignal,
  ) => Promise<InterviewSession>;
  readonly loadHistory?: (signal?: AbortSignal) => Promise<InterviewHistoryResponse>;
  readonly submitSelfReview?: (
    sessionId: string,
    input: SelfReviewInput,
  ) => Promise<InterviewSession>;
  readonly submitReview?: (
    sessionId: string,
    input: ReviewInterviewInput,
  ) => Promise<InterviewSession>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Informe de una entrevista (`sprint-10-entrevistas.md` T16).
 *
 * Reúne transcripción, autoevaluación frente a nota, comparación entre intentos
 * del mismo escenario y —sólo para instructores— el formulario de revisión. El
 * servidor decide qué se puede hacer con cada estado; la vista no lo adivina.
 */
export function InterviewReport({
  sessionId,
  instructor = false,
  loadSession,
  loadHistory,
  submitSelfReview = interviewsApi.selfReview,
  submitReview = interviewsApi.review,
}: InterviewReportProps) {
  const sessionLoader = useMemo(
    () =>
      loadSession ??
      ((id: string, signal?: AbortSignal) =>
        interviewsApi.getSession(id, signal)),
    [loadSession],
  );
  const historyLoader = useMemo(
    () => loadHistory ?? ((signal?: AbortSignal) => interviewsApi.history(signal)),
    [loadHistory],
  );
  const sessionRequest = useContentLoader(
    useMemo(
      () => (signal: AbortSignal) => sessionLoader(sessionId, signal),
      [sessionId, sessionLoader],
    ),
  );
  const historyRequest = useContentLoader(historyLoader);
  const sessionState = sessionRequest.state;
  const historyState = historyRequest.state;
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [scores, setScores] = useState<InterviewScores>(DEFAULT_SCORES);
  const [reflection, setReflection] = useState("");
  const [feedback, setFeedback] = useState("");
  const [invalidate, setInvalidate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionState.status === "ready") {
      setSession((current) => current ?? sessionState.data);
    }
  }, [sessionState]);

  if (sessionState.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando el informe…
      </p>
    );
  }

  if (sessionState.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>No pudimos cargar la entrevista.</p>
        <button
          type="button"
          onClick={() => sessionRequest.reload()}
          className={BUTTON_CLASSES}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const current = session ?? sessionState.data;
  const history = historyState.status === "ready" ? historyState.data : null;
  const attempts =
    history?.items
      .filter((item) => item.scenarioSlug === current.scenarioSlug)
      .slice()
      .reverse() ?? [];
  const needsSelfReview =
    current.status === "COMPLETED" && current.selfScores === null;

  function setScore(criterion: InterviewCriterion, value: number): void {
    setScores((currentScores) => ({ ...currentScores, [criterion]: value }));
  }

  async function handleSelfReview(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      setSession(await submitSelfReview(current.id, { scores, reflection }));
    } catch (cause: unknown) {
      setFormError(
        cause instanceof Error ? cause.message : "No pudimos guardar tu autoevaluación.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      setSession(
        await submitReview(current.id, {
          scores,
          ...(invalidate ? { invalidate: true } : { feedback }),
        }),
      );
    } catch (cause: unknown) {
      setFormError(
        cause instanceof Error ? cause.message : "No pudimos guardar la revisión.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <header className="space-y-3">
        <Link
          href="/learn/interviews"
          className="text-xs font-medium text-slate-400 transition hover:text-slate-200"
        >
          ← Entrevistas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {current.scenarioTitle}
        </h1>
        <p className="text-sm text-slate-400">
          {STATUS_LABELS[current.status]} · {formatDate(current.startedAt)}
          {current.durationMinutes === null
            ? ""
            : ` · ${current.durationMinutes} min`}
        </p>
        <Link
          href={`/learn/interviews/${current.scenarioSlug}`}
          className="inline-flex text-sm font-medium text-accent transition hover:text-accent/80"
        >
          Repetir entrevista
        </Link>
      </header>

      <section aria-label="Notas" className="grid gap-4 sm:grid-cols-2">
        <div className={CARD_CLASSES}>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Tu autoevaluación
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {current.selfScore === null ? "—" : current.selfScore}
          </p>
        </div>
        <div className={CARD_CLASSES}>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Nota del instructor
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {current.score === null ? "Pendiente" : current.score}
          </p>
          {current.selfScore !== null && current.score !== null ? (
            <p className="mt-2 text-xs text-slate-400">
              Desvío: {Math.round((current.score - current.selfScore) * 100) / 100}{" "}
              puntos.
            </p>
          ) : null}
        </div>
      </section>
      {/* COMPARISON */}
      <section aria-label="Comparación entre intentos" className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          Comparación entre intentos
        </h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-400">
            Este es tu primer intento de este escenario.
          </p>
        ) : (
          <ol className="list-none space-y-2 p-0 text-sm text-slate-300">
            {attempts.map((attempt, index) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-ink-card/30 px-4 py-3"
              >
                <span>
                  Intento {index + 1} · {formatDate(attempt.startedAt)}
                </span>
                <Link
                  href={`/learn/interviews/sessions/${attempt.id}`}
                  className="text-xs font-medium text-accent hover:text-accent/80"
                >
                  {attempt.id === current.id
                    ? "Estás aquí"
                    : attempt.score === null
                      ? "Ver sesión"
                      : `${attempt.score} puntos`}
                </Link>
              </li>
            ))}
          </ol>
        )}
        {history === null ? null : (
          <p className="text-xs text-slate-500">
            Mejor nota:{" "}
            {history.best === null ? "sin revisar" : history.best.score} ·
            Promedio: {history.average}
          </p>
        )}
      </section>
      {/* TRANSCRIPT */}
      <section aria-label="Transcripción" className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Transcripción</h2>
        <ol className="list-none space-y-3 p-0">
          {current.transcript.map((entry, index) => (
            <li
              key={`${entry.at}-${index}`}
              className="rounded-2xl border border-line/70 bg-ink-card/40 px-4 py-3 text-sm text-slate-200"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                {entry.role === "interviewer" ? "Entrevistador" : "Tú"} ·{" "}
                {INTERVIEW_PHASE_LABELS[entry.phase]}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{entry.content}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* SELF_FORM */}
      {current.selfScores !== null ? (
        <section aria-label="Reflexión" className={CARD_CLASSES}>
          <h2 className="text-lg font-semibold text-white">Tu reflexión</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
            {current.selfScores.reflection}
          </p>
        </section>
      ) : null}

      {needsSelfReview && !instructor ? (
        <form
          onSubmit={handleSelfReview}
          aria-label="Autoevaluación"
          className="space-y-4 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-5"
        >
          <h2 className="text-lg font-semibold text-white">Autoevaluación</h2>
          <p className="text-sm text-slate-400">
            Puntúa cada criterio de 0 a 4 y explica qué harías distinto. La nota
            del instructor llegará después.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {INTERVIEW_CRITERIA.map((criterion) => (
              <label key={criterion} className="text-sm text-slate-300">
                <span className="block">{INTERVIEW_CRITERION_LABELS[criterion]}</span>
                <select
                  aria-label={INTERVIEW_CRITERION_LABELS[criterion]}
                  value={scores[criterion]}
                  onChange={(event) =>
                    setScore(criterion, Number(event.target.value))
                  }
                  className="mt-1 w-full rounded-xl border border-line/70 bg-ink-card/60 px-3 py-2 text-sm text-slate-100"
                >
                  {[0, 1, 2, 3, 4].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <label className="block text-sm text-slate-300">
            <span className="block">Reflexión</span>
            <textarea
              aria-label="Reflexión"
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              rows={5}
              className="mt-1 w-full rounded-2xl border border-line/70 bg-ink-card/60 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <p className="text-xs text-slate-500">
            {reflection.trim().length}/{INTERVIEW_REFLECTION_MIN} caracteres
            mínimos
          </p>

          {formError !== null ? (
            <p role="alert" className="text-sm text-rose-300">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || reflection.trim().length < INTERVIEW_REFLECTION_MIN}
            className={BUTTON_CLASSES}
          >
            Guardar autoevaluación
          </button>
        </form>
      ) : null}
      {/* REVIEW_FORM */}
      {current.status === "REVIEWED" ? (
        <section aria-label="Revisión" className={CARD_CLASSES}>
          <h2 className="text-lg font-semibold text-white">Revisión del instructor</h2>
          <p className="mt-2 text-sm text-slate-300">{current.feedback}</p>
        </section>
      ) : null}

      {instructor && current.status === "COMPLETED" && current.selfScores === null ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100"
        >
          El estudiante aún no ha completado su autoevaluación. La revisión
          requiere ese paso previo.
        </p>
      ) : null}

      {instructor && current.status === "COMPLETED" && current.selfScores !== null ? (
        <form
          onSubmit={handleReview}
          aria-label="Revisión del instructor"
          className="space-y-4 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-5"
        >
          <h2 className="text-lg font-semibold text-white">Revisión del instructor</h2>
          <p className="text-sm text-slate-400">
            Autoevaluación del candidato: {current.selfScore} puntos. La nota que
            cuenta es la tuya.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {INTERVIEW_CRITERIA.map((criterion) => (
              <label key={criterion} className="text-sm text-slate-300">
                <span className="block">{INTERVIEW_CRITERION_LABELS[criterion]}</span>
                <select
                  aria-label={`Nota de ${INTERVIEW_CRITERION_LABELS[criterion]}`}
                  value={scores[criterion]}
                  onChange={(event) =>
                    setScore(criterion, Number(event.target.value))
                  }
                  className="mt-1 w-full rounded-xl border border-line/70 bg-ink-card/60 px-3 py-2 text-sm text-slate-100"
                >
                  {[0, 1, 2, 3, 4].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <label className="block text-sm text-slate-300">
            <span className="block">Retroalimentación</span>
            <textarea
              aria-label="Retroalimentación"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-2xl border border-line/70 bg-ink-card/60 px-4 py-3 text-sm text-slate-100"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={invalidate}
              onChange={(event) => setInvalidate(event.target.checked)}
            />
            Invalidar la sesión (nota 0, sin evidencia)
          </label>

          {formError !== null ? (
            <p role="alert" className="text-sm text-rose-300">
              {formError}
            </p>
          ) : null}

          <button type="submit" disabled={submitting} className={BUTTON_CLASSES}>
            Guardar revisión
          </button>
        </form>
      ) : null}

      {current.status === "IN_PROGRESS" ? (
        <p
          role="status"
          className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-300"
        >
          La entrevista sigue abierta. Ciérrala desde la sala para poder
          autoevaluarla.
        </p>
      ) : null}

      {current.status === "ABANDONED" ? (
        <p
          role="status"
          className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-300"
        >
          Esta sesión se abandonó por inactividad y no se puede evaluar. Puedes
          repetir el escenario.
        </p>
      ) : null}
    </div>
  );
}
