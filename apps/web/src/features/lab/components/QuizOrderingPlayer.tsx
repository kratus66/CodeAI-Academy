"use client";

import type { ExerciseDetail, QuizGradeResult } from "@codeai/shared";
import { useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";

import { ApiError, exercisesApi } from "@/lib/api-client";
import { cn } from "@/lib/cn";

import type { SubmitQuiz } from "./QuizPlayer";

/**
 * Quiz de ordenar (`config.kind === "ordering"`).
 *
 * El orden inicial es el de `config.items`, que a propósito no es el correcto.
 * La corrección es «todo o nada»: acierta solo el orden exacto (S14, regla 2).
 * Se puede ordenar con los botones «Subir» / «Bajar» (teclado y lectores de
 * pantalla) o arrastrando, pero el teclado nunca depende del arrastre. El orden
 * correcto y sus explicaciones llegan con el resultado de `POST …/quiz-answers`.
 */

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const MOVE_BUTTON =
  "rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:border-line/60 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Mismo texto que usan los demás reproductores cuando el error no es de la API. */
const UNEXPECTED_GRADE_MESSAGE = "No pudimos corregir tu respuesta. Inténtalo de nuevo.";

const MIN_ITEMS = 3;

export interface QuizOrderingPlayerProps {
  readonly exercise: ExerciseDetail;
  readonly submitQuiz?: SubmitQuiz;
}

interface OrderingItem {
  readonly id: string;
  readonly text: string;
}

interface MoveButtons {
  readonly up: HTMLButtonElement | null;
  readonly down: HTMLButtonElement | null;
}

interface FocusIntent {
  readonly itemId: string;
  readonly direction: "up" | "down";
}

type OrderingGradeResult = Extract<QuizGradeResult, { kind: "ordering" }>;

function readItems(config: Record<string, unknown>): OrderingItem[] {
  const raw = config.items;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item: unknown) => {
    const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

    return typeof record.id === "string" && typeof record.text === "string"
      ? [{ id: record.id, text: record.text }]
      : [];
  });
}

/**
 * Sin al menos tres elementos no hay nada que ordenar ni que corregir (es el
 * mínimo del contrato de contenido), así que se anuncia igual que un quiz sin
 * opciones en lugar de pintar un ejercicio incompleto.
 */
function isOrderable(items: readonly OrderingItem[]): boolean {
  return items.length >= MIN_ITEMS;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === "UNAUTHENTICATED"
      ? "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando."
      : error.message;
  }

  return UNEXPECTED_GRADE_MESSAGE;
}

