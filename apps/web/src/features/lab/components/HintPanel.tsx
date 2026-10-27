"use client";

import { HINT_LEVELS } from "@codeai/shared";
import type { HintLevel, HintResponse } from "@codeai/shared";
import { useState } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";

/**
 * Panel de pistas progresivas (S6-T14). Pide una pista cada vez, siempre del
 * nivel siguiente al último recibido: la API rechaza saltarse niveles, así que
 * la web no ofrece ese camino. Un botón por nivel deja claro cuál toca y cuáles
 * esperan. El servidor decide cuántas pistas contaron para el nivel alcanzado;
 * aquí sólo se muestran las recibidas.
 */

const BUTTON_CLASSES =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:border-line/70 disabled:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export type RequestHint = (
  exerciseId: string,
  level: HintLevel,
) => Promise<HintResponse>;

export interface HintPanelProps {
  readonly exerciseId: string;
  /** Pistas que declara el ejercicio; con `0` el panel no ofrece pedir ninguna. */
  readonly hintsAvailable: number;
  /** Inyectable en pruebas; por defecto usa `exercisesApi.requestHint`. */
  readonly requestHint?: RequestHint;
}

function describeHintError(error: unknown, nextLevel: number): string {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") {
      return error.retryAfterSeconds
        ? `Has agotado las 20 pistas del minuto. Vuelve a intentarlo en ${error.retryAfterSeconds} s.`
        : "Has agotado las 20 pistas del minuto. Espera unos segundos y reinténtalo.";
    }

    if (error.code === "RULE_VIOLATION") {
      return `Las pistas van en orden: pide primero la de nivel ${nextLevel}.`;
    }

    if (error.code === "UNAUTHENTICATED") {
      return "Tu sesión caducó. Vuelve a iniciar sesión para pedir pistas.";
    }

    return error.message;
  }

  return "No pudimos obtener la pista. Inténtalo de nuevo.";
}

export function HintPanel({
  exerciseId,
  hintsAvailable,
  requestHint = (id, level) => exercisesApi.requestHint(id, level),
}: HintPanelProps) {
  const [hints, setHints] = useState<readonly HintResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const last = hints[hints.length - 1];
  const revealed = last ? last.level : 0;
  const nextLevel = (revealed + 1) as HintLevel;
  const levels = HINT_LEVELS.filter((level) => level <= hintsAvailable);
  const exhausted =
    last !== undefined &&
    (!last.nextLevelAvailable || last.level >= levels.length);

  async function handleRequest() {
    if (loading || exhausted) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const hint = await requestHint(exerciseId, nextLevel);

      setHints((current) => [...current, hint]);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }

  if (levels.length === 0) {
    return (
      <p className="text-xs text-slate-500">Este ejercicio no ofrece pistas.</p>
    );
  }

  return (
    <section
      aria-labelledby="pistas"
      aria-busy={loading}
      className="space-y-3 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4"
    >
      <h2 id="pistas" className="text-sm font-semibold text-white">
        Pistas
      </h2>
      <p className="text-xs text-slate-500">
        Se piden en orden y cada nivel revela algo más que el anterior. Cada
        pista que pides puede bajar el nivel máximo que alcanzas al enviar.
      </p>

      {hints.length > 0 ? (
        <ol aria-live="polite" className="space-y-2">
          {hints.map((hint) => (
            <li
              key={hint.level}
              className="rounded-xl bg-ink px-3 py-2 text-sm text-slate-200"
            >
              <span className="block text-xs font-medium text-accent">
                Pista {hint.level}
              </span>
              <span className="whitespace-pre-line">{hint.text}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {describeHintError(error, nextLevel)}
        </p>
      ) : null}

      <ul className="space-y-2">
        {levels.map((level) => {
          const isRevealed = level <= revealed;
          const isPending = !isRevealed && !exhausted && level === nextLevel;
          const isWaiting = !isRevealed && !exhausted && level > nextLevel;
          const noteId = `pista-${level}-nota`;

          return (
            <li key={level} className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={BUTTON_CLASSES}
                aria-describedby={isWaiting ? noteId : undefined}
                disabled={!isPending || loading}
                onClick={handleRequest}
              >
                {isRevealed
                  ? `Pista ${level}`
                  : isPending && loading
                    ? `Pidiendo pista ${level}…`
                    : `Pedir pista ${level}`}
              </button>
              {isWaiting ? (
                <span id={noteId} className="text-xs text-slate-500">
                  Pide antes la pista {level - 1}.
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {exhausted ? (
        <p className="text-xs text-slate-500">
          No hay más pistas en este ejercicio.
        </p>
      ) : null}

      <p className="text-xs text-slate-500">
        El texto de cada pista es el del catálogo: no incluye la solución.
      </p>
    </section>
  );
}
