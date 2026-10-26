import { z } from "zod";

import { ERROR_CODES } from "../constants/error-codes";
import { PAGE_SIZE_MAX } from "../constants/pagination";

/** Forma única de error de la API (contratos-api.md §2). */
export const errorDetailSchema = z.object({
  field: z.string().min(1).optional(),
  message: z.string().min(1),
});

export const errorBodySchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string().min(1),
  details: z.array(errorDetailSchema).optional(),
  traceId: z.string().min(1),
});

export const errorResponseSchema = z.object({
  error: errorBodySchema,
});

export type ErrorDetail = z.infer<typeof errorDetailSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** Metadatos de paginación; todo listado devuelve `{ data, meta }`. */
export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(PAGE_SIZE_MAX),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Construye el esquema de un listado paginado para un tipo de elemento concreto. */
export function paginatedSchema<TItem extends z.ZodTypeAny>(itemSchema: TItem) {
  return z.object({
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

/** Respuesta de `GET /api/health` (Sprint 0). */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("codeai-api"),
  version: z.string().min(1),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
