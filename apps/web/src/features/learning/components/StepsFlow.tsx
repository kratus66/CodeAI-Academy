"use client";

import type { LessonStep } from "@codeai/shared";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/** Nombre legible de cada paso de la microestructura (plantilla-leccion.md). */
const STEP_LABELS: Record<LessonStep["kind"], string> = {
  objective: "Objetivo",
  explanation: "Explicación",
  guided_practice: "Práctica guiada",
  independent_practice: "Práctica autónoma",
  debug: "Depuración",
  assessment: "Evaluación",
  transfer: "Transferencia",
};

const NAV_BUTTON_CLASSES =
  "inline-flex items-center gap-1 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-slate-200";

interface StepsFlowProps {
  readonly steps: readonly LessonStep[];
}

/**
 * Los 7 pasos como recorrido activo: un paso a la vez, con su posición, marca
 * local de los ya vistos y navegación anterior/siguiente. Al cambiar de paso el
 * foco pasa al título, para que el lector de pantalla anuncie el nuevo
 * contenido sin perder el hilo. Los pasos vistos no se persisten.
 */
export function StepsFlow({ steps }: StepsFlowProps) {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<ReadonlySet<number>>(
    () => new Set([0]),
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef(false);

  useEffect(() => {
    if (!pendingFocus.current) {
      return;
    }
    pendingFocus.current = false;
    headingRef.current?.focus();
  }, [index]);

  const step = steps[index];

  if (!step) {
    return null;
  }

  const total = steps.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  function goTo(target: number) {
    if (target < 0 || target >= total || target === index) {
      return;
    }

    pendingFocus.current = true;
    setIndex(target);
    setVisited((current) => {
      if (current.has(target)) {
        return current;
      }
      const next = new Set(current);
      next.add(target);
      return next;
    });
  }

  return (
    <section
      aria-labelledby="pasos"
      className="space-y-4 border-t border-line/70 pt-8"
    >
      <h2
        id="pasos"
        className="text-lg font-semibold tracking-tight text-white"
      >
        Los 7 pasos
      </h2>

      <div className="rounded-2xl border border-line/70 bg-ink-card/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Paso{" "}
            <span className="font-mono tracking-normal text-slate-100">
              {index + 1} / {total}
            </span>
          </p>
          <p className="text-xs text-slate-400">
            {visited.size} de {total} vistos
          </p>
        </div>

        <ol className="flex list-none flex-wrap gap-2 px-4 py-3">
          {steps.map((entry, position) => {
            const isCurrent = position === index;
            const isVisited = visited.has(position);

            return (
              <li
                key={entry.kind}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-2.5 w-8 rounded-full transition-colors",
                    isCurrent
                      ? "bg-accent"
                      : isVisited
                        ? "bg-accent/40"
                        : "bg-white/10",
                  )}
                />
                <span className="sr-only">
                  {`Paso ${position + 1}: ${STEP_LABELS[entry.kind]}, ${
                    isVisited ? "visto" : "pendiente"
                  }`}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="space-y-2 px-4 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            {STEP_LABELS[step.kind]}
          </p>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="rounded-md text-lg font-semibold tracking-tight text-white"
          >
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">{step.body}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line/70 px-4 py-3">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={isFirst}
            className={NAV_BUTTON_CLASSES}
          >
            <span aria-hidden>←</span> Anterior
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={isLast}
            className={NAV_BUTTON_CLASSES}
          >
            Siguiente <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
