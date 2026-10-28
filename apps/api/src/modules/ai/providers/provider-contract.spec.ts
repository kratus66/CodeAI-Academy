import { describe, expect, it } from "vitest";

import type { AiProvider } from "../interfaces/ai-provider.interface";
import { MockAiProvider } from "./mock.provider";
import { OpenAiProvider } from "./openai.provider";

const MESSAGES = [
  { role: "system", content: "Eres un tutor." },
  { role: "user", content: "¿Por qué falla el await?" },
] as const;

function openAiWith(handler: () => Promise<Response>): OpenAiProvider {
  return new OpenAiProvider({
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    timeoutMs: 1000,
    fetch: handler,
  });
}

const okResponse = (): Promise<Response> =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        model: "gpt-4o-mini",
        choices: [{ message: { content: "¿Qué devuelve fetch?" } }],
        usage: { prompt_tokens: 40, completion_tokens: 10 },
      }),
      { status: 200 },
    ),
  );

const failing: [string, () => AiProvider][] = [
  ["mock", () => new MockAiProvider({ failWith: new Error("caído") })],
  ["openai", () => openAiWith(() => Promise.resolve(new Response("{}", { status: 503 })))],
];

describe.each<[string, () => AiProvider]>([
  ["mock", () => new MockAiProvider()],
  ["openai", () => openAiWith(okResponse)],
])("contrato AiProvider: %s", (_name, create) => {
  it("devuelve contenido, tokens enteros ≥ 0 y modelo", async () => {
    const result = await create().complete([...MESSAGES], { maxTokens: 600 });

    expect(result.content.length).toBeGreaterThan(0);
    expect(Number.isInteger(result.usage.promptTokens)).toBe(true);
    expect(Number.isInteger(result.usage.outputTokens)).toBe(true);
    expect(result.usage.promptTokens).toBeGreaterThanOrEqual(0);
    expect(result.usage.outputTokens).toBeGreaterThanOrEqual(0);
    expect(result.model.length).toBeGreaterThan(0);
  });

  it("informa disponibilidad", async () => {
    await expect(create().isAvailable()).resolves.toBe(true);
  });
});

describe.each(failing)("errores del proveedor: %s", (_name, create) => {
  it("se propagan como excepción", async () => {
    await expect(create().complete([...MESSAGES])).rejects.toThrow();
  });
});

describe("MockAiProvider", () => {
  it("cuenta llamadas, estima tokens > 0 y publica costo 0", async () => {
    const provider = new MockAiProvider();
    const result = await provider.complete([...MESSAGES]);

    expect(provider.calls).toBe(1);
    expect(result.usage.promptTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.costUsd).toBe(0);
    expect(result.content).toContain("?");
  });
});

describe("OpenAiProvider", () => {
  it("envía cabeceras y cuerpo del formato de chat y calcula el costo", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const provider = new OpenAiProvider({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      timeoutMs: 1000,
      fetch: (url, init) => {
        captured = { url, init };
        return okResponse();
      },
    });

    const result = await provider.complete([...MESSAGES], { temperature: 0.4, maxTokens: 600 });
    const body = JSON.parse(String(captured?.init.body)) as Record<string, unknown>;
    const headers = captured?.init.headers as Record<string, string>;

    expect(captured?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(headers.authorization).toBe("Bearer sk-test");
    expect(body).toMatchObject({ model: "gpt-4o-mini", temperature: 0.4, max_tokens: 600 });
    expect(result.usage).toEqual({ promptTokens: 40, outputTokens: 10 });
    expect(result.costUsd).toBeCloseTo((40 / 1000) * 0.00015 + (10 / 1000) * 0.0006, 10);
  });

  it("clasifica 5xx, red, respuesta vacía y tiempo agotado con código estable", async () => {
    const code = async (provider: OpenAiProvider): Promise<string> => {
      try {
        await provider.complete([...MESSAGES]);
        return "none";
      } catch (error) {
        return (error as { code?: string }).code ?? "unknown";
      }
    };

    await expect(code(openAiWith(() => Promise.resolve(new Response("{}", { status: 500 }))))).resolves.toBe("HTTP_500");
    await expect(code(openAiWith(() => Promise.reject(new Error("ECONNRESET"))))).resolves.toBe("NETWORK");
    await expect(
      code(openAiWith(() => Promise.resolve(new Response(JSON.stringify({ choices: [] }), { status: 200 })))),
    ).resolves.toBe("EMPTY_RESPONSE");

    const slow = new OpenAiProvider({
      apiKey: "k",
      model: "gpt-4o-mini",
      timeoutMs: 10,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("abortado")));
        }),
    });

    await expect(code(slow)).resolves.toBe("TIMEOUT");
  });
});
