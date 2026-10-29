"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";


import {
  INTERVIEW_MAX_TURNS,
  INTERVIEW_MESSAGE_MAX,
  INTERVIEW_PHASE_LABELS,
} from "@codeai/shared";
import type {
  InterviewHistoryResponse,
  InterviewScenario,
  InterviewSession,
  InterviewTurnResponse,
  SendInterviewMessageInput,
  StartInterviewSessionInput,
} from "@codeai/shared";

import { LockNotice, isLocked } from "@/components/ui/LockNotice";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError, interviewsApi } from "@/lib/api-client";

const BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

interface InterviewRoomProps {
  readonly scenarioSlug: string;
  /** Inyectables en pruebas; por defecto llaman a la API real. */
  readonly loadScenario?: (signal: AbortSignal) => Promise<InterviewScenario>;
  readonly startSession?: (
    input: StartInterviewSessionInput,
  ) => Promise<InterviewSession>;
  readonly loadHistory?: (signal?: AbortSignal) => Promise<InterviewHistoryResponse>;
  readonly loadSession?: (
    sessionId: string,
    signal?: AbortSignal,
  ) => Promise<InterviewSession>;
  readonly sendMessage?: (
    sessionId: string,
    input: SendInterviewMessageInput,
    signal?: AbortSignal,
  ) => Promise<InterviewTurnResponse>;
  readonly finishSession?: (sessionId: string) => Promise<InterviewSession>;
}

