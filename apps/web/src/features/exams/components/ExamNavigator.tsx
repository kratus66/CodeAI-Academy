"use client";

import type { ExamAttemptItem } from "@codeai/shared";

import { cn } from "@/lib/cn";

/**
 * Cuadrícula de navegación de la sala de examen (S15, T9c).
 *
 * Cada botón lleva su estado en el nombre accesible y en un icono, no solo en el
 * color: una casilla respondida muestra «✓» y una marcada «⚑», así que la
 * cuadrícula se lee igual con el tema claro, con el oscuro o en blanco y negro.
 */

const CELL =
  "flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const CELL_IDLE = "border-line/70 bg-ink-card/40 hover:border-white/30";

const CELL_CURRENT = "border-accent bg-accent/10";

function stateLabel(item: ExamAttemptItem): string {
  const state = item.answer === null ? "sin responder" : "respondida";

  return item.flagged
    ? `Pregunta ${item.position}: ${state}, marcada`
    : `Pregunta ${item.position}: ${state}`;
}

export interface ExamNavigatorProps {
  readonly items: readonly ExamAttemptItem[];
  readonly current: number;
  readonly onSelect: (position: number) => void;
}

export function ExamNavigator({ items, current, onSelect }: ExamNavigatorProps) {
  return (
    <nav aria-label="Preguntas del simulacro">
      <ol className="grid list-none grid-cols-6 gap-2 p-0 sm:grid-cols-8">
        {items.map((item) => {
          const isCurrent = item.position === current;

          return (
            <li key={item.position}>
              <button
                type="button"
                aria-label={stateLabel(item)}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => onSelect(item.position)}
                className={cn(CELL, isCurrent ? CELL_CURRENT : CELL_IDLE)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    isCurrent ? "font-semibold text-white" : "text-slate-300",
                  )}
                >
                  {item.position}
                </span>
                <span aria-hidden="true" className="flex h-3 items-center gap-1 text-xs leading-none">
                  {item.answer === null ? null : <span className="text-emerald-300">✓</span>}
                  {item.flagged ? <span className="text-amber-300">⚑</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
