"use client";

import Link from "next/link";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { contentApi } from "@/lib/api-client";
import type { StageCatalogPage } from "@/lib/api-client";

const CARD_CLASSES =
  "group flex h-full flex-col rounded-2xl border border-line/70 bg-ink-card/50 p-6 transition hover:border-accent/50 hover:bg-ink-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

type LoadStages = (signal?: AbortSignal) => Promise<StageCatalogPage>;

interface StageCatalogProps {
  /** Inyectable en pruebas; por defecto llama a `GET /api/content/stages`. */
  readonly loadStages?: LoadStages;
}

function moduleCountLabel(count: number): string {
  return count === 1 ? "1 módulo" : `${count} módulos`;
}

/** Catálogo de etapas publicadas con sus estados de carga, error y vacío. */
export function StageCatalog({
  loadStages = contentApi.listStages,
}: StageCatalogProps) {
  const { state, reload } = useContentLoader(loadStages);

  if (state.status === "loading") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-slate-400"
      >
        Cargando el catálogo de etapas…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>
          No pudimos cargar el catálogo. Comprueba tu conexión y vuelve a
          intentarlo.
        </p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  if (state.data.stages.length === 0) {
    return (
      <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
        <p className="text-sm font-medium text-slate-200">
          Todavía no hay etapas publicadas.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          El currículo se publica por etapas: vuelve pronto.
        </p>
      </div>
    );
  }

  return (
    <ol className="grid list-none gap-4 p-0 sm:grid-cols-2">
      {state.data.stages.map((stage) => (
        <li key={stage.id}>
          <Link href={`/learn/stages/${stage.id}`} className={CARD_CLASSES}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              Etapa {stage.order} · Nivel {stage.level}
            </p>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-white transition group-hover:text-accent">
              {stage.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
              {stage.objective}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              {moduleCountLabel(stage.moduleCount)}
              <span aria-hidden> →</span>
            </p>
          </Link>
        </li>
      ))}
    </ol>
  );
}
