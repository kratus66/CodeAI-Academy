import type { ExecutionContext } from "@nestjs/common";
import { UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { ProgressService } from "../progress/progress.service";
import type { ExercisesRepository } from "./exercises.repository";
import { UnitOpenGuard } from "./unit-open.guard";

function context(request: object): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

function guard(state: string | null) {
  const progress = { getUnitState: async () => state } as unknown as ProgressService;
  const exercises = {
    findPublished: async (id: string) => (id === "ex_1" ? { unitCode: "U1" } : null),
  } as unknown as ExercisesRepository;

  return new UnitOpenGuard(progress, exercises);
}

const USER = { sub: "u1", role: "STUDENT" };

describe("UnitOpenGuard", () => {
  it("rechaza con 422 el listado de una unidad bloqueada", async () => {
    await expect(
      guard("LOCKED").canActivate(context({ user: USER, params: { code: "U1" } })),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("deduce la unidad del id del ejercicio", async () => {
    await expect(
      guard("LOCKED").canActivate(context({ user: USER, params: { id: "ex_1" } })),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("deja pasar una unidad abierta y las rutas sin unidad conocida", async () => {
    await expect(
      guard("IN_PROGRESS").canActivate(context({ user: USER, params: { code: "U1" } })),
    ).resolves.toBe(true);
    await expect(
      guard("LOCKED").canActivate(context({ user: USER, params: { id: "otro" } })),
    ).resolves.toBe(true);
  });

  it("no decide sin usuario autenticado", async () => {
    await expect(
      guard("LOCKED").canActivate(context({ params: { code: "U1" } })),
    ).resolves.toBe(true);
  });
});
