"use client";

import Link from "next/link";
import { useCallback } from "react";

import { formatMinutes } from "@/features/learning/lib/format";
import {
  findUnitNeighbours,
  resolvePrerequisites,
} from "@/features/learning/lib/navigation";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { loadUnitView } from "@/features/learning/lib/unit-view-loader";
import type { LoadUnitView } from "@/features/learning/lib/unit-view-loader";
import { ApiError } from "@/lib/api-client";

const LINK_CLASSES =
  "font-medium text-accent underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const ROW_CLASSES =
  "flex flex-col gap-1 rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 transition hover:border-accent/50 hover:bg-ink-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const DISABLED_CLASSES =
  "inline-flex items-center rounded-full border border-line/70 px-4 py-2 text-sm text-slate-600";

interface UnitViewProps {
  readonly code: string;
  /** Inyectable en pruebas; por defecto llama a `loadUnitView`. */
  readonly loadUnit?: LoadUnitView;
}

/** Una URL mal formada y una unidad inexistente son el mismo caso para el estudiante. */
function isMissingContent(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 404 || error.status === 400)
  );
}

function SectionTitle({
  id,
  children,
}: {
  readonly id: string;
  readonly children: string;
}) {
  return (
    <h2
      id={id}
      className="text-lg font-semibold tracking-tight text-white"
    >
      {children}
    </h2>
  );
}

/** Unidad con objetivo, prerrequisitos, lecciones, ejercicios y navegación. */
export function UnitView({ code, loadUnit = loadUnitView }: UnitViewProps) {
  const load = useCallback(
    (signal: AbortSignal) => loadUnit(code, signal),
    [loadUnit, code],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando la unidad…
      </p>
    );
  }

  if (state.status === "error") {
    if (isMissingContent(state.error)) {
      const traceId =
        state.error instanceof ApiError ? state.error.traceId : undefined;

      return (
        <div
          role="alert"
          className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6"
        >
          <p className="text-sm font-medium text-slate-200">
            No encontramos esta unidad.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Puede que ya no esté publicada o que el enlace esté mal formado.
          </p>
          <Link href="/learn" className={`${LINK_CLASSES} mt-4 inline-block`}>
            Volver al catálogo
          </Link>
          {traceId ? (
            <p className="mt-3 font-mono text-xs text-slate-500">
              Referencia: {traceId}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>No pudimos cargar la unidad. Inténtalo de nuevo en unos segundos.</p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const { unit, stage } = state.data;
  const { previous, next } = findUnitNeighbours(stage.modules, unit.code);
  const prerequisites = resolvePrerequisites(
    stage.modules,
    unit.prerequisiteIds,
  );
  const duration = formatMinutes(unit.estimatedMin);

  return (
    <article className="space-y-10">
      <header>
        <nav
          aria-label="Migas de pan"
          className="flex flex-wrap items-center gap-2 text-sm text-slate-400"
        >
          <Link href="/learn" className={LINK_CLASSES}>
            Catálogo
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/learn/stages/${stage.id}`} className={LINK_CLASSES}>
            {stage.title}
          </Link>
          <span aria-hidden>/</span>
          <span className="font-mono text-xs text-slate-500">{unit.code}</span>
        </nav>

        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {unit.moduleCode} · Unidad {unit.order}
          {duration ? ` · ${duration}` : null}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {unit.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
          {unit.objective}
        </p>
      </header>

      <section
        aria-labelledby="prerrequisitos"
        className="space-y-4 border-t border-line/70 pt-8"
      >
        <SectionTitle id="prerrequisitos">Prerrequisitos</SectionTitle>
        {prerequisites.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin prerrequisitos: puedes empezar por aquí.
          </p>
        ) : (
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
            {prerequisites.map((prerequisite) => (
              <li key={prerequisite.id}>
                <Link
                  href={`/learn/units/${prerequisite.code}`}
                  className={ROW_CLASSES}
                >
                  <span className="font-mono text-xs text-slate-500">
                    {prerequisite.code}
                  </span>
                  <span className="text-sm font-medium text-slate-100">
                    {prerequisite.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="lecciones"
        className="space-y-4 border-t border-line/70 pt-8"
      >
        <SectionTitle id="lecciones">Lecciones</SectionTitle>
        {unit.lessons.length === 0 ? (
          <p className="text-sm text-slate-400">
            Esta unidad aún no tiene lecciones publicadas.
          </p>
        ) : (
          <ol className="grid list-none gap-3 p-0">
            {unit.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/learn/lessons/${lesson.slug}`}
                  className={ROW_CLASSES}
                >
                  <span className="text-sm font-medium text-slate-100">
                    Lección {lesson.order} · {lesson.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatMinutes(lesson.estimatedMin) ?? ""}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {unit.exercises.length > 0 ? (
        <section
          aria-labelledby="ejercicios"
          className="space-y-4 border-t border-line/70 pt-8"
        >
          <SectionTitle id="ejercicios">Ejercicios</SectionTitle>
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
            {unit.exercises.map((exercise) => (
              <li key={exercise.id}>
                <Link
                  href={`/learn/units/${unit.code}/exercises/${exercise.slug}`}
                  className={ROW_CLASSES}
                >
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {exercise.type} · dificultad {exercise.difficulty}/5
                  </span>
                  <span className="text-sm font-medium text-slate-100">
                    {exercise.title}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-400">
                    {exercise.statement}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav
        aria-label="Navegación entre unidades"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-8"
      >
        {previous ? (
          <Link href={`/learn/units/${previous.code}`} className={LINK_CLASSES}>
            <span aria-hidden>←</span> Anterior: {previous.code}
          </Link>
        ) : (
          <button type="button" disabled className={DISABLED_CLASSES}>
            <span aria-hidden>←</span> Anterior
          </button>
        )}

        {next ? (
          <Link href={`/learn/units/${next.code}`} className={LINK_CLASSES}>
            Siguiente: {next.code} <span aria-hidden>→</span>
          </Link>
        ) : (
          <button type="button" disabled className={DISABLED_CLASSES}>
            Siguiente <span aria-hidden>→</span>
          </button>
        )}
      </nav>
    </article>
  );
}
