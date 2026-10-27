import { HttpException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { RateLimit } from "./rate-limit.decorator";
import { RateLimitGuard } from "./rate-limit.guard";

function createContext(
  request: {
    ip?: string;
    body?: Record<string, unknown>;
    user?: { sub?: string };
  },
  handler: () => void,
): { context: ExecutionContext; headers: Record<string, string> } {
  const headers: Record<string, string> = {};

  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
      }),
    }),
  } as unknown as ExecutionContext;

  return { context, headers };
}

class LoginProbe {
  @RateLimit({ limit: 2, windowMs: 60_000, keyFromBody: "email" })
  login(): void {}

  @RateLimit({ limit: 2, windowMs: 60_000 })
  register(): void {}

  @RateLimit({ limit: 2, windowMs: 60_000, keyFromUser: true })
  hint(): void {}

  free(): void {}
}

/** Guard con reloj controlado para probar el reinicio de ventana. */
class ClockedRateLimitGuard extends RateLimitGuard {
  constructor(private readonly clock: () => number) {
    super();
  }

  protected override now(): number {
    return this.clock();
  }
}

describe("RateLimitGuard", () => {
  it("no limita rutas sin decorador", () => {
    const guard = new RateLimitGuard();
    const { context } = createContext({ ip: "1.1.1.1" }, () => undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it("permite hasta el límite y luego responde 429 con Retry-After", () => {
    const guard = new RateLimitGuard();
    const handler = LoginProbe.prototype.login;
    const request = { ip: "1.1.1.1", body: { email: "Ana@Example.com" } };

    const first = createContext(request, handler);
    const second = createContext(request, handler);
    const third = createContext(request, handler);

    expect(guard.canActivate(first.context)).toBe(true);
    expect(guard.canActivate(second.context)).toBe(true);

    expect(() => guard.canActivate(third.context)).toThrow(HttpException);
    expect(third.headers["Retry-After"]).toBe("60");
  });

  it("cuenta por email además de por IP", () => {
    const guard = new RateLimitGuard();
    const handler = LoginProbe.prototype.login;

    expect(
      guard.canActivate(
        createContext(
          { ip: "1.1.1.1", body: { email: "ana@example.com" } },
          handler,
        ).context,
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(
          { ip: "1.1.1.1", body: { email: "ana@example.com" } },
          handler,
        ).context,
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(
          { ip: "1.1.1.1", body: { email: "otra@example.com" } },
          handler,
        ).context,
      ),
    ).toBe(true);
  });

  it("separa el límite por IP", () => {
    const guard = new RateLimitGuard();
    const handler = LoginProbe.prototype.register;

    expect(
      guard.canActivate(createContext({ ip: "1.1.1.1" }, handler).context),
    ).toBe(true);
    expect(
      guard.canActivate(createContext({ ip: "2.2.2.2" }, handler).context),
    ).toBe(true);
  });

  it("limita por usuario aunque la IP sea la misma", () => {
    const guard = new RateLimitGuard();
    const handler = LoginProbe.prototype.hint;
    const request = { ip: "1.1.1.1", user: { sub: "user-a" } };

    const third = createContext(request, handler);

    expect(guard.canActivate(createContext(request, handler).context)).toBe(
      true,
    );
    expect(guard.canActivate(createContext(request, handler).context)).toBe(
      true,
    );
    expect(() => guard.canActivate(third.context)).toThrow(HttpException);
    expect(third.headers["Retry-After"]).toBe("60");
  });

  it("da ventanas independientes a usuarios distintos desde la misma IP", () => {
    const guard = new RateLimitGuard();
    const handler = LoginProbe.prototype.hint;
    const userA = { ip: "1.1.1.1", user: { sub: "user-a" } };
    const userB = { ip: "1.1.1.1", user: { sub: "user-b" } };

    guard.canActivate(createContext(userA, handler).context);
    guard.canActivate(createContext(userA, handler).context);
    expect(() =>
      guard.canActivate(createContext(userA, handler).context),
    ).toThrow(HttpException);

    expect(guard.canActivate(createContext(userB, handler).context)).toBe(
      true,
    );
    expect(guard.canActivate(createContext(userB, handler).context)).toBe(
      true,
    );
  });

  it("cae a la IP cuando la petición no trae usuario", () => {
    const guard = new RateLimitGuard();
    const handler = LoginProbe.prototype.hint;

    expect(
      guard.canActivate(createContext({ ip: "1.1.1.1" }, handler).context),
    ).toBe(true);
    expect(
      guard.canActivate(createContext({ ip: "1.1.1.1" }, handler).context),
    ).toBe(true);
    expect(() =>
      guard.canActivate(createContext({ ip: "1.1.1.1" }, handler).context),
    ).toThrow(HttpException);
  });

  it("reinicia la ventana al expirar", () => {
    let now = 0;
    const guard = new ClockedRateLimitGuard(() => now);
    const handler = LoginProbe.prototype.register;

    expect(
      guard.canActivate(createContext({ ip: "1.1.1.1" }, handler).context),
    ).toBe(true);
    expect(
      guard.canActivate(createContext({ ip: "1.1.1.1" }, handler).context),
    ).toBe(true);
    expect(() =>
      guard.canActivate(createContext({ ip: "1.1.1.1" }, handler).context),
    ).toThrow(HttpException);

    now = 60_000;

    expect(
      guard.canActivate(createContext({ ip: "1.1.1.1" }, handler).context),
    ).toBe(true);
  });
});
