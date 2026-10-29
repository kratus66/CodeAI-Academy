"use client";

import { usePathname } from "next/navigation";

import {
  TETROMINO_CELLS,
  TETROMINO_COLORS,
  type TetrominoId,
} from "@/lib/tetromino";

interface Placement {
  readonly id: TetrominoId;
  readonly className: string;
  readonly size: number;
}

/** Piezas fijas en los bordes: nunca se mueven, para no distraer mientras se estudia. */
const PLACEMENTS: readonly Placement[] = [
  { id: "T", className: "-left-10 top-24", size: 34 },
  { id: "L", className: "-right-8 top-1/3", size: 30 },
  { id: "I", className: "-left-6 bottom-24", size: 28 },
  { id: "S", className: "-right-10 bottom-16", size: 34 },
  { id: "O", className: "right-1/4 -top-8", size: 30 },
];

/** Cubo isométrico de lado `s` centrado en la proyección de la celda (c, r). */
function IsoCube({
  c,
  r,
  s,
  color,
}: {
  readonly c: number;
  readonly r: number;
  readonly s: number;
  readonly color: string;
}) {
  const cx = (c - r) * s * 0.866;
  const cy = (c + r) * s * 0.5;
  const h = s;
  const top = `${cx},${cy - h} ${cx + s * 0.866},${cy - h + s * 0.5} ${cx},${cy - h + s} ${cx - s * 0.866},${cy - h + s * 0.5}`;
  const left = `${cx - s * 0.866},${cy - h + s * 0.5} ${cx},${cy - h + s} ${cx},${cy + s} ${cx - s * 0.866},${cy + s * 0.5}`;
  const right = `${cx + s * 0.866},${cy - h + s * 0.5} ${cx},${cy - h + s} ${cx},${cy + s} ${cx + s * 0.866},${cy + s * 0.5}`;
  const common = { stroke: color, strokeOpacity: 0.55, strokeWidth: 1 };
  return (
    <g>
      <polygon points={left} fill={color} fillOpacity={0.16} {...common} />
      <polygon points={right} fill={color} fillOpacity={0.08} {...common} />
      <polygon points={top} fill={color} fillOpacity={0.32} {...common} />
    </g>
  );
}

function IsoPiece({ id, size }: { readonly id: TetrominoId; readonly size: number }) {
  const color = TETROMINO_COLORS[id];
  // De atrás hacia delante, para que las caras se solapen bien.
  const cells = [...TETROMINO_CELLS[id]].sort(
    ([c1, r1], [c2, r2]) => c1 + r1 - (c2 + r2),
  );
  const extent = size * 7;
  return (
    <svg
      aria-hidden
      width={extent}
      height={extent}
      viewBox={`${-extent / 2} ${-size * 2} ${extent} ${extent}`}
      fill="none"
      className="overflow-visible"
    >
      {cells.map(([c, r]) => (
        <IsoCube key={`${c}-${r}`} c={c} r={r} s={size} color={color} />
      ))}
    </svg>
  );
}

/**
 * Decoración 3D estática para todo el sitio salvo la portada, que tiene su
 * propio fondo animado.
 */
export function AmbientPieces() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block"
    >
      {PLACEMENTS.map((placement) => (
        <div key={placement.id} className={`absolute opacity-70 ${placement.className}`}>
          <IsoPiece id={placement.id} size={placement.size} />
        </div>
      ))}
    </div>
  );
}
