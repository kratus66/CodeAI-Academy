"use client";

import type { ExerciseDetail } from "@codeai/shared";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Juego de memoria (`banco-ejercicios.md` §3.3): emparejar término y definición.
 *
 * El tablero se arma con `config.pairs`, que el detalle del ejercicio sirve tal
 * cual porque `config` es libre por tipo. Se juega y se corrige en el cliente:
 * las dos caras de un par están a la vista por definición, así que no hay
 * respuesta que ocultar ni endpoint que consultar. Los pares fallados se listan
 * al terminar para convertirlos en tarjetas de repaso cuando el repaso acepte
 * altas del juego (hoy sólo se anuncian).
 */

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const CARD_BASE =
  "flex min-h-24 items-center justify-center rounded-xl border px-3 py-4 text-center text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Tiempo que un par fallado sigue a la vista antes de girarse otra vez. */
const DEFAULT_FLIP_BACK_MS = 1600;

const HIDDEN_LABEL = "Carta boca abajo";

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

export interface MemoryPlayerProps {
  readonly exercise: ExerciseDetail;
  /** Inyectable para que las pruebas fijen el orden del tablero. */
  readonly shuffle?: ShuffleCards;
  /** Inyectable para que las pruebas no esperen el giro real. */
  readonly flipBackMs?: number;
}

function readPairs(config: Record<string, unknown>): MemoryPair[] {
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

/** Fallos permitidos por intento; `config.maxMisses` lo ajusta dentro de este rango. */
const DEFAULT_MAX_MISSES = 6;
const MIN_MAX_MISSES = 3;
const MAX_MAX_MISSES = 10;

function readMaxMisses(config: Record<string, unknown>): number {
  const raw = config.maxMisses;

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_MAX_MISSES;
  }

  return Math.min(MAX_MAX_MISSES, Math.max(MIN_MAX_MISSES, Math.round(raw)));
}

/** El muñeco tiene seis partes; los fallos permitidos se reparten entre ellas. */
const HANGMAN_PARTS = 6;

/**
 * Muñeco del ahorcado: cada fallo dibuja una parte más y con el último fallo el
 * intento termina. Es decorativo para quien lo ve; el conteo exacto va en el texto.
 */
function Hangman({ misses, max }: { readonly misses: number; readonly max: number }) {
  const drawn = Math.min(HANGMAN_PARTS, Math.ceil((misses * HANGMAN_PARTS) / max));

  return (
    <svg
      role="img"
      aria-label={`Muñeco del ahorcado: ${misses} de ${max} fallos`}
      viewBox="0 0 120 120"
      className="h-28 w-28 shrink-0"
      fill="none"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <g stroke="currentColor" className="text-slate-500">
        <line x1="10" y1="114" x2="110" y2="114" />
        <line x1="30" y1="114" x2="30" y2="10" />
        <line x1="30" y1="10" x2="70" y2="10" />
        <line x1="70" y1="10" x2="70" y2="24" />
      </g>
      <g stroke="currentColor" className="text-rose-300">
        {drawn >= 1 ? <circle cx="70" cy="34" r="10" /> : null}
        {drawn >= 2 ? <line x1="70" y1="44" x2="70" y2="80" /> : null}
        {drawn >= 3 ? <line x1="70" y1="54" x2="54" y2="68" /> : null}
        {drawn >= 4 ? <line x1="70" y1="54" x2="86" y2="68" /> : null}
        {drawn >= 5 ? <line x1="70" y1="80" x2="56" y2="100" /> : null}
        {drawn >= 6 ? <line x1="70" y1="80" x2="84" y2="100" /> : null}
      </g>
    </svg>
  );
}

/** Cada par produce dos cartas: el término y su definición. */
function buildDeck(pairs: readonly MemoryPair[]): MemoryCard[] {
  return pairs.flatMap((pair) => [
    { id: `${pair.id}-term`, pairId: pair.id, text: pair.term },
    { id: `${pair.id}-definition`, pairId: pair.id, text: pair.definition },
  ]);
}

