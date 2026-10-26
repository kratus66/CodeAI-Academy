import { SetMetadata } from "@nestjs/common";

/** Clave de metadatos que lee `RateLimitGuard`. */
export const RATE_LIMIT_METADATA = "codeai:rate-limit";

export interface RateLimitOptions {
  /** Solicitudes permitidas dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana en milisegundos. */
  windowMs: number;
  /**
   * Campo del cuerpo que forma parte de la clave (p. ej. `email` en el login).
   * Sin él, el límite es solo por IP.
   */
  keyFromBody?: string;
}

/**
 * Declara el límite de una ruta (ver `contratos-api.md` §6):
 * `@RateLimit({ limit: 5, windowMs: 15 * 60_000, keyFromBody: "email" })`.
 */
export function RateLimit(options: RateLimitOptions): MethodDecorator {
  return SetMetadata(RATE_LIMIT_METADATA, options);
}
