import type { UserPublic } from "@codeai/shared";

import type { UserRecord } from "./auth.repository";

/**
 * Proyección segura hacia el cliente. Es el único punto que decide qué se
 * expone: `passwordHash`, `isActive` y `lastLoginAt` nunca salen de la API.
 */
export function toUserPublic(user: UserRecord): UserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
