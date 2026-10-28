import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import type { Role } from "@codeai/shared";

import { Roles } from "../decorators/roles.decorator";
import { RolesGuard } from "./roles.guard";

function createContext(
  handler: () => void,
  user?: { sub: string; role: Role },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Probe,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

class Probe {
  @Roles("ADMIN")
  adminOnly(): void {}

  @Roles("INSTRUCTOR", "ADMIN")
  staffOnly(): void {}

  open(): void {}

  @Roles("ADMIN")
  needsSession(): void {}
}

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector());

  it("deja pasar las rutas sin @Roles", () => {
    expect(guard.canActivate(createContext(Probe.prototype.open))).toBe(true);
  });

  it("permite el rol exigido", () => {
    expect(
      guard.canActivate(
        createContext(Probe.prototype.adminOnly, { sub: "u1", role: "ADMIN" }),
      ),
    ).toBe(true);
  });

  it("acepta cualquiera de los roles enumerados", () => {
    expect(
      guard.canActivate(
        createContext(Probe.prototype.staffOnly, {
          sub: "u2",
          role: "INSTRUCTOR",
        }),
      ),
    ).toBe(true);
  });

  it("responde 403 cuando el rol no alcanza", () => {
    expect(() =>
      guard.canActivate(
        createContext(Probe.prototype.adminOnly, { sub: "u3", role: "STUDENT" }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("responde 401 si la ruta con @Roles llega sin usuario", () => {
    expect(() =>
      guard.canActivate(createContext(Probe.prototype.needsSession)),
    ).toThrow(UnauthorizedException);
  });
});
