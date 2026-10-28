import { describe, expect, it } from "vitest";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import {
  AVATAR_URL_MAX_LENGTH,
  updateProfileSchema,
  userListQuerySchema,
  userListResponseSchema,
  userProfileSchema,
  userProfileResponseSchema,
} from "./user";

const PROFILE = {
  id: "usr_1",
  email: "ana@example.com",
  name: "Ana",
  role: "STUDENT",
  createdAt: "2026-10-28T09:00:00.000Z",
  avatarUrl: null,
  locale: "es",
} as const;

describe("updateProfileSchema", () => {
  it("acepta un cambio parcial y recorta el nombre", () => {
    const parsed = updateProfileSchema.parse({ name: "  Ana María  " });

    expect(parsed).toEqual({ name: "Ana María" });
  });

  it("acepta borrar el avatar con null", () => {
    expect(updateProfileSchema.parse({ avatarUrl: null })).toEqual({
      avatarUrl: null,
    });
  });

  it("rechaza un cuerpo vacío", () => {
    const result = updateProfileSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Envía al menos un campo para actualizar",
    );
  });

  it("rechaza claves fuera del contrato", () => {
    const result = updateProfileSchema.safeParse({ role: "ADMIN" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("unrecognized_keys");
  });

  it("rechaza un avatar que no es URL", () => {
    expect(
      updateProfileSchema.safeParse({ avatarUrl: "ftp://example.com/a.png" })
        .success,
    ).toBe(false);
  });

  it("rechaza un avatar con esquema peligroso para un <img>", () => {
    expect(
      updateProfileSchema.safeParse({
        avatarUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      }).success,
    ).toBe(false);
    expect(
      updateProfileSchema.parse({ avatarUrl: " https://cdn.example.com/a.png " })
        .avatarUrl,
    ).toBe("https://cdn.example.com/a.png");
  });

  it("rechaza un avatar más largo que la columna", () => {
    const avatarUrl = `https://example.com/${"a".repeat(AVATAR_URL_MAX_LENGTH)}`;

    expect(updateProfileSchema.safeParse({ avatarUrl }).success).toBe(false);
  });

  it("rechaza un idioma inventado", () => {
    expect(updateProfileSchema.safeParse({ locale: "español" }).success).toBe(
      false,
    );
    expect(updateProfileSchema.parse({ locale: "es-ES" }).locale).toBe("es-ES");
  });
});

describe("userListQuerySchema", () => {
  it("aplica página y tamaño por defecto", () => {
    expect(userListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: PAGE_SIZE_DEFAULT,
    });
  });

  it("convierte los query strings numéricos", () => {
    expect(
      userListQuerySchema.parse({ page: "2", pageSize: "50", role: "INSTRUCTOR" }),
    ).toEqual({ page: 2, pageSize: 50, role: "INSTRUCTOR" });
  });

  it("rechaza un tamaño de página por encima del máximo", () => {
    expect(
      userListQuerySchema.safeParse({ pageSize: String(PAGE_SIZE_MAX + 1) })
        .success,
    ).toBe(false);
  });

  it("rechaza un rol fuera del catálogo", () => {
    const result = userListQuerySchema.safeParse({ role: "TEACHER" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("STUDENT");
  });

  it("exige dos caracteres para buscar y recorta el término", () => {
    expect(userListQuerySchema.safeParse({ search: "a" }).success).toBe(false);
    expect(userListQuerySchema.parse({ search: "  ana " }).search).toBe("ana");
  });

  it("rechaza filtros no declarados", () => {
    expect(userListQuerySchema.safeParse({ email: "ana@example.com" }).success).toBe(
      false,
    );
  });
});

describe("userProfileSchema", () => {
  it("acepta el perfil completo", () => {
    expect(userProfileSchema.parse(PROFILE)).toEqual(PROFILE);
  });

  it("exige el idioma y el avatar explícitos", () => {
    const withoutPreferences = {
      id: PROFILE.id,
      email: PROFILE.email,
      name: PROFILE.name,
      role: PROFILE.role,
      createdAt: PROFILE.createdAt,
    };

    expect(userProfileSchema.safeParse(withoutPreferences).success).toBe(false);
  });

  it("envuelve el perfil en la respuesta de `/me`", () => {
    expect(userProfileResponseSchema.parse({ user: PROFILE }).user.id).toBe(
      "usr_1",
    );
  });
});

describe("userListResponseSchema", () => {
  it("publica el listado con su paginación", () => {
    const parsed = userListResponseSchema.parse({
      data: [PROFILE],
      meta: { page: 1, pageSize: PAGE_SIZE_DEFAULT, total: 1, totalPages: 1 },
    });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.meta.totalPages).toBe(1);
  });

  it("rechaza una página de tamaño cero en los metadatos", () => {
    expect(
      userListResponseSchema.safeParse({
        data: [],
        meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 },
      }).success,
    ).toBe(false);
  });
});
