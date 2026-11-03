import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaid }));

import { MermaidDiagram } from "./MermaidDiagram";

const CODE = "sequenceDiagram\n  Cliente->>API: GET /users";

describe("MermaidDiagram", () => {
  beforeEach(() => {
    mermaid.initialize.mockReset();
    mermaid.render.mockReset();
  });

  it("muestra el código mientras carga y el SVG cuando renderiza", async () => {
    mermaid.render.mockResolvedValue({ svg: '<svg data-testid="svg-ok"></svg>' });

    render(<MermaidDiagram code={CODE} title="Flujo HTTP" />);

    expect(screen.getByText(/sequenceDiagram/)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("svg-ok")).toBeTruthy());
    expect(screen.getByRole("img", { name: "Flujo HTTP" })).toBeTruthy();
    expect(screen.queryByText(/sequenceDiagram/)).toBeNull();
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict", startOnLoad: false }),
    );
  });

  it("si la sintaxis es inválida se queda con el código sin romper la lección", async () => {
    mermaid.render.mockRejectedValue(new Error("Parse error"));

    render(<MermaidDiagram code={CODE} />);

    await waitFor(() => expect(mermaid.render).toHaveBeenCalled());
    expect(screen.getByText(/sequenceDiagram/)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
