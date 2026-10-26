import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";

import type { RequestWithTrace } from "../http/request-with-trace";

export const TRACE_HEADER = "x-trace-id";
const MAX_TRACE_ID_LENGTH = 128;

/**
 * Asigna un `traceId` a cada petición y lo devuelve en la cabecera `x-trace-id`.
 * El filtro global de errores lo reutiliza para que cualquier fallo sea auditable.
 */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(request: RequestWithTrace, response: Response, next: NextFunction): void {
    const incoming = request.headers[TRACE_HEADER];
    const traceId =
      typeof incoming === "string" &&
      incoming.length > 0 &&
      incoming.length <= MAX_TRACE_ID_LENGTH
        ? incoming
        : randomUUID();

    request.traceId = traceId;
    response.setHeader(TRACE_HEADER, traceId);
    next();
  }
}
