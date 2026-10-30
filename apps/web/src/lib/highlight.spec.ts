import { describe, expect, it } from "vitest";

import { highlightCode } from "./highlight";

describe("highlightCode", () => {
  it("resalta un lenguaje conocido con temas claro y oscuro", async () => {
    const html = await highlightCode("print('hola')", "python");

    expect(html).not.toBeNull();
    expect(html).toContain('<pre class="shiki');
    expect(html).toContain("--shiki-light");
    expect(html).toContain("print");
  });

  it("acepta los alias de Shiki", async () => {
    expect(await highlightCode("print('hola')", "py")).not.toBeNull();
  });

  it("devuelve null si el lenguaje no viaja con Shiki", async () => {
    expect(await highlightCode("print('hola')", "codeai-inexistente")).toBeNull();
    expect(await highlightCode("print('hola')", "   ")).toBeNull();
    expect(await highlightCode("print('hola')", null)).toBeNull();
  });

  it("devuelve null con un bloque vacío", async () => {
    expect(await highlightCode("   \n ", "python")).toBeNull();
  });

  it("escapa el contenido del bloque", async () => {
    const html = await highlightCode('<script>alert("x")</script>', "html");

    expect(html).not.toBeNull();
    expect(html).not.toContain("<script");
    expect(html).toContain("&#x3C;");
  });
});
