import type { CSSProperties } from "react";

import {
  TETROMINO_CELLS,
  TETROMINO_COLORS,
  type TetrominoId,
} from "@/lib/tetromino";

interface PieceIconProps {
  readonly id: TetrominoId;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** Miniatura decorativa de un tetrominó; hereda su tamaño de `className`. */
export function PieceIcon({ id, className, style }: PieceIconProps) {
  const cells = TETROMINO_CELLS[id];
  const color = TETROMINO_COLORS[id];
  const cols = Math.max(...cells.map(([c]) => c)) + 1;
  const rows = Math.max(...cells.map(([, r]) => r)) + 1;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${cols * 10} ${rows * 10}`}
      className={className}
      style={style}
      fill="none"
    >
      {cells.map(([c, r]) => (
        <rect
          key={`${c}-${r}`}
          x={c * 10 + 1}
          y={r * 10 + 1}
          width={8}
          height={8}
          rx={2}
          fill={color}
          fillOpacity={0.25}
          stroke={color}
          strokeWidth={1.2}
        />
      ))}
    </svg>
  );
}
