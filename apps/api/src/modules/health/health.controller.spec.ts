import { healthResponseSchema, readinessResponseSchema } from "@codeai/shared";
import type { Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import { HealthController } from "./health.controller";
import { HealthService, READINESS_TIMEOUT_MS } from "./health.service";

/** Doce de `Response`: sólo necesitamos el setter de status. */
function fakeResponse(): Response & { status: ReturnType<typeof vi.fn> } {
  return { status: vi.fn() } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
  };
}

function fakePrisma(queryRaw: () => Promise<unknown>): PrismaService {
  return { $queryRaw: queryRaw } as unknown as PrismaService;
}

describe("HealthController", () => {
  const controller = new HealthController(
    new HealthService(fakePrisma(() => Promise.resolve([{ "?column?": 1 }]))),
  );

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve una respuesta válida contra el contrato compartido", () => {
    const response = controller.getHealth();
    const parsed = healthResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    expect(response.status).toBe("ok");
    expect(response.service).toBe("codeai-api");
  });

  it("reporta un uptime no negativo", () => {
    expect(controller.getHealth().uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("responde ready con 200 cuando la base contesta", async () => {
    const response = fakeResponse();
    const readiness = await controller.getReadiness(response);

    expect(readinessResponseSchema.safeParse(readiness).success).toBe(true);
    expect(readiness.status).toBe("ready");
    expect(readiness.checks).toEqual([
      { name: "database", ok: true, latencyMs: expect.any(Number) },
    ]);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("responde degraded con 503 cuando la base falla", async () => {
    const failingController = new HealthController(
      new HealthService(
        fakePrisma(() => Promise.reject(new Error("connection refused"))),
      ),
    );
    const response = fakeResponse();
    const readiness = await failingController.getReadiness(response);

    expect(readiness.status).toBe("degraded");
    expect(readiness.checks[0]?.ok).toBe(false);
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it("degrada si la consulta supera el timeout", async () => {
    vi.useFakeTimers();

    const hangingController = new HealthController(
      new HealthService(fakePrisma(() => new Promise(() => undefined))),
    );
    const response = fakeResponse();
    const pending = hangingController.getReadiness(response);

    await vi.advanceTimersByTimeAsync(READINESS_TIMEOUT_MS);
    const readiness = await pending;

    expect(readiness.status).toBe("degraded");
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
