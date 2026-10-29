import { describe, expect, it } from "vitest";

import {
  COLS,
  ROWS,
  advance,
  choosePlacement,
  emptyBoard,
  initialState,
  pieceAt,
  rotations,
  simulate,
} from "./tetris-engine";
import { TETROMINO_IDS } from "./tetromino";

describe("tetris-engine", () => {
  it("calcula las orientaciones distintas de cada pieza", () => {
    expect(rotations("O")).toHaveLength(1);
    expect(rotations("I")).toHaveLength(2);
    expect(rotations("S")).toHaveLength(2);
    expect(rotations("Z")).toHaveLength(2);
    expect(rotations("T")).toHaveLength(4);
    expect(rotations("J")).toHaveLength(4);
    expect(rotations("L")).toHaveLength(4);
  });

  it("genera la misma secuencia de piezas siempre", () => {
    const first = Array.from({ length: 30 }, (_, i) => pieceAt(i));
    const second = Array.from({ length: 30 }, (_, i) => pieceAt(i));
    expect(first).toEqual(second);
    expect(new Set(first).size).toBeGreaterThan(3);
  });

  it("encuentra una ubicación válida para cada pieza en un tablero vacío", () => {
    for (const id of TETROMINO_IDS) {
      const placement = choosePlacement(emptyBoard(), id);
      expect(placement).not.toBeNull();
      expect(placement!.x).toBeGreaterThanOrEqual(0);
    }
  });

  it("mantiene las piezas dentro del tablero y completa filas durante una larga partida", () => {
    let state = initialState();
    for (let i = 0; i < 4000; i += 1) {
      state = advance(state);
      if (state.piece) {
        for (const [c, r] of state.piece.cells) {
          expect(state.piece.x + c).toBeGreaterThanOrEqual(0);
          expect(state.piece.x + c).toBeLessThan(COLS);
          expect(state.piece.y + r).toBeLessThan(ROWS);
        }
      }
    }
    expect(state.lines).toBeGreaterThan(0);
  });

  it("simula un número fijo de pasos de forma determinista", () => {
    expect(simulate(120)).toEqual(simulate(120));
  });
});
