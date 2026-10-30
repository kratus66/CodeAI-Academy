"use client";

import type {
  StageDetail,
  UnitProgressSummary,
  UnitState,
} from "@codeai/shared";
import Link from "next/link";
import { useCallback } from "react";

import { ProgressRing } from "@/components/ui/ProgressRing";
import { formatMinutes } from "@/features/learning/lib/format";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError, contentApi, progressApi } from "@/lib/api-client";

const BACK_LINK_CLASSES =
  "inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const UNIT_CLASSES =
  "flex flex-col gap-1 rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 transition hover:border-accent/50 hover:bg-ink-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const LOCKED_UNIT_CLASSES =
  "flex flex-col gap-1 rounded-xl border border-line/60 bg-ink-card/20 px-4 py-3";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Vocabulario visible del estado de una unidad; nunca se comunica solo con color. */
const UNIT_STATE_LABELS: Record<UnitState, string> = {
  MASTERED: "Dominada",
  IN_PROGRESS: "En curso",
  NEEDS_REVIEW: "Para repasar",
  AVAILABLE: "Disponible",
  LOCKED: "Bloqueada",
};

const UNIT_STATE_ICONS: Record<UnitState, string> = {
  MASTERED: "✓",
  IN_PROGRESS: "▸",
  NEEDS_REVIEW: "↻",
  AVAILABLE: "○",
  LOCKED: "🔒",
};

const UNIT_STATE_STYLES: Record<UnitState, string> = {
  MASTERED: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  IN_PROGRESS: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
  NEEDS_REVIEW: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  AVAILABLE: "border-white/15 bg-white/5 text-slate-300",
  LOCKED: "border-amber-400/40 bg-amber-500/10 text-amber-200",
};

function UnitStateBadge({ state }: { readonly state: UnitState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium ${UNIT_STATE_STYLES[state]}`}
    >
      <span aria-hidden="true">{UNIT_STATE_ICONS[state]}</span>
      {UNIT_STATE_LABELS[state]}
    </span>
  );
}

type LoadStage = (
  id: number | string,
  signal?: AbortSignal,
) => Promise<StageDetail>;

type LoadProgress = (
  signal?: AbortSignal,
) => Promise<readonly UnitProgressSummary[]>;

interface StageOutlineProps {
  readonly stageId: number | string;
  /** Inyectable en pruebas; por defecto llama a `GET /api/content/stages/:id`. */
  readonly loadStage?: LoadStage;
  /** Inyectable en pruebas; por defecto llama a `GET /api/progress/units`. */
  readonly loadProgress?: LoadProgress;
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
  loadProgress = progressApi.listUnits,
}: StageOutlineProps) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [stage, units] = await Promise.all([
        loadStage(stageId, signal),
        loadProgress(signal),
      ]);

      return { stage, units };
    },
    [loadStage, loadProgress, stageId],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-6">
        <span className="sr-only">Cargando la etapa…</span>
        <div
          aria-hidden="true"
          className="h-4 w-24 animate-pulse rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="h-9 w-2/3 animate-pulse rounded-xl bg-white/10"
        />
        <div
          aria-hidden="true"
          className="h-4 w-full max-w-xl animate-pulse rounded-full bg-white/5"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              aria-hidden="true"
              className="h-20 animate-pulse rounded-xl border border-line/60 bg-ink-card/30"
            />
          ))}
        </div>
      </div>
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
          <Link href="/learn/stages" className={`${BACK_LINK_CLASSES} mt-4`}>
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

  const { stage, units } = state.data;
  const duration = formatMinutes(stage.estimatedMin);
  const progressByCode = new Map(units.map((unit) => [unit.unitCode, unit]));

  return (
    <article className="space-y-10">
      <header>
        <Link href="/learn/stages" className={BACK_LINK_CLASSES}>
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
                {module.units.map((unit) => {
                  const progress = progressByCode.get(unit.code);
                  const unitState = progress?.state ?? "AVAILABLE";
                  const minutes = formatMinutes(unit.estimatedMin) ?? "";

                  if (unitState === "LOCKED") {
                    return (
                      <li key={unit.id}>
                        <div className={LOCKED_UNIT_CLASSES}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="font-mono text-xs text-slate-500">
                              {unit.code}
                            </span>
                            <UnitStateBadge state={unitState} />
                          </span>
                          <span className="text-sm font-medium text-slate-300">
                            {unit.title}
                          </span>
                          <span className="text-xs text-slate-500">
                            Se abre al dominar la unidad anterior.
                          </span>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={unit.id}>
                      <Link
                        href={`/learn/units/${unit.code}`}
                        aria-label={`Unidad ${unit.code}: ${unit.title}`}
                        className={UNIT_CLASSES}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-mono text-xs text-slate-500">
                            {unit.code}
                          </span>
                          <UnitStateBadge state={unitState} />
                        </span>
                        <span className="text-sm font-medium text-slate-100">
                          {unit.title}
                        </span>
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-500">{minutes}</span>
                          {progress === undefined ? null : (
                            <ProgressRing
                              value={progress.progressPct}
                              label={`Avance de ${unit.code}`}
                              className="scale-75"
                            />
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
