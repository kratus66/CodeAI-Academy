import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Hero } from "./Hero";

describe("Hero", () => {
  it("presenta la propuesta con un único encabezado principal", () => {
    render(<Hero />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Aprende a construir software con IA");
    expect(heading).toHaveTextContent("sin depender ciegamente de ella.");
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("ofrece enlaces accesibles hacia la ruta y la delimitación", () => {
    render(<Hero />);

    expect(
      screen.getByRole("link", { name: /ver la ruta completa/i }),
    ).toHaveAttribute("href", "#ruta");
    expect(
      screen.getByRole("link", { name: /qué no es este programa/i }),
    ).toHaveAttribute("href", "#no-es");
  });

  it("expone el criterio de egreso con sus preguntas de auditoría", () => {
    render(<Hero />);

    expect(
      screen.getByText(/nivel 3 en C1–C9 y nivel 4 en C10/i),
    ).toBeInTheDocument();
    expect(screen.getByText("¿Cómo sé que funciona?")).toBeInTheDocument();
    expect(
      screen.getByText("¿Puedo romperlo a propósito y arreglarlo?"),
    ).toBeInTheDocument();
  });
});
