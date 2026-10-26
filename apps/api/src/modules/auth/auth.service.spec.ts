import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it } from "vitest";

import type { PasswordService } from "../../common/security/password.service";
import { loadEnv } from "../../config/env";
import { AuthService } from "./auth.service";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { TokenService } from "./token.service";

const env = loadEnv({});
const registration = {
  email: "Ana@Example.com",
  password: "S3gura!pass",
  name: "Ana",
};

/** Hash simulado: mantiene las pruebas rápidas; el hashing real se prueba en T3. */
const fakeHash = (plain: string): string =>
  `hashed:${Buffer.from(plain, "utf8").toString("base64")}`;

const passwords = {
  hash: (plain: string): Promise<string> => Promise.resolve(fakeHash(plain)),
  verify: (plain: string, hash: string): Promise<boolean> =>
    Promise.resolve(hash === fakeHash(plain)),
} as PasswordService;

function createContext(): {
  service: AuthService;
  repository: InMemoryAuthRepository;
  tokens: TokenService;
} {
  const repository = new InMemoryAuthRepository();
  const tokens = new TokenService(new JwtService(), env);
  const service = new AuthService(repository, passwords, tokens);

  return { service, repository, tokens };
}

describe("AuthService", () => {
  let context: ReturnType<typeof createContext>;

  beforeEach(() => {
    context = createContext();
  });

  it("registra con el email normalizado y sin guardar la contraseña en claro", async () => {
    const session = await context.service.register(registration);
    const stored = context.repository.getUser("ana@example.com");

    expect(stored?.passwordHash).toBe(fakeHash("S3gura!pass"));
    expect(stored?.passwordHash).not.toContain("S3gura!pass");
    expect(session.user).toEqual({
      id: stored?.id,
      email: "ana@example.com",
      name: "Ana",
      role: "STUDENT",
      createdAt: stored?.createdAt.toISOString(),
    });
    expect(session.user).not.toHaveProperty("passwordHash");
    await expect(
      context.tokens.verifyAccessToken(session.accessToken),
    ).resolves.toMatchObject({ sub: stored?.id, role: "STUDENT" });
  });

  it("rechaza un registro con email repetido", async () => {
    await context.service.register(registration);

    await expect(
      context.service.register({ ...registration, email: "ANA@example.com" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("inicia sesión, actualiza lastLoginAt y emite tokens válidos", async () => {
    await context.service.register(registration);

    const session = await context.service.login({
      email: "ana@example.com",
      password: "S3gura!pass",
    });

    expect(
      context.repository.getUser("ana@example.com")?.lastLoginAt,
    ).toBeInstanceOf(Date);
    expect(context.repository.activeRefreshTokens()).toHaveLength(2);
    await expect(
      context.tokens.verifyAccessToken(session.accessToken),
    ).resolves.toMatchObject({ email: "ana@example.com" });
  });

  it("no revela si el email existe cuando las credenciales fallan", async () => {
    await context.service.register(registration);

    const wrongPassword = await context.service
      .login({ email: "ana@example.com", password: "incorrecta" })
      .catch((error: unknown) => error);
    const unknownEmail = await context.service
      .login({ email: "nadie@example.com", password: "S3gura!pass" })
      .catch((error: unknown) => error);

    expect(wrongPassword).toBeInstanceOf(UnauthorizedException);
    expect(unknownEmail).toBeInstanceOf(UnauthorizedException);
    expect((wrongPassword as Error).message).toBe(
      (unknownEmail as Error).message,
    );
  });

  it("rechaza el login de una cuenta desactivada", async () => {
    await context.service.register(registration);
    const stored = context.repository.getUser("ana@example.com");

    if (stored) {
      stored.isActive = false;
    }

    await expect(
      context.service.login({
        email: "ana@example.com",
        password: "S3gura!pass",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rota el refresh token y revoca el anterior", async () => {
    const first = await context.service.register(registration);

    const second = await context.service.refresh(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(
      context.repository.refreshTokenByHash(
        context.tokens.hashRefreshToken(first.refreshToken),
      )?.revokedAt,
    ).toBeInstanceOf(Date);
    await expect(
      context.service.refresh(second.refreshToken),
    ).resolves.toMatchObject({ user: { id: first.user.id } });
  });

  it("revoca todas las sesiones si se reutiliza un refresh revocado", async () => {
    const first = await context.service.register(registration);
    const second = await context.service.refresh(first.refreshToken);

    await expect(
      context.service.refresh(first.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(context.repository.activeRefreshTokens()).toHaveLength(0);
    await expect(
      context.service.refresh(second.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza un refresh expirado", async () => {
    const session = await context.service.register(registration);
    const record = context.repository.refreshTokenByHash(
      context.tokens.hashRefreshToken(session.refreshToken),
    );

    if (record) {
      record.expiresAt = new Date(Date.now() - 1000);
    }

    await expect(
      context.service.refresh(session.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("cierra sesión de forma idempotente", async () => {
    const session = await context.service.register(registration);

    await context.service.logout(session.refreshToken);
    await expect(
      context.service.logout(session.refreshToken),
    ).resolves.toBeUndefined();
    expect(context.repository.activeRefreshTokens()).toHaveLength(0);
  });

  it("devuelve el usuario actual y rechaza cuentas inactivas", async () => {
    const session = await context.service.register(registration);

    await expect(
      context.service.getCurrentUser(session.user.id),
    ).resolves.toMatchObject({ email: "ana@example.com" });

    const stored = context.repository.getUser("ana@example.com");

    if (stored) {
      stored.isActive = false;
    }

    await expect(
      context.service.getCurrentUser(session.user.id),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
