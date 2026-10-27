import { describe, expect, it } from "vitest";

import {
  sandboxLanguageSchema,
  sandboxRunEnvelopeSchema,
  sandboxRunRequestSchema,
  sandboxRunResponseSchema,
} from "./sandbox";

const indexFile = { path: "index.ts", content: "export const sum = (a, b) => a + b;" };

const runRequest = {
  language: "typescript" as const,
  files: [indexFile],
  tests: [{ id: "t1", code: "expect(sum(1, 2)).toBe(3)" }],
};

const runResponse = {
  outcome: "PASSED" as const,
  score: 100,
  results: [{ testId: "t1", passed: true, durationMs: 3 }],
  stdout: "1\n",
  stderr: "",
  durationMs: 12,
};

describe("sandboxLanguageSchema", () => {
  it("acepta los tres lenguajes del contrato", () => {
    expect(sandboxLanguageSchema.safeParse("typescript").success).toBe(true);
    expect(sandboxLanguageSchema.safeParse("javascript").success).toBe(true);
    expect(sandboxLanguageSchema.safeParse("sql").success).toBe(true);
  });

  it("rechaza un lenguaje que el sandbox no ejecuta", () => {
    expect(sandboxLanguageSchema.safeParse("python").success).toBe(false);
    expect(sandboxLanguageSchema.safeParse("TS").success).toBe(false);
  });
});

describe("sandboxRunRequestSchema", () => {
  it("aplica los límites por defecto cuando no se envían", () => {
    const result = sandboxRunRequestSchema.safeParse({
      language: runRequest.language,
      files: runRequest.files,
      tests: runRequest.tests,
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.limits).toEqual({
      timeoutMs: 5000,
      memoryMb: 256,
    });
  });

  it("aplica peso 1 a la prueba que no declara peso", () => {
    const result = sandboxRunRequestSchema.safeParse(runRequest);

    expect(result.success && result.data.tests[0]?.weight).toBe(1);
  });

  it("rechaza una petición sin archivos", () => {
    const result = sandboxRunRequestSchema.safeParse({ ...runRequest, files: [] });

    expect(result.success).toBe(false);
  });

  it("rechaza más de diez archivos", () => {
    const files = Array.from({ length: 11 }, (_, index) => ({
      path: `file-${index}.ts`,
      content: "export {};",
    }));

    const result = sandboxRunRequestSchema.safeParse({ ...runRequest, files });

    expect(result.success).toBe(false);
  });

  it("rechaza un archivo de más de 100 KB", () => {
    const result = sandboxRunRequestSchema.safeParse({
      ...runRequest,
      files: [{ path: "index.ts", content: "a".repeat(100_001) }],
    });

    expect(result.success).toBe(false);
  });

  it("rechaza más de treinta pruebas", () => {
    const tests = Array.from({ length: 31 }, (_, index) => ({
      id: `t${index}`,
      code: "expect(true).toBe(true)",
    }));

    const result = sandboxRunRequestSchema.safeParse({ ...runRequest, tests });

    expect(result.success).toBe(false);
  });

  it("rechaza un tiempo límite fuera del rango admitido", () => {
    expect(
      sandboxRunRequestSchema.safeParse({
        ...runRequest,
        limits: { timeoutMs: 400, memoryMb: 256 },
      }).success,
    ).toBe(false);
    expect(
      sandboxRunRequestSchema.safeParse({
        ...runRequest,
        limits: { timeoutMs: 6000, memoryMb: 256 },
      }).success,
    ).toBe(false);
  });

  it("rechaza una memoria fuera del rango admitido", () => {
    expect(
      sandboxRunRequestSchema.safeParse({
        ...runRequest,
        limits: { timeoutMs: 5000, memoryMb: 32 },
      }).success,
    ).toBe(false);
    expect(
      sandboxRunRequestSchema.safeParse({
        ...runRequest,
        limits: { timeoutMs: 5000, memoryMb: 1024 },
      }).success,
    ).toBe(false);
  });

  it("rechaza un lenguaje fuera del contrato aunque el resto sea válido", () => {
    const result = sandboxRunRequestSchema.safeParse({
      ...runRequest,
      language: "python",
    });

    expect(result.success).toBe(false);
  });
});

describe("sandboxRunResponseSchema", () => {
  it("acepta una ejecución correcta con su salida", () => {
    expect(sandboxRunResponseSchema.safeParse(runResponse).success).toBe(true);
  });

  it("acepta una ejecución sin salida estándar", () => {
    const result = sandboxRunResponseSchema.safeParse({
      outcome: "TIMEOUT",
      score: 0,
      results: [],
      durationMs: 5000,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un desenlace fuera del enum de envíos", () => {
    const result = sandboxRunResponseSchema.safeParse({
      ...runResponse,
      outcome: "OK",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza una puntuación mayor de 100", () => {
    const result = sandboxRunResponseSchema.safeParse({ ...runResponse, score: 101 });

    expect(result.success).toBe(false);
  });

  it("rechaza un mensaje de prueba de más de 500 caracteres", () => {
    const result = sandboxRunResponseSchema.safeParse({
      ...runResponse,
      results: [{ testId: "t1", passed: false, message: "x".repeat(501) }],
    });

    expect(result.success).toBe(false);
  });

  it("exige la duración total de la ejecución", () => {
    const withoutDuration = {
      outcome: runResponse.outcome,
      score: runResponse.score,
      results: runResponse.results,
      stdout: runResponse.stdout,
      stderr: runResponse.stderr,
    };

    expect(sandboxRunResponseSchema.safeParse(withoutDuration).success).toBe(false);
  });
});

describe("sandboxRunEnvelopeSchema", () => {
  it("envuelve la ejecución bajo la clave run", () => {
    expect(sandboxRunEnvelopeSchema.safeParse({ run: runResponse }).success).toBe(true);
  });

  it("rechaza la ejecución sin la envoltura del endpoint", () => {
    expect(sandboxRunEnvelopeSchema.safeParse(runResponse).success).toBe(false);
  });
});
