import { errorResponseSchema } from "@codeai/shared";
import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestWithTrace } from "../http/request-with-trace";
import { AllExceptionsFilter } from "./all-exceptions.filter";

interface CapturedResponse {
  statusCode?: number;
  headers: Record<string, string>;
  body?: unknown;
}

function createHost(request: Partial<RequestWithTrace> = {}): {
  host: ArgumentsHost;
  captured: CapturedResponse;
} {
  const captured: CapturedResponse = { headers: {} };

  const response = {
    status(code: number) {
      captured.statusCode = code;
      return response;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  it("convierte errores de validación al envelope documentado", () => {
    const { host, captured } = createHost();

    filter.catch(
      new BadRequestException({
        message: ["email debe ser un correo", "password es obligatorio"],
      }),
      host,
    );

    const parsed = errorResponseSchema.parse(captured.body);

    expect(captured.statusCode).toBe(400);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
    expect(parsed.error.details).toHaveLength(2);
  });

  it("conserva el campo culpable en los detalles con estructura", () => {
    const { host, captured } = createHost();

    filter.catch(
      new BadRequestException({
        message: [
          { field: "email", message: "Debe ser un correo válido" },
          { field: "password", message: "Mínimo 8 caracteres" },
        ],
      }),
      host,
    );

    const parsed = errorResponseSchema.parse(captured.body);

    expect(parsed.error.details).toEqual([
      { field: "email", message: "Debe ser un correo válido" },
      { field: "password", message: "Mínimo 8 caracteres" },
    ]);
  });

  it("conserva el mensaje de una excepción HTTP conocida", () => {
    const { host, captured } = createHost();

    filter.catch(new NotFoundException("La lección no existe"), host);

    const parsed = errorResponseSchema.parse(captured.body);

    expect(captured.statusCode).toBe(404);
    expect(parsed.error.code).toBe("NOT_FOUND");
    expect(parsed.error.message).toBe("La lección no existe");
  });

  it("oculta los detalles internos de un fallo inesperado", () => {
    const { host, captured } = createHost();

    filter.catch(new Error("password de la base de datos filtrada"), host);

    const parsed = errorResponseSchema.parse(captured.body);

    expect(captured.statusCode).toBe(500);
    expect(parsed.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(parsed)).not.toContain("base de datos");
  });

  it("reutiliza el traceId de la petición", () => {
    const { host, captured } = createHost({ traceId: "trace-abc-123" });

    filter.catch(new NotFoundException(), host);

    const parsed = errorResponseSchema.parse(captured.body);

    expect(parsed.error.traceId).toBe("trace-abc-123");
    expect(captured.headers["x-trace-id"]).toBe("trace-abc-123");
  });
});
