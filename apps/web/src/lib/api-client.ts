import {
  DEFAULT_ERROR_MESSAGE_BY_CODE,
  ERROR_CODE_BY_HTTP_STATUS,
  errorResponseSchema,
  userResponseSchema,
} from "@codeai/shared";
import type {
  ErrorCode,
  ErrorDetail,
  LoginInput,
  RegisterInput,
  UserPublic,
} from "@codeai/shared";

/**
 * Destino por defecto en desarrollo. `NEXT_PUBLIC_API_URL` lo sobreescribe
 * (ver `.env.example`); se declara aquí para que la web arranque sin `.env`.
 */
export const DEFAULT_API_BASE_URL = "http://localhost:3001/api";

const CONTRACT_ERROR_MESSAGE =
  "La respuesta de la API no cumple el contrato esperado";

/** Normaliza la base para concatenar rutas que empiezan por `/`. */
export function resolveApiBaseUrl(rawUrl: string | undefined): string {
  const value = rawUrl?.trim();

  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  return value.replace(/\/+$/, "");
}

interface ApiErrorInit {
  readonly status: number;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
  readonly traceId?: string;
  readonly retryAfterSeconds?: number;
}

/**
 * Error normalizado del cliente: conserva el catálogo de `@codeai/shared` y el
 * `traceId` para poder reportar un fallo sin exponer la respuesta cruda.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[];
  readonly traceId?: string;
  readonly retryAfterSeconds?: number;

  constructor(init: ApiErrorInit) {
    super(init.message);

    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.traceId = init.traceId;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }

  /** `details` indexados por campo, listos para pintar junto a cada input. */
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const detail of this.details) {
      if (detail.field && !errors[detail.field]) {
        errors[detail.field] = detail.message;
      }
    }

    return errors;
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

/**
 * Petición JSON a la API con cookies de sesión incluidas. Los tokens viven en
 * cookies httpOnly, así que el navegador los envía y JavaScript nunca los lee.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const { method = "GET", body, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${normalizePath(path)}`, {
    method,
    headers,
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload as T;
}

export const authApi = {
  async register(input: RegisterInput): Promise<UserPublic> {
    return parseUserResponse(
      await apiRequest<unknown>("/auth/register", {
        method: "POST",
        body: input,
      }),
    );
  },

  async login(input: LoginInput): Promise<UserPublic> {
    return parseUserResponse(
      await apiRequest<unknown>("/auth/login", { method: "POST", body: input }),
    );
  },

  async me(signal?: AbortSignal): Promise<UserPublic> {
    return parseUserResponse(
      await apiRequest<unknown>("/auth/me", signal ? { signal } : {}),
    );
  },

  async refresh(): Promise<UserPublic> {
    return parseUserResponse(
      await apiRequest<unknown>("/auth/refresh", { method: "POST" }),
    );
  },

  async logout(): Promise<void> {
    await apiRequest<void>("/auth/logout", { method: "POST" });
  },
};

/**
 * Sesión inicial de la aplicación: usa `/auth/me` y, si el access token caducó,
 * rota el refresh una sola vez. Devuelve `null` cuando no hay sesión válida.
 */
export async function restoreSession(
  signal?: AbortSignal,
): Promise<UserPublic | null> {
  try {
    return await authApi.me(signal);
  } catch (error) {
    if (!isUnauthenticated(error)) {
      throw error;
    }
  }

  try {
    return await authApi.refresh();
  } catch (error) {
    if (isUnauthenticated(error)) {
      return null;
    }

    throw error;
  }
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  const retryAfterSeconds = readRetryAfter(response.headers.get("Retry-After"));
  const parsed = errorResponseSchema.safeParse(payload);

  if (parsed.success) {
    return new ApiError({
      status: response.status,
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      details: parsed.data.error.details,
      traceId: parsed.data.error.traceId,
      retryAfterSeconds,
    });
  }

  const code = ERROR_CODE_BY_HTTP_STATUS[response.status] ?? "INTERNAL_ERROR";

  return new ApiError({
    status: response.status,
    code,
    message: DEFAULT_ERROR_MESSAGE_BY_CODE[code],
    retryAfterSeconds,
  });
}

/** La API publica `Retry-After` en segundos (ver `contratos-api.md` §6). */
function readRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
}

function parseUserResponse(payload: unknown): UserPublic {
  const parsed = userResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: CONTRACT_ERROR_MESSAGE,
    });
  }

  return parsed.data.user;
}

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
