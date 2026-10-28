"use client";

import Link from "next/link";
import { useCallback } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError } from "@/lib/api-client";

import { ExerciseLab, loadExerciseLab } from "./ExerciseLab";
import type { ExerciseLabContent, LoadExerciseLab } from "./ExerciseLab";
import { FlashcardPlayer } from "./FlashcardPlayer";
import { QuizPlayer } from "./QuizPlayer";
import { ReflectionPlayer } from "./ReflectionPlayer";

/**
 * Despacha un ejercicio de la unidad al jugador que corresponde a su tipo:
 * `QUIZ` y `FLASHCARD` no necesitan sandbox; el resto sigue en el laboratorio de
 * código, al que se le pasa el ejercicio ya cargado para no pedirlo dos veces.
 */

const LINK_CLASSES =
  "font-medium text-accent underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export interface ExercisePlayerProps {
  readonly unitCode: string;
  readonly slug: string;
  readonly loadLab?: LoadExerciseLab;
}

const TYPE_LABEL: Record<string, string> = {
  QUIZ: "Quiz",
  FLASHCARD: "Tarjeta de repaso",
  REFLECT: "Reflexión",
};

export function ExercisePlayer({ unitCode, slug, loadLab = loadExerciseLab }: ExercisePlayerProps) {
  const load = useCallback(
    (signal: AbortSignal) => loadLab(unitCode, slug, signal),
    [loadLab, unitCode, slug],
  );
  const { state, reload } = useContentLoader<ExerciseLabContent>(load);
  const loaded = state.status === "ready" ? state.data : null;
  const preloaded = useCallback<LoadExerciseLab>(
    () => (loaded ? Promise.resolve(loaded) : load(new AbortController().signal)),
    [loaded, load],
  );

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando el ejercicio…
      </p>
    );
  }

  if (state.status === "error") {
    const missing = state.error instanceof ApiError && [400, 404].includes(state.error.status);

    return (
      <div role="alert" className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6 text-sm">
        <p className="font-medium text-slate-200">
          {missing ? "No encontramos este ejercicio." : "No pudimos cargar el ejercicio. Inténtalo de nuevo en unos segundos."}
        </p>
        {missing ? (
          <Link href={`/learn/units/${unitCode}`} className={`${LINK_CLASSES} mt-4 inline-block`}>
            Volver a la unidad
          </Link>
        ) : (
          <button type="button" onClick={reload} className={`${LINK_CLASSES} mt-4`}>
            Reintentar
          </button>
        )}
      </div>
    );
  }

  const { exercise, unitTitle } = state.data;

  if (exercise.type === "QUIZ" || exercise.type === "FLASHCARD" || exercise.type === "REFLECT") {
    return (
      <article className="space-y-6">
        <header className="space-y-2">
          <nav aria-label="Migas" className="text-sm text-slate-400">
            <Link href={`/learn/units/${unitCode}`} className={LINK_CLASSES}>
              {unitTitle}
            </Link>
          </nav>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {TYPE_LABEL[exercise.type]}
            {exercise.estimatedMin ? ` · ${exercise.estimatedMin} min` : ""}
          </p>
          <h1 className="text-2xl font-semibold text-white">{exercise.title}</h1>
        </header>

        {exercise.type === "QUIZ" ? (
          <QuizPlayer exercise={exercise} />
        ) : exercise.type === "FLASHCARD" ? (
          <FlashcardPlayer exercise={exercise} />
        ) : (
          <ReflectionPlayer exercise={exercise} />
        )}
      </article>
    );
  }

  return (
    <div className="space-y-4">
      <p role="note" className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Modo de práctica: la corrección automática de código todavía no ejecuta tu
        programa de verdad, así que un «aprobado» aquí no certifica tu nivel. Comprueba
        tu solución por tu cuenta (ejecútala y escribe tus propias pruebas).
      </p>
      <ExerciseLab unitCode={unitCode} slug={slug} loadLab={preloaded} />
    </div>
  );
}
