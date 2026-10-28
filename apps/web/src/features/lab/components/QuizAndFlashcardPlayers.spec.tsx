import type { ExerciseDetail } from "@codeai/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { FlashcardPlayer } from "./FlashcardPlayer";
import { QuizPlayer } from "./QuizPlayer";
import { ReflectionPlayer } from "./ReflectionPlayer";

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
    statement: "¿Cuál es el orden correcto?",
    config: {
      options: [
        { id: "a", text: "Primero programar" },
        { id: "b", text: "Primero entender" },
        { id: "c", text: "Primero desplegar" },
      ],
    },
    publicTests: [],
    hintsAvailable: 0,
    starterCode: null,
    ...overrides,
  };
}

describe("QuizPlayer", () => {
  it("no muestra la respuesta antes de comprobar y deshabilita comprobar sin selección", () => {
    render(<QuizPlayer exercise={exercise()} answerQuiz={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();
    expect(screen.queryByText(/La correcta es/)).not.toBeInTheDocument();
  });

  it("envía la opción elegida y explica un acierto", async () => {
    const answerQuiz = vi.fn().mockResolvedValue({
      correct: true,
      correctOptionId: "b",
      explanation: "Se entiende antes de construir.",
      correctExplanation: "Se entiende antes de construir.",
    });
    render(<QuizPlayer exercise={exercise()} answerQuiz={answerQuiz} />);

    fireEvent.click(screen.getByLabelText(/Primero entender/));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByText("¡Correcto!")).toBeInTheDocument();
    expect(answerQuiz).toHaveBeenCalledWith("ex-1", "b");
    expect(screen.getByText("Se entiende antes de construir.")).toBeInTheDocument();
    expect(screen.queryByText(/La correcta es/)).not.toBeInTheDocument();
  });

  it("en un fallo explica la opción elegida y la correcta, y permite reintentar", async () => {
    const answerQuiz = vi.fn().mockResolvedValue({
      correct: false,
      correctOptionId: "b",
      explanation: "Programar primero rehace trabajo.",
      correctExplanation: "Entender primero evita rehacer.",
    });
    render(<QuizPlayer exercise={exercise()} answerQuiz={answerQuiz} />);

    fireEvent.click(screen.getByLabelText(/Primero programar/));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByText("Todavía no.")).toBeInTheDocument();
    expect(screen.getByText("Programar primero rehace trabajo.")).toBeInTheDocument();
    expect(screen.getByText(/La correcta es la B/)).toBeInTheDocument();
    expect(screen.getByText("Entender primero evita rehacer.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));

    expect(screen.getByRole("button", { name: "Comprobar" })).toBeDisabled();
  });

  it("muestra el error de la API sin inventar un resultado", async () => {
    const answerQuiz = vi
      .fn()
      .mockRejectedValue(new ApiError({ status: 409, code: "CONFLICT", message: "Agotaste los intentos." }));
    render(<QuizPlayer exercise={exercise()} answerQuiz={answerQuiz} />);

    fireEvent.click(screen.getByLabelText(/Primero entender/));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Agotaste los intentos.");
    expect(screen.queryByText("¡Correcto!")).not.toBeInTheDocument();
  });

  it("avisa si el quiz no trae opciones", () => {
    render(<QuizPlayer exercise={exercise({ config: {} })} answerQuiz={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("no tiene opciones");
  });
});

describe("FlashcardPlayer", () => {
  const card = exercise({ type: "FLASHCARD", statement: "Define «criterio de aceptación».", config: {} });

  it("exige un intento antes de pedir el reverso", () => {
    render(<FlashcardPlayer exercise={card} revealFlashcard={vi.fn()} rateFlashcard={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Ver respuesta" })).toBeDisabled();
    expect(screen.queryByText("Respuesta")).not.toBeInTheDocument();
  });

  it("revela el reverso tras el intento, califica y confirma el repaso", async () => {
    const revealFlashcard = vi.fn().mockResolvedValue({ back: "Condición verificable." });
    const rateFlashcard = vi.fn().mockResolvedValue({ scheduled: true });
    render(
      <FlashcardPlayer exercise={card} revealFlashcard={revealFlashcard} rateFlashcard={rateFlashcard} />,
    );

    fireEvent.change(screen.getByLabelText(/Escribe lo que recuerdas/), {
      target: { value: "  algo que se verifica  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ver respuesta" }));

    expect(await screen.findByText("Condición verificable.")).toBeInTheDocument();
    expect(revealFlashcard).toHaveBeenCalledWith("ex-1", "algo que se verifica");

    fireEvent.click(screen.getByRole("button", { name: "Calidad 4: Con duda menor" }));

    expect(await screen.findByText(/volverá en tu repaso/)).toBeInTheDocument();
    expect(rateFlashcard).toHaveBeenCalledWith("ex-1", 4);
  });

  it("muestra el error si el reverso no se puede pedir y no lo inventa", async () => {
    const revealFlashcard = vi
      .fn()
      .mockRejectedValue(new ApiError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "No disponible." }));
    render(<FlashcardPlayer exercise={card} revealFlashcard={revealFlashcard} rateFlashcard={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Escribe lo que recuerdas/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Ver respuesta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No disponible.");
    expect(screen.queryByText("Respuesta")).not.toBeInTheDocument();
  });
});

describe("ReflectionPlayer", () => {
  const reflection = exercise({ type: "REFLECT", statement: "Explica tu decisión.", config: {} });

  it("no permite guardar una reflexión vacía", () => {
    render(<ReflectionPlayer exercise={reflection} submitReflection={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Guardar reflexión" })).toBeDisabled();
  });

  it("guarda el texto recortado y lo confirma", async () => {
    const submitReflection = vi.fn().mockResolvedValue({ recorded: true });
    render(<ReflectionPlayer exercise={reflection} submitReflection={submitReflection} />);

    fireEvent.change(screen.getByLabelText("Tu reflexión"), { target: { value: "  Elegí A porque…  " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar reflexión" }));

    expect(await screen.findByText(/Reflexión guardada/)).toBeInTheDocument();
    expect(submitReflection).toHaveBeenCalledWith("ex-1", "Elegí A porque…");
  });

  it("muestra el error sin dar la reflexión por guardada", async () => {
    const submitReflection = vi
      .fn()
      .mockRejectedValue(new ApiError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Sin servicio." }));
    render(<ReflectionPlayer exercise={reflection} submitReflection={submitReflection} />);

    fireEvent.change(screen.getByLabelText("Tu reflexión"), { target: { value: "algo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar reflexión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sin servicio.");
    expect(screen.queryByText(/Reflexión guardada/)).not.toBeInTheDocument();
  });
});
