import { describe, expect, it } from "vitest";

import { loadEnv, loadEnvFile } from "./env";

describe("loadEnv", () => {
  it("aplica valores por defecto en desarrollo", () => {
    const env = loadEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3001);
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
    expect(env.APP_VERSION).toBe("0.1.0");
  });

  it("convierte PORT a número", () => {
    const env = loadEnv({ PORT: "3002" });

    expect(env.PORT).toBe(3002);
  });

  it("falla si PORT no es un número válido", () => {
    expect(() => loadEnv({ PORT: "no-es-un-puerto" })).toThrow(
      /Variables de entorno inválidas/,
    );
  });

  it("falla si WEB_ORIGIN no es una URL absoluta http(s)", () => {
    expect(() => loadEnv({ WEB_ORIGIN: "localhost:3000" })).toThrow(
      /WEB_ORIGIN/,
    );
    expect(() => loadEnv({ WEB_ORIGIN: "ftp://codeai.dev" })).toThrow(
      /http:\/\/ o https:\/\//,
    );
  });

  it("aplica los valores por defecto de persistencia y sesión", () => {
    const env = loadEnv({});

    expect(env.DATABASE_URL).toContain("localhost:5433");
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it("rechaza una URL de base de datos que no sea PostgreSQL", () => {
    expect(() =>
      loadEnv({ DATABASE_URL: "mysql://codeai:codeai@localhost:3306/codeai" }),
    ).toThrow(/PostgreSQL/);
  });

  it("rechaza un JWT_SECRET corto", () => {
    expect(() => loadEnv({ JWT_SECRET: "corto" })).toThrow(/JWT_SECRET/);
  });

  it("exige un JWT_SECRET propio en producción", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        JWT_SECRET: "dev-only-secret-change-me-please-32-chars",
      }),
    ).toThrow(/producción/);

    const env = loadEnv({
      NODE_ENV: "production",
      JWT_SECRET: "produccion-secreto-de-32-caracteres-o-mas",
    });

    expect(env.NODE_ENV).toBe("production");
  });

  it("no falla si el archivo .env no existe", () => {
    expect(() => loadEnvFile(["./no-existe.env"])).not.toThrow();
  });
});
