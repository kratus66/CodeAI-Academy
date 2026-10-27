"use client";

import type {
  ReviewAnswerInput,
  ReviewAnswerResult,
  ReviewQueueItem,
  ReviewQueueResponse,
} from "@codeai/shared";
import { useCallback, useMemo, useState } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError, reviewApi } from "@/lib/api-client";

/**
 * Seis calidades de recuperación (`prerequisitos-y-progreso.md` §5.1). El
 * estudiante elige cómo recordó el ejercicio; el servidor calcula el intervalo.
 */
const QUALITY_OPTIONS = [
  { quality: 0, label: "Sin comprensión" },
  { quality: 1, label: "Error identificado" },
  { quality: 2, label: "Con pistas" },
  { quality: 3, label: "Con esfuerzo" },
  { quality: 4, label: "Con duda menor" },
  { quality: 5, label: "Sin pistas" },
] as const;

const BUTTON_CLASSES =
  "rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

type LoadQueue = (signal?: AbortSignal) => Promise<ReviewQueueResponse>;
type AnswerItem = (
  itemId: string,
  input: ReviewAnswerInput,
) => Promise<ReviewAnswerResult>;

interface ReviewQueueProps {
  /** Inyectables en pruebas; por defecto llaman a `/api/review`. */
  readonly loadQueue?: LoadQueue;
  readonly answerItem?: AnswerItem;
}

function intervalLabel(days: number): string {
  return days === 1 ? "1 día" : `${days} días`;
}

function dueLabel(value: string): string {
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
 * Cola diaria de repaso (`GET /api/review/queue`). Muestra los ítems en el
 * orden intercalado que sirve la API y, al responder, anuncia el próximo
 * intervalo y retira el ítem de la lista. No calcula SM-2 ni reordena nada.
 */
export function ReviewQueue({
  loadQueue = reviewApi.getQueue,
  answerItem = reviewApi.answer,
}: ReviewQueueProps) {
  const { state, reload } = useContentLoader(loadQueue);
  const [answered, setAnswered] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const remaining = useMemo(
    () =>
      state.status === "ready"
        ? state.data.items.filter((item) => !answered.has(item.id))
        : [],
    [answered, state],
  );

  const handleAnswer = useCallback(
    async (item: ReviewQueueItem, quality: number) => {
      setPending(item.id);
      setNotice(null);
      setFailure(null);

      try {
        const result = await answerItem(item.id, { quality });

        setAnswered((current) => new Map(current).set(item.id, result.intervalDays));
        setNotice(
          `«${item.exerciseTitle}» vuelve en ${intervalLabel(result.intervalDays)}.`,
        );
      } catch (error) {
        setFailure(errorMessage(error));
      } finally {
        setPending(null);
      }
    },
    [answerItem],
  );

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando tu cola de repaso…
      </p>
    );
  }

  if (state.status === "error") {
    const signOut = state.error instanceof ApiError && state.error.status === 401;

    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>
          {signOut
            ? "Tu sesión ha caducado: vuelve a iniciar sesión para repasar."
            : "No pudimos cargar tu cola de repaso. Comprueba tu conexión y vuelve a intentarlo."}
        </p>
        {signOut ? null : (
          <button type="button" onClick={reload} className={`${BUTTON_CLASSES} mt-4`}>
            Reintentar
          </button>
        )}
      </div>
    );
  }

  const total = state.data.dueReviews;

  return (
    <section aria-labelledby="cola-repaso" className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cola-repaso" className="text-sm font-medium text-slate-300">
          Cola de repaso
        </h2>
        <p className="text-xs text-slate-500">
          {total === 1 ? "1 repaso pendiente" : `${total} repasos pendientes`} · máx.{" "}
          {state.data.limit}
        </p>
      </header>

      {notice ? (
        <p role="status" aria-live="polite" className="text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      {failure ? (
        <p role="alert" className="text-sm text-rose-300">
          {failure}
        </p>
      ) : null}

      {remaining.length === 0 ? (
        <p className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6 text-sm text-slate-400">
          No tienes repasos pendientes hoy. Vuelve mañana: la cola se llena con tus
          envíos.
        </p>
      ) : (
        <ul className="list-none space-y-3 p-0">
          {remaining.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-line/70 bg-ink-card/40 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{item.exerciseTitle}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Concepto: {item.concept}
                    {item.competencies.length > 0
                      ? ` · ${item.competencies.join(", ")}`
                      : ""}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Vencido el <time dateTime={item.dueAt}>{dueLabel(item.dueAt)}</time>
                </p>
              </div>

              <div
                role="group"
                aria-label={`Calidad de la recuperación de ${item.exerciseTitle}`}
                className="mt-4 flex flex-wrap gap-2"
              >
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.quality}
                    type="button"
                    className={BUTTON_CLASSES}
                    disabled={pending === item.id}
                    aria-label={`Calidad ${option.quality}: ${option.label}`}
                    onClick={() => void handleAnswer(item, option.quality)}
                  >
                    {option.quality} · {option.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "No pudimos guardar tu respuesta. Inténtalo de nuevo.";
}

