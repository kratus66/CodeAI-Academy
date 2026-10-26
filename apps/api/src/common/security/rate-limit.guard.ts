import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request, Response } from "express";

import type { RateLimitOptions } from "./rate-limit.decorator";
import { RATE_LIMIT_METADATA } from "./rate-limit.decorator";

interface Window {
  count: number;
  resetAt: number;
}

const MESSAGE = "Demasiados intentos. Espera antes de volver a probar.";

/**
 * Límite de peticiones en memoria por IP y, opcionalmente, por campo del cuerpo.
 *
 * Es deliberadamente simple: una instancia, sin Redis. Suficiente para S1 y
 * sustituible en S11 sin tocar los controladores (mismo decorador).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();

  /** Reloj sobrescribible en pruebas (sin parámetro de constructor: Nest lo confundiría con un provider). */
  protected now(): number {
    return Date.now();
  }

  canActivate(context: ExecutionContext): boolean {
    const options = Reflect.getMetadata(
      RATE_LIMIT_METADATA,
      context.getHandler(),
    ) as RateLimitOptions | undefined;

    if (!options) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const currentTime = this.now();
    const key = this.keyFor(request, options);
    const window = this.windows.get(key);

    if (!window || window.resetAt <= currentTime) {
      this.windows.set(key, {
        count: 1,
        resetAt: currentTime + options.windowMs,
      });
      this.prune(currentTime);

      return true;
    }

    window.count += 1;

    if (window.count <= options.limit) {
      return true;
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((window.resetAt - currentTime) / 1000),
    );

    response.setHeader("Retry-After", String(retryAfterSeconds));
    throw new HttpException(
      {
        message: MESSAGE,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** IP + valor normalizado del campo declarado (si existe). */
  private keyFor(request: Request, options: RateLimitOptions): string {
    const ip = request.ip ?? request.socket?.remoteAddress ?? "desconocida";
    const rawValue = options.keyFromBody
      ? (request.body as Record<string, unknown> | undefined)?.[
          options.keyFromBody
        ]
      : undefined;
    const extra =
      typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";

    return `${ip}|${options.keyFromBody ?? ""}|${extra}`;
  }

  /** Evita crecer sin límite: descarta ventanas ya expiradas. */
  private prune(currentTime: number): void {
    if (this.windows.size < 1_000) {
      return;
    }

    for (const [key, window] of this.windows) {
      if (window.resetAt <= currentTime) {
        this.windows.delete(key);
      }
    }
  }
}
