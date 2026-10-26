import { ApiError } from "@/lib/api-client";

export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export interface FormErrorState {
  readonly formError: string | null;
  readonly fieldErrors: Readonly<Record<string, string>>;
}

const NETWORK_MESSAGE =
  "No se pudo conectar con el servidor. Inténtalo de nuevo.";

/** Traduce los `issues` de Zod a mensajes por campo (primer error por campo). */
export function fieldErrorsFromIssues(
  issues: readonly ValidationIssue[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

/** Quita el error de un campo cuando la persona vuelve a escribir en él. */
export function withoutField(
  errors: Record<string, string>,
  field: string,
): Record<string, string> {
  if (!errors[field]) {
    return errors;
  }

  const next = { ...errors };

  delete next[field];

  return next;
}

/**
 * Mensaje para la persona según el envelope de error de la API. Los `details`
 * con `field` se muestran junto al input correspondiente.
 */
export function describeSubmitError(error: unknown): FormErrorState {
  if (!(error instanceof ApiError)) {
    return { formError: NETWORK_MESSAGE, fieldErrors: {} };
  }

  if (error.status === 409) {
    return {
      formError: "Ese correo ya está registrado. Inicia sesión en su lugar.",
      fieldErrors: {},
    };
  }

  if (error.status === 401) {
    return {
      formError: "El correo o la contraseña no son correctos.",
      fieldErrors: {},
    };
  }

  if (error.status === 429) {
    return {
      formError: rateLimitMessage(error.retryAfterSeconds),
      fieldErrors: {},
    };
  }

  return { formError: error.message, fieldErrors: error.fieldErrors() };
}

function rateLimitMessage(seconds: number | undefined): string {
  if (!seconds) {
    return "Demasiados intentos. Espera antes de volver a probar.";
  }

  return seconds < 60
    ? `Demasiados intentos. Vuelve a probar en ${seconds} s.`
    : `Demasiados intentos. Vuelve a probar en ${Math.ceil(seconds / 60)} min.`;
}
