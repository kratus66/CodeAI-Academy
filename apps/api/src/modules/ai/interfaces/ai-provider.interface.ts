/**
 * Puerto de la capa de IA (`capa-ia.md` §2). El resto del código sólo conoce
 * `AiProvider`: cambiar de proveedor no toca servicios ni controladores.
 */
export const AI_PROVIDER = Symbol("AI_PROVIDER");

export const AI_PROVIDER_NAMES = ["mock", "openai", "anthropic"] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export interface AiProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Uso real de una llamada en *streaming*; se informa al terminar el flujo. */
export interface AiStreamUsage {
  promptTokens: number;
  outputTokens: number;
  model: string;
  costUsd: number;
}

export interface AiCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  /** JSON Schema para salidas estructuradas. */
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Sólo `stream`: recibe tokens y costo reales cuando el proveedor los informa. */
  onUsage?: (usage: AiStreamUsage) => void;
}

export interface AiCompletionResult {
  content: string;
  usage: { promptTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
  /** Costo en USD; lo informa el adaptador que conoce la tabla de precios. */
  costUsd?: number;
}

export interface AiProvider {
  readonly name: string;
  complete(
    messages: AiProviderMessage[],
    options?: AiCompletionOptions,
  ): Promise<AiCompletionResult>;
  stream(messages: AiProviderMessage[], options?: AiCompletionOptions): AsyncIterable<string>;
  isAvailable(): Promise<boolean>;
}
