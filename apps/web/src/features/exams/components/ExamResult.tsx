"use client";

import type {
  ExamResult as ExamResultData,
  ExamResultItem,
  QuizSubmissionInput,
} from "@codeai/shared";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { examsApi } from "@/lib/api-client";

/**
 * Informe de un simulacro entregado (S15, T10).
 *
 * Publica el porcentaje de aciertos, global y por dominio, y revisa cada
 * pregunta. Con el intento ya entregado la solución deja de ser secreta, así
 * que la respuesta correcta se lee con los textos del `config`, nunca con sus
 * ids. No hay puntuación escalada (decisión 2.2): AWS no publica cómo la
 * obtiene y aquí no se imita.
 */

const BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const CARD_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-200";

const ALERT_CLASSES =
  "rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200";

const WARNING_CLASSES =
  "rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200";

const FILTER_CLASSES =
  "flex cursor-pointer items-center gap-2 rounded-full border border-line/70 bg-ink-card/40 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30";

const LABEL_CLASSES = "text-xs font-medium uppercase tracking-[0.15em] text-slate-500";

const LINK_CLASSES = "inline-flex text-sm font-medium text-accent transition hover:text-white";

const SCORE_NOTE =
  "Porcentaje de aciertos. AWS usa una puntuación escalada que no publica; aquí no se imita.";

const ORIENTATIVE_MESSAGE =
  "Resultado orientativo: alguna pregunta aún no tiene revisión humana y no cuenta para «listo para presentar».";

const EXPIRED_MESSAGE = "Entregado automáticamente al terminar el tiempo";

const REVIEW_NOTICE = "Las preguntas falladas se añadieron a tu repaso con prioridad alta.";

const LOADING_MESSAGE = "Cargando el resultado…";

const LOAD_ERROR_MESSAGE = "No pudimos cargar el resultado.";

const EMPTY_FILTER_MESSAGE = "Ninguna pregunta coincide con este filtro.";

/** El 70 % es el corte por dominio; una pregunta sin responder cuenta como fallo. */
const PASS_THRESHOLD_PCT = 70;

const BELOW_THRESHOLD_LABEL = "Por debajo del 70 %";

const UNANSWERED_LABEL = "Sin responder";

const UNKNOWN_OPTION_LABEL = "Opción no disponible";

const ANSWER_SEPARATOR = " · ";

const PAIR_SEPARATOR = " → ";

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "failed", label: "Falladas" },
  { value: "flagged", label: "Marcadas" },
] as const;

type ResultFilter = (typeof FILTERS)[number]["value"];

interface ResultOption {
  readonly id: string;
  readonly text: string;
}

/** Elementos pintables de una lista del `config`, con la misma tolerancia que la sala. */
function readOptions(raw: unknown): ResultOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((element: unknown) => {
    const record =
      typeof element === "object" && element !== null
        ? (element as Record<string, unknown>)
        : {};

    return typeof record.id === "string" && typeof record.text === "string"
      ? [{ id: record.id, text: record.text }]
      : [];
  });
}

/**
 * Opciones o elementos del `config` en su orden. Sin `kind` es `single`, como en
 * la sala: el informe describe lo que se respondió, no valida la pregunta.
 */
function readOptionsOf(config: Record<string, unknown>): ResultOption[] {
  const kind = typeof config.kind === "string" ? config.kind : "single";

  if (kind === "ordering") {
    return readOptions(config.items);
  }

  if (kind === "matching") {
    return [...readOptions(config.left), ...readOptions(config.right)];
  }

  return readOptions(config.options);
}

function textsById(options: readonly ResultOption[]): Map<string, string> {
  return new Map(options.map((option): [string, string] => [option.id, option.text]));
}

/**
 * Respuesta legible: los textos de las opciones o elementos a los que apunta,
 * en el orden en que se respondieron. Nunca los ids.
 */
function describeAnswer(
  answer: QuizSubmissionInput | null,
  texts: ReadonlyMap<string, string>,
): string {
  if (answer === null) {
    return UNANSWERED_LABEL;
  }

  const textOf = (id: string): string => texts.get(id) ?? UNKNOWN_OPTION_LABEL;
  const parts =
    answer.optionId !== undefined
      ? [textOf(answer.optionId)]
      : answer.optionIds !== undefined
        ? answer.optionIds.map(textOf)
        : answer.order !== undefined
          ? answer.order.map(textOf)
          : Object.entries(answer.pairs ?? {}).map(
              ([left, right]) => `${textOf(left)}${PAIR_SEPARATOR}${textOf(right)}`,
            );

  return parts.length === 0 ? UNKNOWN_OPTION_LABEL : parts.join(ANSWER_SEPARATOR);
}

/** Lo mínimo que el informe necesita del cliente: solo la lectura del resultado. */
export interface ExamResultApi {
  readonly result: (attemptId: string) => Promise<ExamResultData>;
}

export interface ExamResultProps {
  readonly attemptId: string;
  readonly api?: ExamResultApi;
}

