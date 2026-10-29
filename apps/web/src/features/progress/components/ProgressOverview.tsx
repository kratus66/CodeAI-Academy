"use client";

import type { ProgressOverview as ProgressOverviewData } from "@codeai/shared";

import { CompetencyBoard } from "./CompetencyBoard";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { progressApi } from "@/lib/api-client";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

type LoadOverview = (signal?: AbortSignal) => Promise<ProgressOverviewData>;

interface ProgressOverviewProps {
  /** Inyectable en pruebas; por defecto llama a `GET /api/progress/overview`. */
  readonly loadOverview?: LoadOverview;
}

/** `34.5` → `34,5 %`: el panel se lee en español, la API habla en números. */
function percentLabel(value: number): string {
  return `${String(value).replace(".", ",")} %`;
}

function unitCountLabel(count: number): string {
  return count === 1 ? "1 unidad" : `${count} unidades`;
}

/**
 * Panel de avance del estudiante (`GET /api/progress/overview`). Muestra el
 * porcentaje global, la etapa en curso, los cuatro contadores del contrato y el
 * mapa C1–C14. Nunca calcula estado: todo llega resuelto del servidor.
 */
export function ProgressOverview({
  loadOverview = progressApi.getOverview,
}: ProgressOverviewProps) {
  const { state, reload } = useContentLoader(loadOverview);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando tu avance…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>No pudimos cargar tu avance. Comprueba tu conexión y vuelve a intentarlo.</p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const overview = state.data;
  const counters = overview.units;
  const totalUnits =
    counters.mastered + counters.inProgress + counters.needsReview + counters.locked;

  if (totalUnits === 0) {
    return (
      <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
        <p className="text-sm font-medium text-slate-200">
          Todavía no hay progreso registrado.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Cuando el currículo tenga unidades publicadas y completes una lección, tu
          avance aparecerá aquí.
        </p>
      </div>
    );
  }

  const competencies = overview.competencies;
  const hasEvidence = competencies.some((entry) => entry.evidenceCount > 0);

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="avance-global"
        className="glass rounded-2xl p-6"
      >
        <h2 id="avance-global" className="text-sm font-medium text-slate-300">
          Avance global
        </h2>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
          {percentLabel(overview.overallPct)}
        </p>
        <div
          role="progressbar"
          aria-label="Avance global"
          aria-valuenow={overview.overallPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-piece-i via-accent to-piece-t shadow-[0_0_12px_rgba(34,211,238,0.6)] transition-[width] duration-700"
            style={{ width: `${overview.overallPct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Etapa en curso: {overview.currentStage} · {unitCountLabel(totalUnits)} en tu ruta
        </p>
      </section>

      <section aria-labelledby="unidades" className="space-y-3">
        <h2 id="unidades" className="text-sm font-medium text-slate-300">
          Unidades
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Dominadas", value: counters.mastered, tint: "tint-s" },
            { label: "En curso", value: counters.inProgress, tint: "tint-i" },
            { label: "Para repasar", value: counters.needsReview, tint: "tint-o" },
            { label: "Bloqueadas", value: counters.locked, tint: "tint-t" },
          ].map((counter) => (
            <div
              key={counter.label}
              className={`glass rounded-2xl px-4 py-3 ${counter.tint}`}
            >
              <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
                {counter.label}
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-white">{counter.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="competencias" className="space-y-3">
        <h2 id="competencias" className="text-sm font-medium text-slate-300">
          Competencias
        </h2>
        <CompetencyBoard competencies={competencies} />
        {hasEvidence ? (
          <ul className="grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {competencies.map((entry) => (
              <li
                key={entry.code}
                className="glass flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm"
              >
                <span className="font-medium text-white">{entry.code}</span>
                <span className="text-slate-400">
                  Nivel {entry.level} · {entry.evidenceCount} evidencias
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            Todavía no hay evidencia de competencias: aparecerá al resolver ejercicios.
          </p>
        )}
      </section>
    </div>
  );
}
