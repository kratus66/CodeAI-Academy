import type { SandboxRunRequest } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { MockSandboxService } from "./mock-sandbox.service";

function request(overrides: Partial<SandboxRunRequest> = {}): SandboxRunRequest {
  return {
    language: "typescript",
    files: [{ path: "index.ts", content: "export const answer = 42;" }],
    tests: [{ id: "t1", code: "expect(answer).toBe(42)", weight: 1 }],
    limits: { timeoutMs: 5000, memoryMb: 256 },
    ...overrides,
  };
}

describe("MockSandboxService", () => {
  it("es determinista: el mismo código produce la misma respuesta", async () => {
    const sandbox = new MockSandboxService();
    const first = await sandbox.run(request());
    const second = await sandbox.run(request());

    expect(first).toEqual(second);
    expect(first.durationMs).toBe(1);
  });

  it("falla con puntuación 0 cuando queda un TODO", async () => {
    const sandbox = new MockSandboxService();
    const run = await sandbox.run(
      request({ files: [{ path: "index.ts", content: "// TODO: validar el status" }] }),
    );

    expect(run.outcome).toBe("FAILED");
    expect(run.score).toBe(0);
    expect(run.results).toEqual([
      {
        testId: "t1",
        passed: false,
        message: "La solución contiene un TODO sin resolver",
        durationMs: 1,
      },
    ]);
    expect(run.stderr).toBe(
      "La solución contiene un TODO sin resolver en index.ts",
    );
  });

  it("detecta el TODO sin distinguir mayúsculas", async () => {
    const sandbox = new MockSandboxService();
    const run = await sandbox.run(
      request({ files: [{ path: "index.ts", content: "// todo: pendiente" }] }),
    );

    expect(run.outcome).toBe("FAILED");
  });

  it("aprueba todas las pruebas cuando no hay TODO", async () => {
    const sandbox = new MockSandboxService();
    const run = await sandbox.run(
      request({
        tests: [
          { id: "t1", code: "expect(1).toBe(1)", weight: 1 },
          { id: "t2", code: "expect(2).toBe(2)", weight: 2 },
        ],
      }),
    );

    expect(run.outcome).toBe("PASSED");
    expect(run.score).toBe(100);
    expect(run.results.map((result) => result.testId)).toEqual(["t1", "t2"]);
    expect(run.results.every((result) => result.passed)).toBe(true);
    expect(run.results[0]).not.toHaveProperty("message");
    expect(run.stderr).toBe("");
  });

  it("sin pruebas ejecuta y aprueba sin resultados", async () => {
    const sandbox = new MockSandboxService();
    const run = await sandbox.run(request({ tests: [] }));

    expect(run.outcome).toBe("PASSED");
    expect(run.score).toBe(100);
    expect(run.results).toEqual([]);
  });

  it("publica su estado como adaptador mock", () => {
    expect(new MockSandboxService().status()).toEqual({ provider: "mock", mode: "mock" });
  });
});
