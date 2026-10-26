import type { CookieOptions, Response } from "express";

import type { Env } from "../../config/env";

/** Nombres y rutas exigidos por `contratos-api.md` §1. */
export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const REFRESH_TOKEN_PATH = "/api/auth";

/** Lee una cookie del header `Cookie` sin añadir `cookie-parser`. */
export function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");

    if (rawName === name && rest.length > 0) {
      const value = rest.join("=");

      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return undefined;
}

function baseOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    // En local se sirve por http; en producción la cookie no viaja sin TLS.
    secure: env.NODE_ENV === "production",
  };
}

export interface SessionCookies {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/** Deja ambas cookies httpOnly: el frontend nunca lee los tokens. */
export function setSessionCookies(
  response: Response,
  env: Env,
  session: SessionCookies,
): void {
  response.cookie(ACCESS_TOKEN_COOKIE, session.accessToken, {
    ...baseOptions(env),
    path: "/",
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  response.cookie(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    ...baseOptions(env),
    path: REFRESH_TOKEN_PATH,
    expires: session.refreshTokenExpiresAt,
  });
}

/** Borra ambas cookies con las mismas opciones con las que se crearon. */
export function clearSessionCookies(response: Response, env: Env): void {
  response.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseOptions(env), path: "/" });
  response.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseOptions(env),
    path: REFRESH_TOKEN_PATH,
  });
}
