import type { SandboxRunEnvelope, SandboxRunRequest } from "@codeai/shared";
import { sandboxRunRequestSchema } from "@codeai/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import type { SandboxService, SandboxStatus } from "./sandbox.service";
import { SANDBOX_SERVICE } from "./sandbox.service";

/** Cuota del contrato (`contratos-api.md` §4.6): veinte ejecuciones por minuto. */
export const EXECUTIONS_PER_MINUTE = 20;
const QUOTA_WINDOW_MS = 60_000;
const QUOTA_MESSAGE =
  "Has alcanzado el límite de 20 ejecuciones por minuto. Espera antes de volver a intentar.";

interface QuotaWindow {
  count: number;
  resetAt: number;
}

/**
 * Cuota por **usuario** del endpoint de ejecución. La clave sale de
 * `request.user.sub`, que deja `JwtAuthGuard` antes de este guard: un anónimo no
 * llega aquí y dos estudiantes tras la misma IP no se limitan entre sí.
 *
 * Ventana deslizante en memoria, igual que `RateLimitGuard`; S11 la sustituye
 * por un contador compartido sin tocar el controlador.
 */
@Injectable()
export class SandboxQuotaGuard implements CanActivate {
  private readonly windows = new Map<string, QuotaWindow>();

  /** Reloj sobrescribible en pruebas (sin constructor: Nest lo tomaría por provider). */
  protected now(): number {
    return Date.now();
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const key = request.user?.sub ?? "sin-sesion";
    const currentTime = this.now();
    const window = this.windows.get(key);

    if (!window || window.resetAt <= currentTime) {
      this.windows.set(key, { count: 1, resetAt: currentTime + QUOTA_WINDOW_MS });
      this.prune(currentTime);

      return true;
    }

    window.count += 1;

    if (window.count <= EXECUTIONS_PER_MINUTE) {
      return true;
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((window.resetAt - currentTime) / 1000),
    );

    http.getResponse<Response>().setHeader("Retry-After", String(retryAfterSeconds));
    throw new HttpException(
      { message: QUOTA_MESSAGE, retryAfterSeconds },
      HttpStatus.TOO_MANY_REQUESTS,
    );
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

/** `GET /api/sandbox/status`: estado del adaptador para diagnóstico. */
export interface SandboxStatusResponse extends SandboxStatus {
  readonly status: "ok";
}

/**
 * Laboratorio (`contratos-api.md` §4.6). Exige sesión y limita las ejecuciones
 * por usuario; el controlador no ejecuta código: delega en el puerto
 * `SandboxService`, así que cambiar de adaptador no lo toca.
 */
@ApiTags("sandbox")
@Controller("sandbox")
@UseGuards(JwtAuthGuard)
export class SandboxController {
  constructor(
    @Inject(SANDBOX_SERVICE) private readonly sandbox: SandboxService,
  ) {}

  @Post("run")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SandboxQuotaGuard)
  async run(
    @Body(new ZodValidationPipe(sandboxRunRequestSchema)) body: SandboxRunRequest,
  ): Promise<SandboxRunEnvelope> {
    return { run: await this.sandbox.run(body) };
  }

  @Get("status")
  status(): SandboxStatusResponse {
    return { status: "ok", ...this.sandbox.status() };
  }
}
