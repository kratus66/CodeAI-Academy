import type { Role } from "@codeai/shared";

/** Token de inyección del puerto: las pruebas lo sustituyen por el adaptador en memoria. */
export const USERS_REPOSITORY = Symbol("USERS_REPOSITORY");

/**
 * Fila de usuario que necesita el módulo `users`. Incluye `isActive` porque el
 * servicio decide con ella si el perfil existe para el cliente, pero la
 * proyección pública (`UserProfile`) nunca la expone.
 */
export interface UserProfileRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
  createdAt: Date;
}

/** Campos editables del perfil; `undefined` significa «no tocar». */
export interface UpdateProfileData {
  name?: string;
  avatarUrl?: string | null;
  locale?: string;
}

/** Filtros ya validados por `userListQuerySchema`. */
export interface ListUsersFilter {
  role?: Role;
  search?: string;
  page: number;
  pageSize: number;
}

export interface UsersPage {
  items: UserProfileRecord[];
  total: number;
}

/**
 * Puerto de persistencia de usuarios. `auth` solo necesita credenciales; este
 * puerto separa el perfil y el listado de administración para que el módulo
 * `auth` no crezca con responsabilidades ajenas a la sesión.
 */
export interface UsersRepository {
  findById(id: string): Promise<UserProfileRecord | null>;
  /** `null` si el usuario desapareció entre la lectura y la escritura. */
  updateProfile(
    id: string,
    data: UpdateProfileData,
  ): Promise<UserProfileRecord | null>;
  list(filter: ListUsersFilter): Promise<UsersPage>;
}
