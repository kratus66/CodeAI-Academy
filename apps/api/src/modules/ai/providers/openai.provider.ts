import type {
  AiCompletionOptions,
  AiCompletionResult,
  AiProvider,
  AiProviderMessage,
} from "../interfaces/ai-provider.interface";

/** Precio en USD por 1 000 tokens, separado en entrada y salida. */
export interface ModelPrice {
  input: number;
  output: number;
}

/** Tabla de precios (`AI_PRICE_PER_1K`). Un modelo desconocido cuesta lo del más caro. */
export const AI_PRICE_PER_1K: Readonly<Record<string, ModelPrice>> = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
};

const FALLBACK_PRICE: ModelPrice = { input: 0.0025, output: 0.01 };

export function computeCostUsd(model: string, promptTokens: number, outputTokens: number): number {
  const price = AI_PRICE_PER_1K[model] ?? FALLBACK_PRICE;

  return (promptTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface OpenAiProviderConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  /** `fetch` inyectado: las pruebas no necesitan red ni mocks de módulos. */
  fetch?: FetchLike;
}

interface ChatCompletionBody {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Error del proveedor con un código estable para la auditoría. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/** Único lugar del código que conoce el formato HTTP de OpenAI. */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private readonly doFetch: FetchLike;
  private readonly baseUrl: string;

  constructor(private readonly config: OpenAiProviderConfig) {
    this.doFetch = config.fetch ?? ((input, init) => fetch(input, init));
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async complete(
    messages: AiProviderMessage[],
    options: AiCompletionOptions = {},
  ): Promise<AiCompletionResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    options.signal?.addEventListener("abort", () => controller.abort());

    let response: Response;

    try {
      response = await this.doFetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          ...(options.jsonSchema === undefined
            ? {}
            : {
                response_format: {
                  type: "json_schema",
                  json_schema: { name: "result", schema: options.jsonSchema },
                },
              }),
        }),
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

    const body = (await response.json()) as ChatCompletionBody;
    const content = body.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim() === "") {
      throw new AiProviderError("El proveedor devolvió una respuesta vacía", "EMPTY_RESPONSE");
    }

    const model = body.model ?? this.config.model;
    const promptTokens = body.usage?.prompt_tokens ?? 0;
    const outputTokens = body.usage?.completion_tokens ?? 0;

    return {
      content,
      usage: { promptTokens, outputTokens },
      model,
      latencyMs: Date.now() - startedAt,
      costUsd: computeCostUsd(model, promptTokens, outputTokens),
    };
  }

  /** S8 no hace *streaming*: se entrega la respuesta completa como un único fragmento. */
  async *stream(messages: AiProviderMessage[], options?: AiCompletionOptions): AsyncIterable<string> {
    yield (await this.complete(messages, options)).content;
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.config.apiKey.length > 0);
  }
}
