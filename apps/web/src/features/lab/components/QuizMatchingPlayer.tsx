"use client";

import type { ExerciseDetail, QuizGradeResult } from "@codeai/shared";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";

import type { SubmitQuiz } from "./QuizPlayer";

/**
 * Quiz de emparejar (`config.kind === "matching"`).
 *
 * El estudiante asigna a cada elemento de la izquierda un elemento de la derecha.
 * La correspondencia es uno a uno, así que una pareja ya elegida se deshabilita
 * en las demás filas. Se usan `<select>` y no arrastre porque así funciona con
 * teclado y lector de pantalla (S14). Las parejas correctas y sus explicaciones
 * solo llegan con el resultado de `POST …/quiz-answers`, nunca antes del intento
 * (regla 2: corrección «todo o nada»).
 */

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SELECT =
  "rounded-full border border-white/15 bg-ink px-3 py-1 text-sm text-slate-200 transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Mismo texto que usan los demás reproductores cuando el error no es de la API. */
const UNEXPECTED_GRADE_MESSAGE = "No pudimos corregir tu respuesta. Inténtalo de nuevo.";

const EMPTY_OPTION_LABEL = "Elige…";

const MIN_ELEMENTS = 3;

export interface QuizMatchingPlayerProps {
  readonly exercise: ExerciseDetail;
  readonly submitQuiz?: SubmitQuiz;
}

interface MatchingElement {
  readonly id: string;
  readonly text: string;
}

type MatchingGradeResult = Extract<QuizGradeResult, { kind: "matching" }>;

function readElements(config: Record<string, unknown>, side: "left" | "right"): MatchingElement[] {
  const raw = config[side];

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((element: unknown) => {
    const record = typeof element === "object" && element !== null ? (element as Record<string, unknown>) : {};

    return typeof record.id === "string" && typeof record.text === "string"
      ? [{ id: record.id, text: record.text }]
      : [];
  });
}

/**
 * Sin al menos tres elementos por columna, o con columnas de distinto tamaño, no
 * hay correspondencia uno a uno que pintar ni corregir (es el mínimo del contrato
 * de contenido), así que se anuncia igual que un quiz sin opciones en lugar de
 * ofrecer un ejercicio incompleto.
 */
function isMatchable(
  left: readonly MatchingElement[],
  right: readonly MatchingElement[],
): boolean {
  return left.length >= MIN_ELEMENTS && right.length >= MIN_ELEMENTS && left.length === right.length;
}

function isChosen(id: string | undefined): id is string {
  return id !== undefined;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === "UNAUTHENTICATED"
      ? "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando."
      : error.message;
  }

  return UNEXPECTED_GRADE_MESSAGE;
}

export function QuizMatchingPlayer({
  exercise,
  submitQuiz = (id, body) => exercisesApi.submitQuiz(id, body),
}: QuizMatchingPlayerProps) {
  const left = readElements(exercise.config, "left");
  const right = readElements(exercise.config, "right");
  const rightTexts = new Map(right.map((element) => [element.id, element.text]));

  const [pairs, setPairs] = useState<Readonly<Record<string, string>>>({});
  const [result, setResult] = useState<MatchingGradeResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isMatchable(left, right)) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        Este quiz no tiene opciones disponibles.
      </p>
    );
  }

  const locked = result !== null || pending;
  const complete = left.every((element) => pairs[element.id] !== undefined);

  function rightTextOf(id: string | undefined): string {
    return id === undefined ? "" : (rightTexts.get(id) ?? id);
  }

  /** Parejas que ya usan las otras filas: la correspondencia es uno a uno. */
  function chosenElsewhere(leftId: string): ReadonlySet<string> {
    return new Set(
      left
        .filter((element) => element.id !== leftId)
        .map((element) => pairs[element.id])
        .filter(isChosen),
    );
  }

  function choose(leftId: string, rightId: string): void {
    if (locked) {
      return;
    }

    setPairs((previous) => {
      const next: Record<string, string> = { ...previous };

      if (rightId === "") {
        delete next[leftId];
      } else {
        next[leftId] = rightId;
      }

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!complete || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const graded = await submitQuiz(exercise.id, { pairs: { ...pairs } });

      if (graded.kind !== "matching") {
        setError(UNEXPECTED_GRADE_MESSAGE);
        return;
      }

      setResult(graded);
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  function retry(): void {
    setPairs({});
    setResult(null);
    setError(null);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" aria-busy={pending}>
      <fieldset className="space-y-3" disabled={locked}>
        <legend className="text-base font-medium text-white">{exercise.statement}</legend>
        <p className="text-sm text-slate-300">
          Elige para cada elemento de la izquierda su pareja de la derecha. Cada pareja se usa una
          sola vez.
        </p>

        <ul className="list-none space-y-3 p-0">
          {left.map((element) => {
            const selected = pairs[element.id];
            const unavailable = chosenElsewhere(element.id);

            return (
              <li
                key={element.id}
                className="space-y-2 rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 text-sm text-slate-200"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1">{element.text}</span>
                  <select
                    aria-label={`Pareja de ${element.text}`}
                    value={selected ?? ""}
                    onChange={(event) => choose(element.id, event.target.value)}
                    className={SELECT}
                  >
                    <option value="">{EMPTY_OPTION_LABEL}</option>
                    {right.map((option) => (
                      <option
                        key={option.id}
                        value={option.id}
                        disabled={unavailable.has(option.id)}
                      >
                        {option.text}
                      </option>
                    ))}
                  </select>
                </div>

                {result === null ? null : (
                  <div className="space-y-1">
                    {selected === undefined ? null : (
                      <p className="text-slate-300">Tu elección: {rightTextOf(selected)}</p>
                    )}
                    <p className="text-slate-100">
                      Pareja correcta: {rightTextOf(result.correctPairs[element.id])}
                    </p>
                    {result.explanations[element.id] === undefined ? null : (
                      <p className="text-slate-300">{result.explanations[element.id]}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {result === null ? (
        <button type="submit" className={PRIMARY_BUTTON} disabled={!complete || pending}>
          {pending ? "Comprobando…" : "Comprobar"}
        </button>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm"
        >
          <p className={cn("font-semibold", result.correct ? "text-emerald-300" : "text-rose-300")}>
            {result.correct ? "¡Correcto!" : "Todavía no. Todas las parejas deben ser correctas."}
          </p>
          <button type="button" className={SECONDARY_BUTTON} onClick={retry}>
            Intentar de nuevo
          </button>
        </div>
      )}
    </form>
  );
}

