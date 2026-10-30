"use client";

import type { AiMessage, AiTutorRequest, AiTutorResponse, AiUsageResponse } from "@codeai/shared";
import { AI_HISTORY_MAX, AI_MESSAGE_MAX } from "@codeai/shared";
import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { TetrisLoader } from "@/components/effects/TetrisLoader";
import { aiApi, ApiError } from "@/lib/api-client";

const BUTTON_CLASSES =
  "inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export type AskTutor = (input: AiTutorRequest) => Promise<AiTutorResponse>;
export type LoadUsage = () => Promise<AiUsageResponse>;

/** Enunciado y código del intento que acompañan a la pregunta del estudiante. */
export interface TutorContext {
  /** Qué es el código adjunto: el título del ejercicio. */
  readonly title: string;
  /** Enunciado del ejercicio; vacío si no aplica. */
  readonly statement?: string | null;
  /** Código que el estudiante tiene ahora mismo en el editor. */
  readonly code: string;
  /** Lenguaje del bloque de código adjunto. */
  readonly language?: string | null;
}

/** Topes del contexto: el contrato de S8 solo limita el mensaje completo. */
const CONTEXT_TITLE_MAX = 80;
const CONTEXT_STATEMENT_MAX = 400;
const STATEMENT_PREFIX = "\nEnunciado: ";
const CODE_FENCE = "```";

/** Recorta con puntos suspensivos: el mensaje entero no puede pasar del tope. */
function clip(text: string, max: number): string {
  if (max <= 0 || text.length === 0) return "";

  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Anexa el enunciado y el código del intento al mensaje del tutor.
 *
 * `aiTutorRequestSchema` es estricto (`lessonId`, `message`, `history`), así que
 * el contexto viaja dentro del propio `message` —sin tocar el contrato de S8— y
 * recortado para que el conjunto nunca supere `AI_MESSAGE_MAX`.
 */
export function composeTutorMessage(message: string, context?: TutorContext): string {
  if (context === undefined) return message;

  const code = context.code.trim();
  const statement = context.statement?.trim() ?? "";

  if (code === "" && statement === "") return message;

  const header = `\n\n[Contexto del intento: ${clip(context.title.trim(), CONTEXT_TITLE_MAX)}]`;
  let budget = AI_MESSAGE_MAX - message.length - header.length;

  if (budget <= 0) return message;

  let body = "";

  if (statement !== "" && budget > STATEMENT_PREFIX.length) {
    const block = `${STATEMENT_PREFIX}${clip(statement, Math.min(CONTEXT_STATEMENT_MAX, budget - STATEMENT_PREFIX.length))}`;

    body += block;
    budget -= block.length;
  }

  if (code !== "") {
    const opening = `\n${CODE_FENCE}${context.language ?? ""}\n`;
    const closing = `\n${CODE_FENCE}`;
    const room = budget - opening.length - closing.length;

    // Sin sitio para un bloque de código legible, se envía solo el enunciado.
    if (room > 0) {
      body += `${opening}${clip(code, room)}${closing}`;
    }
  }

  return `${message}${header}${body}`;
}

interface TutorPanelProps {
  /** Id de la lección (no el slug): el contrato del tutor lo exige. */
  readonly lessonId: string;
  /** Enunciado y código del intento; se adjuntan al mensaje si el estudiante quiere. */
  readonly context?: TutorContext;
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
export function TutorPanel({
  lessonId,
  context,
  askTutor = aiApi.tutor,
  loadUsage = aiApi.usage,
}: TutorPanelProps) {
  const inputId = useId();
  const [entries, setEntries] = useState<readonly ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [attachContext, setAttachContext] = useState(true);

  // Sin código ni enunciado no hay nada que adjuntar: el laboratorio siempre
  // manda contexto, la lección nunca.
  const hasContext =
    context !== undefined &&
    (context.code.trim() !== "" || (context.statement?.trim() ?? "") !== "");

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
      // El contrato del tutor no admite campos extra: el contexto del intento
      // viaja dentro del mensaje, recortado a `AI_MESSAGE_MAX`.
      const payload =
        hasContext && attachContext ? composeTutorMessage(message, context) : message;
      const response = await askTutor({ lessonId, message: payload, history });

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

      {hasContext ? (
        <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <input
            type="checkbox"
            checked={attachContext}
            onChange={(event) => setAttachContext(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line/70 bg-ink-card text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          />
          <span>
            Adjuntar el enunciado y el código que tengo en el editor, para que el tutor vea dónde estoy atascado.
          </span>
        </label>
      ) : null}

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
            Preguntar
          </button>
          {remaining !== null ? (
            <p className="text-xs text-slate-500">Saldo de IA del mes: {remaining.toFixed(2)} USD</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
