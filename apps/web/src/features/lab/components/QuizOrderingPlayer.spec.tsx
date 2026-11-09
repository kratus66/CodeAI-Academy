import type { ExerciseDetail, QuizGradeResult } from "@codeai/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { QuizOrderingPlayer } from "./QuizOrderingPlayer";
import { QuizPlayer } from "./QuizPlayer";

const ITEMS = [
  { id: "a", text: "Leer el requisito" },
  { id: "b", text: "Escribir la prueba" },
  { id: "c", text: "Ejecutar la suite" },
];

const EXPLANATIONS = {
  a: "Sin requisito no hay criterio que cumplir.",
  b: "La prueba fija el criterio antes de tocar el código.",
  c: "La suite confirma que el cambio no rompe nada.",
};

const CORRECT_ORDER = ["a", "b", "c"];

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
    statement: "¿En qué orden se prepara un cambio?",
    config: { kind: "ordering", items: ITEMS },
    publicTests: [],
    hintsAvailable: 0,
    starterCode: null,
    ...overrides,
  };
}

const CORRECT_RESULT = {
  kind: "ordering",
  correct: true,
  correctOrder: CORRECT_ORDER,
  explanations: EXPLANATIONS,
} satisfies QuizGradeResult;

const WRONG_RESULT = {
  kind: "ordering",
  correct: false,
  correctOrder: CORRECT_ORDER,
  explanations: EXPLANATIONS,
} satisfies QuizGradeResult;

interface FakeDataTransfer {
  readonly setData: (type: string, value: string) => void;
  readonly getData: (type: string) => string;
}

/** jsdom no trae `DataTransfer`; basta con el contrato que usa el arrastre. */
function fakeDataTransfer(): FakeDataTransfer {
  const store = new Map<string, string>();

  return {
    setData: (type, value) => {
      store.set(type, value);
    },
    getData: (type) => store.get(type) ?? "",
  };
}

function rows(): HTMLElement[] {
  return screen.getAllByRole("listitem");
}

function row(text: string): HTMLElement {
  const element = screen.getByText(text).closest("li");

  if (element === null) {
    throw new Error(`No hay fila para «${text}»`);
  }

  return element;
}

describe("QuizOrderingPlayer", () => {
  it("deshabilita «Subir» en el primero y «Bajar» en el último", () => {
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Subir: Leer el requisito" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar: Ejecutar la suite" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Subir: Escribir la prueba" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Bajar: Leer el requisito" })).toBeEnabled();
  });

  it("permite comprobar sin mover nada y envía el orden mostrado", () => {
    const submitQuiz = vi.fn().mockResolvedValue(WRONG_RESULT);
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(submitQuiz).toHaveBeenCalledWith("ex-1", { order: ["a", "b", "c"] });
  });

  it("cambia el orden mostrado y el enviado al pulsar «Bajar: Leer el requisito»", () => {
    const submitQuiz = vi.fn().mockResolvedValue(WRONG_RESULT);
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByRole("button", { name: "Bajar: Leer el requisito" }));

    expect(rows().at(0)).toHaveTextContent("Escribir la prueba");
    expect(rows().at(1)).toHaveTextContent("Leer el requisito");

    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(submitQuiz).toHaveBeenCalledWith("ex-1", { order: ["b", "a", "c"] });
  });

  it("reordena al arrastrar un elemento sobre otro", () => {
    const submitQuiz = vi.fn().mockResolvedValue(WRONG_RESULT);
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    const dataTransfer = fakeDataTransfer();

    fireEvent.dragStart(row("Ejecutar la suite"), { dataTransfer });
    fireEvent.dragOver(row("Leer el requisito"), { dataTransfer });
    fireEvent.drop(row("Leer el requisito"), { dataTransfer });

    expect(rows().at(0)).toHaveTextContent("Ejecutar la suite");

    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(submitQuiz).toHaveBeenCalledWith("ex-1", { order: ["c", "a", "b"] });
  });

  it("deja el foco en el botón pulsado", () => {
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    const down = screen.getByRole("button", { name: "Bajar: Leer el requisito" });
    fireEvent.click(down);

    expect(down).toHaveFocus();
  });

  it("pasa el foco al otro botón cuando el pulsado queda deshabilitado", () => {
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Subir: Escribir la prueba" }));

    expect(screen.getByRole("button", { name: "Bajar: Escribir la prueba" })).toHaveFocus();
  });

  it("no muestra el orden correcto ni las explicaciones antes de comprobar", () => {
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    expect(screen.queryByText("Orden correcto")).not.toBeInTheDocument();
    expect(screen.queryByText(EXPLANATIONS.a)).not.toBeInTheDocument();
    expect(screen.queryByText(EXPLANATIONS.c)).not.toBeInTheDocument();
  });

  it("muestra el orden correcto con la explicación de cada elemento al acertar", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(CORRECT_RESULT);
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByText("¡Correcto!")).toBeInTheDocument();
    expect(screen.getByText("Orden correcto")).toBeInTheDocument();
    expect(screen.getByText(EXPLANATIONS.a)).toBeInTheDocument();
    expect(screen.getByText(EXPLANATIONS.b)).toBeInTheDocument();
    expect(screen.getByText(EXPLANATIONS.c)).toBeInTheDocument();
    expect(screen.queryByText("Tu orden")).not.toBeInTheDocument();
  });

  it("muestra también tu orden cuando fallas", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(WRONG_RESULT);
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByRole("button", { name: "Bajar: Leer el requisito" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(
      await screen.findByText("Todavía no. Hay que ordenarlos todos bien."),
    ).toBeInTheDocument();
    expect(screen.getByText("Orden correcto")).toBeInTheDocument();
    expect(screen.getByText("Tu orden")).toBeInTheDocument();
    expect(screen.getByText(EXPLANATIONS.b)).toBeInTheDocument();
  });

  it("vuelve al orden inicial al intentarlo de nuevo", async () => {
    const submitQuiz = vi.fn().mockResolvedValue(WRONG_RESULT);
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByRole("button", { name: "Bajar: Leer el requisito" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Intentar de nuevo" }));

    expect(rows().at(0)).toHaveTextContent("Leer el requisito");
    expect(screen.getByRole("button", { name: "Subir: Leer el requisito" })).toBeDisabled();
    expect(screen.queryByText(EXPLANATIONS.a)).not.toBeInTheDocument();
  });

  it("muestra el error de la API sin inventar un resultado", async () => {
    const submitQuiz = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ status: 409, code: "CONFLICT", message: "Agotaste los intentos." }),
      );
    render(<QuizOrderingPlayer exercise={exercise()} submitQuiz={submitQuiz} />);

    fireEvent.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Agotaste los intentos.");
    expect(screen.queryByText("¡Correcto!")).not.toBeInTheDocument();
  });

  it("avisa cuando la configuración no trae elementos que ordenar", () => {
    render(
      <QuizOrderingPlayer
        exercise={exercise({ config: { kind: "ordering", items: [] } })}
        submitQuiz={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Este quiz no tiene opciones disponibles.");
  });
});

describe("QuizPlayer — despacho por variante", () => {
  it("manda el quiz de ordenar a su reproductor", () => {
    render(<QuizPlayer exercise={exercise()} submitQuiz={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Subir: Escribir la prueba" })).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
