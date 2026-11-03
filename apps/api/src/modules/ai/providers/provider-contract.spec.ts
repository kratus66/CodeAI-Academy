import { describe, expect, it } from "vitest";

import type { AiProvider } from "../interfaces/ai-provider.interface";
import { AnthropicProvider } from "./anthropic.provider";
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

function anthropicWith(handler: () => Promise<Response>): AnthropicProvider {
  return new AnthropicProvider({
    apiKey: "sk-ant-test",
    model: "claude-haiku-5-5",
    timeoutMs: 1000,
    fetch: handler,
  });
}

const anthropicOk = (): Promise<Response> =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        model: "claude-haiku-5-5",
        content: [{ type: "text", text: "¿Qué devuelve fetch?" }],
        usage: { input_tokens: 40, output_tokens: 10 },
      }),
      { status: 200 },
    ),
  );

const failing: [string, () => AiProvider][] = [
  ["mock", () => new MockAiProvider({ failWith: new Error("caído") })],
  ["openai", () => openAiWith(() => Promise.resolve(new Response("{}", { status: 503 })))],
  ["anthropic", () => anthropicWith(() => Promise.resolve(new Response("{}", { status: 503 })))],
];

describe.each<[string, () => AiProvider]>([
  ["mock", () => new MockAiProvider()],
  ["openai", () => openAiWith(okResponse)],
  ["anthropic", () => anthropicWith(anthropicOk)],
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

describe("AnthropicProvider", () => {
  it("separa el system, usa x-api-key y calcula el costo", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const provider = new AnthropicProvider({
      apiKey: "sk-ant-test",
      model: "claude-haiku-5-5",
      timeoutMs: 1000,
      prices: { "claude-haiku-5-5": { input: 0.001, output: 0.005 } },
      fetch: (url, init) => {
        captured = { url, init };
        return anthropicOk();
      },
    });

    const result = await provider.complete([...MESSAGES], { temperature: 0.4, maxTokens: 600 });
    const body = JSON.parse(String(captured?.init.body)) as Record<string, unknown>;
    const headers = captured?.init.headers as Record<string, string>;

    expect(captured?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(body).toMatchObject({
      model: "claude-haiku-5-5",
      system: "Eres un tutor.",
      max_tokens: 600,
      temperature: 0.4,
      messages: [{ role: "user", content: "¿Por qué falla el await?" }],
    });
    expect(result.usage).toEqual({ promptTokens: 40, outputTokens: 10 });
    expect(result.costUsd).toBeCloseTo((40 / 1000) * 0.001 + (10 / 1000) * 0.005, 10);
  });

  it("clasifica 5xx, red y respuesta vacía con código estable", async () => {
    const code = async (provider: AnthropicProvider): Promise<string> => {
      try {
        await provider.complete([...MESSAGES]);
        return "none";
      } catch (error) {
        return (error as { code?: string }).code ?? "unknown";
      }
    };

    await expect(code(anthropicWith(() => Promise.resolve(new Response("{}", { status: 500 }))))).resolves.toBe("HTTP_500");
    await expect(code(anthropicWith(() => Promise.reject(new Error("ECONNRESET"))))).resolves.toBe("NETWORK");
    await expect(
      code(anthropicWith(() => Promise.resolve(new Response(JSON.stringify({ content: [] }), { status: 200 })))),
    ).resolves.toBe("EMPTY_RESPONSE");
  });
});

function sse(lines: string[]): Response {
  return new Response(lines.map((line) => `${line}\n\n`).join(""), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return chunks;
}

describe("streaming de proveedores", () => {
  it("OpenAI entrega los fragmentos y descarta [DONE]", async () => {
    const provider = openAiWith(() =>
      Promise.resolve(
        sse([
          'data: {"choices":[{"delta":{"content":"¿Qué "}}]}',
          'data: {"choices":[{"delta":{"content":"ves?"}}]}',
          'data: {"choices":[{"delta":{}}]}',
          "data: [DONE]",
        ]),
      ),
    );

    await expect(collect(provider.stream([...MESSAGES]))).resolves.toEqual(["¿Qué ", "ves?"]);
  });

  it("Anthropic entrega sólo los text_delta", async () => {
    const provider = anthropicWith(() =>
      Promise.resolve(
        sse([
          "event: message_start",
          'data: {"type":"message_start"}',
          "event: content_block_delta",
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hola "}}',
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"mundo"}}',
          'data: {"type":"message_stop"}',
        ]),
      ),
    );

    await expect(collect(provider.stream([...MESSAGES]))).resolves.toEqual(["Hola ", "mundo"]);
  });
});
