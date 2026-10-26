import { BadRequestException, Injectable } from "@nestjs/common";
import type { PipeTransform } from "@nestjs/common";
import type { ZodError, ZodSchema } from "zod";

export interface ZodValidationOptions {
  /**
   * Rechaza claves no declaradas en el esquema (equivalente a
   * `forbidNonWhitelisted` de `ValidationPipe`). Activo por defecto.
   */
  rejectUnknownKeys?: boolean;
}

/** Convierte los `issues` de Zod en `details` del envelope de error. */
export function toErrorDetails(error: ZodError): {
  field: string;
  message: string;
}[] {
  return error.issues.flatMap((issue) => {
    // `unrecognized_keys` no trae `path`: la clave culpable está en `keys`.
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({
        field: key,
        message: `La clave "${key}" no está permitida`,
      }));
    }

    return [
      {
        field: issue.path.join(".") || "body",
        message: issue.message,
      },
    ];
  });
}

/**
 * `ZodObject.strict()` pierde el tipo de salida en Zod 3 (los genéricos se
 * ensanchan a `any`), así que se restaura el tipo del esquema original.
 *
 * No se usa `instanceof ZodObject` a propósito: `@codeai/shared` puede resolver
 * su propia copia de Zod y entonces la clase no coincide aunque el esquema sí
 * sea un objeto. La comprobación por comportamiento (`strict`) es estable.
 */
function rejectUnknownKeysOf<T>(schema: ZodSchema<T>): ZodSchema<T> {
  const candidate = schema as ZodSchema<T> & { strict?: () => ZodSchema<T> };

  if (typeof candidate.strict !== "function") {
    return schema;
  }

  return candidate.strict();
}

/**
 * Valida el cuerpo con un esquema Zod de `@codeai/shared`, de modo que las
 * reglas del contrato viven en un único lugar y no se duplican en DTOs.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  private readonly schema: ZodSchema<T>;

  constructor(
    schema: ZodSchema<T>,
    private readonly options: ZodValidationOptions = {},
  ) {
    const rejectUnknownKeys = options.rejectUnknownKeys ?? true;
    this.schema = rejectUnknownKeys ? rejectUnknownKeysOf(schema) : schema;
  }

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({ message: toErrorDetails(result.error) });
    }

    return result.data;
  }
}
