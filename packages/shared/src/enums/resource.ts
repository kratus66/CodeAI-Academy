/** Tipos de recurso externo del catálogo (ver catalogo-recursos.md). */
export const RESOURCE_TYPES = [
  "DOCUMENTATION",
  "VIDEO",
  "COURSE",
  "INTERACTIVE",
  "REPOSITORY",
  "DIAGRAM",
  "ANIMATION",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

/**
 * Estado de curaduría de un recurso. Solo `VERIFIED` se sirve en la API: un
 * enlace roto o pendiente de revisión no llega al estudiante.
 */
export const RESOURCE_STATUSES = ["VERIFIED", "NEEDS_REVIEW", "OBSOLETE"] as const;

export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];
