"use client";

import type {
  AnalyticsRange,
  ErrorBreakdown,
  ProgressOverview,
  StudentSummary,
  UnitProgressSummary,
} from "@codeai/shared";
import { DEFAULT_ANALYTICS_RANGE } from "@codeai/shared";
import { useCallback, useState } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { CompetencyBoard } from "@/features/progress/components/CompetencyBoard";
import { analyticsApi, progressApi } from "@/lib/api-client";

import { RangePicker, rangeLabel } from "./RangePicker";
import { countLabel, dateLabel, percentLabel, usdLabel } from "./format";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const CARD_CLASSES = "glass rounded-2xl p-5";

const BUDGET_LABEL: Record<StudentSummary["ai"]["budgetLevel"], string> = {
  ok: "dentro del presupuesto",
  warning: "cerca del límite",
  exceeded: "límite superado",
};

/** Todo lo que pinta la pantalla, pedido en paralelo al abrir y al cambiar de rango. */
export interface StudentInsightsData {
  readonly summary: StudentSummary;
  readonly errors: ErrorBreakdown;
  readonly overview: ProgressOverview;
  readonly units: readonly UnitProgressSummary[];
}

export type LoadStudentInsights = (
  range: AnalyticsRange,
  signal: AbortSignal,
) => Promise<StudentInsightsData>;

/** Referencia de módulo: el loader del hook debe ser estable entre renders. */
const defaultLoadInsights: LoadStudentInsights = async (range, signal) => {
  const [summary, errors, overview, units] = await Promise.all([
    analyticsApi.getSummary(range, signal),
    analyticsApi.getErrors(range, signal),
    progressApi.getOverview(signal),
    progressApi.listUnits(signal),
  ]);

  return { summary, errors, overview, units };
};

export interface StageProgress {
  /** Índice de etapa que codifica el `unitCode` (`U0.1.1` → `0`). */
  readonly stage: number;
  readonly units: number;
  readonly avgPct: number;
}

/**
 * El resumen del estudiante no trae etapas; el `unitCode` sí las codifica
 * (`U<etapa>.<módulo>.<unidad>`). Se agrupa por esa primera cifra y se promedia
 * el avance de cada unidad, sin inventar etapas que el plan no tenga.
 */
export function summarizeStages(
  units: readonly UnitProgressSummary[],
): readonly StageProgress[] {
  const buckets = new Map<number, { total: number; count: number }>();

  for (const unit of units) {
    const match = /^U(\d+)(?:\.|$)/.exec(unit.unitCode);

    if (!match) continue;

    const stage = Number(match[1]);
    const bucket = buckets.get(stage) ?? { total: 0, count: 0 };
    buckets.set(stage, {
      total: bucket.total + unit.progressPct,
      count: bucket.count + 1,
    });
  }

  return [...buckets.entries()]
    .map(([stage, bucket]) => ({
      stage,
      units: bucket.count,
      avgPct: Math.round((bucket.total / bucket.count) * 10) / 10,
    }))
    .sort((left, right) => left.stage - right.stage);
}

interface StudentInsightsProps {
  /** Inyectable en pruebas; por defecto consulta analítica y progreso de la API. */
  readonly loadInsights?: LoadStudentInsights;
}

/**
 * Pantalla `/learn/insights`: avance global por etapa, competencias y errores
 * frecuentes del estudiante autenticado. Todos los números llegan calculados del
 * servidor; aquí sólo se agrupan las unidades por etapa para pintar la barra.
 */
