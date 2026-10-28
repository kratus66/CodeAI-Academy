import { Injectable } from "@nestjs/common";
// `Prisma` se usa como valor (`instanceof`) y `User`/`Prisma.UserWhereInput` como tipos.
import { Prisma } from "@prisma/client";
import type { User as PrismaUser } from "@prisma/client";

import { ROLES } from "@codeai/shared";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  ListUsersFilter,
  UpdateProfileData,
  UserProfileRecord,
  UsersPage,
  UsersRepository,
} from "./users.repository";

/** Adaptador Prisma del puerto `UsersRepository`. */
@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserProfileRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });

    return row ? toUserProfileRecord(row) : null;
  }

  async updateProfile(
    id: string,
    data: UpdateProfileData,
  ): Promise<UserProfileRecord | null> {
    try {
      const row = await this.prisma.user.update({ where: { id }, data });

      return toUserProfileRecord(row);
    } catch (error) {
      // P2025: el registro desapareció entre la lectura y la escritura.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }

      throw error;
    }
  }

  async list(filter: ListUsersFilter): Promise<UsersPage> {
    const where: Prisma.UserWhereInput = { isActive: true };

    if (filter.role) {
      where.role = filter.role;
    }

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: "insensitive" } },
        { email: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: rows.map(toUserProfileRecord), total };
  }
}

/** El enum `Role` de Prisma coincide con el de `@codeai/shared` (mismos valores). */
function toUserProfileRecord(row: PrismaUser): UserProfileRecord {
  if (!ROLES.includes(row.role)) {
    // Un valor fuera del catálogo sería un dato corrupto: mejor fallar aquí
    // que servir un rol que el contrato no admite.
    throw new Error(`Rol desconocido en la base de datos: ${String(row.role)}`);
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    avatarUrl: row.avatarUrl,
    locale: row.locale,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}
