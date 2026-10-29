"use client";

import { useEffect, useMemo, useState } from "react";

import { PieceIcon } from "@/components/effects/PieceIcon";
import {
  COLS,
  ROWS,
  advance,
  pieceAt,
  simulate,
  type EngineState,
} from "@/lib/tetris-engine";
import { useMotionPaused } from "@/lib/motion-preference";
import { TETROMINO_COLORS, type TetrominoId } from "@/lib/tetromino";

const TICK_MS = 110;
/** Pasos para dejar una pila presentable en la imagen estática. */
const STATIC_STEPS = 260;

function cellStyle(id: TetrominoId | null, flash: boolean) {
  if (flash) {
    return {
      backgroundColor: "rgba(255,255,255,0.85)",
      borderColor: "rgba(255,255,255,1)",
      boxShadow: "0 0 14px rgba(255,255,255,0.8)",
    };
  }
  if (id === null) return undefined;
  const color = TETROMINO_COLORS[id];
  return {
    backgroundColor: `${color}40`,
    borderColor: `${color}cc`,
    boxShadow: `0 0 10px ${color}55`,
  };
}

/**
 * Tablero decorativo: una "IA" juega sola, encaja piezas y borra filas.
 * Sin movimiento (preferencia o sistema), muestra una pila ya formada.
 */
export function HeroBoard() {
  const paused = useMotionPaused();
  const staticState = useMemo(() => simulate(STATIC_STEPS), []);
  const [live, setLive] = useState<EngineState>(staticState);

  useEffect(() => {
    if (paused) return;
    let timer = 0;
    const run = () => {
      window.clearInterval(timer);
      if (document.hidden) return;
      timer = window.setInterval(() => setLive(advance), TICK_MS);
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [paused]);

  const state = paused ? staticState : live;

  const grid = state.board.map((row) => [...row]);
  const flashing = new Set(state.clearing);
  if (state.piece) {
    for (const [c, r] of state.piece.cells) {
      const row = grid[state.piece.y + r];
      if (row) row[state.piece.x + c] = state.piece.id;
    }
  }
  const next = pieceAt(state.index);

  return (
    <div className="flex items-stretch gap-5" aria-hidden>
      <div
        className="grid flex-none gap-px rounded-lg border border-white/10 bg-ink/60 p-1"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          width: "11.5rem",
          aspectRatio: `${COLS} / ${ROWS}`,
        }}
      >
        {grid.flatMap((row, r) =>
          row.map((cell, c) => (
            <span
              key={`${r}-${c}`}
              className="rounded-[2px] border border-white/[0.04] transition-colors duration-100"
              style={cellStyle(cell, flashing.has(r))}
            />
          )),
        )}
      </div>

      <dl className="flex min-w-0 flex-1 flex-col justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
        <div>
          <dt>Filas</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-normal text-white">
            {String(state.lines).padStart(2, "0")}
          </dd>
        </div>
        <div>
          <dt>Siguiente</dt>
          <dd className="mt-2 flex h-10 items-center">
            <PieceIcon id={next} className="h-8 w-auto" />
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd className="mt-1 normal-case tracking-normal text-mint">
            {paused ? "en pausa" : "auditando…"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