/** Fisher–Yates: un tablero siempre ordenado no es un juego de memoria. */
function shuffleInPlace(cards: readonly MemoryCard[]): MemoryCard[] {
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

export function MemoryPlayer({
  exercise,
  shuffle = shuffleInPlace,
  flipBackMs = DEFAULT_FLIP_BACK_MS,
}: MemoryPlayerProps) {
  const pairs = useMemo(() => readPairs(exercise.config), [exercise.config]);

  // El tablero se baraja una vez por montaje: cambiar de ejercicio remonta el
  // componente (`key` en `ExercisePlayer`) y «Reiniciar» vuelve a barajar.
  const [deck, setDeck] = useState<readonly MemoryCard[]>(() => shuffle(buildDeck(pairs)));
  const [flipped, setFlipped] = useState<readonly string[]>([]);
  const [matched, setMatched] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState<readonly string[]>([]);
  const [moves, setMoves] = useState(0);
  const [misses, setMisses] = useState(0);
  const maxMisses = readMaxMisses(exercise.config);

  // Un par fallado se queda a la vista un instante para que se pueda leer.
  useEffect(() => {
    if (flipped.length < 2) {
      return;
    }

    const firstCard = deck.find((card) => card.id === flipped[0]);
    const secondCard = deck.find((card) => card.id === flipped[1]);

    if (!firstCard || !secondCard || firstCard.pairId === secondCard.pairId) {
      return;
    }

    const timer = setTimeout(() => setFlipped([]), flipBackMs);

    return () => clearTimeout(timer);
  }, [flipped, deck, flipBackMs]);

  const complete = pairs.length > 0 && matched.length === pairs.length;
  const firstUp = deck.find((card) => card.id === flipped[0]);
  const secondUp = deck.find((card) => card.id === flipped[1]);
  // Dos cartas levantadas que no son pareja: se pintan en rojo mientras giran de vuelta.
  const mismatch = firstUp !== undefined && secondUp !== undefined && firstUp.pairId !== secondUp.pairId;
  // Se pierde cuando se agota el cupo de fallos y el último par fallado ya terminó de girar.
  const lost = !complete && misses >= maxMisses && flipped.length < 2;
  const pendingPairs = pairs.filter((pair) => !matched.includes(pair.id));
  const failedTerms = pairs.filter((pair) => failed.includes(pair.id)).map((pair) => pair.term);

  function flip(card: MemoryCard): void {
    if (lost || flipped.includes(card.id) || matched.includes(card.pairId) || flipped.length === 2) {
      return;
    }

    if (flipped.length === 0) {
      setFlipped([card.id]);

      return;
    }

    const firstCard = deck.find((current) => current.id === flipped[0]);
    const firstPairId = firstCard?.pairId;

    setMoves((current) => current + 1);

    if (firstPairId !== undefined && firstPairId === card.pairId) {
      setMatched((current) => [...current, card.pairId]);
      setFlipped([]);

      return;
    }

    setMisses((current) => current + 1);
    setFailed((current) =>
      [firstPairId, card.pairId].reduce<readonly string[]>(
        (result, pairId) => (pairId !== undefined && !result.includes(pairId) ? [...result, pairId] : result),
        current,
      ),
    );
    setFlipped([card.id, ...flipped]);
  }

  function restart(): void {
    setDeck(shuffle(buildDeck(pairs)));
    setFlipped([]);
    setMatched([]);
    setFailed([]);
    setMoves(0);
    setMisses(0);
  }

  if (pairs.length === 0) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        Este juego de memoria no tiene pares disponibles.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-100">{exercise.statement}</p>

      <div role="group" aria-label="Tablero de memoria" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {deck.map((card) => {
          const isMatched = matched.includes(card.pairId);
          const isWrong = mismatch && flipped.includes(card.id);
          const isUp = isMatched || flipped.includes(card.id);

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(card)}
              aria-label={isUp ? card.text : HIDDEN_LABEL}
              aria-pressed={isUp}
              disabled={isMatched || lost}
              className={cn(
                CARD_BASE,
                // Un solo estado de color por carta: si se apilaran, gana la clase que Tailwind
                // genera después y no la que se escribió después.
                isMatched
                  ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                  : isWrong
                    ? "border-rose-400/70 bg-rose-500/15 text-rose-200 motion-safe:animate-pulse"
                    : isUp
                      ? "border-line bg-ink-card text-slate-100"
                      : "border-line/70 bg-ink-card/40 text-slate-500 hover:border-white/30",
              )}
            >
              {isMatched ? <span aria-hidden="true" className="mr-1">✓</span> : null}
              {isWrong ? <span aria-hidden="true" className="mr-1">✗</span> : null}
              {isUp ? card.text : "?"}
            </button>
          );
        })}
      </div>

      {complete ? (
        <div
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm"
        >
          <p className="font-semibold text-emerald-300">
            Tablero completado en {moves} {moves === 1 ? "movimiento" : "movimientos"}.
          </p>

          {failedTerms.length > 0 ? (
            <div className="space-y-1 text-slate-300">
              <p>Pares para repasar:</p>
              <ul className="list-disc space-y-1 pl-5">
                {failedTerms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-slate-300">Sin fallos: este tablero no necesita repaso.</p>
          )}

          <button type="button" className={SECONDARY_BUTTON} onClick={restart}>
            Jugar otra vez
          </button>
        </div>
      ) : lost ? (
        <div
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-5 py-4 text-sm"
        >
          <div className="flex items-center gap-4">
            <Hangman misses={misses} max={maxMisses} />
            <div className="space-y-1">
              <p className="font-semibold text-rose-200">Se acabaron los intentos.</p>
              <p className="text-slate-300">
                Fallaste {misses} veces. Repasa estos pares y vuelve a presentar la prueba.
              </p>
            </div>
          </div>

          <ul aria-label="Pares pendientes" className="list-disc space-y-1 pl-5 text-slate-300">
            {pendingPairs.map((pair) => (
              <li key={pair.id}>
                <strong className="text-slate-100">{pair.term}</strong>: {pair.definition}
              </li>
            ))}
          </ul>

          <button type="button" className={SECONDARY_BUTTON} onClick={restart}>
            Volver a intentar la prueba
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Hangman misses={misses} max={maxMisses} />
            <p role="status" aria-live="polite" className="text-sm text-slate-400">
              Movimientos: {moves} · Pares: {matched.length} de {pairs.length}
              <br />
              Fallos: {misses} de {maxMisses}
              {misses > 0 && maxMisses - misses <= 2
                ? ` · ¡te ${maxMisses - misses === 1 ? "queda 1 intento" : `quedan ${maxMisses - misses} intentos`}!`
                : ""}
            </p>
          </div>
          <button type="button" className={SECONDARY_BUTTON} onClick={restart}>
            Reiniciar
          </button>
        </div>
      )}
    </div>
  );
}
