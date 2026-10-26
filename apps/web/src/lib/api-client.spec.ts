import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  authApi,
  resolveApiBaseUrl,
  restoreSession,
} from "./api-client";

const USER = {
  id: "usr_1",
  email: "ana@example.com",
  name: "Ana",
  role: "STUDENT",
  createdAt: "2026-10-26T14:30:00.000Z",
} as const;

const UNAUTHENTICATED = {
  error: {
    code: "UNAUTHENTICATED",
    message: "La sesión no es válida o ha expirado",
    traceId: "trace-401",
  },
} as const;

const fetchMock =
  vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }

    throw error;
  }

  throw new Error("Se esperaba un ApiError");
}

describe("resolveApiBaseUrl", () => {
  it("usa el destino local cuando no hay variable de entorno", () => {
    expect(resolveApiBaseUrl(undefined)).toBe("http://localhost:3001/api");
    expect(resolveApiBaseUrl("  ")).toBe("http://localhost:3001/api");
  });

  it("respeta NEXT_PUBLIC_API_URL y elimina la barra final", () => {
    expect(resolveApiBaseUrl("http://localhost:4000/api/")).toBe(
      "http://localhost:4000/api",
    );
  });
});

describe("apiRequest a través de authApi", () => {
  it("envía cookies, JSON y devuelve el usuario del contrato", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: USER }));

    const user = await authApi.login({
      email: "ana@example.com",
      password: "S3gura!pass",
    });

    expect(user).toEqual(USER);
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://localhost:3001/api/auth/login");
    expect(call?.[1]?.method).toBe("POST");
    expect(call?.[1]?.credentials).toBe("include");
    expect(call?.[1]?.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(call?.[1]?.body).toBe(
      JSON.stringify({ email: "ana@example.com", password: "S3gura!pass" }),
    );
  });

  it("convierte el envelope de error en ApiError con detalles por campo", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Datos de entrada inválidos",
            details: [{ field: "email", message: "Debe ser un correo válido" }],
            traceId: "trace-400",
          },
        },
        { status: 400 },
      ),
    );

    const error = await captureApiError(
      authApi.login({ email: "ana", password: "S3gura!pass" }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.traceId).toBe("trace-400");
    expect(error.fieldErrors()).toEqual({ email: "Debe ser un correo válido" });
  });

  it("usa el mensaje por defecto si la respuesta de error no cumple el envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "sin envelope" }, { status: 503 }),
    );

    const error = await captureApiError(authApi.me());

    expect(error.status).toBe(503);
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
    expect(error.message).toBe(
      "Un servicio necesario no está disponible",
    );
  });

  it("expone Retry-After en segundos cuando la API limita los intentos", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Demasiados intentos",
            traceId: "trace-429",
          },
        },
        { status: 429, headers: { "Retry-After": "120" } },
      ),
    );

    const error = await captureApiError(
      authApi.login({ email: "ana@example.com", password: "S3gura!pass" }),
    );

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(120);
  });

  it("acepta 204 sin cuerpo al cerrar sesión", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(authApi.logout()).resolves.toBeUndefined();
  });

  it("rechaza una respuesta que no cumple el contrato de usuario", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: { name: "Ana" } }));

    const error = await captureApiError(
      authApi.login({ email: "ana@example.com", password: "S3gura!pass" }),
    );

    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toContain("contrato");
  });
});

describe("restoreSession", () => {
  it("rota el refresh cuando el access token caducó", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(UNAUTHENTICATED, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ user: USER }));

    const user = await restoreSession();

    expect(user).toEqual(USER);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://localhost:3001/api/auth/me",
      "http://localhost:3001/api/auth/refresh",
    ]);
  });

  it("devuelve null cuando tampoco hay refresh válido", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(UNAUTHENTICATED, { status: 401 }),
    );

    await expect(restoreSession()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
