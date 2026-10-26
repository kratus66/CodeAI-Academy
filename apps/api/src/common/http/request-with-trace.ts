import type { Request } from "express";

/** Request de Express enriquecido con el identificador de traza de la petición. */
export interface RequestWithTrace extends Request {
  traceId?: string;
}