function formatElapsed(startedAt: string, now: number): string {
  const elapsed = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1_000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/**
 * Sala de entrevista (`sprint-10-entrevistas.md` T15).
 *
 * Arranca la sesión al cargar el escenario; si ya hay una abierta (`409`), la
 * recupera del historial en lugar de dejar al estudiante bloqueado. El chat
 * muestra la fase que impone el servidor, los turnos restantes, el cronómetro y
 * un aviso cuando la réplica viene del guion estático (`degraded`).
 */
export function InterviewRoom({
  scenarioSlug,
  loadScenario,
  startSession = interviewsApi.start,
  loadHistory = interviewsApi.history,
  loadSession = interviewsApi.getSession,
  sendMessage = interviewsApi.sendMessage,
  finishSession = interviewsApi.finish,
}: InterviewRoomProps) {
  const load = useMemo(
    () =>
      loadScenario ??
      ((signal: AbortSignal) => interviewsApi.getScenario(scenarioSlug, signal)),
    [loadScenario, scenarioSlug],
  );
  const { state, reload } = useContentLoader(load);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startedRef = useRef(false);

  useEffect(() => {
    if (state.status !== "ready" || startedRef.current) return;
    // Un escenario bloqueado no abre sesión: la API también lo rechazaría con 422.
    if (isLocked(state.data.unlock)) return;

    startedRef.current = true;
    let cancelled = false;

    startSession({ scenarioSlug })
      .then((created) => {
        if (!cancelled) setSession(created);
      })
      .catch(async (cause: unknown) => {
        if (cancelled) return;

        // Una entrevista abierta se retoma en vez de mostrarse como error.
        if (isConflict(cause)) {
          try {
            const history = await loadHistory();
            const open = history.items.find(
              (item) =>
                item.status === "IN_PROGRESS" &&
                item.scenarioSlug === scenarioSlug,
            );

            if (open) {
              const resumed = await loadSession(open.id);
              if (!cancelled) setSession(resumed);
              return;
            }
          } catch {
            // Si tampoco se puede leer el historial, se explica el 409 original.
          }
        }

        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos iniciar la entrevista.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadHistory, loadSession, scenarioSlug, startSession, state]);

  useEffect(() => {
    if (session?.status !== "IN_PROGRESS") return undefined;

    const timer = setInterval(() => setNow(Date.now()), 1_000);

    return () => clearInterval(timer);
  }, [session?.status]);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando la entrevista…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>No pudimos cargar el escenario.</p>
        <button type="button" onClick={reload} className={SECONDARY_BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const scenario = state.data;

  if (scenario.unlock && isLocked(scenario.unlock)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{scenario.title}</h1>
        <LockNotice unlock={scenario.unlock} subject="Esta entrevista" />
        <Link
          href="/learn/interviews"
          className="inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          Volver a las entrevistas
        </Link>
      </div>
    );
  }
  const currentPhase =
    scenario.phases.find((phase) => phase.phase === session?.phase) ??
    scenario.phases[0];
  const phaseNumber = scenario.phases.findIndex(
    (phase) => phase.phase === (currentPhase?.phase ?? session?.phase),
  );
  const turnsRemaining =
    session === null
      ? INTERVIEW_MAX_TURNS
      : INTERVIEW_MAX_TURNS - session.turns;
  const closed = session !== null && session.status !== "IN_PROGRESS";
  const degraded = session?.degraded ?? false;

  async function handleSend(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (session === null || sending) return;

    const text = message.trim();

    if (text.length === 0) return;

    setSending(true);
    setError(null);

    try {
      const previousPhase = session.phase;
      const turn = await sendMessage(session.id, { message: text });
      const at = new Date().toISOString();

      setSession((current) =>
        current === null
          ? current
          : {
              ...current,
              phase: turn.phase,
              turns: turn.turn,
              degraded: current.degraded || turn.degraded,
              transcript: [
                ...current.transcript,
                {
                  role: "candidate",
                  phase: previousPhase,
                  content: text,
                  at,
                },
                {
                  role: "interviewer",
                  phase: turn.phase,
                  content: turn.reply,
                  at,
                },
              ],
            },
      );
      setMessage("");
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos enviar tu respuesta.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleFinish(): Promise<void> {
    if (session === null || sending) return;

    setSending(true);
    setError(null);

    try {
      setSession(await finishSession(session.id));
      setConfirmingClose(false);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos cerrar la sesión.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="space-y-3">
        <Link
          href="/learn/interviews"
          className="text-xs font-medium text-slate-400 transition hover:text-slate-200"
        >
          ← Entrevistas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {scenario.title}
        </h1>
        <p className="text-sm text-slate-400">
          {scenario.role} · {scenario.level} · {scenario.language} ·{" "}
          {scenario.estimatedMinutes} min
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Fase
            </dt>
            <dd className="mt-1 text-slate-200">
              {currentPhase === undefined
                ? "Preparando…"
                : `${phaseNumber + 1} de ${scenario.phases.length} · ${
                    INTERVIEW_PHASE_LABELS[currentPhase.phase]
                  }`}
            </dd>
          </div>
          <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Turnos restantes
            </dt>
            <dd className="mt-1 text-slate-200">{turnsRemaining}</dd>
          </div>
          <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Cronómetro
            </dt>
            <dd className="mt-1 font-mono text-slate-200" role="timer">
              {session === null ? "00:00" : formatElapsed(session.startedAt, now)}
            </dd>
          </div>
        </dl>
      </header>
      {/* ALERTS */}
      {degraded ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100"
        >
          Modo degradado: no hay proveedor de IA disponible o se agotó el
          presupuesto. Las réplicas vienen del guion estático y la entrevista
          sigue siendo evaluable.
        </p>
      ) : null}

      {/* TRANSCRIPT */}
      <ol
        aria-label="Conversación de la entrevista"
        className="list-none space-y-3 p-0"
      >
        {session?.transcript.map((entry, index) => (
          <li
            key={`${entry.at}-${index}`}
            className={
              entry.role === "interviewer"
                ? "rounded-2xl border border-line/70 bg-ink-card/50 px-4 py-3 text-sm text-slate-200"
                : "rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-slate-100"
            }
          >
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {entry.role === "interviewer" ? "Entrevistador" : "Tú"} ·{" "}
              {INTERVIEW_PHASE_LABELS[entry.phase]}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{entry.content}</p>
          </li>
        ))}
      </ol>

      {session === null && error === null ? (
        <p role="status" className="text-sm text-slate-400">
          Preparando la entrevista…
        </p>
      ) : null}

      {error !== null ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}
      {/* FORM */}
      {session !== null && !closed ? (
        <form onSubmit={handleSend} className="space-y-3">
          <label
            htmlFor="interview-answer"
            className="block text-sm font-medium text-slate-200"
          >
            Tu respuesta
          </label>
          <textarea
            id="interview-answer"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={INTERVIEW_MESSAGE_MAX}
            rows={4}
            className="w-full rounded-2xl border border-line/70 bg-ink-card/60 px-4 py-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              {message.length}/{INTERVIEW_MESSAGE_MAX}
            </span>
            <button
              type="submit"
              disabled={sending || message.trim().length === 0}
              className={BUTTON_CLASSES}
            >
              Enviar respuesta
            </button>
          </div>
        </form>
      ) : null}

      {closed ? (
        <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-200">
          <p className="font-medium">Entrevista cerrada.</p>
          <Link
            href={`/learn/interviews/sessions/${session.id}`}
            className={`${SECONDARY_BUTTON_CLASSES} mt-3`}
          >
            Ver informe
          </Link>
        </div>
      ) : null}
      {/* FOOTER */}
      {session !== null && !closed ? (
        confirmingClose ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            <p className="font-medium">¿Cerrar la entrevista?</p>
            <p className="mt-1 text-amber-100/80">
              No podrás enviar más turnos. Después autoevaluarás tu desempeño.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleFinish}
                disabled={sending}
                className={BUTTON_CLASSES}
              >
                Sí, cerrar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClose(false)}
                className={SECONDARY_BUTTON_CLASSES}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClose(true)}
            className={SECONDARY_BUTTON_CLASSES}
          >
            Cerrar entrevista
          </button>
        )
      ) : null}
    </div>
  );
}