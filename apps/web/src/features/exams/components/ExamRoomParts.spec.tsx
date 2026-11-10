import type { ExamAttemptItem, QuizSubmissionInput } from "@codeai/shared";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamNavigator } from "./ExamNavigator";
import { ExamTimer } from "./ExamTimer";

const ANSWERED: QuizSubmissionInput = { optionId: "b" };

function attemptItem(
  position: number,
  overrides: Partial<Omit<ExamAttemptItem, "position">> = {},
): ExamAttemptItem {
  return {
    position,
    domain: 1,
    statement: "¿Qué servicio almacena objetos de forma duradera?",
    config: { options: [] },
    answer: null,
    flagged: false,
    ...overrides,
  };
}

describe("ExamTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advance(seconds: number): void {
    act(() => {
      vi.advanceTimersByTime(seconds * 1_000);
    });
  }

  it("muestra el tiempo restante en hh:mm:ss sin anunciarlo cada segundo", () => {
    render(<ExamTimer remainingSeconds={3_661} onElapsed={vi.fn()} />);

    const timer = screen.getByRole("timer", { name: "Tiempo restante" });

    expect(timer).toHaveTextContent("01:01:01");
    expect(timer).not.toHaveAttribute("aria-live");
  });

  it("baja un segundo por segundo", () => {
    render(<ExamTimer remainingSeconds={90} onElapsed={vi.fn()} />);

    advance(3);

    expect(screen.getByRole("timer")).toHaveTextContent("00:01:27");
  });

  it("avisa de los diez minutos una sola vez", () => {
    render(<ExamTimer remainingSeconds={601} onElapsed={vi.fn()} />);

    const status = screen.getByRole("status");

    expect(status).toBeEmptyDOMElement();

    advance(1);
    expect(status).toHaveTextContent("Quedan 10 minutos");

    advance(6);
    expect(status).toBeEmptyDOMElement();

    advance(60);
    expect(status).toBeEmptyDOMElement();
  });

  it("avisa del último minuto una sola vez", () => {
    render(<ExamTimer remainingSeconds={61} onElapsed={vi.fn()} />);

    const status = screen.getByRole("status");

    advance(1);
    expect(status).toHaveTextContent("Queda 1 minuto");

    advance(6);
    expect(status).toBeEmptyDOMElement();

    advance(30);
    expect(status).toBeEmptyDOMElement();
  });

  it("llama a onElapsed una sola vez al llegar a cero", () => {
    const onElapsed = vi.fn();

    render(<ExamTimer remainingSeconds={2} onElapsed={onElapsed} />);

    advance(2);

    expect(onElapsed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("timer")).toHaveTextContent("00:00:00");

    advance(10);

    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  it("se resincroniza cuando cambia remainingSeconds", () => {
    const onElapsed = vi.fn();
    const { rerender } = render(<ExamTimer remainingSeconds={300} onElapsed={onElapsed} />);

    advance(5);
    expect(screen.getByRole("timer")).toHaveTextContent("00:04:55");

    rerender(<ExamTimer remainingSeconds={1_800} onElapsed={onElapsed} />);
    expect(screen.getByRole("timer")).toHaveTextContent("00:30:00");

    advance(1);
    expect(screen.getByRole("timer")).toHaveTextContent("00:29:59");
  });
});

describe("ExamNavigator", () => {
  const items: readonly ExamAttemptItem[] = [
    attemptItem(1, { answer: ANSWERED }),
    attemptItem(2),
    attemptItem(3, { answer: ANSWERED, flagged: true }),
  ];

  it("rotula cada pregunta con su estado y su marca", () => {
    render(<ExamNavigator items={items} current={1} onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Pregunta 1: respondida" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pregunta 2: sin responder" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pregunta 3: respondida, marcada" }),
    ).toBeInTheDocument();
  });

  it("señala la pregunta actual con aria-current", () => {
    render(<ExamNavigator items={items} current={2} onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Pregunta 2: sin responder" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Pregunta 1: respondida" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("entrega la posición elegida a onSelect", () => {
    const onSelect = vi.fn();

    render(<ExamNavigator items={items} current={1} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Pregunta 3: respondida, marcada" }));

    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("indica el estado con un icono, no solo con color", () => {
    render(<ExamNavigator items={items} current={1} onSelect={vi.fn()} />);

    const answered = screen.getByRole("button", { name: "Pregunta 1: respondida" });
    const unanswered = screen.getByRole("button", { name: "Pregunta 2: sin responder" });
    const flagged = screen.getByRole("button", { name: "Pregunta 3: respondida, marcada" });

    expect(within(answered).getByText("✓")).toBeInTheDocument();
    expect(within(flagged).getByText("✓")).toBeInTheDocument();
    expect(within(flagged).getByText("⚑")).toBeInTheDocument();
    expect(within(unanswered).queryByText("✓")).toBeNull();
    expect(within(unanswered).queryByText("⚑")).toBeNull();
  });
});
