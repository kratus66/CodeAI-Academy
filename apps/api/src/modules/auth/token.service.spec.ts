import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { loadEnv } from "../../config/env";
import { TokenService } from "./token.service";

const env = loadEnv({});

function createService(): TokenService {
  return new TokenService(new JwtService(), env);
}

const payload = {
  sub: "usr_123",
  email: "ana@example.com",
  role: "STUDENT" as const,
};

describe("TokenService", () => {
  it("firma y verifica un access token conservando el payload", async () => {
    const service = createService();

    const token = await service.signAccessToken(payload);

    await expect(service.verifyAccessToken(token)).resolves.toEqual(payload);
  });

  it("rechaza un token manipulado", async () => {
    const service = createService();
    const token = await service.signAccessToken(payload);

    await expect(
      service.verifyAccessToken(`${token.slice(0, -2)}xx`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza un token expirado", async () => {
    const service = createService();
    const expired = new JwtService().sign(payload, {
      secret: env.JWT_SECRET,
      expiresIn: -10,
    });

    await expect(service.verifyAccessToken(expired)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza un payload con rol desconocido", async () => {
    const service = createService();
    const forged = new JwtService().sign(
      { ...payload, role: "SUPERADMIN" },
      { secret: env.JWT_SECRET, expiresIn: 60 },
    );

    await expect(service.verifyAccessToken(forged)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("genera refresh tokens distintos con hash estable", () => {
    const service = createService();

    const first = service.generateRefreshToken();
    const second = service.generateRefreshToken();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toHaveLength(64);
    expect(service.hashRefreshToken(first.token)).toBe(first.tokenHash);
  });

  it("expira el refresh token en los días configurados", () => {
    const service = createService();

    const { expiresAt } = service.generateRefreshToken();
    const days = (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);

    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });
});
