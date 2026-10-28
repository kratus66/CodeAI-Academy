import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
// Import de valor obligatorio: `Reflector` se usa como dependencia de Nest.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from "@nestjs/core";

import type { Role } from "@codeai/shared";

import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedRequest } from "./jwt-auth.guard";

/**
 * Autoriza por rol después de `JwtAuthGuard` (`contratos-api.md` §5).
 *
 * - Sin `@Roles`, la ruta no se restringe y el guard no estorba.
 * - Con `@Roles`, exige que `request.user.role` esté en la lista; si no hay
 *   usuario responde `401` y si el rol no alcanza, `403 FORBIDDEN`.
 *
 * El rol se lee del **token**, no de la base: un cambio de rol surte efecto
 * cuando el usuario renueva la sesión. Es el mismo criterio que documenta S3 y
 * evita una consulta por petición.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.requiredRoles(context);

    if (required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException("Debes iniciar sesión para continuar");
    }

    if (!required.includes(request.user.role)) {
      throw new ForbiddenException("No tienes permiso para realizar esta acción");
    }

    return true;
  }

  /** El `@Roles` del método gana sobre el de la clase, como en Nest. */
  private requiredRoles(context: ExecutionContext): readonly Role[] {
    return (
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }
}
