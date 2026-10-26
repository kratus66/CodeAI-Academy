import { createHash, randomBytes } from "node:crypto";

import { ROLES } from "@codeai/shared";
import type { Role } from "@codeai/shared";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
// Import de valor obligatorio: Nest resuelve `JwtService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { JwtService } from "@nestjs/jwt";

import type { Env } from "../../config/env";
import { ENV } from "../../config/env.module";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface RefreshTokenMaterial {
  /** Valor que se entrega al cliente en la cookie. */
  token: string;
  /** SHA-256 del token; es lo único que se guarda en base de datos. */
  tokenHash: string;
  expiresAt: Date;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Único responsable de la criptografía de sesión: JWT de acceso firmado con
 * HS256 y refresh tokens opacos de alta entropía.
 *
 * El refresh token nunca se guarda en claro: si se filtra la base de datos, las
 * sesiones no son reutilizables.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.env.JWT_SECRET,
      expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  /**
   * Verifica firma y expiración y valida la forma del payload: un token firmado
   * con otro propósito o con un rol inventado no debe autenticar.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    let payload: Record<string, unknown>;

    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: this.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException("La sesión ha expirado o no es válida");
    }

    const { sub, email, role } = payload;

    if (
      typeof sub !== "string" ||
      sub.length === 0 ||
      typeof email !== "string" ||
      !ROLES.includes(role as Role)
    ) {
      throw new UnauthorizedException("La sesión ha expirado o no es válida");
    }

    return { sub, email, role: role as Role };
  }

  /** Genera un refresh token nuevo con su hash y su fecha de expiración. */
  generateRefreshToken(): RefreshTokenMaterial {
    const token = randomBytes(48).toString("base64url");
    const expiresAt = new Date(
      Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * MILLISECONDS_PER_DAY,
    );

    return { token, tokenHash: this.hashRefreshToken(token), expiresAt };
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
