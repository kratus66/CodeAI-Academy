export type TetrominoId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

/** Celdas [columna, fila] de cada pieza en su orientación inicial. */
export const TETROMINO_CELLS: Readonly<
  Record<TetrominoId, readonly (readonly [number, number])[]>
> = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

/** Paleta clásica de las piezas; coincide con `piece.*` en tailwind.config.ts. */
export const TETROMINO_COLORS: Readonly<Record<TetrominoId, string>> = {
  I: "#22d3ee",
  O: "#facc15",
  T: "#a78bfa",
  S: "#34d399",
  Z: "#fb7185",
  J: "#60a5fa",
  L: "#fb923c",
};

export const TETROMINO_IDS = Object.keys(TETROMINO_CELLS) as TetrominoId[];
