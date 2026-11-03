import type { ExerciseDetail } from "@codeai/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryPlayer } from "./MemoryPlayer";
import type { ShuffleCards } from "./MemoryPlayer";

const PAIRS = [
  { id: "p1", term: "git commit", definition: "Registra los cambios en el historial local" },
  { id: "p2", term: "git push", definition: "Envía los commits al repositorio remoto" },
  { id: "p3", term: "git clone", definition: "Copia un repositorio en tu equipo" },
];

function exercise(config: Record<string, unknown> = { pairs: PAIRS }): ExerciseDetail {
  return {
    id: "ex-memory",
    unitId: "unit-1",
    unitCode: "U0.1.1",
    type: "MEMORY",
    title: "Memory de comandos de Git",
    ladder: "GUIDED",
    difficulty: 1,
    estimatedMin: 2,
    language: null,
    competencies: ["C3"],
    statement: "Empareja cada comando con lo que hace.",
    config,
    publicTests: [],
    hintsAvailable: 0,
    starterCode: null,
  };
}

/** Barajado inyectable: deja el tablero en [t1, d1, t2, d2, t3, d3]. */
const dealInOrder: ShuffleCards = (cards) => [...cards];

function cardAt(position: number): HTMLElement {
  const card = within(screen.getByRole("group", { name: "Tablero de memoria" })).getAllByRole("button")[
    position
  ];

  if (card === undefined) {
    throw new Error(`No hay carta en la posición ${position}`);
  }

  return card;
}

function hiddenCards(): HTMLElement[] {
  return screen.getAllByRole("button", { name: "Carta boca abajo" });
}

describe("MemoryPlayer", () => {
  it("no revela ninguna carta al empezar", () => {
    render(<MemoryPlayer exercise={exercise()} shuffle={dealInOrder} />);

    expect(screen.getByText("Empareja cada comando con lo que hace.")).toBeInTheDocument();
    expect(hiddenCards()).toHaveLength(6);
    expect(screen.queryByText("git commit")).not.toBeInTheDocument();
  });

  it("empareja el término con su definición y cuenta un movimiento", () => {
    render(<MemoryPlayer exercise={exercise()} shuffle={dealInOrder} />);

    fireEvent.click(cardAt(0));
    fireEvent.click(cardAt(1));

    expect(screen.getByRole("status")).toHaveTextContent("Movimientos: 1 · Pares: 1 de 3");
    expect(screen.getByText("Registra los cambios en el historial local")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "git commit" })).toBeDisabled();
  });

  it("cuenta el fallo y gira las cartas sin dejar abrir una tercera", async () => {
    render(<MemoryPlayer exercise={exercise()} shuffle={dealInOrder} flipBackMs={0} />);

    fireEvent.click(cardAt(0));
    fireEvent.click(cardAt(2));
    fireEvent.click(cardAt(4));

    expect(screen.getByRole("status")).toHaveTextContent("Movimientos: 1 · Pares: 0 de 3");
    expect(hiddenCards()).toHaveLength(4);

    await waitFor(() => expect(hiddenCards()).toHaveLength(6));
  });

  it("al completar anuncia los movimientos y los pares para repasar", async () => {
    render(<MemoryPlayer exercise={exercise()} shuffle={dealInOrder} flipBackMs={0} />);

    fireEvent.click(cardAt(0));
    fireEvent.click(cardAt(2));

    await waitFor(() => expect(hiddenCards()).toHaveLength(6));

    fireEvent.click(cardAt(0));
    fireEvent.click(cardAt(1));
    fireEvent.click(cardAt(2));
    fireEvent.click(cardAt(3));
    fireEvent.click(cardAt(4));
    fireEvent.click(cardAt(5));

    expect(await screen.findByRole("status")).toHaveTextContent("Tablero completado en 4 movimientos.");
    expect(screen.getByText("Pares para repasar:")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list"))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["git commit", "git push"]);
  });

  it("sin fallos no propone repaso", async () => {
    render(<MemoryPlayer exercise={exercise()} shuffle={dealInOrder} />);

    fireEvent.click(cardAt(0));
    fireEvent.click(cardAt(1));
    fireEvent.click(cardAt(2));
    fireEvent.click(cardAt(3));
    fireEvent.click(cardAt(4));
    fireEvent.click(cardAt(5));

    expect(await screen.findByRole("status")).toHaveTextContent("Tablero completado en 3 movimientos.");
    expect(screen.getByText("Sin fallos: este tablero no necesita repaso.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("reinicia el tablero y los contadores", () => {
    render(<MemoryPlayer exercise={exercise()} shuffle={dealInOrder} />);

    fireEvent.click(cardAt(0));
    fireEvent.click(cardAt(1));
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));

    expect(screen.getByRole("status")).toHaveTextContent("Movimientos: 0 · Pares: 0 de 3");
    expect(hiddenCards()).toHaveLength(6);
  });

  it("avisa si el ejercicio no trae pares", () => {
    render(<MemoryPlayer exercise={exercise({})} shuffle={dealInOrder} />);

    expect(screen.getByRole("alert")).toHaveTextContent("no tiene pares disponibles");
  });

  it("descarta los pares incompletos en vez de romper el tablero", () => {
    render(
      <MemoryPlayer
        exercise={exercise({
          pairs: [PAIRS[0], { term: "sin definición" }, PAIRS[1], { id: "p9", term: "", definition: "x" }],
        })}
        shuffle={dealInOrder}
      />,
    );

    expect(hiddenCards()).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent("Pares: 0 de 2");
  });
});
