"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  TETROMINO_CELLS,
  TETROMINO_COLORS,
  TETROMINO_IDS,
  type TetrominoId,
} from "@/lib/tetromino";
import {
  isMotionPaused,
  setMotionPaused,
  subscribeMotion,
  useMotionPaused,
} from "@/lib/motion-preference";

interface Piece {
  id: TetrominoId;
  x: number;
  y: number;
  /** Profundidad 0 (lejos) a 1 (cerca): gobierna tamaño, velocidad y parallax. */
  depth: number;
  cell: number;
  angle: number;
  spin: number;
  speed: number;
}

function createPiece(width: number, height: number, scatter: boolean): Piece {
  const depth = Math.random();
  const cell = 12 + depth * 26;
  return {
    id: TETROMINO_IDS[Math.floor(Math.random() * TETROMINO_IDS.length)] ?? "T",
    x: Math.random() * width,
    y: scatter ? Math.random() * height : -cell * 5,
    depth,
    cell,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.5,
    speed: 10 + depth * 26,
  };
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  offsetX: number,
  offsetY: number,
): void {
  const cells = TETROMINO_CELLS[piece.id];
  const color = TETROMINO_COLORS[piece.id];
  const { cell } = piece;
  const cols = Math.max(...cells.map(([c]) => c)) + 1;
  const rows = Math.max(...cells.map(([, r]) => r)) + 1;
  const gap = Math.max(1, cell * 0.08);

  ctx.save();
  ctx.translate(piece.x + offsetX * piece.depth, piece.y + offsetY * piece.depth);
  ctx.rotate(piece.angle);
  ctx.translate((-cols * cell) / 2, (-rows * cell) / 2);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  // Las piezas lejanas quedan más tenues para no competir con el texto.
  const fillAlpha = 0.05 + piece.depth * 0.08;
  const strokeAlpha = 0.18 + piece.depth * 0.3;
  const radius = cell * 0.18;

  for (const [c, r] of cells) {
    const px = c * cell + gap;
    const py = r * cell + gap;
    const size = cell - gap * 2;
    ctx.beginPath();
    ctx.roundRect(px, py, size, size, radius);
    ctx.globalAlpha = fillAlpha;
    ctx.fill();
    ctx.globalAlpha = strokeAlpha;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Lluvia decorativa de tetrominós a pantalla completa, detrás del contenido.
 * Respeta `prefers-reduced-motion`, se detiene con la pestaña oculta y ofrece
 * un control para pausarla.
 */
export function TetrisBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paused = useMotionPaused();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let pieces: Piece[] = [];
    let frame = 0;
    let last = 0;
    let pointerX = 0;
    let pointerY = 0;
    let offsetX = 0;
    let offsetY = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(
        Math.min(24, Math.max(8, (width * height) / 80000)),
      );
      pieces = Array.from({ length: target }, () =>
        createPiece(width, height, true),
      );
      render();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      // Primero las lejanas, para que las cercanas queden encima.
      for (const piece of [...pieces].sort((a, b) => a.depth - b.depth)) {
        drawPiece(ctx, piece, offsetX, offsetY);
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      offsetX += (pointerX - offsetX) * 0.05;
      offsetY += (pointerY - offsetY) * 0.05;
      pieces = pieces.map((piece) => {
        const moved = {
          ...piece,
          y: piece.y + piece.speed * dt,
          angle: piece.angle + piece.spin * dt,
        };
        return moved.y - moved.cell * 5 > height
          ? createPiece(width, height, false)
          : moved;
      });
      render();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      if (isMotionPaused() || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const onPointer = (event: PointerEvent) => {
      pointerX = (event.clientX / width - 0.5) * -36;
      pointerY = (event.clientY / height - 0.5) * -36;
    };

    resize();
    start();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", start);
    const unsubscribe = subscribeMotion(start);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", start);
      unsubscribe();
    };
  }, []);

  const toggle = useCallback(() => setMotionPaused(!isMotionPaused()), []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paused}
        className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        <span aria-hidden>{paused ? "▶" : "❚❚"}</span>
        {paused ? "Reanudar fondo animado" : "Pausar fondo animado"}
      </button>
    </>
  );
}
