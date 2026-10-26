import { describe, expect, it } from "vitest";

import { BCRYPT_COST, PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("genera un hash bcrypt con el coste del contrato", async () => {
    const passwordHash = await service.hash("S3gura!pass");

    expect(passwordHash).not.toBe("S3gura!pass");
    expect(passwordHash.startsWith("$2")).toBe(true);
    expect(passwordHash).toContain(`$${BCRYPT_COST}$`);
  });

  it("usa una sal distinta en cada hash", async () => {
    const [first, second] = await Promise.all([
      service.hash("S3gura!pass"),
      service.hash("S3gura!pass"),
    ]);

    expect(first).not.toBe(second);
  });

  it("verifica la contraseña correcta", async () => {
    const passwordHash = await service.hash("S3gura!pass");

    await expect(service.verify("S3gura!pass", passwordHash)).resolves.toBe(
      true,
    );
  });

  it("rechaza una contraseña incorrecta", async () => {
    const passwordHash = await service.hash("S3gura!pass");

    await expect(service.verify("otra-clave", passwordHash)).resolves.toBe(
      false,
    );
  });

  it("trata un hash corrupto como no coincidente", async () => {
    await expect(service.verify("S3gura!pass", "no-es-un-hash")).resolves.toBe(
      false,
    );
  });
});
