import type { UserProfile } from "@codeai/shared";

import type { UserProfileRecord } from "./users.repository";

/**
 * Proyección del perfil hacia el cliente. Es el único punto que decide qué se
 * expone: `isActive` se queda en el servidor y las fechas viajan en ISO 8601,
 * igual que en `AuthMapper`.
 */
export function toUserProfile(user: UserProfileRecord): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: user.avatarUrl,
    locale: user.locale,
  };
}
