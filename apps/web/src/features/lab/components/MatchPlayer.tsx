"use client";

import type { ExerciseDetail } from "@codeai/shared";
import type { DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

import { MemoryIntroBox, readIntro, readPairs, shuffleCards } from "./MemoryShared";
import type { MemoryCard, MemoryPair, ShuffleCards } from "./MemoryShared";

/**
 * Modo «unir» del juego de memoria (`banco-ejercicios.md` §3.3, `config.mode: "match"`):
 * cada definición se arrastra hasta el concepto al que corresponde. Es el mismo
 * contenido que voltear cartas (`config.pairs`), pero se razona en vez de recordar
 * posiciones, así que no hay tope de fallos: se cuentan para el repaso final.
 *
 * Arrastrar no existe en la mayoría de pantallas táctiles ni con teclado, por eso
 * también se puede tocar una definición y luego el concepto.
 */

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Zona, en píxeles, junto a cada borde del visor donde arrastrar desplaza la página. */
const SCROLL_EDGE_TOP = 170; // el menú fijo de Aprender ocupa hasta ~142 px
const SCROLL_EDGE_BOTTOM = 110;
const SCROLL_MAX_SPEED = 26;

/**
 * Píxeles por fotograma que debe desplazarse la página mientras se arrastra con el
 * puntero en `clientY` (negativo: hacia arriba). Cuanto más cerca del borde, más rápido.
 * El navegador no desplaza solo al arrastrar entre zonas lejanas, y aquí el concepto
 * de destino puede quedar fuera de pantalla.
 */
export function autoScrollVelocity(clientY: number, viewportHeight: number): number {
  if (clientY < SCROLL_EDGE_TOP) {
    return -Math.ceil((Math.min(SCROLL_EDGE_TOP, SCROLL_EDGE_TOP - clientY) / SCROLL_EDGE_TOP) * SCROLL_MAX_SPEED);
  }

  const bottomStart = viewportHeight - SCROLL_EDGE_BOTTOM;

  if (clientY > bottomStart) {
    return Math.ceil((Math.min(SCROLL_EDGE_BOTTOM, clientY - bottomStart) / SCROLL_EDGE_BOTTOM) * SCROLL_MAX_SPEED);
  }

  return 0;
}

/** Mientras `active`, desplaza la página al acercar el puntero al borde superior o inferior. */
function useEdgeAutoScroll(active: boolean): void {
  useEffect(() => {
    if (!active || typeof requestAnimationFrame !== "function") {
      return;
    }

    let velocity = 0;
    let frame = 0;

    const onDragOver = (event: Event): void => {
      const { clientY } = event as Event & { clientY?: number };

      velocity = typeof clientY === "number" ? autoScrollVelocity(clientY, window.innerHeight) : 0;
    };
    const tick = (): void => {
      if (velocity !== 0) {
        window.scrollBy(0, velocity);
      }

      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("dragover", onDragOver);
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("dragover", onDragOver);
      cancelAnimationFrame(frame);
    };
  }, [active]);
}

/** Tiempo que una definición mal colocada sigue a la vista, en rojo, antes de volver al grupo. */
const DEFAULT_WRONG_MS = 2500;

export interface MatchPlayerProps {
  readonly exercise: ExerciseDetail;
  /** Inyectable para que las pruebas fijen el orden de las definiciones. */
  readonly shuffle?: ShuffleCards;
  /** Inyectable para que las pruebas no esperen el aviso en rojo. */
  readonly flipBackMs?: number;
}

function buildDefinitionCards(pairs: readonly MemoryPair[]): MemoryCard[] {
  return pairs.map((pair) => ({ id: `${pair.id}-definition`, pairId: pair.id, text: pair.definition }));
}

/** Barajado que nunca deja las definiciones en el mismo orden que los conceptos. */
function dealDefinitions(pairs: readonly MemoryPair[], shuffle: ShuffleCards): MemoryCard[] {
  const dealt = shuffle(buildDefinitionCards(pairs));
  const alreadyAligned = dealt.length > 1 && dealt.every((card, index) => card.pairId === pairs[index]?.id);

  return alreadyAligned ? [...dealt.slice(1), ...dealt.slice(0, 1)] : dealt;
}

export function MatchPlayer({ exercise, shuffle = shuffleCards, flipBackMs = DEFAULT_WRONG_MS }: MatchPlayerProps) {
  const pairs = useMemo(() => readPairs(exercise.config), [exercise.config]);
  const intro = useMemo(() => readIntro(exercise.config), [exercise.config]);

  const [deck, setDeck] = useState<readonly MemoryCard[]>(() => dealDefinitions(pairs, shuffle));
  const [matched, setMatched] = useState<readonly string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [wrong, setWrong] = useState<{ readonly slotId: string; readonly cardId: string } | null>(null);
  const [misses, setMisses] = useState(0);
  const [failed, setFailed] = useState<readonly string[]>([]);

  useEdgeAutoScroll(dragging !== null);

  // La definición mal colocada se queda un instante en rojo para que se pueda leer y vuelve al grupo.
  useEffect(() => {
    if (wrong === null) {
      return;
    }

    const timer = setTimeout(() => setWrong(null), flipBackMs);

    return () => clearTimeout(timer);
  }, [wrong, flipBackMs]);

  const complete = pairs.length > 0 && matched.length === pairs.length;
  const pool = deck.filter((card) => !matched.includes(card.pairId) && card.id !== wrong?.cardId);
  const failedTerms = pairs.filter((pair) => failed.includes(pair.id)).map((pair) => pair.term);

  function place(cardId: string | null, slotId: string): void {
    const card = deck.find((candidate) => candidate.id === cardId);

    if (card === undefined || wrong !== null || matched.includes(slotId)) {
      return;
    }

    setSelected(null);
    setDragging(null);

    if (card.pairId === slotId) {
      setMatched((current) => [...current, slotId]);

      return;
    }

    setMisses((current) => current + 1);
    setFailed((current) => [...new Set([...current, slotId, card.pairId])]);
    setWrong({ slotId, cardId: card.id });
  }

  function restart(): void {
    setDeck(dealDefinitions(pairs, shuffle));
    setMatched([]);
    setSelected(null);
    setDragging(null);
    setWrong(null);
    setMisses(0);
    setFailed([]);
  }

  function onDrop(event: DragEvent<HTMLElement>, slotId: string): void {
    event.preventDefault();
    place(event.dataTransfer?.getData("text/plain") || dragging, slotId);
  }

  if (pairs.length === 0) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        Este juego no tiene pares disponibles.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <MemoryIntroBox intro={intro} pairs={pairs} showTerms={false} showAnswers={false} collapsible />

      <p className="text-base text-slate-100">{exercise.statement}</p>
      <p className="text-xs text-slate-400">
        Arrastra cada definición hasta su concepto. Si no puedes arrastrar, toca la definición y luego el concepto.
      </p>

      <div role="group" aria-label="Tablero de unir" className="grid items-start gap-4 md:grid-cols-2">
        <ul aria-label="Conceptos" className="grid list-none content-start gap-2 p-0">
          {pairs.map((pair) => {
            const isMatched = matched.includes(pair.id);
            const wrongHere = wrong?.slotId === pair.id;
            const wrongCard = wrongHere ? deck.find((card) => card.id === wrong?.cardId) : undefined;
            const canReceive = !isMatched && !wrongHere;

            return (
              // Toda la fila recibe la definición: apuntar al hueco exacto no hace falta.
              <li
                key={pair.id}
                onDragOver={(event) => {
                  if (canReceive) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => onDrop(event, pair.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-2 transition sm:flex-row sm:items-center",
                  isMatched
                    ? "border-emerald-400/70 bg-emerald-500/10"
                    : wrongHere
                      ? "border-rose-400/70 bg-rose-500/10"
                      : dragging !== null && canReceive
                        ? "border-accent/60 bg-accent/5"
                        : "border-line/70 bg-ink-card/40",
                )}
              >
                <p className="px-1 text-sm font-semibold text-slate-100 sm:w-36 sm:shrink-0">{pair.term}</p>
                <button
                  type="button"
                  disabled={isMatched}
                  aria-label={
                    isMatched
                      ? `${pair.term}: ${pair.definition}`
                      : `Colocar la definición en ${pair.term}`
                  }
                  onClick={() => place(selected, pair.id)}
                  className={cn(
                    "flex min-h-11 w-full flex-1 items-center justify-center rounded-lg border-2 px-3 py-1.5 text-center text-sm leading-snug transition",
                    FOCUS,
                    isMatched
                      ? "border-solid border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                      : wrongHere
                        ? "border-solid border-rose-400/70 bg-rose-500/15 text-rose-200 motion-safe:animate-pulse"
                        : selected !== null || dragging !== null
                          ? "border-dashed border-accent/70 text-slate-300 hover:bg-accent/10"
                          : "border-dashed border-line/70 text-slate-500",
                  )}
                >
                  {isMatched ? (
                    <>
                      <span aria-hidden="true" className="mr-1">
                        ✓
                      </span>
                      {pair.definition}
                    </>
                  ) : wrongHere && wrongCard !== undefined ? (
                    <>
                      <span aria-hidden="true" className="mr-1">
                        ✗
                      </span>
                      {wrongCard.text}
                    </>
                  ) : (
                    "Suelta aquí la definición"
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Fijo bajo el menú: sigue en pantalla mientras se recorre la lista de conceptos. */}
        <div className="space-y-2 md:sticky md:top-40 md:max-h-[calc(100vh-11rem)] md:overflow-y-auto md:pr-1">
          <p className="text-sm font-medium text-slate-100">Definiciones</p>
          {pool.length === 0 ? (
            <p className="text-sm text-slate-400">No quedan definiciones por colocar.</p>
          ) : (
            <ul aria-label="Definiciones disponibles" className="grid list-none gap-2 p-0">
              {pool.map((card) => {
                const isSelected = selected === card.id;

                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      draggable
                      aria-pressed={isSelected}
                      onClick={() => setSelected(isSelected ? null : card.id)}
                      onDragStart={(event) => {
                        setDragging(card.id);
                        event.dataTransfer?.setData("text/plain", card.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        "w-full cursor-grab rounded-lg border px-3 py-2 text-left text-sm leading-snug transition active:cursor-grabbing",
                        FOCUS,
                        isSelected
                          ? "border-accent bg-accent/15 text-slate-100"
                          : "border-line bg-ink-card text-slate-100 hover:border-white/30",
                      )}
                    >
                      {card.text}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {complete ? (
        <div
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm"
        >
          <p className="font-semibold text-emerald-300">
            ¡Unido todo! {misses === 0 ? "Sin errores." : `${misses} ${misses === 1 ? "error" : "errores"} por el camino.`}
          </p>

          {failedTerms.length > 0 ? (
            <div className="space-y-1 text-slate-300">
              <p>Conceptos para repasar:</p>
              <ul aria-label="Conceptos para repasar" className="list-disc space-y-1 pl-5">
                {failedTerms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-slate-300">Sin errores: este tema no necesita repaso.</p>
          )}

          <button type="button" className={SECONDARY_BUTTON} onClick={restart}>
            Jugar otra vez
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-sm text-slate-400">
            Unidos: {matched.length} de {pairs.length} · Errores: {misses}
          </p>
          <button type="button" className={SECONDARY_BUTTON} onClick={restart}>
            Reiniciar
          </button>
        </div>
      )}
    </div>
  );
}
