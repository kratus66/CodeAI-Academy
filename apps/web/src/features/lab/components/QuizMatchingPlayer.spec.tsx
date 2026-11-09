import type { ExerciseDetail, QuizGradeResult } from "@codeai/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { QuizMatchingPlayer } from "./QuizMatchingPlayer";
import { QuizPlayer } from "./QuizPlayer";

const LEFT = [
  { id: "a", text: "TCP" },
  { id: "b", text: "IP" },
  { id: "c", text: "HTTP" },
];

const RIGHT = [
  { id: "1", text: "Capa de red" },
  { id: "2", text: "Capa de transporte" },
  { id: "3", text: "Capa de aplicación" },
];

const EXPLANATIONS = {
  a: "TCP segmenta y ordena los datos: es de la capa de transporte.",
  b: "IP enruta paquetes entre redes: es de la capa de red.",
  c: "HTTP habla con el servidor: es de la capa de aplicación.",
};

const CORRECT_PAIRS = { a: "2", b: "1", c: "3" };

function exercise(overrides: Partial<ExerciseDetail> = {}): ExerciseDetail {
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
    statement: "Empareja cada protocolo con su capa.",
    config: { kind: "matching", left: LEFT, right: RIGHT },
    publicTests: [],
    hintsAvailable: 0,
    starterCode: null,
    ...overrides,
  };
}

const CORRECT_RESULT = {
  kind: "matching",
  correct: true,
  correctPairs: CORRECT_PAIRS,
  explanations: EXPLANATIONS,
} satisfies QuizGradeResult;

const WRONG_RESULT = {
  kind: "matching",
  correct: false,
  correctPairs: CORRECT_PAIRS,
  explanations: EXPLANATIONS,
} satisfies QuizGradeResult;

function selectOf(text: string): HTMLSelectElement {
  return screen.getByLabelText(`Pareja de ${text}`);
}

function choose(text: string, value: string): void {
  fireEvent.change(selectOf(text), { target: { value } });
}

function chooseEverything(): void {
  choose("TCP", "2");
  choose("IP", "1");
  choose("HTTP", "3");
}

function row(text: string): HTMLElement {
  const element = screen.getByText(text).closest("li");

  if (element === null) {
    throw new Error(`No hay fila para «${text}»`);
  }

  return element;
}

describe("QuizMatchingPlayer", () => {
  it("sólo habilita «Comprobar» cuando todas las filas tienen pareja", () => {
    render(<QuizMatchingPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();

    choose("TCP", "2");

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();

    choose("IP", "1");

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();

    choose("HTTP", "3");

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeEnabled();
  });

  it("deshabilita en las demás filas la pareja ya elegida", () => {
    render(<QuizMatchingPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    choose("TCP", "2");

    expect(within(selectOf("TCP")).getByRole("option", { name: "Capa de transporte" })).toBeEnabled();
    expect(within(selectOf("IP")).getByRole("option", { name: "Capa de transporte" })).toBeDisabled();
    expect(within(selectOf("HTTP")).getByRole("option", { name: "Capa de transporte" })).toBeDisabled();
    expect(within(selectOf("IP")).getByRole("option", { name: "Capa de red" })).toBeEnabled();
  });

  it("envía las parejas elegidas al comprobar", () => {
    const submitQuiz = vi.fn().mockResolvedValue(WRONG_RESULT);
    render(<QuizMatchingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    chooseEverything();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(submitQuiz).toHaveBeenCalledWith("ex-1", { pairs: { a: "2", b: "1", c: "3" } });
  });

  it("no revela parejas correctas ni explicaciones antes de comprobar", () => {
    render(<QuizMatchingPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    chooseEverything();

    expect(screen.queryByText(/Pareja correcta/)).not.toBeInTheDocument();
    expect(screen.queryByText(EXPLANATIONS.a)).not.toBeInTheDocument();
    expect(screen.queryByText(EXPLANATIONS.b)).not.toBeInTheDocument();
    expect(screen.queryByText(EXPLANATIONS.c)).not.toBeInTheDocument();
  });

  it("tras un fallo muestra tu elección, la pareja correcta y la explicación", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(WRONG_RESULT);
    render(<QuizMatchingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    choose("TCP", "1");
    choose("IP", "2");
    choose("HTTP", "3");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(
      await screen.findByText("Todavía no. Todas las parejas deben ser correctas."),
    ).toBeInTheDocument();

    const tcp = row("TCP");
    expect(tcp).toHaveTextContent("Tu elección: Capa de red");
    expect(tcp).toHaveTextContent("Pareja correcta: Capa de transporte");
    expect(tcp).toHaveTextContent(EXPLANATIONS.a);
  });

  it("muestra «¡Correcto!» y la explicación de cada pareja al acertar", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(CORRECT_RESULT);
    render(<QuizMatchingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    chooseEverything();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByText("¡Correcto!")).toBeInTheDocument();
    expect(screen.getByText(EXPLANATIONS.a)).toBeInTheDocument();
    expect(screen.getByText(EXPLANATIONS.b)).toBeInTheDocument();
    expect(screen.getByText(EXPLANATIONS.c)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intentar de nuevo" })).toBeInTheDocument();
  });

  it("reinicia las parejas al intentarlo de nuevo", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(WRONG_RESULT);
    render(<QuizMatchingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    chooseEverything();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Intentar de nuevo" }));

    expect(selectOf("TCP")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();
    expect(screen.queryByText(EXPLANATIONS.a)).not.toBeInTheDocument();
  });

  it("muestra el error de la API sin inventar un resultado", async () => {
    const submitQuiz = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ status: 409, code: "CONFLICT", message: "Agotaste los intentos." }),
      );
    render(<QuizMatchingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    chooseEverything();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Agotaste los intentos.");
    expect(screen.queryByText("¡Correcto!")).not.toBeInTheDocument();
  });

  it("avisa cuando la configuración no trae las dos columnas", () => {
    render(
      <QuizMatchingPlayer
        exercise={exercise({ config: { kind: "matching", left: LEFT, right: [] } })}
        submitQuiz={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Este quiz no tiene opciones disponibles.");
  });
});

describe("QuizPlayer — despacho por variante", () => {
  it("manda el quiz de emparejar a su reproductor", () => {
    render(<QuizPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getByLabelText("Pareja de TCP")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});
