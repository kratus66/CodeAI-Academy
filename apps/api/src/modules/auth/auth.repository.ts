import type { Role } from "@codeai/shared";

/** Usuario tal como vive en persistencia (incluye el hash de contraseña). */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Token de inyección: el dominio depende de la interfaz, no de Prisma. */
export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(data: CreateUserData): Promise<UserRecord>;
  markLogin(userId: string, at: Date): Promise<void>;
  createRefreshToken(
    data: CreateRefreshTokenData,
  ): Promise<RefreshTokenRecord>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string, at: Date): Promise<void>;
  revokeAllRefreshTokens(userId: string, at: Date): Promise<void>;
}

/**
 * Violación de unicidad (email ya registrado). El adaptador la traduce desde el
 * error de Prisma y el servicio la convierte en `409 CONFLICT`, de modo que la
 * capa de dominio no conozca códigos de la base de datos.
 */
export class EmailAlreadyInUseError extends Error {
  constructor(readonly email: string) {
    super("El correo ya está registrado");
    this.name = "EmailAlreadyInUseError";
  }
}
