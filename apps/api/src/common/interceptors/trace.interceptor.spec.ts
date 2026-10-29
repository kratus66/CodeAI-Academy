import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { HttpException, Logger } from "@nestjs/common";
import { firstValueFrom, of, throwError } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "../../config/env";
import type { RequestWithTrace } from "../http/request-with-trace";
import {
  SLOW_AI_REQUEST_MS,
  SLOW_REQUEST_MS,
  TraceInterceptor,
} from "./trace.interceptor";

function httpContext(
  request: RequestWithTrace,
  response: { statusCode: number } = { statusCode: 200 },
): ExecutionContext {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function request(overrides: Partial<RequestWithTrace> = {}): RequestWithTrace {
  return {
    method: "GET",
    route: { path: "/content/stages" },
    originalUrl: "/api/content/stages",
    path: "/api/content/stages",
    traceId: "prueba-s11",
    ...overrides,
  } as RequestWithTrace;
}

function run(
  context: ExecutionContext,
  env: Partial<Env> = {},
  handler: () => unknown = () => of({ ok: true }),
): Promise<unknown> {
  const interceptor = new TraceInterceptor({ LOG_LEVEL: "info", ...env } as Env);

  return firstValueFrom(
    interceptor.intercept(context, { handle: handler } as CallHandler),
  );
}

function logged(spy: ReturnType<typeof vi.spyOn>): string {
  return String(spy.mock.calls[0]?.[0] ?? "");
}

describe("TraceInterceptor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registra método, ruta normalizada, estado, duración y trace id", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(1_012);

    await expect(run(httpContext(request()))).resolves.toEqual({ ok: true });

    expect(log).toHaveBeenCalledTimes(1);
    expect(logged(log)).toBe(
      "GET /content/stages 200 durationMs=12 traceId=prueba-s11",
    );
  });

  it("no incluye cuerpo ni correo en la línea de log", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(5);

    await run(
      httpContext(
        request({
          method: "POST",
          route: { path: "/auth/login" },
          body: { email: "estudiante@codeai.dev", password: "secreto" },
        } as Partial<RequestWithTrace>),
      ),
    );

    expect(logged(log)).not.toContain("@");
    expect(logged(log)).not.toContain("secreto");
  });

  it("respeta LOG_LEVEL=warn y no escribe líneas informativas", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(40);

    await run(httpContext(request()), { LOG_LEVEL: "warn" });

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("marca SLOW_REQUEST cuando supera 500 ms", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(SLOW_REQUEST_MS + 1);

    await run(httpContext(request()));

    expect(log).not.toHaveBeenCalled();
    expect(logged(warn)).toContain("SLOW_REQUEST");
    expect(logged(warn)).toContain(`durationMs=${SLOW_REQUEST_MS + 1}`);
  });

  it("usa el umbral de 1500 ms en rutas de IA", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const aiRequest = request({ route: { path: "/ai/tutor" } });

    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(SLOW_REQUEST_MS + 200);
    await run(httpContext(aiRequest));
    expect(warn).not.toHaveBeenCalled();

    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(SLOW_AI_REQUEST_MS + 1);
    await run(httpContext(aiRequest));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("normaliza identificadores cuando no hay plantilla de ruta", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(9);

    await run(
      httpContext(
        request({
          route: undefined,
          originalUrl:
            "/api/content/units/cj1234567890abcdefghij/lessons/42?range=30d",
        } as Partial<RequestWithTrace>),
      ),
    );

    expect(logged(log)).toBe(
      "GET /api/content/units/:id/lessons/:id 200 durationMs=9 traceId=prueba-s11",
    );
  });

  it("registra el estado real de un error y lo propaga sin tocarlo", async () => {
    const error = new HttpException("La lección no existe", 404);
    const errorLog = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(8);

    await expect(
      run(
        httpContext(request({ route: { path: "/content/lessons/:slug" } })),
        {},
        () => throwError(() => error),
      ),
    ).rejects.toBe(error);

    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(logged(errorLog)).toBe(
      "REQUEST_FAILED GET /content/lessons/:slug 404 durationMs=8 traceId=prueba-s11",
    );
  });

  it("no intercepta contextos que no son HTTP", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const context = { getType: () => "rpc" } as unknown as ExecutionContext;

    await expect(run(context)).resolves.toEqual({ ok: true });
    expect(log).not.toHaveBeenCalled();
  });
});

