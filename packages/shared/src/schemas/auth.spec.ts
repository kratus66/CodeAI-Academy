import { describe, expect, it } from "vitest";

import {
  loginSchema,
  registerSchema,
  userPublicSchema,
} from "./auth";

const validRegistration = {
  email: "ana@example.com",
  password: "S3gura!pass",
  name: "Ana",
};

describe("registerSchema", () => {
  it("acepta un alta válida", () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it("rechaza una contraseña sin número", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "SoloLetras",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Debe incluir un número",
    );
  });

  it("rechaza una contraseña sin letra", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "12345678",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Debe incluir una letra",
    );
  });

  it("rechaza una contraseña de menos de 8 caracteres", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "Ab1",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un correo inválido", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: "ana@",
    });

    expect(result.success).toBe(false);
  });

  it("normaliza el nombre quitando espacios externos", () => {
    const result = registerSchema.parse({
      ...validRegistration,
      name: "  Ana  ",
    });

    expect(result.name).toBe("Ana");
  });
});

describe("loginSchema", () => {
  it("exige una contraseña no vacía", () => {
    const result = loginSchema.safeParse({
      email: "ana@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("userPublicSchema", () => {
  it("acepta un usuario con rol STUDENT", () => {
    const result = userPublicSchema.safeParse({
      id: "ckv2n3x0a0001qz8h2b3c4d5e",
      email: "ana@example.com",
      name: "Ana",
      role: "STUDENT",
      createdAt: "2026-10-26T14:30:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza cualquier rol fuera del catálogo", () => {
    const result = userPublicSchema.safeParse({
      id: "ckv2n3x0a0001qz8h2b3c4d5e",
      email: "ana@example.com",
      name: "Ana",
      role: "TEACHER",
      createdAt: "2026-10-26T14:30:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
