import {
  TETROMINO_CELLS,
  TETROMINO_IDS,
  type TetrominoId,
} from "./tetromino";

export const COLS = 10;
export const ROWS = 14;
/** Si la pila sube hasta aquí, el tablero se reinicia para que la demo no termine. */
const RESET_HEIGHT = ROWS - 4;

export type Cell = TetrominoId | null;
export type Board = readonly (readonly Cell[])[];
export type Shape = readonly (readonly [number, number])[];

export interface ActivePiece {
  readonly id: TetrominoId;
  readonly cells: Shape;
  readonly x: number;
  readonly y: number;
  readonly targetX: number;
  readonly finalY: number;
}

export interface EngineState {
  readonly board: Board;
  readonly piece: ActivePiece | null;
  /** Filas completas que aún se muestran con destello antes de borrarse. */
  readonly clearing: readonly number[];
  readonly lines: number;
  /** Índice de la siguiente pieza de la secuencia. */
  readonly index: number;
}

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => null),
  );
}

/** Secuencia determinista (misma en servidor y cliente) de piezas. */
export function pieceAt(index: number): TetrominoId {
  const hash = Math.imul(index + 1, 2654435761) >>> 16;
  return TETROMINO_IDS[hash % TETROMINO_IDS.length] ?? "T";
}

function normalize(cells: Shape): Shape {
  const minC = Math.min(...cells.map(([c]) => c));
  const minR = Math.min(...cells.map(([, r]) => r));
  return cells.map(([c, r]) => [c - minC, r - minR] as const);
}

function shapeKey(cells: Shape): string {
  return [...cells]
    .map(([c, r]) => `${c},${r}`)
    .sort()
    .join(";");
}

/** Orientaciones distintas de una pieza (la O tiene una, la I y S/Z dos, el resto cuatro). */
export function rotations(id: TetrominoId): Shape[] {
  const seen = new Map<string, Shape>();
  let current: Shape = normalize(TETROMINO_CELLS[id]);
  for (let i = 0; i < 4; i += 1) {
    seen.set(shapeKey(current), current);
    current = normalize(current.map(([c, r]) => [-r, c] as const));
  }
  return [...seen.values()];
}

export function shapeWidth(cells: Shape): number {
  return Math.max(...cells.map(([c]) => c)) + 1;
}

function collides(board: Board, cells: Shape, x: number, y: number): boolean {
  return cells.some(([c, r]) => {
    const bx = x + c;
    const by = y + r;
    if (bx < 0 || bx >= COLS || by >= ROWS) return true;
    return by >= 0 && board[by]?.[bx] != null;
  });
}

/** Fila final al soltar la pieza en la columna `x`, o `null` si no cabe. */
function landingY(board: Board, cells: Shape, x: number): number | null {
  if (collides(board, cells, x, 0)) return null;
  let y = 0;
  while (!collides(board, cells, x, y + 1)) y += 1;
  return y;
}

function lock(
  board: Board,
  id: TetrominoId,
  cells: Shape,
  x: number,
  y: number,
): Board {
  const next = board.map((row) => [...row]);
  for (const [c, r] of cells) {
    const row = next[y + r];
    if (row) row[x + c] = id;
  }
  return next;
}

export function fullRows(board: Board): number[] {
  return board.flatMap((row, index) =>
    row.every((cell) => cell !== null) ? [index] : [],
  );
}

function removeRows(board: Board, rows: readonly number[]): Board {
  const kept = board.filter((_, index) => !rows.includes(index));
  const fill = Array.from({ length: rows.length }, () =>
    Array.from({ length: COLS }, (): Cell => null),
  );
  return [...fill, ...kept];
}

export function stackHeight(board: Board): number {
  const top = board.findIndex((row) => row.some((cell) => cell !== null));
  return top === -1 ? 0 : ROWS - top;
}

/** Evalúa un tablero con la heurística clásica (alturas, huecos, irregularidad, líneas). */
function evaluate(board: Board, lines: number): number {
  const heights = Array.from({ length: COLS }, (_, col) => {
    const top = board.findIndex((row) => row[col] != null);
    return top === -1 ? 0 : ROWS - top;
  });
  let holes = 0;
  for (let col = 0; col < COLS; col += 1) {
    let seen = false;
    for (let row = 0; row < ROWS; row += 1) {
      if (board[row]?.[col] != null) seen = true;
      else if (seen) holes += 1;
    }
  }
  let bumpiness = 0;
  for (let col = 0; col < COLS - 1; col += 1) {
    bumpiness += Math.abs((heights[col] ?? 0) - (heights[col + 1] ?? 0));
  }
  const aggregate = heights.reduce((sum, h) => sum + h, 0);
  return -0.51 * aggregate + 0.76 * lines - 0.36 * holes - 0.18 * bumpiness;
}

export function choosePlacement(
  board: Board,
  id: TetrominoId,
): { cells: Shape; x: number; y: number } | null {
  let best: { cells: Shape; x: number; y: number; score: number } | null = null;
  for (const cells of rotations(id)) {
    for (let x = 0; x <= COLS - shapeWidth(cells); x += 1) {
      const y = landingY(board, cells, x);
      if (y === null) continue;
      const locked = lock(board, id, cells, x, y);
      const score = evaluate(removeRows(locked, fullRows(locked)), fullRows(locked).length);
      if (best === null || score > best.score) best = { cells, x, y, score };
    }
  }
  return best && { cells: best.cells, x: best.x, y: best.y };
}

export function initialState(): EngineState {
  return { board: emptyBoard(), piece: null, clearing: [], lines: 0, index: 0 };
}

/** Un paso de animación: mover, soltar, fijar o borrar filas. */
export function advance(state: EngineState): EngineState {
  if (state.clearing.length > 0) {
    return {
      ...state,
      board: removeRows(state.board, state.clearing),
      clearing: [],
      lines: state.lines + state.clearing.length,
    };
  }

  const { piece } = state;
  if (piece === null) {
    const board =
      stackHeight(state.board) > RESET_HEIGHT ? emptyBoard() : state.board;
    const id = pieceAt(state.index);
    const placement = choosePlacement(board, id);
    if (placement === null) {
      return { ...state, board: emptyBoard(), index: state.index + 1 };
    }
    const spawnX = Math.floor((COLS - shapeWidth(placement.cells)) / 2);
    return {
      ...state,
      board,
      index: state.index + 1,
      piece: {
        id,
        cells: placement.cells,
        x: spawnX,
        y: 0,
        targetX: placement.x,
        finalY: placement.y,
      },
    };
  }

  if (piece.x !== piece.targetX) {
    const step = piece.targetX > piece.x ? 1 : -1;
    return { ...state, piece: { ...piece, x: piece.x + step } };
  }
  if (piece.y < piece.finalY) {
    return { ...state, piece: { ...piece, y: piece.y + 1 } };
  }

  const board = lock(state.board, piece.id, piece.cells, piece.x, piece.y);
  return { ...state, board, piece: null, clearing: fullRows(board) };
}

/** Avanza `steps` pasos; sirve para generar la imagen estática sin animación. */
export function simulate(steps: number, from: EngineState = initialState()): EngineState {
  let state = from;
  for (let i = 0; i < steps; i += 1) state = advance(state);
  return state;
}
