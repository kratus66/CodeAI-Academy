"use client";

import type { LessonContentBlock, LessonDetail } from "@codeai/shared";
import Link from "next/link";
import { useCallback } from "react";

import { TutorPanel } from "@/features/ai/components/TutorPanel";
import { formatMinutes } from "@/features/learning/lib/format";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError, contentApi } from "@/lib/api-client";

const LINK_CLASSES =
  "font-medium text-accent underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Nombre legible de cada paso de la microestructura (plantilla-leccion.md). */
const STEP_LABELS: Record<LessonDetail["steps"][number]["kind"], string> = {
  objective: "Objetivo",
  explanation: "Explicación",
  guided_practice: "Práctica guiada",
  independent_practice: "Práctica autónoma",
  debug: "Depuración",
  assessment: "Evaluación",
  transfer: "Transferencia",
};

type LoadLesson = (slug: string, signal?: AbortSignal) => Promise<LessonDetail>;

interface LessonReaderProps {
  readonly slug: string;
  /** Inyectable en pruebas; por defecto llama a `GET /api/content/lessons/:slug`. */
  readonly loadLesson?: LoadLesson;
}

/** Una URL mal formada y una lección inexistente son el mismo caso para el estudiante. */
function isMissingContent(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 404 || error.status === 400)
  );
}

function BlockTitle({ children }: { readonly children: string }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </h3>
  );
}

/**
 * Un bloque de contenido tal como llega de la API. Los tipos son los del
 * contrato (`LESSON_CONTENT_BLOCK_TYPES`); un bloque sin carga útil no pinta nada.
 */
function ContentBlock({ block }: { readonly block: LessonContentBlock }) {
  switch (block.type) {
    case "paragraph":
      return (
        <div className="space-y-2">
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <p className="text-base leading-relaxed text-slate-300">
            {block.text}
          </p>
        </div>
      );

    case "list":
      return (
        <div className="space-y-2">
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <ul className="list-disc space-y-1 pl-5 text-base leading-relaxed text-slate-300">
            {(block.items ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );

    case "code":
      return (
        <figure className="space-y-2">
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <div className="overflow-x-auto rounded-xl border border-line/70 bg-ink-card">
            {block.language ? (
              <p className="border-b border-line/70 px-4 py-2 font-mono text-xs text-slate-500">
                {block.language}
              </p>
            ) : null}
            <pre className="px-4 py-3 text-sm text-slate-200">
              <code>{block.code}</code>
            </pre>
          </div>
        </figure>
      );

    case "callout":
      return (
        <aside className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          {block.title ? (
            <p className="text-sm font-semibold text-accent">{block.title}</p>
          ) : null}
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            {block.text}
          </p>
        </aside>
      );

    case "diagram":
      return (
        <figure className="space-y-2">
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <p className="whitespace-pre overflow-x-auto rounded-xl border border-line/70 bg-ink-card px-4 py-3 font-mono text-xs text-slate-300">
            {block.text}
          </p>
        </figure>
      );

    case "table":
      return (
        <div className="space-y-2">
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <ul className="list-none space-y-1 rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3 p-0 font-mono text-xs text-slate-300">
            {(block.items ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );
  }
}

/** Lección publicada: bloques de contenido, los 7 pasos y recursos verificados. */
export function LessonReader({
  slug,
  loadLesson = contentApi.getLesson,
}: LessonReaderProps) {
  const load = useCallback(
    (signal: AbortSignal) => loadLesson(slug, signal),
    [loadLesson, slug],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando la lección…
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
            No encontramos esta lección.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Puede que aún no esté publicada o que el enlace esté mal formado.
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
        <p>No pudimos cargar la lección. Inténtalo de nuevo en unos segundos.</p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const lesson = state.data;
  const duration = formatMinutes(lesson.estimatedMin);

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
          <Link
            href={`/learn/units/${lesson.unitCode}`}
            className={LINK_CLASSES}
          >
            Unidad {lesson.unitCode}
          </Link>
        </nav>

        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Lección {lesson.order}
          {duration ? ` · ${duration}` : null}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {lesson.title}
        </h1>
      </header>

      <section
        aria-labelledby="contenido"
        className="space-y-6 border-t border-line/70 pt-8"
      >
        <h2
          id="contenido"
          className="text-lg font-semibold tracking-tight text-white"
        >
          Contenido
        </h2>
        {lesson.content.map((block, index) => (
          <ContentBlock key={`${block.type}-${index}`} block={block} />
        ))}
      </section>

      <section
        aria-labelledby="pasos"
        className="space-y-4 border-t border-line/70 pt-8"
      >
        <h2
          id="pasos"
          className="text-lg font-semibold tracking-tight text-white"
        >
          Los 7 pasos
        </h2>
        <ol className="grid list-none gap-4 p-0">
          {lesson.steps.map((step, index) => (
            <li
              key={step.kind}
              className="rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3"
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
                <span aria-hidden>{index + 1}. </span>
                {STEP_LABELS[step.kind]}
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="recursos"
        className="space-y-4 border-t border-line/70 pt-8"
      >
        <h2
          id="recursos"
          className="text-lg font-semibold tracking-tight text-white"
        >
          Recursos
        </h2>
        {lesson.resources.length === 0 ? (
          <p className="text-sm text-slate-400">
            Esta lección no tiene recursos verificados todavía.
          </p>
        ) : (
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
            {lesson.resources.map((entry) => (
              <li
                key={entry.resource.id}
                className="rounded-xl border border-line/70 bg-ink-card/40 px-4 py-3"
              >
                <a
                  href={entry.resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASSES}
                >
                  {entry.resource.title}
                </a>
                <p className="mt-1 text-xs text-slate-500">
                  <span>{entry.resource.provider}</span>
                  <span aria-hidden> · </span>
                  <span>{entry.resource.type}</span>
                </p>
                {entry.note ? (
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {entry.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <TutorPanel lessonId={lesson.id} />

      <footer className="border-t border-line/70 pt-8">
        <Link
          href={`/learn/units/${lesson.unitCode}`}
          className={LINK_CLASSES}
        >
          <span aria-hidden>←</span> Volver a la unidad {lesson.unitCode}
        </Link>
      </footer>
    </article>
  );
}

