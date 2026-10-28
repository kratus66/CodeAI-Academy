import { describe, expect, it } from "vitest";

import { ROLES_KEY } from "../auth/decorators/roles.decorator";
import { UsersController } from "./users.controller";
import type { UsersService } from "./users.service";

const PROFILE = {
  id: "usr_ana",
  email: "ana@example.com",
  name: "Ana",
  role: "STUDENT" as const,
  createdAt: "2026-10-01T10:00:00.000Z",
  avatarUrl: null,
  locale: "es",
};

const USER = { sub: "usr_ana", email: "ana@example.com", role: "STUDENT" as const };

/** Doble mínimo del servicio: el controlador solo compone la respuesta. */
function createController() {
  const calls = {
    getProfile: [] as string[],
    updateProfile: [] as [string, unknown][],
    listUsers: [] as unknown[],
  };

  const service = {
    async getProfile(userId: string) {
      calls.getProfile.push(userId);
      return PROFILE;
    },
    async updateProfile(userId: string, input: unknown) {
      calls.updateProfile.push([userId, input]);
      return { ...PROFILE, name: "Ana María" };
    },
    async listUsers(query: unknown) {
      calls.listUsers.push(query);
      return {
        data: [PROFILE],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };
    },
  } as unknown as UsersService;

  return { controller: new UsersController(service), calls };
}

describe("UsersController", () => {
  it("resuelve el perfil por el id del token, no por la ruta", async () => {
    const { controller, calls } = createController();

    await expect(controller.getProfile(USER)).resolves.toEqual({
      user: PROFILE,
    });
    expect(calls.getProfile).toEqual(["usr_ana"]);
  });

  it("pasa el cuerpo validado al servicio y devuelve el perfil actualizado", async () => {
    const { controller, calls } = createController();

    await expect(
      controller.updateProfile(USER, { name: "Ana María" }),
    ).resolves.toMatchObject({ user: { name: "Ana María" } });
    expect(calls.updateProfile).toEqual([["usr_ana", { name: "Ana María" }]]);
  });

  it("delega el listado con la consulta ya validada", async () => {
    const { controller, calls } = createController();
    const query = { role: "STUDENT" as const, page: 2, pageSize: 20 };

    await expect(controller.listUsers(query)).resolves.toMatchObject({
      meta: { total: 1 },
    });
    expect(calls.listUsers).toEqual([query]);
  });

  it("marca el listado como exclusivo de ADMIN", () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, UsersController.prototype.listUsers),
    ).toEqual(["ADMIN"]);
    expect(
      Reflect.getMetadata(ROLES_KEY, UsersController.prototype.getProfile),
    ).toBeUndefined();
  });
});
