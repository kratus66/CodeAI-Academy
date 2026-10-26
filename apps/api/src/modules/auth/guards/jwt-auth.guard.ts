import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { ACCESS_TOKEN_COOKIE, readCookie } from "../auth.cookies";
import type { AccessTokenPayload } from "../token.service";
// Import de valor obligatorio: Nest resuelve `TokenService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TokenService } from "../token.service";

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

/**
 * Autentica por cookie httpOnly (navegador) o `Authorization: Bearer`
 * (clientes externos y pruebas). Deja el payload en `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token =
      extractBearerToken(request.headers.authorization) ??
      readCookie(request.headers.cookie, ACCESS_TOKEN_COOKIE);

    if (!token) {
      throw new UnauthorizedException("Debes iniciar sesión para continuar");
    }

    request.user = await this.tokens.verifyAccessToken(token);

    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  const [scheme, value] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return undefined;
  }

  return value;
}
