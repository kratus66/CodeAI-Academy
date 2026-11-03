import type { ExerciseDetail } from "@codeai/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExerciseLabContent } from "./ExerciseLab";
import { ExercisePlayer } from "./ExercisePlayer";

function exercise(overrides: Partial<ExerciseDetail>): ExerciseDetail {
  return {
    id: "ex-1",
    unitId: "unit-1",
    unitCode: "U0.1.1",
    type: "QUIZ",
    title: "Título",
    ladder: "GUIDED",
    difficulty: 1,
    estimatedMin: 2,
    language: null,
    competencies: ["C1"],
    statement: "Enunciado.",
    config: {},
    publicTests: [],
    hintsAvailable: 0,
    starterCode: null,
    ...overrides,
  };
}

const MEMORY = exercise({
  id: "ex-memory",
  type: "MEMORY",
  title: "Memory de comandos de Git",
  statement: "Empareja cada comando con lo que hace.",
  config: {
    pairs: [
      { id: "p1", term: "git commit", definition: "Registra los cambios en el historial local" },
      { id: "p2", term: "git push", definition: "Envía los commits al repositorio remoto" },
    ],
  },
});

const QUIZ = exercise({
  type: "QUIZ",
  config: {
    options: [
      { id: "a", text: "Primero programar" },
      { id: "b", text: "Primero entender" },
    ],
  },
});

function loaderFor(source: ExerciseDetail) {
  return async (): Promise<ExerciseLabContent> => ({
    exercise: source,
    unitTitle: "Unidad 1",
    lessonId: "lesson-1",
  });
}

describe("ExercisePlayer", () => {
  it("despacha MEMORY al tablero de memoria, sin editor de código", async () => {
    render(<ExercisePlayer unitCode="U0.1.1" slug="mem-1" loadLab={loaderFor(MEMORY)} />);

    expect(await screen.findByRole("group", { name: "Tablero de memoria" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Carta boca abajo" })).toHaveLength(4);
    expect(screen.getByText(/Juego de memoria/)).toBeInTheDocument();
    expect(screen.queryByText(/Modo de práctica/)).not.toBeInTheDocument();
  });

  it("no confunde un MEMORY con un quiz ni con una reflexión", async () => {
    render(<ExercisePlayer unitCode="U0.1.1" slug="mem-1" loadLab={loaderFor(MEMORY)} />);

    await screen.findByRole("group", { name: "Tablero de memoria" });

    expect(screen.queryByRole("button", { name: "Comprobar" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tu reflexión")).not.toBeInTheDocument();
  });

  it("mantiene el quiz en su jugador", async () => {
    render(<ExercisePlayer unitCode="U0.1.1" slug="quiz-1" loadLab={loaderFor(QUIZ)} />);

    expect(await screen.findByRole("button", { name: "Comprobar" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tablero de memoria" })).not.toBeInTheDocument();
  });
});
