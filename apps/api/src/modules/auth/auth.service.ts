import type { LoginInput, RegisterInput, UserPublic } from "@codeai/shared";
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

// Imports de valor obligatorios: Nest los resuelve por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PasswordService } from "../../common/security/password.service";
import { toUserPublic } from "./auth.mapper";
import type { AuthRepository, UserRecord } from "./auth.repository";
import { AUTH_REPOSITORY, EmailAlreadyInUseError } from "./auth.repository";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TokenService } from "./token.service";

export interface AuthSession {
  user: UserPublic;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/**
 * Hash señuelo (contraseña aleatoria, coste 12) para verificar siempre, aunque
 * el email no exista: el tiempo de respuesta no delata cuentas registradas.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$ijtML.dvumPcn.ktlkwC6uQQbQ0w2fuxIKFzsMKNDh3FMmbA7u8mi";

const INVALID_CREDENTIALS = "Correo o contraseña incorrectos";
const INVALID_SESSION = "La sesión no es válida o ha expirado";

/**
 * Reglas de identidad: alta, login, rotación de refresh tokens y baja de
 * sesión. No conoce HTTP (cookies/headers) ni Prisma; el controlador y el
 * adaptador se encargan de esos detalles.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthSession> {
    const passwordHash = await this.passwords.hash(input.password);

    try {
      const user = await this.repository.createUser({
        email: normalizeEmail(input.email),
        passwordHash,
        name: input.name,
      });

      return this.issueSession(user);
    } catch (error) {
      if (error instanceof EmailAlreadyInUseError) {
        throw new ConflictException("Ese correo ya está registrado");
      }

      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.repository.findUserByEmail(
      normalizeEmail(input.email),
    );
    const matches = await this.passwords.verify(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !matches || !user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.repository.markLogin(user.id, new Date());

    return this.issueSession(user);
  }

  /**
   * Rotación con detección de reutilización: si llega un refresh ya revocado, se
   * asume robo y se revocan todas las sesiones del usuario.
   */
  async refresh(rawToken: string | undefined): Promise<AuthSession> {
    if (!rawToken) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const record = await this.repository.findRefreshToken(
      this.tokens.hashRefreshToken(rawToken),
    );

    if (!record) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    if (record.revokedAt !== null) {
      await this.repository.revokeAllRefreshTokens(record.userId, new Date());
      throw new UnauthorizedException(INVALID_SESSION);
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const user = await this.repository.findUserById(record.userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    await this.repository.revokeRefreshToken(record.id, new Date());

    return this.issueSession(user);
  }

  /** Idempotente: cerrar sesión dos veces no es un error. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    const record = await this.repository.findRefreshToken(
      this.tokens.hashRefreshToken(rawToken),
    );

    if (record && record.revokedAt === null) {
      await this.repository.revokeRefreshToken(record.id, new Date());
    }
  }

  async getCurrentUser(userId: string): Promise<UserPublic> {
    const user = await this.repository.findUserById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    return toUserPublic(user);
  }

  /** Emite el par de tokens y persiste el refresh (solo su hash). */
  private async issueSession(user: UserRecord): Promise<AuthSession> {
    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refresh = this.tokens.generateRefreshToken();

    await this.repository.createRefreshToken({
      userId: user.id,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    });

    return {
      user: toUserPublic(user),
      accessToken,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }
}

/** Los emails se comparan sin mayúsculas ni espacios accidentales. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
