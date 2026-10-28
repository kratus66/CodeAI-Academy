"use client";

import Link from "next/link";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { projectsApi } from "@/lib/api-client";
import type { ProjectCatalogPage } from "@/lib/api-client";

const CARD_CLASSES =
  "group flex h-full flex-col rounded-2xl border border-line/70 bg-ink-card/50 p-6 transition hover:border-accent/50 hover:bg-ink-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BADGE_CLASSES =
  "inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200";

type LoadProjects = (signal: AbortSignal) => Promise<ProjectCatalogPage>;

interface ProjectCatalogProps {
  /** Inyectable en pruebas; por defecto llama a `GET /api/projects`. */
  readonly loadProjects?: LoadProjects;
}

/** El catálogo de proyectos es corto: una página basta y evita paginar en la web. */
const defaultLoadProjects: LoadProjects = (signal) =>
  projectsApi.list({ pageSize: 50 }, signal);

function requirementCountLabel(count: number): string {
  return count === 1 ? "1 requisito" : `${count} requisitos`;
}

/**
 * Catálogo de proyectos publicados (`contratos-api.md` §4.11) con estados de
 * carga, error, vacío y la marca `submitted` del usuario autenticado.
 */
export function ProjectCatalog({
  loadProjects = defaultLoadProjects,
}: ProjectCatalogProps) {
  const { state, reload } = useContentLoader(loadProjects);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando los proyectos…
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
          No pudimos cargar los proyectos. Comprueba tu conexión y vuelve a
          intentarlo.
        </p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  if (state.data.projects.length === 0) {
    return (
      <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
        <p className="text-sm font-medium text-slate-200">
          Todavía no hay proyectos publicados.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Cada etapa termina en un proyecto evaluable: vuelve pronto.
        </p>
      </div>
    );
  }

  return (
    <ol className="grid list-none gap-4 p-0 sm:grid-cols-2">
      {state.data.projects.map((project) => (
        <li key={project.id}>
          <Link href={`/learn/projects/${project.slug}`} className={CARD_CLASSES}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              Etapa E{project.stageId}
            </p>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-white transition group-hover:text-accent">
              {project.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
              {project.brief}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{requirementCountLabel(project.requirements.length)}</span>
              {project.submitted ? (
                <span className={BADGE_CLASSES}>Entregado</span>
              ) : (
                <span>Sin entregar</span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
