import type { SandboxRunRequest } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { DockerSandboxService } from "./docker-sandbox.service";

/**
 * Pruebas contra un daemon de Docker real (`sandbox-ejecucion.md` §9). Se activan
 * con `SANDBOX_DOCKER_TESTS=1`; sin esa variable el CI no necesita Docker.
 */
const enabled = process.env.SANDBOX_DOCKER_TESTS === "1";

function request(overrides: Partial<SandboxRunRequest>): SandboxRunRequest {
  return {
    language: "javascript",
    files: [{ path: "index.js", content: "" }],
    tests: [],
    limits: { timeoutMs: 5000, memoryMb: 256 },
    ...overrides,
  };
}

describe.skipIf(!enabled)("DockerSandboxService con Docker real", () => {
  const sandbox = new DockerSandboxService();

  it("ejecuta JavaScript con `export` y aprueba las pruebas", async () => {
    const run = await sandbox.run(
      request({
        files: [
          { path: "index.js", content: "export function suma(a, b) { return a + b; }" },
        ],
        tests: [{ id: "t1", code: "assert.strictEqual(suma(1, 2), 3);", weight: 1 }],
      }),
    );

    expect(run.outcome).toBe("PASSED");
    expect(run.score).toBe(100);
  }, 60_000);

  it("ejecuta TypeScript con tipos y `export`", async () => {
    const run = await sandbox.run(
      request({
        language: "typescript",
        files: [
          {
            path: "index.ts",
            content:
              "export function suma(a: number, b: number): number { return a + b; }",
          },
        ],
        tests: [
          { id: "t1", code: "assert.strictEqual(suma(1, 2), 3);", weight: 1 },
          { id: "t2", code: "assert.strictEqual(suma(1, 2), 4);", weight: 1 },
        ],
      }),
    );

    expect(run.outcome).toBe("PARTIAL");
    expect(run.results.map((result) => result.passed)).toEqual([true, false]);
  }, 60_000);

  it("termina `while(true)` por tiempo agotado", async () => {
    const run = await sandbox.run(
      request({
        files: [{ path: "index.js", content: "while (true) {}" }],
        limits: { timeoutMs: 1000, memoryMb: 256 },
      }),
    );

    expect(run.outcome).toBe("TIMEOUT");
  }, 60_000);

  it("no tiene red", async () => {
    const run = await sandbox.run(
      request({
        files: [
          {
            path: "index.js",
            content:
              'fetch("http://1.1.1.1").then(() => process.exit(0), () => process.exit(7));',
          },
        ],
      }),
    );

    expect(run.outcome).toBe("ERROR");
  }, 60_000);

  it("no puede escribir en el sistema de archivos", async () => {
    const run = await sandbox.run(
      request({
        files: [
          {
            path: "index.js",
            content: 'require("node:fs").writeFileSync("/work/x", "1");',
          },
        ],
      }),
    );

    expect(run.outcome).toBe("ERROR");
  }, 60_000);
});
