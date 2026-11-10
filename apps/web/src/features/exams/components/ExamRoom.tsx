"use client";

import type {
  ExamAttempt,
  ExamAttemptItem,
  ExamResult,
  QuizSubmissionInput,
  UpdateExamItemInput,
} from "@codeai/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError, examsApi } from "@/lib/api-client";

import { ExamAnswerInput } from "./ExamAnswerInput";
import { ExamNavigator } from "./ExamNavigator";
import { ExamTimer } from "./ExamTimer";

/**
 * Sala de examen (S15, T9d).
 *
 * Una pregunta a la vez, con su cronómetro y su cuadrícula. La sala **solo
 * captura**: cada respuesta o marca se guarda con `PUT /items/:position` y no hay
 * corrección hasta entregar. El tiempo lo manda el servidor (§4.0, regla 3): el
 * reloj muestra `remainingSeconds` y cada respuesta lo resincroniza con el valor
 * que devuelve el `PUT`; cuando se acaba, la sala abre el resultado y **no**
 * llama a `submit`, porque el servidor ya cerró el intento al leerlo.
 */

const BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const GHOST_BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:border-line/60 disabled:text-slate-500";

const ALERT_CLASSES =
  "rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200";

const TIME_UP_MESSAGE = "Se acabó el tiempo: tu simulacro se entregó";

const SAVE_ERROR_MESSAGE =
  "No pudimos guardar tu respuesta. Tu respuesta sigue en pantalla: vuelve a intentarlo.";

const SUBMIT_ERROR_MESSAGE = "No pudimos entregar el simulacro.";

/** El mismo destino que usará el informe de la T10. */
function resultPath(attemptId: string): string {
  return `/learn/exams/attempts/${attemptId}/result`;
}

/**
 * Un `409` al guardar significa que el intento ya no está en curso: el plazo
 * venció y el servidor lo cerró, así que la sala muestra el aviso y abre el
 * resultado en lugar de reintentar o entregar.
 */
function isTimeUp(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === 409;
}

/** Lo mínimo que la sala necesita del cliente: el resto de `examsApi` sobra aquí. */
export interface ExamRoomApi {
  readonly get: (attemptId: string) => Promise<ExamAttempt>;
  readonly updateItem: (
    attemptId: string,
    position: number,
    body: UpdateExamItemInput,
  ) => Promise<{ readonly item: ExamAttemptItem; readonly remainingSeconds: number }>;
  readonly submit: (attemptId: string) => Promise<ExamResult>;
}

export interface ExamRoomProps {
  readonly attemptId: string;
  readonly api?: ExamRoomApi;
}

export function ExamRoom({ attemptId, api = examsApi }: ExamRoomProps) {
  const load = useMemo(
    () => (): Promise<ExamAttempt> => api.get(attemptId),
    [api, attemptId],
  );
  const request = useContentLoader(load);
  const state = request.state;

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando el simulacro…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className={`${ALERT_CLASSES} space-y-3`}>
        <p>No pudimos cargar el simulacro.</p>
        <button type="button" onClick={() => request.reload()} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  if (state.data.status !== "in-progress") {
    return <ExamResultRedirect attemptId={attemptId} />;
  }

  return (
    <ExamRoomBody
      key={state.data.id}
      attemptId={attemptId}
      initial={state.data}
      api={api}
    />
  );
}

/**
 * Un intento que ya no está en curso no se reanuda: se abre su resultado. La
 * navegación va en un efecto porque es el único sitio donde `useRouter` puede
 * usarse sin tocar el render.
 */
function ExamResultRedirect({ attemptId }: { readonly attemptId: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(resultPath(attemptId));
  }, [attemptId, router]);

  return (
    <p role="status" aria-live="polite" className="text-sm text-slate-400">
      El simulacro ya está entregado. Abriendo el resultado…
    </p>
  );
}

interface FailedSave {
  readonly position: number;
  readonly body: UpdateExamItemInput;
}

interface ExamRoomBodyProps {
  readonly attemptId: string;
  readonly initial: ExamAttempt;
  readonly api: ExamRoomApi;
}

