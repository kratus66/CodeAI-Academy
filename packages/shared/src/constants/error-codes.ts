/**
 * Catálogo único de códigos de error de la API (ver contratos-api.md §2).
 * Ningún módulo puede inventar códigos fuera de esta lista.
 */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RULE_VIOLATION",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Código de error canónico para cada estado HTTP del contrato. */
export const ERROR_CODE_BY_HTTP_STATUS: Readonly<Record<number, ErrorCode>> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "RULE_VIOLATION",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  503: "SERVICE_UNAVAILABLE",
};

/** Mensajes por defecto en español, usados cuando la excepción no aporta uno. */
export const DEFAULT_ERROR_MESSAGE_BY_CODE: Readonly<Record<ErrorCode, string>> = {
  VALIDATION_ERROR: "Datos de entrada inválidos",
  UNAUTHENTICATED: "Debes iniciar sesión para continuar",
  FORBIDDEN: "No tienes permiso para realizar esta acción",
  NOT_FOUND: "El recurso solicitado no existe",
  CONFLICT: "La operación entra en conflicto con el estado actual",
  RULE_VIOLATION: "No se cumple una regla del programa",
  RATE_LIMITED: "Demasiadas solicitudes, intenta más tarde",
  INTERNAL_ERROR: "Error interno del servidor",
  SERVICE_UNAVAILABLE: "Un servicio necesario no está disponible",
};
