"use client";

import type { ExerciseDetail, QuizGradeResult } from "@codeai/shared";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";

import type { SubmitQuiz } from "./QuizPlayer";

/**
 * Quiz de respuesta múltiple (`config.kind === "multiple"`).
 *
 * El estudiante marca exactamente `selectCount` casillas y la corrección es
 * «todo o nada»: acierta solo si elige todas las correctas y ninguna más (S14,
 * regla 2). Igual que el quiz de respuesta única, las opciones correctas y sus
 * explicaciones solo llegan con el resultado de `POST …/quiz-answers`, nunca
 * antes del intento.
 */

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Mismo texto que usa el quiz de respuesta única cuando el error no es de la API. */
const UNEXPECTED_GRADE_MESSAGE = "No pudimos corregir tu respuesta. Inténtalo de nuevo.";

const SELECT_COUNT_HINT: Record<2 | 3, string> = {
  2: "Selecciona DOS",
  3: "Selecciona TRES",
};

export interface QuizMultiplePlayerProps {
  readonly exercise: ExerciseDetail;
  readonly submitQuiz?: SubmitQuiz;
}

interface QuizOption {
  readonly id: string;
  readonly text: string;
}

interface MultipleQuizConfig {
  readonly selectCount: 2 | 3;
  readonly options: readonly QuizOption[];
}

type MultipleGradeResult = Extract<QuizGradeResult, { kind: "multiple" }>;

function readOptions(config: Record<string, unknown>): QuizOption[] {
  const raw = config.options;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((option: unknown) => {
    const record = typeof option === "object" && option !== null ? (option as Record<string, unknown>) : {};

    return typeof record.id === "string" && typeof record.text === "string"
      ? [{ id: record.id, text: record.text }]
      : [];
  });
}

/**
 * Configuración mínima que se puede pintar y corregir: un número de casillas que
 * el servidor acepte (`2` o `3`) y al menos esas opciones. Lo demás se trata
 * como un quiz sin opciones, igual que el reproductor de respuesta única.
 */
function readConfig(config: Record<string, unknown>): MultipleQuizConfig | null {
  const selectCount = config.selectCount;

  if (selectCount !== 2 && selectCount !== 3) {
    return null;
  }

  const options = readOptions(config);

  return options.length < selectCount ? null : { selectCount, options };
}

/** Estado de una opción ya corregida: siempre con texto, nunca solo con color. */
function describeOption(
  result: MultipleGradeResult,
  optionId: string,
  checked: boolean,
): string | null {
  if (result.correctOptionIds.includes(optionId)) {
    return checked ? "acierto" : "te faltó";
  }

  return checked ? "fallo" : null;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === "UNAUTHENTICATED"
      ? "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando."
      : error.message;
  }

  return UNEXPECTED_GRADE_MESSAGE;
}

export function QuizMultiplePlayer({
  exercise,
  submitQuiz = (id, body) => exercisesApi.submitQuiz(id, body),
}: QuizMultiplePlayerProps) {
  const config = readConfig(exercise.config);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [result, setResult] = useState<MultipleGradeResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (config === null) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        Este quiz no tiene opciones disponibles.
      </p>
    );
  }

  const { selectCount, options } = config;
  const complete = selectedIds.length === selectCount;

  function toggle(optionId: string): void {
    setSelectedIds((current) =>
      current.includes(optionId)
        ? current.filter((item) => item !== optionId)
        : [...current, optionId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!complete || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const graded = await submitQuiz(exercise.id, { optionIds: [...selectedIds] });

      if (graded.kind !== "multiple") {
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
    setSelectedIds([]);
    setResult(null);
    setError(null);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" aria-busy={pending}>
      <fieldset className="space-y-3" disabled={result !== null || pending}>
        <legend className="text-base font-medium text-white">{exercise.statement}</legend>
        <p className="text-sm text-slate-300">{SELECT_COUNT_HINT[selectCount]}</p>

        {options.map((option) => {
          const checked = selectedIds.includes(option.id);
          const isCorrect = result !== null && result.correctOptionIds.includes(option.id);
          const isWrongChoice = result !== null && checked && !isCorrect;
          const isMissing = result !== null && !checked && isCorrect;
          const atLimit = !checked && selectedIds.length >= selectCount;
          const explanation = result === null ? undefined : result.explanations[option.id];
          const state = result === null ? null : describeOption(result, option.id, checked);

          return (
            <div key={option.id} className="space-y-2">
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm text-slate-200 transition",
                  checked ? "border-accent bg-accent/10" : "border-line/70 bg-ink-card/40 hover:border-white/30",
                  isCorrect && "border-emerald-400/60 bg-emerald-500/10",
                  isWrongChoice && "border-rose-400/60 bg-rose-500/10",
                  isMissing && "border-amber-400/60 bg-amber-500/10",
                )}
              >
                <input
                  type="checkbox"
                  name={`quiz-${exercise.id}`}
                  value={option.id}
                  checked={checked}
                  disabled={result !== null || atLimit}
                  onChange={() => toggle(option.id)}
                  className="mt-1"
                />
                <span>
                  <span className="mr-2 font-mono text-xs uppercase text-slate-500">{option.id}</span>
                  {option.text}
                  {state === null ? null : (
                    <span className="ml-2 font-medium text-slate-100">{state}</span>
                  )}
                </span>
              </label>
              {explanation === undefined ? null : (
                <p className="pl-4 text-sm text-slate-300">{explanation}</p>
              )}
            </div>
          );
        })}
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
        <div role="status" aria-live="polite" className="space-y-3 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm">
          <p className={cn("font-semibold", result.correct ? "text-emerald-300" : "text-rose-300")}>
            {result.correct
              ? "¡Correcto!"
              : "Todavía no. Una respuesta múltiple se corrige completa: hay que elegir todas las correctas y ninguna más."}
          </p>
          <button type="button" className={SECONDARY_BUTTON} onClick={retry}>
            Intentar de nuevo
          </button>
        </div>
      )}
    </form>
  );
}

