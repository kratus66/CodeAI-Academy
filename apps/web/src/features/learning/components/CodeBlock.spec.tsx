import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { highlightCode } from "@/lib/highlight";

import { CodeBlock } from "./CodeBlock";

vi.mock("@/lib/highlight", () => ({ highlightCode: vi.fn() }));

const highlight = vi.mocked(highlightCode);

const CODE = "print('hola')";

function stubClipboard(writeText: () => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

beforeEach(() => {
  highlight.mockReset();
  highlight.mockResolvedValue(null);
});

describe("CodeBlock — resaltado", () => {
  it("pinta el HTML que devuelve el resaltador del servidor", async () => {
    highlight.mockResolvedValue(
      '<pre class="shiki"><code><span>print</span></code></pre>',
    );

    render(<CodeBlock code={CODE} language="python" />);

    expect(await screen.findByText("print")).toBeInTheDocument();
    expect(highlight).toHaveBeenCalledWith(CODE, "python");
    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("cae a texto plano cuando el lenguaje no está soportado", async () => {
    render(<CodeBlock code={CODE} language="cobol" />);

    await waitFor(() => expect(highlight).toHaveBeenCalledWith(CODE, "cobol"));

    expect(screen.getByText(CODE)).toBeInTheDocument();
    expect(document.querySelector("pre.shiki")).toBeNull();
    expect(screen.getByText("cobol")).toBeInTheDocument();
  });

  it("no pide resaltado si el bloque no declara lenguaje", async () => {
    render(<CodeBlock code={CODE} />);

    await waitFor(() => expect(highlight).not.toHaveBeenCalled());

    expect(screen.getByText(CODE)).toBeInTheDocument();
    expect(screen.getByText("texto")).toBeInTheDocument();
  });
});

describe("CodeBlock — copiar", () => {
  it("copia el código y anuncia la confirmación", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);

    render(<CodeBlock code={CODE} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument(),
    );
    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Código copiado al portapapeles",
    );
  });

  it("explica el fallo cuando el portapapeles no responde", async () => {
    stubClipboard(async () => {
      throw new Error("sin permiso");
    });

    render(<CodeBlock code={CODE} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "No pudimos copiar el código",
      ),
    );
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
  });
});

describe("CodeBlock — laboratorio", () => {
  it("enlaza al laboratorio de la unidad cuando se indica el destino", () => {
    render(<CodeBlock code={CODE} labHref="/learn/units/U0.1.1#ejercicios" />);

    expect(
      screen.getByRole("link", { name: /Abrir en el laboratorio/ }),
    ).toHaveAttribute("href", "/learn/units/U0.1.1#ejercicios");
  });

  it("no pinta el atajo al laboratorio si no hay destino", () => {
    render(<CodeBlock code={CODE} />);

    expect(screen.queryByRole("link")).toBeNull();
  });
});
