import type {
  ListUsersFilter,
  UpdateProfileData,
  UserProfileRecord,
  UsersPage,
  UsersRepository,
} from "./users.repository";

/**
 * Implementación en memoria de `UsersRepository` para pruebas y entornos sin
 * base de datos. Imita el adaptador Prisma: solo las cuentas activas aparecen
 * en el listado, la búsqueda ignora mayúsculas y el orden es el mismo
 * (`createdAt` desc, `id` desc) para que la paginación sea reproducible.
 */
export class InMemoryUsersRepository implements UsersRepository {
  private readonly rows = new Map<string, UserProfileRecord>();

  constructor(seed: readonly UserProfileRecord[] = []) {
    for (const user of seed) {
      this.rows.set(user.id, { ...user });
    }
  }

  async findById(id: string): Promise<UserProfileRecord | null> {
    const row = this.rows.get(id);

    return row ? { ...row } : null;
  }

  async updateProfile(
    id: string,
    data: UpdateProfileData,
  ): Promise<UserProfileRecord | null> {
    const current = this.rows.get(id);

    if (!current) {
      return null;
    }

    const next: UserProfileRecord = { ...current, ...data };
    this.rows.set(id, next);

    return { ...next };
  }

  async list(filter: ListUsersFilter): Promise<UsersPage> {
    const needle = filter.search?.toLowerCase();

    const matches = [...this.rows.values()]
      .filter((user) => user.isActive)
      .filter((user) => !filter.role || user.role === filter.role)
      .filter(
        (user) =>
          !needle ||
          user.name.toLowerCase().includes(needle) ||
          user.email.toLowerCase().includes(needle),
      )
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      );

    const start = (filter.page - 1) * filter.pageSize;

    return {
      items: matches
        .slice(start, start + filter.pageSize)
        .map((user) => ({ ...user })),
      total: matches.length,
    };
  }
}
