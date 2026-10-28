"use client";

import type { ExerciseDetail, FlashcardRatingResponse, FlashcardRevealResponse } from "@codeai/shared";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";

/**
 * Tarjeta de recuperación. Orden forzado (`fundamentos-pedagogicos.md` §3.2):
 * intento escrito → reverso → autocalificación 0–5, que reprograma el repaso.
 * El reverso no está en el ejercicio: solo lo devuelve el servidor tras el intento.
 */

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const QUALITY_BUTTON =
  "rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const QUALITY_OPTIONS = [
  { quality: 0, label: "Sin comprensión" },
  { quality: 1, label: "Error identificado" },
  { quality: 2, label: "Con pistas" },
  { quality: 3, label: "Con esfuerzo" },
  { quality: 4, label: "Con duda menor" },
  { quality: 5, label: "Sin pistas" },
] as const;

export type RevealFlashcard = (exerciseId: string, attempt: string) => Promise<FlashcardRevealResponse>;
export type RateFlashcard = (exerciseId: string, quality: number) => Promise<FlashcardRatingResponse>;

export interface FlashcardPlayerProps {
  readonly exercise: ExerciseDetail;
  readonly revealFlashcard?: RevealFlashcard;
  readonly rateFlashcard?: RateFlashcard;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === "UNAUTHENTICATED"
      ? "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando."
      : error.message;
  }

  return "No pudimos completar la acción. Inténtalo de nuevo.";
}

export function FlashcardPlayer({
  exercise,
  revealFlashcard = (id, attempt) => exercisesApi.revealFlashcard(id, attempt),
  rateFlashcard = (id, quality) => exercisesApi.rateFlashcard(id, quality),
}: FlashcardPlayerProps) {
  const [attempt, setAttempt] = useState("");
  const [back, setBack] = useState<string | null>(null);
  const [rated, setRated] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (attempt.trim().length === 0 || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      setBack((await revealFlashcard(exercise.id, attempt.trim())).back);
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  async function handleRate(quality: number): Promise<void> {
    setPending(true);
    setError(null);

    try {
      await rateFlashcard(exercise.id, quality);
      setRated(quality);
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  function again(): void {
    setAttempt("");
    setBack(null);
    setRated(null);
    setError(null);
  }

  return (
    <div className="space-y-5">
      <p className="text-lg font-medium text-white">{exercise.statement}</p>

      <form onSubmit={(event) => void handleReveal(event)} className="space-y-3" aria-busy={pending}>
        <label htmlFor={`attempt-${exercise.id}`} className="block text-sm text-slate-300">
          Escribe lo que recuerdas antes de ver la respuesta
        </label>
        <textarea
          id={`attempt-${exercise.id}`}
          value={attempt}
          onChange={(event) => setAttempt(event.target.value)}
          disabled={back !== null || pending}
          rows={4}
          maxLength={2000}
          className="w-full rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {back === null ? (
          <button type="submit" className={PRIMARY_BUTTON} disabled={attempt.trim().length === 0 || pending}>
            Ver respuesta
          </button>
        ) : null}
      </form>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {back !== null ? (
        <section aria-live="polite" className="space-y-4 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4">
          <p className="text-sm font-medium text-white">Respuesta</p>
          <p className="text-sm text-slate-200">{back}</p>

          {rated === null ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-300">¿Qué tan bien la recordabas?</p>
              <div className="flex flex-wrap gap-2">
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.quality}
                    type="button"
                    className={QUALITY_BUTTON}
                    disabled={pending}
                    aria-label={`Calidad ${option.quality}: ${option.label}`}
                    onClick={() => void handleRate(option.quality)}
                  >
                    {option.quality} · {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div role="status" className="space-y-3 text-sm text-slate-300">
              <p>Registrado. La tarjeta volverá en tu repaso según cómo la recordaste.</p>
              <button type="button" className={PRIMARY_BUTTON} onClick={again}>
                Practicar otra vez
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
