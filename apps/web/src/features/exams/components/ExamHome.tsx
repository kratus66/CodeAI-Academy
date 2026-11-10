"use client";

import {
  CERTIFICATION_REGISTRY,
  EXAM_EXTRA_TIME_MIN,
  EXAM_MODES,
} from "@codeai/shared";
import type {
  CertificationCode,
  ExamAttempt,
  ExamAttemptStatus,
  ExamHistoryItem,
  ExamMode,
  StartExamAttemptInput,
} from "@codeai/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import type { ContentState } from "@/features/learning/lib/use-content-loader";
import { ApiError, examsApi } from "@/lib/api-client";

import { ReadinessPanel } from "./ReadinessPanel";

/**
 * Página de una certificación (S15, T11a): el formato oficial, los modos de
 * simulacro y el historial de intentos.
 *
 * Cada persona tiene un intento en curso como máximo por certificación
 * (decisión f), así que un `409` de «en curso» no se reintenta: se ofrece el que
 * ya está abierto. En beta (decisión i) no hay simulacro y los modos se
 * deshabilitan con la explicación, sin esperar al `409` del servidor.
 */

const BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const GHOST_BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const CARD_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-200";

const ALERT_CLASSES =
  "rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200";

const WARNING_CLASSES =
  "rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200";

const RADIO_CLASSES =
  "flex cursor-pointer items-center gap-2 rounded-full border border-line/70 bg-ink-card/40 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30";

const SELECT_CLASSES =
  "w-full rounded-xl border border-line/70 bg-ink px-3 py-2 text-sm text-slate-100";

const LABEL_CLASSES = "text-xs font-medium uppercase tracking-[0.15em] text-slate-500";

const LINK_CLASSES = "inline-flex text-sm font-medium text-accent transition hover:text-white";

const BADGE_CLASSES =
  "ml-2 rounded-full border border-amber-400/40 px-2 py-0.5 text-xs text-amber-200";

/** Nombre de cada modo en la interfaz; las formas fijas se anuncian por su letra. */
const MODE_LABELS: Readonly<Record<ExamMode, string>> = {
  "form-a": "Forma A",
  "form-b": "Forma B",
  "form-c": "Forma C",
  random: "Aleatorio",
  domain: "Bloque por dominio",
};

const STATUS_LABELS: Readonly<Record<ExamAttemptStatus, string>> = {
  "in-progress": "En curso",
  submitted: "Entregado",
  expired: "Vencido",
};

/** Los mismos textos que el servicio: un `409` se reconoce por su mensaje. */
const IN_PROGRESS_MESSAGE = "Ya tienes un simulacro en curso de esta certificación";

const BETA_MESSAGE =
  "Esta certificación está en beta: el simulacro llegará con la guía definitiva";

const CONTINUE_LABEL = "Continuar el simulacro en curso";

const EXTRA_TIME_LABEL = `+${EXAM_EXTRA_TIME_MIN} minutos (adaptación por idioma)`;

const MODE_FIELD_LABEL = "Modo del simulacro";

const DOMAIN_FIELD_LABEL = "Dominio del bloque";

const DOMAIN_PLACEHOLDER = "Elige un dominio";

const DOMAIN_REQUIRED_MESSAGE = "Elige un dominio para el bloque por dominio.";

const START_LABEL = "Iniciar el simulacro";

const STARTING_LABEL = "Iniciando…";

const START_ERROR_MESSAGE = "No pudimos iniciar el simulacro.";

const HISTORY_TITLE = "Tu historial";

const HISTORY_TABLE_LABEL = "Historial de simulacros";

const HISTORY_LOADING_MESSAGE = "Cargando tu historial…";

const HISTORY_ERROR_MESSAGE = "No pudimos cargar tu historial.";

const EMPTY_HISTORY_MESSAGE =
  "Todavía no hiciste ningún simulacro de esta certificación.";

const ORIENTATIVE_LABEL = "orientativo";

const NO_SCORE_LABEL = "—";

const ENTER_ROOM_LABEL = "Entrar en la sala";

