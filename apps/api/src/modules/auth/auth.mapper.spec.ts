import { userPublicSchema } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import type { UserRecord } from "./auth.repository";
import { toUserPublic } from "./auth.mapper";

const user: UserRecord = {
  id: "usr_1",
  email: "ana@example.com",
  passwordHash: "$2b$12$hash-secreto",
  name: "Ana",
  role: "STUDENT",
  avatarUrl: null,
  locale: "es",
  isActive: true,
  createdAt: new Date("2026-10-26T14:30:00.000Z"),
  lastLoginAt: new Date("2026-10-26T15:00:00.000Z"),
};

describe("toUserPublic", () => {
  it("devuelve exactamente el contrato público de usuario", () => {
    const publicUser = toUserPublic(user);

    expect(userPublicSchema.parse(publicUser)).toEqual(publicUser);
    expect(publicUser).toEqual({
      id: "usr_1",
      email: "ana@example.com",
      name: "Ana",
      role: "STUDENT",
      createdAt: "2026-10-26T14:30:00.000Z",
    });
  });

  it("nunca expone el hash ni campos internos", () => {
    const serialized = JSON.stringify(toUserPublic(user));

    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("hash-secreto");
    expect(serialized).not.toContain("lastLoginAt");
    expect(serialized).not.toContain("isActive");
  });
});
