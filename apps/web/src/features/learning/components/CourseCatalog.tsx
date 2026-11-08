"use client";

import type { CourseSummary } from "@codeai/shared";
import Link from "next/link";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { contentApi } from "@/lib/api-client";
import type { CourseCatalogPage } from "@/lib/api-client";

const CARD_CLASSES =
  "group flex h-full flex-col rounded-2xl border border-line/70 bg-ink-card/50 p-6 transition hover:border-accent/50 hover:bg-ink-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

type LoadCourses = (signal?: AbortSignal) => Promise<CourseCatalogPage>;

interface CourseCatalogProps {
  /** Inyectable en pruebas; por defecto llama a `GET /api/content/courses`. */
  readonly loadCourses?: LoadCourses;
}

function stageCountLabel(count: number): string {
  return count === 1 ? "1 etapa" : `${count} etapas`;
}

function CourseCard({ course }: { readonly course: CourseSummary }) {
  return (
    <Link
      href={`/learn/stages?course=${course.slug}`}
      aria-label={`Ruta ${course.title}`}
      className={CARD_CLASSES}
    >
      <h3 className="text-lg font-semibold tracking-tight text-white transition group-hover:text-accent">
        {course.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
        {course.objective}
      </p>
      <p className="mt-4 text-xs text-slate-500">
        {stageCountLabel(course.stageCount)}
        <span aria-hidden> →</span>
      </p>
      {course.notice === null ? null : (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {course.notice}
        </p>
      )}
    </Link>
  );
}

/** Catálogo de rutas publicadas con sus estados de carga, error y vacío. */
export function CourseCatalog({
  loadCourses = contentApi.listCourses,
}: CourseCatalogProps) {
  const { state, reload } = useContentLoader(loadCourses);

  if (state.status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid gap-4 sm:grid-cols-2"
      >
        <span className="sr-only">Cargando el catálogo de rutas…</span>
        {[0, 1].map((index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-44 animate-pulse rounded-2xl border border-line/60 bg-ink-card/30"
          />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>
          No pudimos cargar las rutas. Comprueba tu conexión y vuelve a
          intentarlo.
        </p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  if (state.data.courses.length === 0) {
    return (
      <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
        <p className="text-sm font-medium text-slate-200">
          Todavía no hay rutas publicadas.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Las rutas se publican por etapas: vuelve pronto.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
      {state.data.courses.map((course) => (
        <li key={course.slug}>
          <CourseCard course={course} />
        </li>
      ))}
    </ul>
  );
}
