import type {
  AiCompletionOptions,
  AiCompletionResult,
  AiProvider,
  AiProviderMessage,
} from "../interfaces/ai-provider.interface";

/** Aproximación de tokens: ≈ 4 caracteres por token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface MockAiProviderOptions {
  /** Respuesta fija; por defecto una pregunta socrática determinista. */
  reply?: string;
  /** Si se define, `complete` lanza este error (simula un proveedor caído). */
  failWith?: Error;
}

const DEFAULT_REPLY =
  "Antes de responderte: ¿qué crees que ocurre justo antes de la línea donde falla tu intento?";

/**
 * Proveedor determinista para desarrollo y pruebas: costo 0 y tokens estimados,
 * de modo que la auditoría sea verificable sin gastar. `calls` cuenta las
 * invocaciones reales para comprobar la caché y la degradación.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  calls = 0;
  reply: string;
  failWith: Error | undefined;

  constructor(options: MockAiProviderOptions = {}) {
    this.reply = options.reply ?? DEFAULT_REPLY;
    this.failWith = options.failWith;
  }

  complete(
    messages: AiProviderMessage[],
    options: AiCompletionOptions = {},
  ): Promise<AiCompletionResult> {
    this.calls += 1;

    if (this.failWith !== undefined) {
      return Promise.reject(this.failWith);
    }

    const promptTokens = estimateTokens(messages.map((message) => message.content).join("\n"));
    const outputTokens = Math.min(estimateTokens(this.reply), options.maxTokens ?? Infinity);

    return Promise.resolve({
      content: this.reply,
      usage: { promptTokens, outputTokens },
      model: "mock-1",
      latencyMs: 0,
      costUsd: 0,
    });
  }

  async *stream(messages: AiProviderMessage[], options?: AiCompletionOptions): AsyncIterable<string> {
    yield (await this.complete(messages, options)).content;
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.failWith === undefined);
  }
}
