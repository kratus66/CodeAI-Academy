"use client";

import type { AiMessage, AiTutorRequest, AiTutorResponse, AiUsageResponse } from "@codeai/shared";
import { AI_HISTORY_MAX, AI_MESSAGE_MAX } from "@codeai/shared";
import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { TetrisLoader } from "@/components/effects/TetrisLoader";
import { aiApi, ApiError } from "@/lib/api-client";

const BUTTON_CLASSES =
  "inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

type AskTutor = (input: AiTutorRequest) => Promise<AiTutorResponse>;
type LoadUsage = () => Promise<AiUsageResponse>;

interface TutorPanelProps {
  /** Id de la lección (no el slug): el contrato del tutor lo exige. */
  readonly lessonId: string;
  /** Inyectables en pruebas; por defecto llaman a `/api/ai/*`. */
  readonly askTutor?: AskTutor;
  readonly loadUsage?: LoadUsage;
}

interface ChatEntry extends AiMessage {
  readonly id: number;
  readonly hints?: readonly string[];
  readonly source?: AiTutorResponse["source"];
}

/** Aviso mostrado al estudiante según el fallo; nunca el cuerpo crudo de la API. */
function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      const minutes =
        error.retryAfterSeconds === undefined ? null : Math.max(1, Math.ceil(error.retryAfterSeconds / 60));

      return minutes === null
        ? "Alcanzaste el límite de mensajes al tutor. Espera un poco antes de volver a escribir."
        : `Alcanzaste el límite de mensajes al tutor. Vuelve a intentarlo en ${minutes} min.`;
    }

    if (error.status === 401) {
      return "Tu sesión expiró. Inicia sesión de nuevo para hablar con el tutor.";
    }
  }

  return "No pudimos contactar al tutor. Inténtalo de nuevo en unos segundos.";
}

const FALLBACK_NOTE =
  "El tutor no está disponible ahora mismo; esta es una pista general. Puedes seguir con la lección.";

/** Tutor socrático de la lección: aviso de privacidad, pistas sugeridas, carga, error y saldo. */
export function TutorPanel({ lessonId, askTutor = aiApi.tutor, loadUsage = aiApi.usage }: TutorPanelProps) {
  const inputId = useId();
  const [entries, setEntries] = useState<readonly ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    loadUsage()
      .then((usage) => {
        if (!controller.signal.aborted) setRemaining(usage.remainingUsd);
      })
      .catch(() => {
        // El saldo es informativo: sin él el panel sigue siendo útil.
      });

    return () => controller.abort();
  }, [loadUsage]);

  async function send(): Promise<void> {
    const message = draft.trim();

    if (message === "" || pending) return;

    const history = entries
      .slice(-AI_HISTORY_MAX)
      .map(({ role, content }): AiMessage => ({ role, content }));
    const nextId = entries.length;

    setEntries((current) => [...current, { id: nextId, role: "user", content: message }]);
    setDraft("");
    setError(null);
    setPending(true);

    try {
      const response = await askTutor({ lessonId, message, history });

      setEntries((current) => [
        ...current,
        {
          id: nextId + 1,
          role: "assistant",
          content: response.reply,
          hints: response.suggestedHints,
          source: response.source,
        },
      ]);
      setRemaining(response.budgetRemainingUsd);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <section aria-labelledby="tutor" className="space-y-4 border-t border-line/70 pt-8">
      <h2 id="tutor" className="text-lg font-semibold tracking-tight text-white">
        Tutor
      </h2>
      <p className="text-xs leading-relaxed text-slate-500">
        Privacidad: tu mensaje se envía a un proveedor de IA para responderte. No incluyas contraseñas, claves ni datos
        personales. El tutor te guía con preguntas y no entrega la solución completa.
      </p>

      {entries.length > 0 ? (
        <ol aria-label="Conversación con el tutor" className="grid list-none gap-3 p-0">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={
                entry.role === "user"
                  ? "glass animate-rise rounded-xl px-4 py-3 text-sm text-slate-200"
                  : "glass tint-t animate-rise rounded-xl !border-accent/40 px-4 py-3 text-sm text-slate-100"
              }
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {entry.role === "user" ? "Tú" : "Tutor"}
                {entry.role === "assistant" && entry.source === "fallback" ? (
                  <span className="ml-2 rounded-full border border-amber-300/30 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-200">
                    Pista general
                  </span>
                ) : null}
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
              {entry.source === "fallback" ? <p className="mt-2 text-xs text-slate-400">{FALLBACK_NOTE}</p> : null}
              {entry.hints !== undefined && entry.hints.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs text-slate-400">Pistas sugeridas para repasar:</p>
                  <ul aria-label="Pistas sugeridas" className="mt-1 flex list-none flex-wrap gap-2 p-0">
                    {entry.hints.map((hint) => (
                      <li key={hint} className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200">
                        {hint}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {pending ? (
        <p role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-slate-400">
          <TetrisLoader />
          El tutor está pensando…
        </p>
      ) : null}

      {error !== null ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
          Pregúntale al tutor
        </label>
        <textarea
          id={inputId}
          value={draft}
          maxLength={AI_MESSAGE_MAX}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe tu duda y pulsa Enter (Shift+Enter para una línea nueva)"
          className="w-full rounded-xl border border-line/70 bg-ink-card px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void send()}
            disabled={pending || draft.trim() === ""}
            className={BUTTON_CLASSES}
          >
            Enviar
          </button>
          {remaining !== null ? (
            <p className="text-xs text-slate-500">Saldo de IA del mes: {remaining.toFixed(2)} USD</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
