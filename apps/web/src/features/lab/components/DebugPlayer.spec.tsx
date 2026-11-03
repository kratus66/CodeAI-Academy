import type { ExerciseDetail } from "@codeai/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DebugPlayer, ROOT_CAUSE_MIN_CHARS } from "./DebugPlayer";

const BUGGY = ["try {", "  const res = await fetch(url);", "  handle(res);", "} catch (e) { console.log(e); }"].join(
  "\n",
);

const EXERCISE: ExerciseDetail = {
  id: "dbg-1",
  unitId: "unit-1",
  unitCode: "U2.3.2",
  type: "DEBUG",
  title: "El rechazo que se pierde",
  ladder: "SEMI",
  difficulty: 3,
  estimatedMin: 10,
  language: "typescript",
  competencies: ["C2"],
  statement: "Esta función ignora los errores de red.",
  config: {},
  publicTests: [],
  hintsAvailable: 3,
  starterCode: BUGGY,
};

const CAUSE = "El catch solo imprime el error y la función sigue como si nada hubiera pasado.";

function setup() {
  render(
    <DebugPlayer exercise={EXERCISE}>
      <p>Laboratorio de código</p>
    </DebugPlayer>,
  );
}

describe("DebugPlayer", () => {
  it("bloquea el laboratorio hasta que hay diagnóstico", () => {
    setup();

    expect(screen.getByText(/Paso 1/)).toBeInTheDocument();
    expect(screen.queryByText("Laboratorio de código")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar a corregir" })).toBeDisabled();
  });

  it("exige línea marcada y una causa raíz explicada", () => {
    setup();

    const start = screen.getByRole("button", { name: "Empezar a corregir" });

    fireEvent.click(screen.getByRole("button", { name: "Línea 4" }));
    expect(start).toBeDisabled();

    fireEvent.change(screen.getByLabelText("¿Cuál es la causa raíz?"), { target: { value: "falla" } });
    expect(start).toBeDisabled();
    expect(screen.getByText(`Faltan ${ROOT_CAUSE_MIN_CHARS - 5} caracteres para que sea una explicación.`)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("¿Cuál es la causa raíz?"), { target: { value: CAUSE } });
    expect(start).toBeEnabled();
  });

  it("desmarcar la única línea vuelve a bloquear", () => {
    setup();

    fireEvent.change(screen.getByLabelText("¿Cuál es la causa raíz?"), { target: { value: CAUSE } });
    fireEvent.click(screen.getByRole("button", { name: "Línea 2" }));
    expect(screen.getByRole("button", { name: "Línea 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Empezar a corregir" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Línea 2" }));
    expect(screen.getByRole("button", { name: "Empezar a corregir" })).toBeDisabled();
  });

  it("al terminar muestra el diagnóstico y habilita el laboratorio", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Línea 4" }));
    fireEvent.click(screen.getByRole("button", { name: "Línea 2" }));
    fireEvent.change(screen.getByLabelText("¿Cuál es la causa raíz?"), { target: { value: CAUSE } });
    fireEvent.click(screen.getByRole("button", { name: "Empezar a corregir" }));

    expect(screen.getByText("Laboratorio de código")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tu diagnóstico" })).toHaveTextContent("2, 4");
    expect(screen.getByRole("region", { name: "Tu diagnóstico" })).toHaveTextContent(CAUSE);
    expect(screen.queryByText(/Paso 1/)).not.toBeInTheDocument();
  });
});
