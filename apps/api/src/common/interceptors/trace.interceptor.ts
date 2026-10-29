import type { Env, LogLevel } from "../../config/env";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import { ENV } from "../../config/env.module";
import type { Observable } from "rxjs";
import { catchError, finalize, throwError } from "rxjs";

import type { RequestWithTrace } from "../http/request-with-trace";

/** Umbral general de petición lenta (`T11`). */
export const SLOW_REQUEST_MS = 500;

/** Umbral para rutas que esperan a la IA: una llamada normal ya tarda. */
export const SLOW_AI_REQUEST_MS = 1_500;

/** Prefijos de los controladores que hablan con el proveedor de IA. */
const AI_ROUTE_PREFIXES = ["/ai", "/interviews"] as const;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const UUID_PATTERN =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CUID_PATTERN = /\/c[a-z0-9]{20,}/gi;
const NUMERIC_PATTERN = /\/\d+/g;

interface ResponseLike {
  statusCode: number;
}

/**
 * Convierte la traza de S1 en una línea de log por petición (`T11`):
 * `método ruta-normalizada estado durationMs traceId`.
 *
 * No toca el cuerpo ni las cabeceras del cliente, así que ninguna línea puede
 * contener un correo o el contenido de un envío. La ruta se toma de la plantilla
 * de Express (`/content/units/:code`); si no está disponible se normaliza la URL
 * sustituyendo identificadores por `:id`.
 *
 * `LOG_LEVEL` decide el mínimo registrado: con `warn` no se escriben las líneas
 * informativas, pero un `SLOW_REQUEST` (warn) siempre aparece.
 */
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  constructor(@Inject(ENV) private readonly env: Env) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithTrace>();
    const response = http.getResponse<ResponseLike>();
    const startedAt = Date.now();
    let statusCode = response.statusCode;
    let failed = false;

    return next.handle().pipe(
      catchError((error: unknown) => {
        failed = true;
        statusCode = error instanceof HttpException ? error.getStatus() : 500;

        return throwError(() => error);
      }),
      finalize(() => {
        const durationMs = Math.max(0, Date.now() - startedAt);
        this.write(request, statusCode, durationMs, failed);
      }),
    );
  }

  private write(
    request: RequestWithTrace,
    statusCode: number,
    durationMs: number,
    failed: boolean,
  ): void {
    const route = normalizedRoute(request);
    const threshold = isAiRoute(route) ? SLOW_AI_REQUEST_MS : SLOW_REQUEST_MS;
    const slow = !failed && durationMs > threshold;
    const line =
      `${request.method} ${route} ${statusCode} durationMs=${durationMs}` +
      ` traceId=${request.traceId ?? "sin-traza"}`;

    if (slow) {
      this.logger.warn(`SLOW_REQUEST ${line}`);
      return;
    }

    if (failed) {
      this.logger.error(`REQUEST_FAILED ${line}`);
      return;
    }

    if (this.enabled("info")) {
      this.logger.log(line);
    }
  }

  private enabled(level: LogLevel): boolean {
    return LEVEL_ORDER[this.env.LOG_LEVEL] <= LEVEL_ORDER[level];
  }
}

function isAiRoute(route: string): boolean {
  return AI_ROUTE_PREFIXES.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`),
  );
}

/**
 * La plantilla del router no contiene valores concretos. El respaldo cubre el
 * caso de una ruta no registrada (404) sin dejar ids en el log.
 */
function normalizedRoute(request: RequestWithTrace): string {
  const template = request.route?.path;

  if (typeof template === "string" && template.length > 0) {
    return template;
  }

  const raw = (request.originalUrl ?? request.path ?? "/").split("?")[0] ?? "/";

  return raw
    .replace(UUID_PATTERN, "/:id")
    .replace(CUID_PATTERN, "/:id")
    .replace(NUMERIC_PATTERN, "/:id");
}
