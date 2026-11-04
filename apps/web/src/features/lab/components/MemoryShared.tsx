"use client";

import { useMemo } from "react";

/**
 * Piezas comunes de los dos modos del juego de memoria (`banco-ejercicios.md` §3.3):
 * voltear cartas (`MemoryPlayer`) y unir arrastrando (`MatchPlayer`). Ambos leen los
 * mismos `config.pairs` e `config.intro`.
 */

export interface MemoryPair {
  readonly id: string;
  readonly term: string;
  readonly definition: string;
}

export interface MemoryCard {
  readonly id: string;
  readonly pairId: string;
  readonly text: string;
}

export type ShuffleCards = (cards: readonly MemoryCard[]) => MemoryCard[];

export function readPairs(config: Record<string, unknown>): MemoryPair[] {
  const raw = config.pairs;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry: unknown, index: number) => {
    const record = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
    const term = record.term;
    const definition = record.definition;

    if (typeof term !== "string" || typeof definition !== "string" || term === "" || definition === "") {
      return [];
    }

    return [
      {
        id: typeof record.id === "string" && record.id !== "" ? record.id : `pair-${index}`,
        term,
        definition,
      },
    ];
  });
}

export interface MemoryIntro {
  readonly summary: string;
  readonly list: {
    readonly title: string;
    readonly ordered: boolean;
    readonly items: readonly string[];
  } | null;
}

/** `config.intro` es opcional y se descarta entero si viene mal formado: el juego no depende de él. */
export function readIntro(config: Record<string, unknown>): MemoryIntro | null {
  const raw = config.intro;

  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const { summary, list } = raw as { summary?: unknown; list?: unknown };

  if (typeof summary !== "string" || summary.trim() === "") {
    return null;
  }

  const candidate = typeof list === "object" && list !== null ? (list as Record<string, unknown>) : null;
  const items = Array.isArray(candidate?.items)
    ? candidate.items.filter((item: unknown): item is string => typeof item === "string" && item !== "")
    : [];

  return {
    summary,
    list:
      candidate !== null && typeof candidate.title === "string" && items.length >= 2
        ? { title: candidate.title, ordered: candidate.ordered === true, items }
        : null,
  };
}

/** Fisher–Yates: un tablero siempre ordenado no es un juego de memoria. */
export function shuffleCards(cards: readonly MemoryCard[]): MemoryCard[] {
  const copy = [...cards];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    const other = copy[swap];

    if (current === undefined || other === undefined) {
      continue;
    }

    copy[index] = other;
    copy[swap] = current;
  }

  return copy;
}

interface MemoryIntroBoxProps {
  readonly intro: MemoryIntro | null;
  readonly pairs: readonly MemoryPair[];
  /** Mostrar los conceptos como chips cuando no hay lista de etapas (el modo unir ya los muestra). */
  readonly showTerms?: boolean;
  /** Mostrar las definiciones como respuestas (el modo unir ya las muestra). */
  readonly showAnswers?: boolean;
}

/** Recuadro «Qué vas a repasar»: resumen, etapas y, según el modo, conceptos y respuestas. */
export function MemoryIntroBox({ intro, pairs, showTerms = true, showAnswers = true }: MemoryIntroBoxProps) {
  // Alfabético: si siguieran el orden de los términos, la lista delataría cada pareja.
  const sortedDefinitions = useMemo(
    () => pairs.map((pair) => pair.definition).sort((left, right) => left.localeCompare(right, "es")),
    [pairs],
  );

  return (
    <section
      aria-labelledby="memory-intro"
      className="space-y-3 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4"
    >
      <h2 id="memory-intro" className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Qué vas a repasar
      </h2>
      {intro !== null ? <p className="text-sm leading-relaxed text-slate-200">{intro.summary}</p> : null}
      {intro?.list != null ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-100">{intro.list.title}</p>
          {intro.list.ordered ? (
            <ol className="flex list-none flex-wrap items-center gap-2 p-0 text-sm text-slate-200">
              {intro.list.items.map((item, index) => (
                <li key={item} className="flex items-center gap-2">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-slate-500">
                      →
                    </span>
                  ) : null}
                  <span className="rounded-full border border-line/70 px-3 py-1">
                    <span className="mr-1.5 text-xs text-slate-500">{index + 1}</span>
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <ul className="flex list-none flex-wrap gap-2 p-0 text-sm text-slate-200">
              {intro.list.items.map((item) => (
                <li key={item} className="rounded-full border border-line/70 px-3 py-1">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {showTerms && intro?.list == null ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-100">Conceptos que vas a emparejar</p>
          <ul aria-label="Conceptos a emparejar" className="flex list-none flex-wrap gap-2 p-0 text-sm text-slate-200">
            {pairs.map((pair) => (
              <li key={pair.id} className="rounded-full border border-line/70 px-3 py-1">
                {pair.term}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showAnswers ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-100">
            Respuestas: {pairs.length} definiciones para asignar a cada concepto
          </p>
          <ul aria-label="Definiciones a asignar" className="grid list-none gap-2 p-0 text-sm text-slate-200 sm:grid-cols-2">
            {sortedDefinitions.map((definition) => (
              <li key={definition} className="rounded-lg border border-line/70 px-3 py-2 leading-snug">
                {definition}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
