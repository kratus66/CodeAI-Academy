import type { ExerciseDetail, QuizGradeResult } from "@codeai/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { QuizMultiplePlayer } from "./QuizMultiplePlayer";
import { QuizPlayer } from "./QuizPlayer";

const EXPLANATIONS = {
  a: "Idempotente: repetir la petición no duplica el efecto.",
  b: "Asíncrona: la cola responde antes de terminar el trabajo.",
  c: "Bloqueante: una cola no debería bloquear el hilo.",
  d: "Sincronizada: no describe el reparto de microtareas.",
  e: "Tolerante a fallos: reintenta sin perder la tarea.",
};

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
    statement: "¿Qué propiedades describen una cola de microtareas?",
    config: {
      kind: "multiple",
      selectCount: 2,
      options: [
        { id: "a", text: "Idempotente" },
        { id: "b", text: "Asíncrona" },
        { id: "c", text: "Bloqueante" },
        { id: "d", text: "Sincronizada" },
        { id: "e", text: "Tolerante a fallos" },
      ],
    },
    publicTests: [],
    hintsAvailable: 0,
    starterCode: null,
    ...overrides,
  };
}

const CORRECT_RESULT = {
  kind: "multiple",
  correct: true,
  correctOptionIds: ["b", "e"],
  selectedOptionIds: ["b", "e"],
  explanations: EXPLANATIONS,
} satisfies QuizGradeResult;

const PARTIAL_RESULT = {
  kind: "multiple",
  correct: false,
  correctOptionIds: ["b", "e"],
  selectedOptionIds: ["b", "c"],
  explanations: EXPLANATIONS,
} satisfies QuizGradeResult;

describe("QuizMultiplePlayer", () => {
  it("sólo habilita comprobar con las casillas pedidas y anuncia cuántas son", () => {
    render(<QuizMultiplePlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    expect(screen.getByText("Selecciona DOS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Asíncrona/));

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Tolerante a fallos/));

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeEnabled();
  });

  it("deshabilita las demás casillas al llegar al número pedido", () => {
    render(<QuizMultiplePlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    fireEvent.click(screen.getByLabelText(/Asíncrona/));
    fireEvent.click(screen.getByLabelText(/Tolerante a fallos/));

    expect(screen.getByLabelText(/Idempotente/)).toBeDisabled();
    expect(screen.getByLabelText(/Bloqueante/)).toBeDisabled();
    expect(screen.getByLabelText(/Asíncrona/)).toBeEnabled();
    expect(screen.getByLabelText(/Tolerante a fallos/)).toBeEnabled();
  });

  it("no muestra ninguna explicación antes de comprobar", () => {
    render(<QuizMultiplePlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    expect(screen.queryByText(EXPLANATIONS.b)).not.toBeInTheDocument();
    expect(screen.queryByText(EXPLANATIONS.e)).not.toBeInTheDocument();
  });

  it("envía las dos opciones marcadas y explica cada una al acertar", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(CORRECT_RESULT);
    render(<QuizMultiplePlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByLabelText(/Asíncrona/));
    fireEvent.click(screen.getByLabelText(/Tolerante a fallos/));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByText("¡Correcto!")).toBeInTheDocument();
    expect(submitQuiz).toHaveBeenCalledWith("ex-1", { optionIds: ["b", "e"] });
    expect(screen.getByText(EXPLANATIONS.b)).toBeInTheDocument();
    expect(screen.getByText(EXPLANATIONS.e)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intentar de nuevo" })).toBeInTheDocument();
  });

  it("en un fallo parcial marca la que faltó y la elegida de más", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(PARTIAL_RESULT);
    render(<QuizMultiplePlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByLabelText(/Asíncrona/));
    fireEvent.click(screen.getByLabelText(/Bloqueante/));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(
      await screen.findByText(
        "Todavía no. Una respuesta múltiple se corrige completa: hay que elegir todas las correctas y ninguna más.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("te faltó")).toBeInTheDocument();
    expect(screen.getByText("fallo")).toBeInTheDocument();
    expect(screen.getByText("acierto")).toBeInTheDocument();
    expect(submitQuiz).toHaveBeenCalledWith("ex-1", { optionIds: ["b", "c"] });
  });

  it("reinicia las casillas al intentarlo de nuevo", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(CORRECT_RESULT);
    render(<QuizMultiplePlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByLabelText(/Asíncrona/));
    fireEvent.click(screen.getByLabelText(/Tolerante a fallos/));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Intentar de nuevo" }));

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();
    expect(screen.getByLabelText(/Asíncrona/)).not.toBeChecked();
    expect(screen.queryByText(EXPLANATIONS.b)).not.toBeInTheDocument();
    expect(screen.queryByText("te faltó")).not.toBeInTheDocument();
  });

  it("muestra el error de la API sin inventar un resultado", async () => {
    const submitQuiz = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ status: 409, code: "CONFLICT", message: "Agotaste los intentos." }),
      );
    render(<QuizMultiplePlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByLabelText(/Asíncrona/));
    fireEvent.click(screen.getByLabelText(/Tolerante a fallos/));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Agotaste los intentos.");
    expect(screen.queryByText("¡Correcto!")).not.toBeInTheDocument();
  });
});


describe("QuizPlayer — despacho por variante", () => {
  it("manda la respuesta múltiple a su reproductor y envía la corrección", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(CORRECT_RESULT);
    render(<QuizPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    expect(screen.getByText("Selecciona DOS")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    fireEvent.click(screen.getByLabelText(/Asíncrona/));
    fireEvent.click(screen.getByLabelText(/Tolerante a fallos/));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByText("¡Correcto!")).toBeInTheDocument();
    expect(submitQuiz).toHaveBeenCalledWith("ex-1", { optionIds: ["b", "e"] });
  });

  it("trata un quiz sin kind como respuesta única", () => {
    render(
      <QuizPlayer
        exercise={exercise({ config: { options: [{ id: "a", text: "Primero entender" }] } })}
        answerQuiz={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.queryByText("Selecciona DOS")).not.toBeInTheDocument();
  });

  it("avisa de que una variante todavía no está disponible", () => {
    render(<QuizPlayer exercise={exercise({ config: { kind: "ordering", items: [] } })} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este tipo de pregunta todavía no está disponible.",
    );
  });
});