const RESULT_LABEL = "Ver el resultado";

const RETRY_LABEL = "Reintentar";

/** La sala del intento, que a su vez enlaza al informe al entregar. */
function roomPath(attemptId: string): string {
  return `/learn/exams/attempts/${attemptId}`;
}

function resultPath(attemptId: string): string {
  return `${roomPath(attemptId)}/result`;
}

function formatDate(value: string): string {
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
 * Un `409` con este mensaje significa que ya hay un intento abierto: el resto de
 * `409` (beta, forma que no existe, banco insuficiente) se muestran tal cual.
 */
function isInProgressConflict(cause: unknown): boolean {
  return (
    cause instanceof ApiError &&
    cause.status === 409 &&
    cause.message === IN_PROGRESS_MESSAGE
  );
}

/** Lo mínimo que la página necesita del cliente: iniciar y leer el historial. */
export interface ExamHomeApi {
  readonly start: (
    certification: string,
    input: StartExamAttemptInput,
  ) => Promise<ExamAttempt>;
  readonly history: (certification: string) => Promise<ExamHistoryItem[]>;
}

export interface ExamHomeProps {
  readonly certification: CertificationCode;
  readonly api?: ExamHomeApi;
}

export function ExamHome({ certification, api = examsApi }: ExamHomeProps) {
  const definition = CERTIFICATION_REGISTRY[certification];
  const isBeta = definition.status === "beta";
  const load = useMemo(
    () => (): Promise<ExamHistoryItem[]> => api.history(certification),
    [api, certification],
  );
  const request = useContentLoader(load);
  const state = request.state;
  const router = useRouter();
  const [mode, setMode] = useState<ExamMode>("form-a");
  const [domainId, setDomainId] = useState("");
  const [extraTime, setExtraTime] = useState(false);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const inProgressAttempt =
    state.status === "ready"
      ? (state.data.find((item) => item.status === "in-progress") ?? null)
      : null;

  const domainLabelOf = (domainOfAttempt: number): string => {
    const domain = definition.domains.find(
      (candidate) => candidate.id === domainOfAttempt,
    );

    return domain === undefined ? `Dominio ${domainOfAttempt}` : domain.name;
  };

  async function handleStart(): Promise<void> {
    if (starting) {
      return;
    }

    setFormError(null);
    setConflict(false);

    if (mode === "domain" && domainId === "") {
      setFormError(DOMAIN_REQUIRED_MESSAGE);
      return;
    }

    const input: StartExamAttemptInput =
      mode === "domain"
        ? { mode, domain: Number(domainId), extraTime }
        : { mode, extraTime };

    setStarting(true);

    try {
      const attempt = await api.start(certification, input);

      router.push(roomPath(attempt.id));
    } catch (cause: unknown) {
      setStarting(false);

      if (isInProgressConflict(cause)) {
        setConflict(true);
        request.reload();
        return;
      }

      setFormError(cause instanceof Error ? cause.message : START_ERROR_MESSAGE);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void handleStart();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Simulacro · {definition.code}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {definition.name}
        </h1>
        <p className="text-sm text-slate-300">
          {definition.questionCount} preguntas · {definition.durationMin} minutos
        </p>
      </header>

      {isBeta ? (
        <p role="status" className={WARNING_CLASSES}>
          {BETA_MESSAGE}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className={`${CARD_CLASSES} space-y-4`}>
        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-400">{MODE_FIELD_LABEL}</legend>
          <div className="flex flex-wrap gap-3">
            {EXAM_MODES.map((value) => (
              <label key={value} className={RADIO_CLASSES}>
                <input
                  type="radio"
                  name="modo-simulacro"
                  value={value}
                  checked={mode === value}
                  disabled={isBeta}
                  onChange={() => setMode(value)}
                />
                {MODE_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "domain" ? (
          <div className="space-y-2">
            <label htmlFor="dominio-simulacro" className={LABEL_CLASSES}>
              {DOMAIN_FIELD_LABEL}
            </label>
            <select
              id="dominio-simulacro"
              value={domainId}
              disabled={isBeta}
              onChange={(event) => setDomainId(event.target.value)}
              className={SELECT_CLASSES}
            >
              <option value="">{DOMAIN_PLACEHOLDER}</option>
              {definition.domains.map((domain) => (
                <option key={domain.id} value={String(domain.id)}>
                  {domain.name} ({domain.weightPct} %)
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={extraTime}
            disabled={isBeta}
            onChange={() => setExtraTime((current) => !current)}
          />
          {EXTRA_TIME_LABEL}
        </label>

        {formError === null ? null : (
          <div role="alert" className={ALERT_CLASSES}>
            <p>{formError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isBeta || starting}
          className={BUTTON_CLASSES}
        >
          {starting ? STARTING_LABEL : START_LABEL}
        </button>
      </form>

      {conflict ? (
        <div role="status" className={`${WARNING_CLASSES} space-y-2`}>
          <p>{IN_PROGRESS_MESSAGE}</p>
          {inProgressAttempt === null ? null : (
            <Link
              href={roomPath(inProgressAttempt.attemptId)}
              className={LINK_CLASSES}
            >
              {CONTINUE_LABEL}
            </Link>
          )}
        </div>
      ) : null}

      <ReadinessPanel certification={certification} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">{HISTORY_TITLE}</h2>
        <HistoryBody
          state={state}
          onRetry={request.reload}
          domainLabelOf={domainLabelOf}
        />
      </section>
    </div>
  );
}

interface HistoryBodyProps {
  readonly state: ContentState<ExamHistoryItem[]>;
  readonly onRetry: () => void;
  readonly domainLabelOf: (domainOfAttempt: number) => string;
}

/** Historial del más reciente al más antiguo, tal como lo sirve la API. */
function HistoryBody({ state, onRetry, domainLabelOf }: HistoryBodyProps) {
  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        {HISTORY_LOADING_MESSAGE}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className={`${ALERT_CLASSES} space-y-3`}>
        <p>{HISTORY_ERROR_MESSAGE}</p>
        <button type="button" onClick={onRetry} className={GHOST_BUTTON_CLASSES}>
          {RETRY_LABEL}
        </button>
      </div>
    );
  }

  if (state.data.length === 0) {
    return <p className="text-sm text-slate-400">{EMPTY_HISTORY_MESSAGE}</p>;
  }

  return (
    <table
      aria-label={HISTORY_TABLE_LABEL}
      className="w-full border-collapse text-left text-sm"
    >
      <thead>
        <tr className="text-xs uppercase tracking-[0.15em] text-slate-500">
          <th scope="col" className="px-3 py-2">
            Fecha
          </th>
          <th scope="col" className="px-3 py-2">
            Modo
          </th>
          <th scope="col" className="px-3 py-2">
            Estado
          </th>
          <th scope="col" className="px-3 py-2">
            %
          </th>
          <th scope="col" className="px-3 py-2">
            Abrir
          </th>
        </tr>
      </thead>
      <tbody>
        {state.data.map((item) => (
          <tr
            key={item.attemptId}
            className="border-t border-line/70 text-slate-200"
          >
            <td className="px-3 py-2">{formatDate(item.startedAt)}</td>
            <td className="px-3 py-2">
              {MODE_LABELS[item.mode]}
              {item.domain === null ? null : ` · ${domainLabelOf(item.domain)}`}
            </td>
            <td className="px-3 py-2">
              {STATUS_LABELS[item.status]}
              {item.orientative ? (
                <span className={BADGE_CLASSES}>{ORIENTATIVE_LABEL}</span>
              ) : null}
            </td>
            <td className="px-3 py-2">
              {item.scorePct === null ? NO_SCORE_LABEL : `${item.scorePct} %`}
            </td>
            <td className="px-3 py-2">
              {item.status === "in-progress" ? (
                <Link href={roomPath(item.attemptId)} className={LINK_CLASSES}>
                  {ENTER_ROOM_LABEL}
                </Link>
              ) : (
                <Link href={resultPath(item.attemptId)} className={LINK_CLASSES}>
                  {RESULT_LABEL}
                </Link>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