export function ExamResult({ attemptId, api = examsApi }: ExamResultProps) {
  const load = useMemo(
    () => (): Promise<ExamResultData> => api.result(attemptId),
    [api, attemptId],
  );
  const request = useContentLoader(load);
  const state = request.state;

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        {LOADING_MESSAGE}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className={`${ALERT_CLASSES} space-y-3`}>
        <p>{LOAD_ERROR_MESSAGE}</p>
        <button type="button" onClick={() => request.reload()} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  return <ExamResultBody result={state.data} />;
}

function ExamResultBody({ result }: { readonly result: ExamResultData }) {
  const [filter, setFilter] = useState<ResultFilter>("all");
  const visible = result.items.filter((item) => {
    if (filter === "failed") {
      return !item.correct;
    }

    if (filter === "flagged") {
      return item.flagged;
    }

    return true;
  });

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Simulacro · {result.certification}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Resultado del simulacro
        </h1>
        <p className="text-4xl font-semibold text-white">{result.scorePct} %</p>
        <p className="text-sm text-slate-300">
          {result.correctCount} de {result.questionCount} correctas
        </p>

        {result.status === "expired" ? (
          <p className={CARD_CLASSES}>{EXPIRED_MESSAGE}</p>
        ) : null}

        {result.orientative ? (
          <p role="status" className={WARNING_CLASSES}>
            {ORIENTATIVE_MESSAGE}
          </p>
        ) : null}

        <p className="text-xs text-slate-400">{SCORE_NOTE}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Resultado por dominio</h2>

        <table
          aria-label="Aciertos por dominio"
          className="w-full border-collapse text-left text-sm"
        >
          <thead>
            <tr className="text-xs uppercase tracking-[0.15em] text-slate-500">
              <th scope="col" className="px-3 py-2">
                Dominio
              </th>
              <th scope="col" className="px-3 py-2">
                Aciertos
              </th>
              <th scope="col" className="px-3 py-2">
                Total
              </th>
              <th scope="col" className="px-3 py-2">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {result.domains.map((domain) => (
              <tr key={domain.domain} className="border-t border-line/70 text-slate-200">
                <th scope="row" className="px-3 py-2 font-medium text-white">
                  {domain.name}
                </th>
                <td className="px-3 py-2">{domain.correct}</td>
                <td className="px-3 py-2">{domain.total}</td>
                <td className="px-3 py-2">
                  <span>{domain.pct} %</span>
                  {domain.pct < PASS_THRESHOLD_PCT ? (
                    <span className="ml-2 rounded-full border border-amber-400/40 px-2 py-0.5 text-xs text-amber-200">
                      {BELOW_THRESHOLD_LABEL}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Revisión pregunta a pregunta</h2>

        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-400">Filtrar preguntas</legend>
          <div className="flex flex-wrap gap-3">
            {FILTERS.map((option) => (
              <label key={option.value} className={FILTER_CLASSES}>
                <input
                  type="radio"
                  name="filtro-resultado"
                  value={option.value}
                  checked={filter === option.value}
                  onChange={() => setFilter(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <p className="text-sm text-slate-300">{REVIEW_NOTICE}</p>

        {visible.length === 0 ? (
          <p className="text-sm text-slate-400">{EMPTY_FILTER_MESSAGE}</p>
        ) : (
          <div className="space-y-4">
            {visible.map((item) => (
              <ResultQuestion key={item.position} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Una pregunta corregida. La respuesta guardada y la correcta se leen con los
 * textos de las opciones, y la explicación de cada opción o elemento acompaña a
 * su texto para que no haga falta cruzar ids.
 */
function ResultQuestion({ item }: { readonly item: ExamResultItem }) {
  const options = readOptionsOf(item.config);
  const texts = textsById(options);
  const explanations = options.flatMap((option) => {
    const explanation = item.explanations[option.id];

    return explanation === undefined ? [] : [{ option, explanation }];
  });

  return (
    <article
      aria-labelledby={`pregunta-${item.position}`}
      className={`${CARD_CLASSES} space-y-3`}
    >
      <h3 id={`pregunta-${item.position}`} className="text-base font-medium text-white">
        Pregunta {item.position}
      </h3>

      <p className="text-slate-200">{item.statement}</p>

      <div className="space-y-1">
        <p className={LABEL_CLASSES}>Tu respuesta</p>
        <p className="text-slate-100">{describeAnswer(item.answer, texts)}</p>
      </div>

      <div className="space-y-1">
        <p className={LABEL_CLASSES}>Respuesta correcta</p>
        <p className="text-slate-100">{describeAnswer(item.correctAnswer, texts)}</p>
      </div>

      {explanations.length === 0 ? null : (
        <div className="space-y-1">
          <p className={LABEL_CLASSES}>Explicación de cada opción o elemento</p>
          <ul className="list-none space-y-2 p-0">
            {explanations.map(({ option, explanation }) => (
              <li key={option.id}>
                <span className="text-slate-100">{option.text}</span>
                <span className="block text-slate-300">{explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href={`/learn/units/${item.unitCode}`} className={LINK_CLASSES}>
        Repasar la unidad
      </Link>
    </article>
  );
}

