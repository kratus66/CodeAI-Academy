import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodeEditor } from "./CodeEditor";
import type { CodeSurfaceProps } from "./CodeEditor";

const baseProps = {
  value: "export function sumar(a: number, b: number) {",
  onChange: () => {},
  language: "typescript",
  label: "Tu solución",
} as const;

describe("CodeEditor", () => {
  it("pinta la reserva monoespaciada con etiqueta y lenguaje", () => {
    render(
      <CodeEditor
        {...baseProps}
        description="Puedes usar funciones asíncronas."
        surface={null}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Tu solución" });

    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.className).toContain("font-mono");
    expect(textarea).toHaveValue(baseProps.value);
    expect(textarea).toHaveAttribute("rows", "12");
    expect(textarea).toHaveAttribute("spellcheck", "false");
    expect(
      screen.getByText("Puedes usar funciones asíncronas."),
    ).toBeInTheDocument();
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("sigue siendo editable y propaga lo escrito sin Monaco", () => {
    const onChange = vi.fn();

    render(<CodeEditor {...baseProps} onChange={onChange} surface={null} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Tu solución" }), {
      target: { value: "return a + b;" },
    });

    expect(onChange).toHaveBeenCalledWith("return a + b;");
  });

  it("asocia la descripción al área de texto y respeta minRows y readOnly", () => {
    render(
      <CodeEditor
        {...baseProps}
        description="Sin pistas."
        minRows={6}
        readOnly
        surface={null}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Tu solución" });

    expect(textarea).toHaveAttribute("rows", "6");
    expect(textarea).toHaveAttribute("readonly");
    expect(textarea.getAttribute("aria-describedby")).toBe(
      screen.getByText("Sin pistas.").id,
    );
  });

  it("usa la superficie inyectada cuando está disponible", () => {
    function FakeSurface({ value, label }: CodeSurfaceProps) {
      return (
        <p data-testid="monaco-superficie">
          {label}: {value}
        </p>
      );
    }

    render(<CodeEditor {...baseProps} surface={FakeSurface} />);

    expect(screen.getByTestId("monaco-superficie")).toHaveTextContent(
      "Tu solución: export function sumar",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("vuelve a la reserva si la superficie falla al cargar", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    function BrokenSurface(): JSX.Element {
      throw new Error("chunk caído");
    }

    render(<CodeEditor {...baseProps} surface={BrokenSurface} />);

    expect(screen.getByRole("textbox", { name: "Tu solución" })).toHaveValue(
      baseProps.value,
    );

    consoleError.mockRestore();
  });
});
