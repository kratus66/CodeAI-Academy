import { randomUUID } from "node:crypto";

import {
  DEFAULT_ERROR_MESSAGE_BY_CODE,
  ERROR_CODES,
  ERROR_CODE_BY_HTTP_STATUS,
  errorResponseSchema,
} from "@codeai/shared";
import type { ErrorBody, ErrorCode, ErrorDetail } from "@codeai/shared";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

import type { RequestWithTrace } from "../http/request-with-trace";

/**
 * Convierte toda excepción al formato único de error documentado en
 * `docs/03-arquitectura/contratos-api.md` §2. Ninguna ruta puede devolver
 * otra forma, y los errores inesperados nunca exponen stack ni detalles internos.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithTrace>();
    const response = http.getResponse<Response>();
    const traceId = request.traceId ?? randomUUID();
    const { status, body } = this.describe(exception, traceId);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${traceId}] ${
          exception instanceof Error
            ? exception.stack ?? exception.message
            : "Excepción no reconocida"
        }`,
      );
    }

    const payload = errorResponseSchema.parse({ error: body });

    response
      .status(status)
      .setHeader("x-trace-id", traceId)
      .json(payload);
  }

  private describe(
    exception: unknown,
    traceId: string,
  ): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionPayload = exception.getResponse();
      const details = this.extractDetails(exceptionPayload);

      return {
        status,
        body: {
          code: this.codeForPayload(exceptionPayload, status),
          message: this.extractMessage(exceptionPayload, status),
          ...(details ? { details } : {}),
          traceId,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: "INTERNAL_ERROR",
        message: DEFAULT_ERROR_MESSAGE_BY_CODE.INTERNAL_ERROR,
        traceId,
      },
    };
  }

  private codeForStatus(status: number): ErrorCode {
    return ERROR_CODE_BY_HTTP_STATUS[status] ?? "INTERNAL_ERROR";
  }

  /**
   * `contratos-api.md` §2 deriva el código del estado HTTP. Un módulo puede
   * precisar uno del catálogo para la misma familia (p. ej. `INVALID_RANGE` en
   * un `400`), pero nunca inventar códigos fuera de `ERROR_CODES`.
   */
  private codeForPayload(payload: unknown, status: number): ErrorCode {
    const fallback = this.codeForStatus(status);

    if (typeof payload !== "object" || payload === null) {
      return fallback;
    }

    const candidate = (payload as { code?: unknown }).code;

    return typeof candidate === "string" &&
      (ERROR_CODES as readonly string[]).includes(candidate)
      ? (candidate as ErrorCode)
      : fallback;
  }

  private extractDetails(payload: unknown): ErrorDetail[] | undefined {
    if (typeof payload !== "object" || payload === null) {
      return undefined;
    }

    // Un módulo puede publicar `details` ya estructurados (p. ej.
    // `INVALID_RANGE`): se prefieren antes que reinterpretar `message`.
    const explicit = (payload as { details?: unknown }).details;

    if (Array.isArray(explicit)) {
      const details = explicit.flatMap((entry) => this.toDetail(entry));

      if (details.length > 0) {
        return details;
      }
    }

    const message = (payload as { message?: unknown }).message;

    if (!Array.isArray(message)) {
      return undefined;
    }

    const details = message.flatMap((entry) => this.toDetail(entry));

    return details.length > 0 ? details : undefined;
  }

  /**
   * Acepta tanto mensajes sueltos (`class-validator`) como objetos
   * `{ field, message }` (nuestro `ZodValidationPipe`).
   */
  private toDetail(entry: unknown): ErrorDetail[] {
    if (typeof entry === "string" && entry.length > 0) {
      return [{ message: entry }];
    }

    if (typeof entry !== "object" || entry === null) {
      return [];
    }

    const { field, message } = entry as { field?: unknown; message?: unknown };

    if (typeof message !== "string" || message.length === 0) {
      return [];
    }

    return [
      {
        ...(typeof field === "string" && field.length > 0 ? { field } : {}),
        message,
      },
    ];
  }

  private extractMessage(payload: unknown, status: number): string {
    const fallback = DEFAULT_ERROR_MESSAGE_BY_CODE[this.codeForStatus(status)];

    if (typeof payload === "string" && payload.length > 0) {
      return payload;
    }

    if (typeof payload === "object" && payload !== null) {
      const message = (payload as { message?: unknown }).message;

      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }

    return fallback;
  }
}
