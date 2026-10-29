"use client";

import type { AnalyticsRange, CohortAnalytics } from "@codeai/shared";
import { COHORT_AT_RISK_LIMIT, DEFAULT_ANALYTICS_RANGE } from "@codeai/shared";
import { useCallback, useState } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { analyticsApi } from "@/lib/api-client";

import { RangePicker, rangeLabel } from "./RangePicker";
import { countLabel, percentLabel } from "./format";

const CARD_CLASSES = "glass rounded-2xl p-5";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export type LoadCohort = (
  range: AnalyticsRange,
  signal: AbortSignal,
) => Promise<CohortAnalytics>;

/** Referencia de módulo: el loader del hook debe ser estable entre renders. */
const defaultLoadCohort: LoadCohort = (range, signal) =>
  analyticsApi.getCohort(range, signal);

interface CohortOverviewProps {
  /** Inyectable en pruebas; por defecto `GET /api/analytics/cohort`. */
  readonly loadCohort?: LoadCohort;
}

/**
 * Panel `/instructor/cohort`: agregados de la cohorte y lista de estudiantes en
 * riesgo. Sólo expone el nombre visible que devuelve la API (sin correo ni
 * transcripciones) y el rol se vuelve a comprobar en el servidor.
 */
export function CohortOverview({ loadCohort = defaultLoadCohort }: CohortOverviewProps) {
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_ANALYTICS_RANGE);
  const load = useCallback(
    (signal: AbortSignal) => loadCohort(range, signal),
    [loadCohort, range],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <RangePicker value={range} onChange={setRange} />
        <p role="status" aria-live="polite" className="text-sm text-slate-400">
          Cargando la cohorte…
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
            No pudimos cargar la cohorte. Si tu cuenta no es de instructor, la
            API responde 403.
          </p>
          <button type="button" onClick={reload} className={BUTTON_CLASSES}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const cohort = state.data;
  const hasStudents = cohort.students.total > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePicker value={range} onChange={setRange} />
        <p className="text-xs text-slate-500">Periodo: {rangeLabel(range)}</p>
      </div>

      <section aria-label="Resumen de la cohorte" className="space-y-3">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Estudiantes activos",
              value: `${cohort.students.active}/${cohort.students.total}`,
              note: "Con envíos o repasos en el periodo",
            },
            {
              label: "Avance medio",
              value: percentLabel(cohort.avgOverallPct),
              note: "Media de las unidades publicadas",
            },
            {
              label: "Repasos pendientes",
              value: String(cohort.reviewBacklog),
              note: "Tarjetas vencidas en la cohorte",
            },
            {
              label: "En riesgo",
              value: String(cohort.atRisk.length),
              note: `Máximo de ${COHORT_AT_RISK_LIMIT} estudiantes por panel`,
            },
          ].map((kpi) => (
            <div key={kpi.label} className={CARD_CLASSES}>
              <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
                {kpi.label}
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-white">{kpi.value}</dd>
              <dd className="mt-1 text-xs text-slate-400">{kpi.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {hasStudents ? (
        <>
          <section aria-labelledby="cohorte-etapas" className="space-y-3">
            <h2 id="cohorte-etapas" className="text-sm font-medium text-slate-300">
              Cumplimiento por etapa
            </h2>
            {cohort.stageCompletion.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aún no hay etapas con avance registrado en la cohorte.
              </p>
            ) : (
              <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
                {cohort.stageCompletion.map((entry) => (
                  <li key={entry.stage} className={CARD_CLASSES}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-white">{entry.stage}</span>
                      <span className="text-slate-400">
                        {percentLabel(entry.completedPct)} ·{" "}
                        {countLabel(entry.studentsAtStage, "estudiante", "estudiantes")}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Cumplimiento de la etapa ${entry.stage}`}
                      aria-valuenow={entry.completedPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-piece-i via-accent to-piece-t"
                        style={{ width: `${entry.completedPct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="cohorte-errores" className="space-y-3">
            <h2 id="cohorte-errores" className="text-sm font-medium text-slate-300">
              Errores más frecuentes
            </h2>
            {cohort.topErrors.length === 0 ? (
              <p className="text-sm text-slate-400">
                Sin errores clasificados en el periodo.
              </p>
            ) : (
              <div className={CARD_CLASSES}>
                <ul className="list-none space-y-3 p-0">
                  {cohort.topErrors.map((entry) => (
                    <li key={entry.category}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="capitalize text-slate-200">
                          {entry.category}
                        </span>
                        <span className="text-slate-400">
                          {countLabel(entry.count, "fallo", "fallos")} ·{" "}
                          {Math.round(entry.share * 100)} %
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
            )}
          </section>


          <section aria-labelledby="cohorte-riesgo" className="space-y-3">
            <h2 id="cohorte-riesgo" className="text-sm font-medium text-slate-300">
              Estudiantes en riesgo
            </h2>
            {cohort.atRisk.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nadie en riesgo con este periodo: todos han tenido actividad
                reciente.
              </p>
            ) : (
              <div className={CARD_CLASSES}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">
                      Estudiantes con menos avance o más días sin actividad
                    </caption>
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                        <th scope="col" className="pb-2 pr-4 font-medium">
                          Estudiante
                        </th>
                        <th scope="col" className="pb-2 pr-4 font-medium">
                          Avance
                        </th>
                        <th scope="col" className="pb-2 font-medium">
                          Sin actividad
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohort.atRisk.map((student) => (
                        <tr key={student.userId} className="border-t border-white/5">
                          <th
                            scope="row"
                            className="py-2 pr-4 text-left font-medium text-slate-200"
                          >
                            {student.displayName}
                          </th>
                          <td className="py-2 pr-4 text-slate-400">
                            {percentLabel(student.overallPct)}
                          </td>
                          <td className="py-2 text-slate-400">
                            {countLabel(student.daysSinceActivity, "día", "días")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  El panel no incluye correo, contraseña ni transcripciones: sólo
                  el nombre visible y los agregados que necesita el instructor.
                </p>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
          <p className="text-sm font-medium text-slate-200">
            Todavía no hay estudiantes en la cohorte.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Los agregados aparecerán cuando haya cuentas de estudiante con
            actividad registrada.
          </p>
        </div>
      )}
    </div>
  );
}

