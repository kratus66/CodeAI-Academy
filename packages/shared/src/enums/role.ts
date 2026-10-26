/** Roles del sistema. Coincide con el enum `Role` del modelo de datos. */
export const ROLES = ["STUDENT", "INSTRUCTOR", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];
