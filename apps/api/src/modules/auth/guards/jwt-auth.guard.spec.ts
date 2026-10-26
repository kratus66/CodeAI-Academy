import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it } from "vitest";

import { loadEnv } from "../../../config/env";
import { ACCESS_TOKEN_COOKIE } from "../auth.cookies";
import { TokenService } from "../token.service";
import type { AuthenticatedRequest } from "./jwt-auth.guard";
import { JwtAuthGuard } from "./jwt-auth.guard";

const env = loadEnv({});
const tokens = new TokenService(new JwtService(), env);
const user = { sub: "usr_1", email: "ana@example.com", role: "STUDENT" as const };

function createContext(request: Partial<AuthenticatedRequest>): {
  context: ExecutionContext;
  request: AuthenticatedRequest;
} {
  const fullRequest = { headers: {}, ...request } as AuthenticatedRequest;

  const context = {
    switchToHttp: () => ({ getRequest: () => fullRequest }),
  } as unknown as ExecutionContext;

  return { context, request: fullRequest };
}

describe("JwtAuthGuard", () => {
  const guard = new JwtAuthGuard(tokens);

  it("autentica con Authorization: Bearer", async () => {
    const token = await tokens.signAccessToken(user);
    const { context, request } = createContext({
      headers: { authorization: `Bearer ${token}` },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(user);
  });

  it("autentica con la cookie access_token", async () => {
    const token = await tokens.signAccessToken(user);
    const { context, request } = createContext({
      headers: { cookie: `theme=dark; ${ACCESS_TOKEN_COOKIE}=${token}` },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(user);
  });

  it("rechaza una petición sin credenciales", async () => {
    const { context } = createContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza un token inválido", async () => {
    const { context } = createContext({
      headers: { authorization: "Bearer token-falso" },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("ignora esquemas distintos de Bearer", async () => {
    const token = await tokens.signAccessToken(user);
    const { context } = createContext({
      headers: { authorization: `Basic ${token}` },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
