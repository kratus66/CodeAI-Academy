import { SetMetadata } from "@nestjs/common";

import type { Role } from "@codeai/shared";

/**
 * Clave de metadatos que lee `RolesGuard`. Se exporta para que el guard y las
 * pruebas usen la misma cadena y no se dupliquen literales.
 */
export const ROLES_KEY = "codeai:roles";

/**
 * Restringe una ruta a los roles indicados (`contratos-api.md` §5).
 *
 * ```ts
 * @Get()
 * @Roles("ADMIN")
 * @UseGuards(RolesGuard)
 * list() { … }
 * ```
 *
 * Sin `@Roles` la ruta no se restringe: `RolesGuard` deja pasar a cualquier
 * usuario ya autenticado por `JwtAuthGuard`. El decorador **no autentica** por
 * sí solo; siempre va acompañado del guard JWT.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