export function QuizOrderingPlayer({
  exercise,
  submitQuiz = (id, body) => exercisesApi.submitQuiz(id, body),
}: QuizOrderingPlayerProps) {
  const items = readItems(exercise.config);
  const initialOrder = items.map((item) => item.id);
  const texts = new Map(items.map((item) => [item.id, item.text]));

  const [order, setOrder] = useState<readonly string[]>(initialOrder);
  const [result, setResult] = useState<OrderingGradeResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [focusIntent, setFocusIntent] = useState<FocusIntent | null>(null);
  const moveButtons = useRef(new Map<string, MoveButtons>());

  /**
   * Tras mover, el foco se queda en el botón pulsado; si ese botón quedó
   * deshabilitado porque el elemento llegó al extremo, pasa al otro botón del
   * mismo elemento. Se hace después de repintar, cuando ya se sabe qué sigue
   * habilitado.
   */
  useEffect(() => {
    if (focusIntent === null) {
      return;
    }

    const buttons = moveButtons.current.get(focusIntent.itemId);
    const preferred = focusIntent.direction === "up" ? buttons?.up : buttons?.down;
    const other = focusIntent.direction === "up" ? buttons?.down : buttons?.up;
    const target =
      preferred !== null && preferred !== undefined && !preferred.disabled ? preferred : other;

    target?.focus();
  }, [focusIntent]);

  if (!isOrderable(items)) {
    return (
      <p role="alert" className="text-sm text-rose-200">
        Este quiz no tiene opciones disponibles.
      </p>
    );
  }

  const locked = result !== null || pending;

  function textOf(id: string): string {
    return texts.get(id) ?? id;
  }

  function move(index: number, delta: -1 | 1): void {
    const itemId = order[index];
    const destination = index + delta;

    if (locked || itemId === undefined || destination < 0 || destination >= order.length) {
      return;
    }

    const next = [...order];
    next.splice(index, 1);
    next.splice(destination, 0, itemId);

    setOrder(next);
    setFocusIntent({ itemId, direction: delta === -1 ? "up" : "down" });
  }

  function reorder(draggedId: string | null, targetId: string): void {
    if (locked || draggedId === null || draggedId === targetId || !order.includes(draggedId)) {
      return;
    }

    const next = order.filter((id) => id !== draggedId);
    const targetIndex = next.indexOf(targetId);

    if (targetIndex < 0) {
      return;
    }

    next.splice(targetIndex, 0, draggedId);
    setOrder(next);
  }

  function handleDragStart(event: DragEvent<HTMLLIElement>, itemId: string): void {
    setDraggingId(itemId);
    event.dataTransfer?.setData("text/plain", itemId);
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, targetId: string): void {
    event.preventDefault();
    reorder(event.dataTransfer?.getData("text/plain") || draggingId, targetId);
    setDraggingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const graded = await submitQuiz(exercise.id, { order: [...order] });

      if (graded.kind !== "ordering") {
        setError(UNEXPECTED_GRADE_MESSAGE);
        return;
      }

      setResult(graded);
    } catch (caught: unknown) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  function retry(): void {
    setOrder(initialOrder);
    setResult(null);
    setError(null);
    setDraggingId(null);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" aria-busy={pending}>
      <fieldset className="space-y-3" disabled={locked}>
        <legend id={`ordering-${exercise.id}`} className="text-base font-medium text-white">
          {exercise.statement}
        </legend>
        <p className="text-sm text-slate-300">
          Arrastra un elemento sobre otro o usa «Subir» y «Bajar» para ordenarlos.
        </p>

        <ol aria-labelledby={`ordering-${exercise.id}`} className="list-none space-y-2 p-0">
          {order.map((itemId, index) => {
            const isFirst = index === 0;
            const isLast = index === order.length - 1;
            const text = textOf(itemId);

            return (
              <li
                key={itemId}
                draggable
                onDragStart={(event) => handleDragStart(event, itemId)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => {
                  if (!locked) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => handleDrop(event, itemId)}
                className={cn(
                  "flex cursor-grab items-start gap-3 rounded-xl border px-4 py-3 text-sm text-slate-200 transition active:cursor-grabbing",
                  draggingId === itemId ? "border-accent bg-accent/10" : "border-line/70 bg-ink-card/40",
                )}
              >
                <span aria-hidden="true" className="mt-0.5 font-mono text-xs text-slate-500">
                  {index + 1}
                </span>
                <span className="flex-1">{text}</span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    aria-label={`Subir: ${text}`}
                    disabled={isFirst}
                    onClick={() => move(index, -1)}
                    ref={(node) => {
                      const current = moveButtons.current.get(itemId) ?? { up: null, down: null };
                      moveButtons.current.set(itemId, { ...current, up: node });
                    }}
                    className={MOVE_BUTTON}
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    aria-label={`Bajar: ${text}`}
                    disabled={isLast}
                    onClick={() => move(index, 1)}
                    ref={(node) => {
                      const current = moveButtons.current.get(itemId) ?? { up: null, down: null };
                      moveButtons.current.set(itemId, { ...current, down: node });
                    }}
                    className={MOVE_BUTTON}
                  >
                    Bajar
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {result === null ? (
        <button type="submit" className={PRIMARY_BUTTON} disabled={pending}>
          {pending ? "Comprobando…" : "Comprobar"}
        </button>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="space-y-4 rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm"
        >
          <p className={cn("font-semibold", result.correct ? "text-emerald-300" : "text-rose-300")}>
            {result.correct ? "¡Correcto!" : "Todavía no. Hay que ordenarlos todos bien."}
          </p>

          <div className="space-y-1">
            <p className="font-medium text-white">Orden correcto</p>
            <ol className="list-decimal space-y-2 pl-5 text-slate-300">
              {result.correctOrder.map((correctId) => {
                const explanation = result.explanations[correctId];

                return (
                  <li key={correctId}>
                    <span className="text-slate-100">{textOf(correctId)}</span>
                    {explanation === undefined ? null : (
                      <span className="block text-slate-300">{explanation}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {result.correct ? null : (
            <div className="space-y-1">
              <p className="font-medium text-white">Tu orden</p>
              <ol className="list-decimal pl-5 text-slate-300">
                {order.map((itemId) => (
                  <li key={itemId}>{textOf(itemId)}</li>
                ))}
              </ol>
            </div>
          )}

          <button type="button" className={SECONDARY_BUTTON} onClick={retry}>
            Intentar de nuevo
          </button>
        </div>
      )}
    </form>
  );
}

