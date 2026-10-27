import { z } from "zod";

/**
 * `z.string().url()` acepta valores como `localhost:3000` porque `new URL()` los
 * interpreta con esquema `localhost:`. El origen del frontend debe ser http(s).
 */
const httpOrigin = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    { message: "debe usar http:// o https://" },
  );

/**
 * Secreto de desarrollo. Nunca se usa en producción: `loadEnv` lo rechaza
 * cuando `NODE_ENV=production`.
 */
const DEV_JWT_SECRET = "dev-only-secret-change-me-please-32-chars";

/** La base siempre es PostgreSQL; el esquema Prisma no admite otra cosa. */
const postgresUrl = z
  .string()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    { message: "debe ser una URL de PostgreSQL (postgresql://…)" },
  );

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    WEB_ORIGIN: httpOrigin.default("http://localhost:3000"),
    APP_VERSION: z.string().min(1).default("0.1.0"),

    // Persistencia (S1). El puerto 5433 evita choques con otras bases locales.
    DATABASE_URL: postgresUrl.default(
      "postgresql://codeai:codeai@localhost:5433/codeai?schema=public",
    ),

    // Sesión (S1).
    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET debe tener al menos 32 caracteres")
      .default(DEV_JWT_SECRET),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),

    // Sandbox (S5). Debe coincidir con `SANDBOX_MODES` del puerto
    // `modules/sandbox/sandbox.service.ts`. `sandbox-ejecucion.md` §3: en
    // producción sólo se acepta el adaptador aislado.
    SANDBOX_MODE: z.enum(["mock", "subprocess", "docker"]).default("mock"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.JWT_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "obligatorio en producción: define un secreto propio",
      });
    }

    if (env.NODE_ENV === "production" && env.SANDBOX_MODE !== "docker") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SANDBOX_MODE"],
        message: "en producción sólo se acepta SANDBOX_MODE=docker",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Carga `.env` con la API nativa de Node (20.12+), sin dependencias. Se prueban
 * varias rutas porque el proceso puede arrancar desde la raíz o desde `apps/api`.
 * Si ningún archivo existe, los valores por defecto cubren el desarrollo local.
 */
export function loadEnvFile(
  paths: readonly string[] = [".env", "apps/api/.env"],
): void {
  for (const path of paths) {
    try {
      process.loadEnvFile(path);
      return;
    } catch {
      // Siguiente candidato: la ausencia de `.env` no es un error.
    }
  }
}

/**
 * Valida las variables de entorno al arrancar. Si algo es inválido, el proceso
 * falla de inmediato en lugar de arrastrar una configuración rota.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Variables de entorno inválidas → ${details}`);
  }

  return result.data;
}
