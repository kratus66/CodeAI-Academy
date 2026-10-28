"use client";

import type { ExerciseDetail, ReflectionResponse } from "@codeai/shared";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";

/**
 * Reflexión abierta (elaboración: «qué decidiste, qué descartaste, qué
 * consecuencia tiene»). Se registra como intento; la valoración con rúbrica
 * llega con S9, así que aquí solo se confirma que quedó guardada.
 */

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export type SubmitReflection = (exerciseId: string, text: string) => Promise<ReflectionResponse>;

export interface ReflectionPlayerProps {
  readonly exercise: ExerciseDetail;
  readonly submitReflection?: SubmitReflection;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === "UNAUTHENTICATED"
      ? "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando."
      : error.message;
  }

  return "No pudimos guardar tu reflexión. Inténtalo de nuevo.";
}

export function ReflectionPlayer({
  exercise,
  submitReflection = (id, text) => exercisesApi.submitReflection(id, text),
}: ReflectionPlayerProps) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (text.trim().length === 0 || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      await submitReflection(exercise.id, text.trim());
      setSaved(true);
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4" aria-busy={pending}>
      <p className="text-base text-slate-100">{exercise.statement}</p>

      <label htmlFor={`reflection-${exercise.id}`} className="block text-sm text-slate-300">
        Tu reflexión
      </label>
      <textarea
        id={`reflection-${exercise.id}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={saved || pending}
        rows={6}
        maxLength={2000}
        className="w-full rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p role="status" className="text-sm text-emerald-300">
          Reflexión guardada. Releerla dentro de unos días es parte de la práctica.
        </p>
      ) : (
        <button type="submit" className={PRIMARY_BUTTON} disabled={text.trim().length === 0 || pending}>
          {pending ? "Guardando…" : "Guardar reflexión"}
        </button>
      )}
    </form>
  );
}