type ExamView = "exam" | "review";

/** Aplica localmente un cambio antes de que responda el servidor. */
function mergeItem(item: ExamAttemptItem, body: UpdateExamItemInput): ExamAttemptItem {
  return {
    ...item,
    answer: body.answer === undefined ? item.answer : body.answer,
    flagged: body.flagged ?? item.flagged,
  };
}

function ExamRoomBody({ attemptId, initial, api }: ExamRoomBodyProps) {
  const router = useRouter();
  const [items, setItems] = useState<readonly ExamAttemptItem[]>(initial.items);
  const [current, setCurrent] = useState(initial.items[0]?.position ?? 1);
  const [remainingSeconds, setRemainingSeconds] = useState(initial.remainingSeconds);
  const [view, setView] = useState<ExamView>("exam");
  const [confirming, setConfirming] = useState(false);
  const [failedSave, setFailedSave] = useState<FailedSave | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const saveSequences = useRef(new Map<number, number>());
  const submitStarted = useRef(false);

  const handleElapsed = useCallback(() => {
    setTimeUp(true);
  }, []);

  useEffect(() => {
    if (!timeUp) {
      return;
    }

    router.replace(resultPath(attemptId));
  }, [attemptId, router, timeUp]);

  // Mientras el intento está en curso, cerrar la pestaña puede costar el examen:
  // el navegador pide confirmación y el intento sigue vivo del lado del servidor.
  useEffect(() => {
    if (timeUp) {
      return;
    }

    function warnBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [timeUp]);

  const question = items.find((item) => item.position === current);
  const unanswered = items.filter((item) => item.answer === null);
  const flagged = items.filter((item) => item.flagged);

  /**
   * Guarda un cambio dejando que gane la última llamada de cada pregunta: si dos
   * `PUT` se cruzan, la respuesta más reciente es la que puede pisar la pantalla.
   * La respuesta local se aplica antes de esperar a la red, así que un fallo no la
   * pierde: sigue visible y el aviso ofrece reintentar.
   */
  async function save(position: number, body: UpdateExamItemInput): Promise<void> {
    const sequence = (saveSequences.current.get(position) ?? 0) + 1;
    saveSequences.current.set(position, sequence);
    setFailedSave(null);
    setItems((previous) =>
      previous.map((item) => (item.position === position ? mergeItem(item, body) : item)),
    );

    try {
      const response = await api.updateItem(attemptId, position, body);

      if (saveSequences.current.get(position) !== sequence) {
        return;
      }

      setItems((previous) =>
        previous.map((item) =>
          item.position === response.item.position ? response.item : item,
        ),
      );
      setRemainingSeconds(response.remainingSeconds);
    } catch (cause: unknown) {
      if (isTimeUp(cause)) {
        setTimeUp(true);
        return;
      }

      if (saveSequences.current.get(position) === sequence) {
        setFailedSave({ position, body });
      }
    }
  }

  async function handleSubmit(): Promise<void> {
    if (submitStarted.current) {
      return;
    }

    submitStarted.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      await api.submit(attemptId);
      router.replace(resultPath(attemptId));
    } catch (cause: unknown) {
      submitStarted.current = false;
      setSubmitting(false);

      if (isTimeUp(cause)) {
        setTimeUp(true);
        return;
      }

      setSubmitError(cause instanceof Error ? cause.message : SUBMIT_ERROR_MESSAGE);
    }
  }

  function openQuestion(position: number): void {
    setCurrent(position);
    setView("exam");
    setConfirming(false);
  }

  if (timeUp) {
    return (
      <div role="alert" className={`${ALERT_CLASSES} space-y-2`}>
        <p>{TIME_UP_MESSAGE}</p>
        <p className="text-slate-300">Abriendo el resultado…</p>
      </div>
    );
  }

  if (question === undefined) {
    return (
      <div role="alert" className={ALERT_CLASSES}>
        <p>Este simulacro no tiene preguntas para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Simulacro · {initial.certification}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {view === "review" ? "Revisar y entregar" : "Sala de examen"}
        </h1>
        <ExamTimer remainingSeconds={remainingSeconds} onElapsed={handleElapsed} />
      </header>

      {failedSave === null ? null : (
        <div role="alert" className={`${ALERT_CLASSES} space-y-3`}>
          <p>{SAVE_ERROR_MESSAGE}</p>
          <button
            type="button"
            onClick={() => void save(failedSave.position, failedSave.body)}
            className={GHOST_BUTTON_CLASSES}
          >
            Reintentar guardado
          </button>
        </div>
      )}

      {submitError === null ? null : (
        <div role="alert" className={ALERT_CLASSES}>
          <p>{submitError}</p>
        </div>
      )}

      {view === "review" ? (
        <div className="space-y-6">
          <p className="text-sm text-slate-400">
            {unanswered.length} sin responder · {flagged.length} marcadas
          </p>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Sin responder</h2>
            {unanswered.length === 0 ? (
              <p className="text-sm text-slate-400">
                No queda ninguna pregunta sin responder.
              </p>
            ) : (
              <ul
                aria-label="Preguntas sin responder"
                className="flex list-none flex-wrap gap-2 p-0"
              >
                {unanswered.map((item) => (
                  <li key={item.position}>
                    <button
                      type="button"
                      onClick={() => openQuestion(item.position)}
                      className={GHOST_BUTTON_CLASSES}
                    >
                      Pregunta {item.position}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Marcadas</h2>
            {flagged.length === 0 ? (
              <p className="text-sm text-slate-400">No has marcado ninguna pregunta.</p>
            ) : (
              <ul
                aria-label="Preguntas marcadas"
                className="flex list-none flex-wrap gap-2 p-0"
              >
                {flagged.map((item) => (
                  <li key={item.position}>
                    <button
                      type="button"
                      onClick={() => openQuestion(item.position)}
                      className={GHOST_BUTTON_CLASSES}
                    >
                      Pregunta {item.position}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {confirming ? (
            <div className="space-y-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
              <p>{confirmMessage(unanswered.length)}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className={BUTTON_CLASSES}
                >
                  {submitting ? "Entregando…" : "Sí, entregar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                  className={GHOST_BUTTON_CLASSES}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={BUTTON_CLASSES}
            >
              Entregar simulacro
            </button>
          )}

          <button
            type="button"
            onClick={() => setView("exam")}
            className="text-sm font-medium text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Volver al simulacro
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-slate-400">
            Pregunta {question.position} de {items.length}
          </p>

          <ExamAnswerInput
            config={question.config}
            statement={question.statement}
            value={question.answer}
            onChange={(next: QuizSubmissionInput | null) =>
              void save(question.position, { answer: next })
            }
            disabled={submitting}
          />

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={question.flagged}
              onChange={(event) =>
                void save(question.position, { flagged: event.target.checked })
              }
              disabled={submitting}
              className="h-4 w-4"
            />
            Marcar para revisar
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrent(question.position - 1)}
              disabled={question.position <= 1}
              className={GHOST_BUTTON_CLASSES}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setCurrent(question.position + 1)}
              disabled={question.position >= items.length}
              className={GHOST_BUTTON_CLASSES}
            >
              Siguiente
            </button>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Preguntas</h2>
            <ExamNavigator
              items={items}
              current={question.position}
              onSelect={openQuestion}
            />
          </section>

          <button type="button" onClick={() => setView("review")} className={BUTTON_CLASSES}>
            Revisar y entregar
          </button>
        </div>
      )}
    </div>
  );
}

/** La confirmación dice cuántas preguntas quedan sin responder. */
function confirmMessage(unanswered: number): string {
  if (unanswered === 0) {
    return "No queda ninguna pregunta sin responder. ¿Entregar el simulacro?";
  }

  if (unanswered === 1) {
    return "Queda 1 pregunta sin responder. ¿Entregar el simulacro?";
  }

  return `Quedan ${unanswered} preguntas sin responder. ¿Entregar el simulacro?`;
}

