import type {
  AiCompletionOptions,
  AiCompletionResult,
  AiProvider,
  AiProviderMessage,
} from "../interfaces/ai-provider.interface";
import { AiProviderError, type FetchLike, type ModelPrice } from "./openai.provider";
import { readSseData } from "./sse";

/**
 * Precios en USD por 1 000 tokens. Un modelo sin entrada se cobra al precio más
 * alto conocido (conservador): sobreestimar protege el presupuesto mensual.
 */
export const ANTHROPIC_PRICE_PER_1K: Readonly<Record<string, ModelPrice>> = {};

const FALLBACK_PRICE: ModelPrice = { input: 0.015, output: 0.075 };
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 1024;

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  /** Sobrescribe la tabla de precios por modelo (USD / 1 000 tokens). */
  prices?: Readonly<Record<string, ModelPrice>>;
  /** `fetch` inyectado: las pruebas no necesitan red ni mocks de módulos. */
  fetch?: FetchLike;
}

interface MessagesBody {
  model?: string;
  content?: { type?: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface StreamEvent {
  type?: string;
  delta?: { type?: string; text?: string };
}

/** Único lugar del código que conoce el formato HTTP de Anthropic (Messages API). */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private readonly doFetch: FetchLike;
  private readonly baseUrl: string;

  constructor(private readonly config: AnthropicProviderConfig) {
    this.doFetch = config.fetch ?? ((input, init) => fetch(input, init));
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1";
  }

  async complete(
    messages: AiProviderMessage[],
    options: AiCompletionOptions = {},
  ): Promise<AiCompletionResult> {
    const startedAt = Date.now();
    const response = await this.post(messages, options, false);
    const body = (await response.json()) as MessagesBody;
    const content = (body.content ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("");

    if (content.trim() === "") {
      throw new AiProviderError("El proveedor devolvió una respuesta vacía", "EMPTY_RESPONSE");
    }

    const model = body.model ?? this.config.model;
    const promptTokens = body.usage?.input_tokens ?? 0;
    const outputTokens = body.usage?.output_tokens ?? 0;

    return {
      content,
      usage: { promptTokens, outputTokens },
      model,
      latencyMs: Date.now() - startedAt,
      costUsd: this.costOf(model, promptTokens, outputTokens),
    };
  }

  async *stream(
    messages: AiProviderMessage[],
    options: AiCompletionOptions = {},
  ): AsyncIterable<string> {
    const response = await this.post(messages, options, true);

    for await (const data of readSseData(response)) {
      const event = parseEvent(data);

      if (event?.type === "content_block_delta" && event.delta?.type === "text_delta") {
        const text = event.delta.text;

        if (typeof text === "string" && text !== "") {
          yield text;
        }
      }
    }
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.config.apiKey.length > 0);
  }

  private costOf(model: string, promptTokens: number, outputTokens: number): number {
    const price = this.config.prices?.[model] ?? ANTHROPIC_PRICE_PER_1K[model] ?? FALLBACK_PRICE;

    return (promptTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
  }

  private async post(
    messages: AiProviderMessage[],
    options: AiCompletionOptions,
    stream: boolean,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    options.signal?.addEventListener("abort", () => controller.abort());

    let response: Response;

    try {
      response = await this.doFetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(this.payload(messages, options, stream)),
        signal: controller.signal,
      });
    } catch (error) {
      throw controller.signal.aborted
        ? new AiProviderError("El proveedor no respondió a tiempo", "TIMEOUT")
        : new AiProviderError(error instanceof Error ? error.message : "Fallo de red", "NETWORK");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new AiProviderError(`El proveedor respondió ${response.status}`, `HTTP_${response.status}`);
    }

    return response;
  }

  /** Anthropic recibe `system` aparte y no admite mensajes `system` en la lista. */
  private payload(
    messages: AiProviderMessage[],
    options: AiCompletionOptions,
    stream: boolean,
  ): Record<string, unknown> {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content);

    if (options.jsonSchema !== undefined) {
      system.push(
        `Responde únicamente con JSON válido que cumpla este esquema: ${JSON.stringify(options.jsonSchema)}`,
      );
    }

    return {
      model: this.config.model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(system.length === 0 ? {} : { system: system.join("\n\n") }),
      messages: messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role, content: message.content })),
      ...(stream ? { stream: true } : {}),
    };
  }
}

function parseEvent(data: string): StreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(data);

    return typeof parsed === "object" && parsed !== null ? (parsed as StreamEvent) : null;
  } catch {
    return null;
  }
}
