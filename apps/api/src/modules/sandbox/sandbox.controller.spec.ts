import type { SandboxRunRequest } from "@codeai/shared";
import { HttpException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { MockSandboxService } from "./mock-sandbox.service";
import {
  EXECUTIONS_PER_MINUTE,
  SandboxController,
  SandboxQuotaGuard,
} from "./sandbox.controller";

function contextFor(userId: string): {
  context: ExecutionContext;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: userId } }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
      }),
    }),
  } as unknown as ExecutionContext;

  return { context, headers };
}

/** Guard con reloj controlado para probar el reinicio de la ventana. */
class ClockedQuotaGuard extends SandboxQuotaGuard {
  constructor(private readonly clock: () => number) {
    super();
  }

  protected override now(): number {
    return this.clock();
  }
}

const REQUEST: SandboxRunRequest = {
  language: "typescript",
  files: [{ path: "index.ts", content: "console.log(1)" }],
  tests: [{ id: "t1", code: "asserción", weight: 1 }],
  limits: { timeoutMs: 5_000, memoryMb: 256 },
};

describe("SandboxQuotaGuard", () => {
  it("permite veinte ejecuciones por minuto y responde 429 con Retry-After en la siguiente", () => {
    const guard = new SandboxQuotaGuard();

    for (let attempt = 0; attempt < EXECUTIONS_PER_MINUTE; attempt += 1) {
      expect(guard.canActivate(contextFor("user_a").context)).toBe(true);
    }

    const blocked = contextFor("user_a");

    expect(() => guard.canActivate(blocked.context)).toThrow(HttpException);
    expect(blocked.headers["Retry-After"]).toBe("60");
  });

  it("cuenta por usuario: la cuota de uno no limita a otro", () => {
    const guard = new SandboxQuotaGuard();

    for (let attempt = 0; attempt < EXECUTIONS_PER_MINUTE; attempt += 1) {
      guard.canActivate(contextFor("user_a").context);
    }

    expect(guard.canActivate(contextFor("user_b").context)).toBe(true);
  });

  it("reinicia la ventana al expirar el minuto", () => {
    let now = 0;
    const guard = new ClockedQuotaGuard(() => now);

    for (let attempt = 0; attempt < EXECUTIONS_PER_MINUTE; attempt += 1) {
      guard.canActivate(contextFor("user_a").context);
    }
    expect(() => guard.canActivate(contextFor("user_a").context)).toThrow(
      HttpException,
    );

    now = 60_000;

    expect(guard.canActivate(contextFor("user_a").context)).toBe(true);
  });
});

describe("SandboxController", () => {
  const controller = new SandboxController(new MockSandboxService());

  it("ejecuta a través del puerto y envuelve la respuesta en `run`", async () => {
    const response = await controller.run(REQUEST);

    expect(response.run.outcome).toBe("PASSED");
    expect(response.run.results).toEqual([
      { testId: "t1", passed: true, durationMs: 1 },
    ]);
    expect(response.run.durationMs).toBe(1);
  });

  it("publica el adaptador activo en el estado", () => {
    expect(controller.status()).toEqual({
      status: "ok",
      provider: "mock",
      mode: "mock",
    });
  });
});
