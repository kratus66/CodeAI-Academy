import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { InMemoryUsersRepository } from "./in-memory-users.repository";
import type { UserProfileRecord } from "./users.repository";
import { UsersService } from "./users.service";

function user(
  id: string,
  overrides: Partial<UserProfileRecord> = {},
): UserProfileRecord {
  return {
    id,
    email: `${id}@example.com`,
    name: `Usuario ${id}`,
    role: "STUDENT",
    avatarUrl: null,
    locale: "es",
    isActive: true,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    ...overrides,
  };
}

function createService(seed: readonly UserProfileRecord[]): UsersService {
  return new UsersService(new InMemoryUsersRepository(seed));
}

describe("UsersService.getProfile", () => {
  it("devuelve el perfil propio sin exponer el estado de la cuenta", async () => {
    const service = createService([user("ana")]);

    const profile = await service.getProfile("ana");

    expect(profile).toEqual({
      id: "ana",
      email: "ana@example.com",
      name: "Usuario ana",
      role: "STUDENT",
      createdAt: "2026-10-01T10:00:00.000Z",
      avatarUrl: null,
      locale: "es",
    });
    expect(profile).not.toHaveProperty("isActive");
  });

  it("responde 404 si el usuario no existe", async () => {
    const service = createService([]);

    await expect(service.getProfile("fantasma")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("responde 404 si la cuenta está desactivada", async () => {
    const service = createService([user("ana", { isActive: false })]);

    await expect(service.getProfile("ana")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("UsersService.updateProfile", () => {
  it("cambia solo los campos enviados", async () => {
    const service = createService([
      user("ana", { avatarUrl: "https://cdn.example.com/ana.png" }),
    ]);

    const updated = await service.updateProfile("ana", {
      name: "Ana María",
    });

    expect(updated.name).toBe("Ana María");
    expect(updated.avatarUrl).toBe("https://cdn.example.com/ana.png");
    expect(updated.locale).toBe("es");
  });

  it("permite borrar el avatar con null", async () => {
    const service = createService([
      user("ana", { avatarUrl: "https://cdn.example.com/ana.png" }),
    ]);

    const updated = await service.updateProfile("ana", { avatarUrl: null });

    expect(updated.avatarUrl).toBeNull();
    expect(updated.name).toBe("Usuario ana");
  });

  it("guarda el idioma elegido", async () => {
    const service = createService([user("ana")]);

    await expect(
      service.updateProfile("ana", { locale: "es-ES" }),
    ).resolves.toMatchObject({ locale: "es-ES" });
  });

  it("no permite editar el perfil de otro usuario", async () => {
    const service = createService([user("ana")]);

    await expect(
      service.updateProfile("beto", { name: "Intruso" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("no deja escribir en una cuenta desactivada", async () => {
    const repository = new InMemoryUsersRepository([
      user("ana", { isActive: false }),
    ]);
    const service = new UsersService(repository);

    await expect(
      service.updateProfile("ana", { name: "Ana María" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(repository.findById("ana")).resolves.toMatchObject({
      name: "Usuario ana",
    });
  });
});

describe("UsersService.listUsers", () => {
  const seed = [
    user("ana", { name: "Ana Pérez", createdAt: new Date("2026-10-04T10:00:00Z") }),
    user("beto", { name: "Beto Ruiz", createdAt: new Date("2026-10-03T10:00:00Z") }),
    user("carla", {
      name: "Carla Soto",
      role: "INSTRUCTOR",
      email: "carla@academy.dev",
      createdAt: new Date("2026-10-02T10:00:00Z"),
    }),
    user("diego", {
      name: "Diego Paz",
      isActive: false,
      createdAt: new Date("2026-10-01T10:00:00Z"),
    }),
  ];

  it("pagina de más reciente a más antiguo y omite las cuentas desactivadas", async () => {
    const service = createService(seed);

    const page = await service.listUsers({ page: 1, pageSize: 2 });

    expect(page.data.map((profile) => profile.id)).toEqual(["ana", "beto"]);
    expect(page.meta).toEqual({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it("devuelve la segunda página sin repetir elementos", async () => {
    const service = createService(seed);

    const page = await service.listUsers({ page: 2, pageSize: 2 });

    expect(page.data.map((profile) => profile.id)).toEqual(["carla"]);
  });

  it("filtra por rol", async () => {
    const service = createService(seed);

    const page = await service.listUsers({
      role: "INSTRUCTOR",
      page: 1,
      pageSize: 20,
    });

    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.role).toBe("INSTRUCTOR");
    expect(page.meta.total).toBe(1);
  });

  it("busca por nombre y por correo sin distinguir mayúsculas", async () => {
    const service = createService(seed);

    await expect(
      service.listUsers({ search: "carla", page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ meta: { total: 1 } });
    await expect(
      service.listUsers({ search: "PÉREZ", page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ meta: { total: 1 } });
  });

  it("devuelve una página vacía con metadatos coherentes", async () => {
    const service = createService(seed);

    const page = await service.listUsers({ page: 9, pageSize: 2 });

    expect(page.data).toEqual([]);
    expect(page.meta).toEqual({
      page: 9,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
  });
});
