"use client";

import type { PortfolioResponse } from "@codeai/shared";
import { useCallback } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { portfolioApi } from "@/lib/api-client";

const CARD_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-5";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

type LoadPortfolio = (signal: AbortSignal) => Promise<PortfolioResponse>;

interface PublicPortfolioProps {
  /** Sin `userId` se sirve el portafolio propio, con las entregas privadas. */
  readonly userId?: string;
  /** Inyectable en pruebas; por defecto llama a `/api/portfolio`. */
  readonly loadPortfolio?: LoadPortfolio;
}

function formatScore(score: number | null): string {
  return score === null ? "Pendiente de revisión" : `${score.toFixed(2)} / 100`;
}

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

/**
 * Portafolio público y propio (`contratos-api.md` §4.11).
 *
 * El modo público es la vista que se comparte con un reclutador: no muestra
 * correo, entregas privadas ni la nota de lo no revisado. El modo propio añade
 * las privadas, porque es el mismo usuario quien las consulta.
 */
export function PublicPortfolio({
  userId,
  loadPortfolio,
}: PublicPortfolioProps) {
  const isOwnerView = userId === undefined;
  const load = useCallback(
    (signal: AbortSignal) =>
      loadPortfolio
        ? loadPortfolio(signal)
        : userId
          ? portfolioApi.get(userId, signal)
          : portfolioApi.getMine(signal),
    [loadPortfolio, userId],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando el portafolio…
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
          No pudimos cargar el portafolio. Comprueba tu conexión y vuelve a
          intentarlo.
        </p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const { user, entries, publicCount } = state.data;

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {isOwnerView ? "Tu portafolio" : "Portafolio público"}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {isOwnerView ? "Mi portafolio" : `${user.name} · Portafolio`}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          {isOwnerView
            ? "Aquí ves todas tus entregas. Sólo las que publicas aparecen en tu enlace público, y puedes retirarlas cuando quieras."
            : `Proyectos que ${user.name} publicó de forma explícita. Las entregas privadas no se muestran.`}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Entregas públicas incluidas: {publicCount}
        </p>
      </header>

      {entries.length === 0 ? (
        <div className={CARD_CLASSES}>
          <p className="text-sm font-medium text-slate-200">
            {isOwnerView
              ? "Todavía no has entregado ningún proyecto."
              : "Este portafolio aún no tiene entregas públicas."}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {isOwnerView
              ? "Cuando entregues un proyecto y lo publiques, aparecerá aquí."
              : "El autor decide qué entregas comparte: vuelve más adelante."}
          </p>
        </div>
      ) : (
        <ol className="grid list-none gap-4 p-0 sm:grid-cols-2">
          {entries.map((entry) => {
            const published = formatDate(entry.publishedAt);

            return (
              <li key={entry.id} className={CARD_CLASSES}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
                  Etapa E{entry.stageId}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  {entry.projectTitle}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {formatScore(entry.score)}
                  {published ? ` · Publicada el ${published}` : ""}
                </p>

                {entry.feedback ? (
                  <p className="mt-3 text-sm text-slate-300">
                    Retroalimentación: {entry.feedback}
                  </p>
                ) : null}

                <p className="mt-3 flex flex-wrap gap-4 text-sm">
                  <a
                    href={entry.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    Repositorio
                  </a>
                  {entry.deployUrl ? (
                    <a
                      href={entry.deployUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      Despliegue
                    </a>
                  ) : null}
                </p>

                {!entry.isPublic && isOwnerView ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Privada: no aparece en tu enlace público.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
