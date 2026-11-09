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

describe("ExercisePlayer: DEBUG", () => {
  it("abre con el diagnóstico en lugar del editor", async () => {
    const debug = exercise({
      id: "ex-debug",
      type: "DEBUG",
      title: "El rechazo que se pierde",
      language: "typescript",
      starterCode: "const a = 1;\nconst b = 2;",
    });

    render(<ExercisePlayer unitCode="U0.1.1" slug="dbg-1" loadLab={loaderFor(debug)} />);

    expect(await screen.findByText(/Paso 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Línea 2" })).toBeInTheDocument();
  });
});

describe("ExercisePlayer: volver a la unidad", () => {
  it("los ejercicios del cliente ofrecen un enlace visible de regreso a la unidad", async () => {
    render(<ExercisePlayer unitCode="U0.1.1" slug="quiz-1" loadLab={loaderFor(QUIZ)} />);

    const back = await screen.findByRole("link", { name: /Volver a la unidad/ });

    expect(back).toHaveAttribute("href", "/learn/units/U0.1.1");
  });
});

describe("ExercisePlayer: MEMORY en modo unir", () => {
  it("despacha config.mode «match» al tablero de unir, no al de voltear", async () => {
    const match = exercise({
      id: "ex-match",
      type: "MEMORY",
      title: "Une los conceptos",
      statement: "Une cada concepto con su definición.",
      config: {
        mode: "match",
        pairs: [
          { id: "p1", term: "Alcance", definition: "Lo que entra y lo que queda fuera" },
          { id: "p2", term: "Pruebas", definition: "Comprobar que cumple el requisito" },
          { id: "p3", term: "Despliegue", definition: "Llevar el cambio a producción" },
        ],
      },
    });

    render(<ExercisePlayer unitCode="U0.1.1" slug="memoria-u0-1-1" loadLab={loaderFor(match)} />);

    expect(await screen.findByRole("group", { name: "Tablero de unir" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tablero de memoria" })).not.toBeInTheDocument();
    expect(screen.getByText(/Unir conceptos/)).toBeInTheDocument();
  });
});

const AUDIT = exercise({
  id: "ex-audit",
  type: "AUDIT",
  title: "La respuesta que nadie comprueba",
  statement: "Audita la función y marca los defectos que encuentres.",
  config: {
    artifact: {
      language: "typescript",
      content:
        "async function cargar(id: string) {\n  const res = await fetch(`/api/usuarios/${id}`);\n  return res.json();\n}",
    },
    candidates: [
      { id: "f1", lines: [2, 2], label: "No comprueba si la respuesta trae error" },
      { id: "f2", lines: [3, 3], label: "Devuelve el cuerpo sin validar su forma" },
    ],
  },
});

describe("ExercisePlayer: AUDIT", () => {
  it("abre la auditoría en su reproductor, no en el editor de código", async () => {
    render(<ExercisePlayer unitCode="U0.1.1" slug="audit-1" loadLab={loaderFor(AUDIT)} />);

    expect(await screen.findByRole("region", { name: "Artefacto a auditar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar auditoría" })).toBeInTheDocument();
    expect(screen.getByText(/Auditoría/)).toBeInTheDocument();
    expect(screen.queryByText(/Modo de práctica/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });

  it("no confunde la auditoría con una reflexión ni con un quiz", async () => {
    render(<ExercisePlayer unitCode="U0.1.1" slug="audit-1" loadLab={loaderFor(AUDIT)} />);

    await screen.findByRole("region", { name: "Artefacto a auditar" });

    expect(screen.queryByLabelText("Tu reflexión")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Comprobar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tablero de memoria" })).not.toBeInTheDocument();
  });
});
