"use client";

import type {
  ExerciseDetail,
  QuizAnswerResult,
  QuizSubmissionInput,
  QuizGradeResult,
} from "@codeai/shared";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";

import { QuizMultiplePlayer } from "./QuizMultiplePlayer";
import { QuizOrderingPlayer } from "./QuizOrderingPlayer";

/**
 * Quiz de opción múltiple. La respuesta correcta y las explicaciones no viajan
 * en el ejercicio: llegan con el resultado de `POST …/quiz-answers`, es decir,
 * solo después de un intento registrado (recuperación activa).
 */

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export type AnswerQuiz = (exerciseId: string, optionId: string) => Promise<QuizAnswerResult>;

export type SubmitQuiz = (id: string, body: QuizSubmissionInput) => Promise<QuizGradeResult>;

export interface QuizPlayerProps {
  readonly exercise: ExerciseDetail;
  readonly answerQuiz?: AnswerQuiz;
  readonly submitQuiz?: SubmitQuiz;
}

interface QuizOption {
  readonly id: string;
  readonly text: string;
}

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

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === "UNAUTHENTICATED"
      ? "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando."
      : error.message;
  }

  return "No pudimos corregir tu respuesta. Inténtalo de nuevo.";
}

function SingleQuizPlayer({
  exercise,
  answerQuiz = (id, optionId) => exercisesApi.answerQuiz(id, optionId),
}: QuizPlayerProps) {
  const options = readOptions(exercise.config);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<QuizAnswerResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (selected === null || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      setResult(await answerQuiz(exercise.id, selected));
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  function retry(): void {
    setSelected(null);
    setResult(null);
    setError(null);
  }

  if (options.length === 0) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        Este quiz no tiene opciones disponibles.
      </p>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" aria-busy={pending}>
      <fieldset className="space-y-3" disabled={result !== null || pending}>
        <legend className="text-base font-medium text-white">{exercise.statement}</legend>

        {options.map((option) => {
          const checked = selected === option.id;
          const isCorrect = result !== null && option.id === result.correctOptionId;
          const isWrongChoice = result !== null && checked && !result.correct;

          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm text-slate-200 transition",
                checked ? "border-accent bg-accent/10" : "border-line/70 bg-ink-card/40 hover:border-white/30",
                isCorrect && "border-emerald-400/60 bg-emerald-500/10",
                isWrongChoice && "border-rose-400/60 bg-rose-500/10",
              )}
            >
              <input
                type="radio"
                name={`quiz-${exercise.id}`}
                value={option.id}
                checked={checked}
                onChange={() => setSelected(option.id)}
                className="mt-1"
              />
              <span>
                <span className="mr-2 font-mono text-xs uppercase text-slate-500">{option.id}</span>
                {option.text}
              </span>
            </label>
          );
        })}
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {result === null ? (
        <button type="submit" className={PRIMARY_BUTTON} disabled={selected === null || pending}>
          {pending ? "Comprobando…" : "Comprobar"}
        </button>
      ) : (
        <div role="status" aria-live="polite" className="space-y-3 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm">
          <p className={cn("font-semibold", result.correct ? "text-emerald-300" : "text-rose-300")}>
            {result.correct ? "¡Correcto!" : "Todavía no."}
          </p>
          <p className="text-slate-300">{result.explanation}</p>
          {result.correct ? null : (
            <p className="text-slate-300">
              <span className="font-medium text-white">La correcta es la {result.correctOptionId.toUpperCase()}: </span>
              {result.correctExplanation}
            </p>
          )}
          <button type="button" className={SECONDARY_BUTTON} onClick={retry}>
            Intentar de nuevo
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * `config.kind` lo escribe el contenido. Un valor que no es texto se trata como
 * ausente, igual que `readOptions` tolera una configuración mal formada.
 */
function readQuizKind(config: Record<string, unknown>): string | undefined {
  const kind = config.kind;

  return typeof kind === "string" ? kind : undefined;
}

/**
 * Reparto por variante de quiz: cada tipo tiene su reproductor porque cambia la
 * forma de responder, no solo el texto. Las variantes que aún no tienen
 * reproductor se anuncian en lugar de pintar un quiz equivocado.
 */
export function QuizPlayer({
  exercise,
  answerQuiz,
  submitQuiz = (id, body) => exercisesApi.submitQuiz(id, body),
}: QuizPlayerProps) {
  const kind = readQuizKind(exercise.config);

  if (kind === "multiple") {
    return <QuizMultiplePlayer exercise={exercise} submitQuiz={submitQuiz} />;
  }

  if (kind === "ordering") {
    return <QuizOrderingPlayer exercise={exercise} submitQuiz={submitQuiz} />;
  }

  if (kind === undefined || kind === "single") {
    return <SingleQuizPlayer exercise={exercise} answerQuiz={answerQuiz} />;
  }

  return (
    <p role="alert" className="text-sm text-rose-200">
      Este tipo de pregunta todavía no está disponible.
    </p>
  );
}

