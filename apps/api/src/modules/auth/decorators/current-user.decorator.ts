import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

import type { AuthenticatedRequest } from "../guards/jwt-auth.guard";
import type { AccessTokenPayload } from "../token.service";

/**
 * Inyecta el usuario autenticado por `JwtAuthGuard` en un parámetro del
 * controlador. Solo es válido en rutas protegidas.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload => {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new Error(
        "CurrentUser se usó en una ruta sin JwtAuthGuard",
      );
    }

    return request.user;
  },
);