export function StudentInsights({
  loadInsights = defaultLoadInsights,
}: StudentInsightsProps) {
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_ANALYTICS_RANGE);
  const load = useCallback(
    (signal: AbortSignal) => loadInsights(range, signal),
    [loadInsights, range],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <RangePicker value={range} onChange={setRange} />
        <p role="status" aria-live="polite" className="text-sm text-slate-400">
          Cargando tus métricas…
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <RangePicker value={range} onChange={setRange} />
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
        >
          <p>
            No pudimos cargar tus métricas. Comprueba tu conexión y vuelve a
            intentarlo.
          </p>
          <button type="button" onClick={reload} className={BUTTON_CLASSES}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { summary, errors, overview, units } = state.data;
  const stages = summarizeStages(units);
  const withEvidence = overview.competencies.filter(
    (entry) => entry.evidenceCount > 0,
  );
  const hasActivity =
    summary.units.total > 0 ||
    summary.submissions.total > 0 ||
    summary.reviews.completed > 0 ||
    summary.ai.calls > 0 ||
    units.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePicker value={range} onChange={setRange} />
        <p className="text-xs text-slate-500">Periodo: {rangeLabel(range)}</p>
      </div>

      {hasActivity ? (
        <>
          <section aria-label="Resumen del periodo" className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: "Avance global",
                  value: percentLabel(summary.overallPct),
                  note: `Etapa en curso: ${overview.currentStage}`,
                },
                {
                  label: "Días activos",
                  value: String(summary.activeDays),
                  note: summary.lastActivityAt
                    ? `Última actividad: ${dateLabel(summary.lastActivityAt)}`
                    : "Sin actividad registrada",
                },
                {
                  label: "Envíos superados",
                  value: `${summary.submissions.passed}/${summary.submissions.total}`,
                  note:
                    summary.submissions.avgScore === null
                      ? "Sin nota media todavía"
                      : `Nota media: ${percentLabel(summary.submissions.avgScore)}`,
                },
                {
                  label: "Repasos pendientes",
                  value: String(summary.reviews.due),
                  note: `${summary.reviews.completed} completados · ${summary.reviews.lapses} olvidos`,
                },
              ].map((kpi) => (
                <div key={kpi.label} className={CARD_CLASSES}>
                  <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {kpi.label}
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold text-white">
                    {kpi.value}
                  </dd>
                  <dd className="mt-1 text-xs text-slate-400">{kpi.note}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate-500">
              Uso de IA en el periodo: <span className="text-slate-300">{summary.ai.calls} llamadas</span>{" "}
              · {usdLabel(summary.ai.costUsd)} · {BUDGET_LABEL[summary.ai.budgetLevel]}
            </p>
          </section>

          <section aria-labelledby="insights-etapas" className="space-y-3">
            <h2 id="insights-etapas" className="text-sm font-medium text-slate-300">
              Avance por etapa
            </h2>
            {stages.length === 0 ? (
              <p className="text-sm text-slate-400">
                Todavía no hay unidades con avance registrado en tu ruta.
              </p>
            ) : (
              <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
                {stages.map((stage) => (
                  <li key={stage.stage} className={CARD_CLASSES}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-white">
                        Etapa E{stage.stage}
                      </span>
                      <span className="text-slate-400">
                        {percentLabel(stage.avgPct)} · {countLabel(stage.units, "unidad", "unidades")}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Avance de la etapa E${stage.stage}`}
                      aria-valuenow={stage.avgPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-piece-i via-accent to-piece-t"
                        style={{ width: `${stage.avgPct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="insights-competencias" className="space-y-3">
            <h2
              id="insights-competencias"
              className="text-sm font-medium text-slate-300"
            >
              Competencias
            </h2>
            <CompetencyBoard competencies={overview.competencies} />
            {withEvidence.length === 0 ? (
              <p className="text-sm text-slate-400">
                Todavía no hay evidencia de competencias: aparecerá al resolver
                ejercicios con evaluación.
              </p>
            ) : (
              <ul className="grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {withEvidence.map((entry) => (
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
            )}
          </section>

          <section aria-labelledby="insights-errores" className="space-y-3">
            <h2 id="insights-errores" className="text-sm font-medium text-slate-300">
              Errores frecuentes
            </h2>
            {errors.total === 0 ? (
              <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
                <p className="text-sm font-medium text-slate-200">
                  Sin errores registrados en este periodo.
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Cuando un envío falle, la API lo clasifica por categoría y
                  concepto para que sepas qué repasar primero.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  {errors.total} errores clasificados en el periodo.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={CARD_CLASSES}>
                    <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Por categoría
                    </h3>
                    <ul className="mt-3 list-none space-y-3 p-0">
                      {errors.byCategory.map((entry) => (
                        <li key={entry.category}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="capitalize text-slate-200">
                              {entry.category}
                            </span>
                            <span className="text-slate-400">
                              {entry.count} · {Math.round(entry.share * 100)} %
                            </span>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={`Errores de ${entry.category}`}
                            aria-valuenow={Math.round(entry.share * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                          >
                            <div
                              className="h-full rounded-full bg-rose-400/70"
                              style={{ width: `${entry.share * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={CARD_CLASSES}>
                    <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Conceptos
                    </h3>
                    {errors.byConcept.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-400">
                        La API todavía no asocia estos errores a un concepto.
                      </p>
                    ) : (
                      <ul className="mt-3 list-none space-y-2 p-0 text-sm">
                        {errors.byConcept.map((entry) => (
                          <li
                            key={entry.conceptSlug}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-slate-200">{entry.conceptName}</span>
                            <span className="text-slate-400">
                              {countLabel(entry.count, "fallo", "fallos")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
          <p className="text-sm font-medium text-slate-200">
            Todavía no hay actividad en este periodo.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Cuando envíes ejercicios o repases tarjetas aparecerán aquí tu avance
            por etapa, tus competencias y los errores que más repites.
          </p>
        </div>
      )}
    </div>
  );
}

