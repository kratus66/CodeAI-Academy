import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ONBOARDING_STORAGE_KEY } from "@/features/learning/lib/onboarding-preference";

import { FirstRunOnboarding } from "./FirstRunOnboarding";

function storedChoice(): unknown {
  return JSON.parse(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? "null");
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("FirstRunOnboarding", () => {
  it("arranca en el primer paso y no deja avanzar sin responder", () => {
    render(<FirstRunOnboarding />);

    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "¿Qué te trae a CodeAI Academy?" }),
    ).toBeInTheDocument();

    const siguiente = screen.getByRole("button", { name: "Siguiente" });
    expect(siguiente).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Cambiar de carrera/ }));

    expect(siguiente).toBeEnabled();
  });

  it("recorre los tres pasos y guarda el objetivo, el nivel y el ritmo", () => {
    render(<FirstRunOnboarding />);

    fireEvent.click(screen.getByRole("radio", { name: /Cambiar de carrera/ }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Paso 2 de 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Empiezo de cero/ }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Paso 3 de 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Unas cinco horas/ }));
    fireEvent.click(screen.getByRole("button", { name: "Empezar la ruta" }));

    expect(storedChoice()).toEqual({
      status: "completed",
      answers: { goal: "career-change", level: "beginner", pace: "steady" },
    });
  });

  it("permite saltar sin responder nada", () => {
    render(<FirstRunOnboarding />);

    fireEvent.click(screen.getByRole("button", { name: "Saltar por ahora" }));

    expect(storedChoice()).toEqual({ status: "skipped" });
  });

  it("lleva el foco al grupo del paso nuevo y conserva lo ya respondido", () => {
    render(<FirstRunOnboarding />);

    fireEvent.click(screen.getByRole("radio", { name: /Cambiar de carrera/ }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "¿De dónde partes?" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));

    expect(screen.getByRole("radio", { name: /Cambiar de carrera/ })).toBeChecked();
  });
});
