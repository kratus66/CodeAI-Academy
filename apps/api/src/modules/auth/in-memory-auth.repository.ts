import type { Role } from "@codeai/shared";

import type {
  AuthRepository,
  CreateRefreshTokenData,
  CreateUserData,
  RefreshTokenRecord,
  UserRecord,
} from "./auth.repository";
import { EmailAlreadyInUseError } from "./auth.repository";

/**
 * Implementación en memoria de `AuthRepository` para pruebas y para entornos
 * sin base de datos. Mantiene la misma semántica que el adaptador Prisma:
 * email único, tokens revocables y usuarios dados de baja lógica (`isActive`).
 */
export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, UserRecord>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  private sequence = 0;

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.get(email) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return (
      [...this.users.values()].find((user) => user.id === id) ?? null
    );
  }

  async createUser(data: CreateUserData): Promise<UserRecord> {
    if (this.users.has(data.email)) {
      throw new EmailAlreadyInUseError(data.email);
    }

    const user: UserRecord = {
      id: `usr_${++this.sequence}`,
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      role: "STUDENT" as Role,
      avatarUrl: null,
      locale: "es",
      isActive: true,
      createdAt: new Date(),
      lastLoginAt: null,
    };

    this.users.set(user.email, user);

    return user;
  }

  async markLogin(userId: string, at: Date): Promise<void> {
    const user = await this.findUserById(userId);

    if (user) {
      user.lastLoginAt = at;
    }
  }

  async createRefreshToken(
    data: CreateRefreshTokenData,
  ): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      id: `rt_${++this.sequence}`,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
    };

    this.refreshTokens.set(record.tokenHash, record);

    return record;
  }

  async findRefreshToken(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    return this.refreshTokens.get(tokenHash) ?? null;
  }

  async revokeRefreshToken(id: string, at: Date): Promise<void> {
    for (const record of this.refreshTokens.values()) {
      if (record.id === id && record.revokedAt === null) {
        record.revokedAt = at;
      }
    }
  }

  async revokeAllRefreshTokens(userId: string, at: Date): Promise<void> {
    for (const record of this.refreshTokens.values()) {
      if (record.userId === userId && record.revokedAt === null) {
        record.revokedAt = at;
      }
    }
  }

  /** Utilidades de inspección para las pruebas. */
  getUser(email: string): UserRecord | undefined {
    return this.users.get(email);
  }

  activeRefreshTokens(): RefreshTokenRecord[] {
    return [...this.refreshTokens.values()].filter(
      (record) => record.revokedAt === null,
    );
  }

  refreshTokenByHash(tokenHash: string): RefreshTokenRecord | undefined {
    return this.refreshTokens.get(tokenHash);
  }
}
