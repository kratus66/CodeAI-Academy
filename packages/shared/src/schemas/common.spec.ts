import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  errorResponseSchema,
  healthResponseSchema,
  paginatedSchema,
} from "./common";

describe("errorResponseSchema", () => {
  it("acepta el formato documentado en contratos-api.md", () => {
    const result = errorResponseSchema.safeParse({
      error: {
        code: "VALIDATION_ERROR",
        message: "El campo email no es válido",
        details: [{ field: "email", message: "Debe ser un correo válido" }],
        traceId: "ckv2n3x0a0001qz8h2b3c4d5e",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rechaza códigos de error no registrados", () => {
    const result = errorResponseSchema.safeParse({
      error: {
        code: "SOMETHING_ELSE",
        message: "Error",
        traceId: "trace-1",
      },
    });

    expect(result.success).toBe(false);
  });

  it("exige traceId para poder auditar el fallo", () => {
    const result = errorResponseSchema.safeParse({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor",
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("paginatedSchema", () => {
  it("valida un listado con metadatos", () => {
    const schema = paginatedSchema(z.object({ id: z.string() }));
    const result = schema.safeParse({
      data: [{ id: "unit-1" }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un pageSize superior al máximo", () => {
    const schema = paginatedSchema(z.object({ id: z.string() }));
    const result = schema.safeParse({
      data: [],
      meta: { page: 1, pageSize: 101, total: 0, totalPages: 0 },
    });

    expect(result.success).toBe(false);
  });
});

describe("healthResponseSchema", () => {
  it("acepta la respuesta del módulo health", () => {
    const result = healthResponseSchema.safeParse({
      status: "ok",
      service: "codeai-api",
      version: "0.1.0",
      uptimeSeconds: 12,
      timestamp: "2026-10-26T14:30:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un estado distinto de ok", () => {
    const result = healthResponseSchema.safeParse({
      status: "degraded",
      service: "codeai-api",
      version: "0.1.0",
      uptimeSeconds: 12,
      timestamp: "2026-10-26T14:30:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
