import { z } from "zod";

import { ROLES } from "../enums/role";

export const emailSchema = z
  .string()
  .min(1, "El correo es obligatorio")
  .email("Debe ser un correo válido")
  .max(254, "Máximo 254 caracteres");

export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Za-z]/, "Debe incluir una letra")
  .regex(/[0-9]/, "Debe incluir un número");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres")
  .max(80, "Máximo 80 caracteres");

/** Alta de cuenta: `POST /api/auth/register`. */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Inicio de sesión: `POST /api/auth/login`. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Datos de usuario seguros para exponer al cliente (nunca incluye el hash). */
export const userPublicSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  createdAt: z.string().datetime(),
});

export type UserPublic = z.infer<typeof userPublicSchema>;

export const userResponseSchema = z.object({
  user: userPublicSchema,
});

export type UserResponse = z.infer<typeof userResponseSchema>;
