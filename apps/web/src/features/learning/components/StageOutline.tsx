"use client";

import type { StageDetail } from "@codeai/shared";
import Link from "next/link";
import { useCallback } from "react";

import { formatMinutes } from "@/features/learning/lib/format";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError, contentApi } from "@/lib/api-client";

const BACK_LINK_CLASSES =
  "inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const UNIT_CLASSES =
  "flex flex-col gap-1 rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 transition hover:border-accent/50 hover:bg-ink-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

type LoadStage = (
  id: number | string,
  signal?: AbortSignal,
) => Promise<StageDetail>;

interface StageOutlineProps {
  readonly stageId: number | string;
  /** Inyectable en pruebas; por defecto llama a `GET /api/content/stages/:id`. */
  readonly loadStage?: LoadStage;
}

/** Una URL mal formada y una etapa inexistente son el mismo caso para el estudiante. */
function isMissingContent(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 404 || error.status === 400)
  );
}

/** Etapa con sus módulos y las unidades publicadas de cada módulo. */
export function StageOutline({
  stageId,
  loadStage = contentApi.getStage,
}: StageOutlineProps) {
  const load = useCallback(
    (signal: AbortSignal) => loadStage(stageId, signal),
    [loadStage, stageId],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando la etapa…
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
            No encontramos esta etapa.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Puede que ya no esté publicada o que el enlace esté mal formado.
          </p>
          <Link href="/learn" className={`${BACK_LINK_CLASSES} mt-4`}>
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
        <p>No pudimos cargar la etapa. Inténtalo de nuevo en unos segundos.</p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const stage = state.data;
  const duration = formatMinutes(stage.estimatedMin);

  return (
    <article className="space-y-10">
      <header>
        <Link href="/learn" className={BACK_LINK_CLASSES}>
          <span aria-hidden>←</span>
          Catálogo
        </Link>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Etapa {stage.order} · Nivel {stage.level}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {stage.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
          {stage.objective}
        </p>
        <p className="mt-4 text-sm text-slate-500">
          {stage.moduleCount} {stage.moduleCount === 1 ? "módulo" : "módulos"}
          {duration ? ` · Duración estimada: ${duration}` : null}
        </p>
      </header>

      <div className="space-y-8">
        {stage.modules.map((module) => (
          <section key={module.id} aria-labelledby={`modulo-${module.id}`}>
            <p className="font-mono text-xs text-slate-500">{module.code}</p>
            <h2
              id={`modulo-${module.id}`}
              className="mt-2 text-xl font-semibold tracking-tight text-white"
            >
              {module.title}
            </h2>

            {module.units.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Este módulo aún no tiene unidades publicadas.
              </p>
            ) : (
              <ol className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
                {module.units.map((unit) => (
                  <li key={unit.id}>
                    <Link
                      href={`/learn/units/${unit.code}`}
                      className={UNIT_CLASSES}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-xs text-slate-500">
                          {unit.code}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatMinutes(unit.estimatedMin) ?? ""}
                        </span>
                      </span>
                      <span className="text-sm font-medium text-slate-100">
                        {unit.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
