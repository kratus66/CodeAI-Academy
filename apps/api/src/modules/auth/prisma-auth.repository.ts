import { Injectable } from "@nestjs/common";
// `Prisma` se usa como valor (`instanceof`) y `User` solo como tipo.
import { Prisma } from "@prisma/client";
import type { User as PrismaUser } from "@prisma/client";

import type { Role } from "@codeai/shared";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  AuthRepository,
  CreateRefreshTokenData,
  CreateUserData,
  RefreshTokenRecord,
  UserRecord,
} from "./auth.repository";
import { EmailAlreadyInUseError } from "./auth.repository";

/** Adaptador Prisma del puerto `AuthRepository`. */
@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });

    return row ? toUserRecord(row) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });

    return row ? toUserRecord(row) : null;
  }

  async createUser(data: CreateUserData): Promise<UserRecord> {
    try {
      const row = await this.prisma.user.create({ data });
      return toUserRecord(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EmailAlreadyInUseError(data.email);
      }

      throw error;
    }
  }

  async markLogin(userId: string, at: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: at },
    });
  }

  async createRefreshToken(
    data: CreateRefreshTokenData,
  ): Promise<RefreshTokenRecord> {
    const row = await this.prisma.refreshToken.create({ data });

    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }

  async revokeRefreshToken(id: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeAllRefreshTokens(userId: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}

/** El enum `Role` de Prisma coincide con el de `@codeai/shared` (mismos valores). */
function toUserRecord(row: PrismaUser): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    name: row.name,
    role: row.role as Role,
    avatarUrl: row.avatarUrl,
    locale: row.locale,
    isActive: row.isActive,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  };
}
