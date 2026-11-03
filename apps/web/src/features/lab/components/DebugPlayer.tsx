"use client";

import type { ExerciseDetail } from "@codeai/shared";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Depuración (`banco-ejercicios.md` §3.5): antes de corregir hay que localizar y
 * explicar. El estudiante marca las líneas que cree defectuosas y escribe la causa
 * raíz; sólo entonces se habilita el laboratorio, donde el arreglo se corrige con
 * pruebas reales. El diagnóstico es del estudiante (recuperación activa y
 * elaboración): la API no lo califica, y la nota sigue saliendo de las pruebas.
 */

const PRIMARY_BUTTON =
  "inline-flex items-center rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Una causa raíz de menos de esto no es una explicación: es una etiqueta. */
export const ROOT_CAUSE_MIN_CHARS = 20;

export interface DebugPlayerProps {
  readonly exercise: ExerciseDetail;
  /** El laboratorio de código que se habilita al terminar el diagnóstico. */
  readonly children: ReactNode;
}

export function DebugPlayer({ exercise, children }: DebugPlayerProps) {
  const causeId = useId();
  const lines = (exercise.starterCode ?? "").split("\n");
  const [suspects, setSuspects] = useState<readonly number[]>([]);
  const [cause, setCause] = useState("");
  const [diagnosed, setDiagnosed] = useState(false);

  const causeReady = cause.trim().length >= ROOT_CAUSE_MIN_CHARS;
  const ready = suspects.length > 0 && causeReady;

  function toggle(lineNumber: number): void {
    setSuspects((current) =>
      current.includes(lineNumber)
        ? current.filter((line) => line !== lineNumber)
        : [...current, lineNumber].sort((a, b) => a - b),
    );
  }

  if (diagnosed) {
    return (
      <div className="space-y-6">
        <section aria-label="Tu diagnóstico" className="glass rounded-xl px-4 py-3 text-sm text-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tu diagnóstico</p>
          <p className="mt-1">
            Líneas sospechosas: <strong>{suspects.join(", ")}</strong>
          </p>
          <p className="mt-1 whitespace-pre-wrap text-slate-300">{cause.trim()}</p>
        </section>
        {children}
      </div>
    );
  }

  return (
    <section aria-labelledby="debug-diagnosis" className="space-y-5">
      <div className="space-y-2">
        <h2 id="debug-diagnosis" className="text-lg font-semibold text-white">
          Paso 1 · Diagnostica antes de corregir
        </h2>
        <p className="text-sm leading-relaxed text-slate-300">{exercise.statement}</p>
        <p className="text-xs text-slate-400">
          Marca la línea o líneas donde crees que está el defecto y explica por qué falla. Después podrás
          arreglarlo en el editor.
        </p>
      </div>

      <ol
        aria-label="Código con el defecto"
        className="list-none overflow-x-auto rounded-xl border border-line/70 bg-ink-card p-0 font-mono text-xs"
      >
        {lines.map((text, index) => {
          const lineNumber = index + 1;
          const selected = suspects.includes(lineNumber);

          return (
            <li key={lineNumber}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`Línea ${lineNumber}`}
                onClick={() => toggle(lineNumber)}
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                  selected ? "bg-rose-500/15 text-rose-100" : "text-slate-300 hover:bg-white/5",
                )}
              >
                <span aria-hidden="true" className="w-6 shrink-0 select-none text-right text-slate-500">
                  {lineNumber}
                </span>
                <span className="whitespace-pre">{text === "" ? " " : text}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="space-y-2">
        <label htmlFor={causeId} className="text-sm font-medium text-slate-300">
          ¿Cuál es la causa raíz?
        </label>
        <textarea
          id={causeId}
          value={cause}
          rows={3}
          onChange={(event) => setCause(event.target.value)}
          placeholder="Explica qué ocurre y por qué produce el error, no sólo dónde."
          className="w-full rounded-xl border border-line/70 bg-ink-card px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {!causeReady && cause.length > 0 ? (
          <p className="text-xs text-slate-400">
            Faltan {ROOT_CAUSE_MIN_CHARS - cause.trim().length} caracteres para que sea una explicación.
          </p>
        ) : null}
      </div>

      <button type="button" disabled={!ready} onClick={() => setDiagnosed(true)} className={PRIMARY_BUTTON}>
        Empezar a corregir
      </button>
    </section>
  );
}
