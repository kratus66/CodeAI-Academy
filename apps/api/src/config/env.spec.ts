import { describe, expect, it } from "vitest";

import { loadEnv, loadEnvFile } from "./env";

describe("loadEnv", () => {
  it("aplica valores por defecto en desarrollo", () => {
    const env = loadEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3001);
    expect(env.WEB_ORIGIN).toEqual(["http://localhost:3000"]);
    expect(env.APP_VERSION).toBe("0.1.0");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("acepta un nivel de log explícito y rechaza uno desconocido", () => {
    expect(loadEnv({ LOG_LEVEL: "warn" }).LOG_LEVEL).toBe("warn");
    expect(() => loadEnv({ LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/);
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

  it("acepta varios orígenes para CORS separados por comas", () => {
    const env = loadEnv({
      WEB_ORIGIN: "http://localhost:3000, http://localhost:3002 ,",
    });

    expect(env.WEB_ORIGIN).toEqual([
      "http://localhost:3000",
      "http://localhost:3002",
    ]);
  });

  it("falla si WEB_ORIGIN no es una URL absoluta http(s)", () => {
    expect(() => loadEnv({ WEB_ORIGIN: "localhost:3000" })).toThrow(
      /WEB_ORIGIN/,
    );
    expect(() => loadEnv({ WEB_ORIGIN: "ftp://codeai.dev" })).toThrow(
      /http:\/\/ o https:\/\//,
    );
    expect(() =>
      loadEnv({ WEB_ORIGIN: "http://localhost:3000,javascript:alert(1)" }),
    ).toThrow(/http:\/\/ o https:\/\//);
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
        SANDBOX_MODE: "docker",
      }),
    ).toThrow(/producción/);

    const env = loadEnv({
      NODE_ENV: "production",
      JWT_SECRET: "produccion-secreto-de-32-caracteres-o-mas",
      SANDBOX_MODE: "docker",
      AI_PROVIDER: "openai",
      AI_API_KEY: "sk-test",
    });

    expect(env.NODE_ENV).toBe("production");
  });

  it("en producción sólo acepta el sandbox docker", () => {
    const production = {
      NODE_ENV: "production",
      JWT_SECRET: "produccion-secreto-de-32-caracteres-o-mas",
    } as const;

    expect(() => loadEnv({ ...production, SANDBOX_MODE: "subprocess" })).toThrow(
      /SANDBOX_MODE/,
    );
    expect(() => loadEnv(production)).toThrow(/SANDBOX_MODE/);
    expect(
      loadEnv({ ...production, SANDBOX_MODE: "docker", AI_PROVIDER: "openai", AI_API_KEY: "sk-test" })
        .SANDBOX_MODE,
    ).toBe("docker");
  });

  describe("capa de IA", () => {
    const production = {
      NODE_ENV: "production",
      JWT_SECRET: "produccion-secreto-de-32-caracteres-o-mas",
      SANDBOX_MODE: "docker",
    } as const;

    it("arranca con mock y valores por defecto", () => {
      const env = loadEnv({});

      expect(env.AI_PROVIDER).toBe("mock");
      expect(env.AI_MONTHLY_BUDGET_USD).toBe(5);
      expect(env.AI_TIMEOUT_MS).toBe(15_000);
      expect(env.AI_API_KEY).toBeUndefined();
    });

    it("en producción rechaza mock indicando AI_PROVIDER", () => {
      expect(() => loadEnv({ ...production, AI_PROVIDER: "mock" })).toThrow(/AI_PROVIDER/);
      expect(() => loadEnv(production)).toThrow(/AI_PROVIDER/);
    });

    it("con openai exige AI_API_KEY", () => {
      expect(() => loadEnv({ AI_PROVIDER: "openai" })).toThrow(/AI_API_KEY/);
      expect(() => loadEnv({ AI_PROVIDER: "openai", AI_API_KEY: "  " })).toThrow(/AI_API_KEY/);
      expect(loadEnv({ AI_PROVIDER: "openai", AI_API_KEY: "sk-test" }).AI_API_KEY).toBe("sk-test");
    });

    it("AI_API_KEY vacía con mock no falla", () => {
      expect(loadEnv({ AI_PROVIDER: "mock", AI_API_KEY: "" }).AI_API_KEY).toBeUndefined();
    });

    it("rechaza proveedor desconocido y presupuesto no positivo", () => {
      expect(() => loadEnv({ AI_PROVIDER: "anthropic" })).toThrow(/AI_PROVIDER/);
      expect(() => loadEnv({ AI_MONTHLY_BUDGET_USD: "0" })).toThrow(/AI_MONTHLY_BUDGET_USD/);
    });
  });

  it("fuera de producción acepta mock y subprocess", () => {
    expect(loadEnv({ SANDBOX_MODE: "mock" }).SANDBOX_MODE).toBe("mock");
    expect(loadEnv({ SANDBOX_MODE: "subprocess" }).SANDBOX_MODE).toBe("subprocess");
    expect(loadEnv({ NODE_ENV: "test", SANDBOX_MODE: "mock" }).SANDBOX_MODE).toBe("mock");
  });

  it("usa el sandbox mock por defecto y rechaza modos desconocidos", () => {
    expect(loadEnv({}).SANDBOX_MODE).toBe("mock");
    expect(() => loadEnv({ SANDBOX_MODE: "firecracker" })).toThrow(/SANDBOX_MODE/);
  });

  it("no falla si el archivo .env no existe", () => {
    expect(() => loadEnvFile(["./no-existe.env"])).not.toThrow();
  });
});
