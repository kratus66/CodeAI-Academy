import { z } from "zod";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import { ROLES } from "../enums/role";
import { nameSchema, userPublicSchema } from "./auth";
import { paginatedSchema } from "./common";

/** Longitud máxima de `avatarUrl`; coincide con la columna `User.avatarUrl`. */
export const AVATAR_URL_MAX_LENGTH = 2048;

/**
 * Avatar del perfil. Se acepta `null` para borrarlo: un `PATCH` que manda
 * `null` deja la columna vacía, mientras que omitir la clave la conserva.
 *
 * Solo se admiten `http`/`https`: un `data:` o un `javascript:` acabarían en un
 * `<img src>` y `z.string().url()` por sí solo los aceptaría.
 */
export const avatarUrlSchema = z
  .string()
  .trim()
  .url("El avatar debe ser una URL válida")
  .max(
    AVATAR_URL_MAX_LENGTH,
    `La URL del avatar no puede superar ${AVATAR_URL_MAX_LENGTH} caracteres`,
  )
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "El avatar debe apuntar a http o https",
  )
  .nullable();

/**
 * Idioma de la interfaz. `User.locale` es texto libre en la base, así que se
 * acepta una etiqueta BCP 47 corta (`es`, `es-ES`, `en`) en lugar de enumerar
 * idiomas que la web todavía no traduce.
 */
export const localeSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
    'Usa un código de idioma como "es" o "es-ES"',
  )
  .max(15, "Máximo 15 caracteres");

/**
 * Perfil del usuario autenticado (`GET /api/users/me`). Amplía `UserPublic`
 * con las preferencias que la sesión no necesita: el `AuthController` sigue
 * devolviendo `UserPublic` y así el contrato de S1 no cambia.
 */
export const userProfileSchema = userPublicSchema.extend({
  avatarUrl: avatarUrlSchema,
  locale: localeSchema,
});

export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * `PATCH /api/users/me`. Todos los campos son opcionales, pero el cuerpo vacío
 * se rechaza: un `PATCH` sin cambios es casi siempre un error del cliente.
 */
export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    avatarUrl: avatarUrlSchema.optional(),
    locale: localeSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Envía al menos un campo para actualizar",
    path: [],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Respuesta de `GET` y `PATCH /api/users/me`. */
export const userProfileResponseSchema = z.object({
  user: userProfileSchema,
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;

/**
 * `GET /api/users?role&search&page&pageSize` — listado de administración.
 * `search` filtra por nombre o correo y exige dos caracteres para no recorrer
 * la tabla entera con una sola letra.
 */
export const userListQuerySchema = z
  .object({
    role: z
      .enum(ROLES, {
        errorMap: () => ({
          message: `El rol debe ser uno de: ${ROLES.join(", ")}`,
        }),
      })
      .optional(),
    search: z
      .string()
      .trim()
      .min(2, "Busca al menos 2 caracteres")
      .max(80, "Máximo 80 caracteres")
      .optional(),
    page: z.coerce
      .number({ invalid_type_error: "La página debe ser un número entero" })
      .int("La página debe ser un número entero")
      .min(1, "La página debe ser 1 o mayor")
      .default(1),
    pageSize: z.coerce
      .number({ invalid_type_error: "El tamaño de página debe ser un número entero" })
      .int("El tamaño de página debe ser un número entero")
      .min(1, "El tamaño de página debe ser 1 o mayor")
      .max(PAGE_SIZE_MAX, `El tamaño de página no puede superar ${PAGE_SIZE_MAX}`)
      .default(PAGE_SIZE_DEFAULT),
  })
  .strict();

export type UserListQuery = z.infer<typeof userListQuerySchema>;

/** Respuesta de `GET /api/users`: mismo sobre `{ data, meta }` que el resto. */
export const userListResponseSchema = paginatedSchema(userProfileSchema);

export type UserListResponse = z.infer<typeof userListResponseSchema>;
