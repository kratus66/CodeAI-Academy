"use client";

import Link from "next/link";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { interviewsApi } from "@/lib/api-client";
import type { InterviewCatalogPage } from "@/lib/api-client";

const CARD_CLASSES =
  "group flex h-full flex-col rounded-2xl border border-line/70 bg-ink-card/50 p-6 transition hover:border-accent/50 hover:bg-ink-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BADGE_CLASSES =
  "inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200";

const ROLE_LABELS: Record<string, string> = {
  backend: "Backend",
  frontend: "Frontend",
  fullstack: "Fullstack",
  data: "Datos",
  qa: "QA",
};

const LEVEL_LABELS: Record<string, string> = {
  junior: "Junior",
  "semi-senior": "Semi-senior",
  senior: "Senior",
};

const LANGUAGE_LABELS: Record<string, string> = {
  ts: "TypeScript",
  py: "Python",
  java: "Java",
  go: "Go",
};

type LoadScenarios = (signal: AbortSignal) => Promise<InterviewCatalogPage>;

interface ScenarioCatalogProps {
  /** Inyectable en pruebas; por defecto llama a `GET /api/interviews/scenarios`. */
  readonly loadScenarios?: LoadScenarios;
}

/** El catálogo es corto: una página basta y evita paginar en la web. */
const defaultLoadScenarios: LoadScenarios = (signal) =>
  interviewsApi.list({ pageSize: 50 }, signal);

function attemptsLabel(attempts: number): string {
  if (attempts === 0) return "Sin intentos";
  return attempts === 1 ? "1 intento" : `${attempts} intentos`;
}

/**
 * Catálogo de entrevistas publicadas (`contratos-api.md` §4.12) con estados de
 * carga, error, vacío y los intentos del usuario autenticado.
 */
export function ScenarioCatalog({
  loadScenarios = defaultLoadScenarios,
}: ScenarioCatalogProps) {
  const { state, reload } = useContentLoader(loadScenarios);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando las entrevistas…
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
          No pudimos cargar las entrevistas. Comprueba tu conexión y vuelve a
          intentarlo.
        </p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  if (state.data.scenarios.length === 0) {
    return (
      <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
        <p className="text-sm font-medium text-slate-200">
          Todavía no hay entrevistas publicadas.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Cada escenario entrena una entrevista técnica completa: vuelve pronto.
        </p>
      </div>
    );
  }

  return (
    <ol className="grid list-none gap-4 p-0 sm:grid-cols-2">
      {state.data.scenarios.map((scenario) => (
        <li key={scenario.slug}>
          <Link
            href={`/learn/interviews/${scenario.slug}`}
            className={CARD_CLASSES}
          >
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              {ROLE_LABELS[scenario.role] ?? scenario.role} ·{" "}
              {LEVEL_LABELS[scenario.level] ?? scenario.level}
            </p>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-white transition group-hover:text-accent">
              {scenario.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
              {scenario.phaseCount} fases · {scenario.estimatedMinutes} min ·{" "}
              {LANGUAGE_LABELS[scenario.language] ?? scenario.language}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{scenario.competencies.join(" · ")}</span>
              {scenario.attempts > 0 ? (
                <span className={BADGE_CLASSES}>
                  {attemptsLabel(scenario.attempts)}
                </span>
              ) : (
                <span>{attemptsLabel(scenario.attempts)}</span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
