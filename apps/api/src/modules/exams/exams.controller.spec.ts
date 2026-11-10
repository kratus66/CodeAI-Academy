import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";

import { RATE_LIMIT_METADATA } from "../../common/security/rate-limit.decorator";
import { RateLimitGuard } from "../../common/security/rate-limit.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ExamsController } from "./exams.controller";
import type { ExamsService } from "./exams.service";

const USER = { sub: "usr_ana", email: "ana@example.com", role: "STUDENT" as const };

function createController() {
  const service = {
    start: vi.fn(async () => ({ id: "att_1" })),
    get: vi.fn(async () => ({ id: "att_1" })),
    updateItem: vi.fn(async () => ({ item: { position: 3 }, remainingSeconds: 900 })),
    submit: vi.fn(async () => ({ attemptId: "att_1" })),
    result: vi.fn(async () => ({ attemptId: "att_1" })),
    history: vi.fn(async () => [{ id: "att_1" }]),
    readiness: vi.fn(async () => ({ ready: false })),
    registerRealResult: vi.fn(async () => ({ id: "real_1" })),
  };

  return { service, controller: new ExamsController(service as unknown as ExamsService) };
}

function rateLimitOf(method: keyof ExamsController): unknown {
  return Reflect.getMetadata(RATE_LIMIT_METADATA, ExamsController.prototype[method]);
}

describe("ExamsController", () => {
  it("start delega con user.sub y envuelve { attempt }", async () => {
    const { controller, service } = createController();
    const body = { mode: "form-a" as const, extraTime: false };

    await expect(controller.start(USER, { certification: "MLA-C02" }, body)).resolves.toEqual({
      attempt: { id: "att_1" },
    });
    expect(service.start).toHaveBeenCalledWith("usr_ana", "MLA-C02", body);
  });

  it("getAttempt delega y envuelve { attempt }", async () => {
    const { controller, service } = createController();

    await expect(controller.getAttempt(USER, { id: "att_1" })).resolves.toEqual({
      attempt: { id: "att_1" },
    });
    expect(service.get).toHaveBeenCalledWith("usr_ana", "att_1");
  });

  it("updateItem devuelve lo del servicio", async () => {
    const { controller, service } = createController();
    const body = { flagged: true };

    await expect(controller.updateItem(USER, { id: "att_1", position: 3 }, body)).resolves.toEqual({
      item: { position: 3 },
      remainingSeconds: 900,
    });
    expect(service.updateItem).toHaveBeenCalledWith("usr_ana", "att_1", 3, body);
  });

  it("submit y getResult envuelven { result }", async () => {
    const { controller, service } = createController();

    await expect(controller.submit(USER, { id: "att_1" })).resolves.toEqual({
      result: { attemptId: "att_1" },
    });
    await expect(controller.getResult(USER, { id: "att_1" })).resolves.toEqual({
      result: { attemptId: "att_1" },
    });
    expect(service.submit).toHaveBeenCalledWith("usr_ana", "att_1");
    expect(service.result).toHaveBeenCalledWith("usr_ana", "att_1");
  });

  it("history y readiness envuelven su respuesta", async () => {
    const { controller, service } = createController();

    await expect(controller.history(USER, { certification: "MLA-C02" })).resolves.toEqual({
      attempts: [{ id: "att_1" }],
    });
    await expect(controller.readiness(USER, { certification: "MLA-C02" })).resolves.toEqual({
      readiness: { ready: false },
    });
    expect(service.history).toHaveBeenCalledWith("usr_ana", "MLA-C02");
    expect(service.readiness).toHaveBeenCalledWith("usr_ana", "MLA-C02");
  });

  it("registerRealResult delega y envuelve { realResult }", async () => {
    const { controller, service } = createController();
    const body = { passed: true, takenOn: "2026-10-01" };

    await expect(
      controller.registerRealResult(USER, { certification: "MLA-C02" }, body),
    ).resolves.toEqual({ realResult: { id: "real_1" } });
    expect(service.registerRealResult).toHaveBeenCalledWith("usr_ana", "MLA-C02", body);
  });

  it("la clase usa JwtAuthGuard y RateLimitGuard", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ExamsController)).toEqual([
      JwtAuthGuard,
      RateLimitGuard,
    ]);
  });

  it("POST attempts tiene su límite propio y el resto el general", () => {
    expect(rateLimitOf("start")).toEqual({ limit: 10, windowMs: 3_600_000, keyFromUser: true });

    const general = { limit: 120, windowMs: 60_000, keyFromUser: true };
    for (const method of [
      "getAttempt",
      "updateItem",
      "submit",
      "getResult",
      "history",
      "readiness",
      "registerRealResult",
    ] as const) {
      expect(rateLimitOf(method)).toEqual(general);
    }
  });

  it("start y registerRealResult responden 201 y submit 200", () => {
    const code = (method: keyof ExamsController) =>
      Reflect.getMetadata(HTTP_CODE_METADATA, ExamsController.prototype[method]);

    expect(code("start")).toBe(201);
    expect(code("registerRealResult")).toBe(201);
    expect(code("submit")).toBe(200);
  });
});
