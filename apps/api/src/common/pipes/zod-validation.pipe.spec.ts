import { registerSchema } from "@codeai/shared";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { ZodValidationOptions } from "./zod-validation.pipe";
import { ZodValidationPipe } from "./zod-validation.pipe";

interface DetailsPayload {
  message: { field: string; message: string }[];
}

function detailsOf(error: unknown): { field: string; message: string }[] {
  if (!(error instanceof BadRequestException)) {
    throw new Error("Se esperaba BadRequestException");
  }

  return (error.getResponse() as DetailsPayload).message;
}

function options(value: ZodValidationOptions): ZodValidationOptions {
  return value;
}

describe("ZodValidationPipe", () => {
  it("acepta un cuerpo válido y devuelve los datos normalizados", () => {
    const pipe = new ZodValidationPipe(registerSchema);

    const result = pipe.transform({
      email: "ana@example.com",
      password: "S3gura!pass",
      name: "  Ana  ",
    });

    expect(result.name).toBe("Ana");
  });

  it("rechaza un cuerpo inválido con el campo culpable", () => {
    const pipe = new ZodValidationPipe(registerSchema);

    try {
      pipe.transform({ email: "no-es-correo", password: "123", name: "A" });
      throw new Error("La validación debía fallar");
    } catch (error) {
      const fields = detailsOf(error).map((detail) => detail.field);

      expect(fields).toContain("email");
      expect(fields).toContain("password");
      expect(fields).toContain("name");
    }
  });

  it("rechaza claves no declaradas por defecto", () => {
    const pipe = new ZodValidationPipe(registerSchema);

    try {
      pipe.transform({
        email: "ana@example.com",
        password: "S3gura!pass",
        name: "Ana",
        role: "ADMIN",
      });
      throw new Error("La validación debía fallar");
    } catch (error) {
      expect(detailsOf(error)[0]?.field).toBe("role");
    }
  });

  it("permite claves extra y las descarta si se desactiva la comprobación", () => {
    const pipe = new ZodValidationPipe(
      registerSchema,
      options({ rejectUnknownKeys: false }),
    );

    const result = pipe.transform({
      email: "ana@example.com",
      password: "S3gura!pass",
      name: "Ana",
      role: "ADMIN",
    });

    expect(result).not.toHaveProperty("role");
  });
});
