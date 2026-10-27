import { describe, expect, it } from "vitest";

import { checkAttemptLimit } from "./submit-limits";

describe("checkAttemptLimit", () => {
  it("permite el primer intento sin envíos previos", () => {
    expect(checkAttemptLimit({ attemptsUsed: 0, maxAttempts: 3 })).toEqual({
      allowed: true,
      attemptNumber: 1,
    });
  });

  it("permite el último intento disponible", () => {
    expect(checkAttemptLimit({ attemptsUsed: 2, maxAttempts: 3 })).toEqual({
      allowed: true,
      attemptNumber: 3,
    });
  });

  it("bloquea al agotar el límite", () => {
    expect(checkAttemptLimit({ attemptsUsed: 3, maxAttempts: 3 })).toEqual({
      allowed: false,
      attemptNumber: 4,
      maxAttempts: 3,
    });
  });

  it("no se recupera si ya se superó el límite", () => {
    expect(checkAttemptLimit({ attemptsUsed: 5, maxAttempts: 3 })).toEqual({
      allowed: false,
      attemptNumber: 6,
      maxAttempts: 3,
    });
  });

  it("null significa sin límite", () => {
    expect(checkAttemptLimit({ attemptsUsed: 99, maxAttempts: null })).toEqual({
      allowed: true,
      attemptNumber: 100,
    });
  });

  it.each([0, -1])("maxAttempts %i se trata como sin límite", (maxAttempts) => {
    expect(checkAttemptLimit({ attemptsUsed: 10, maxAttempts }).allowed).toBe(true);
  });

  it("un attemptsUsed negativo cuenta como 0", () => {
    expect(checkAttemptLimit({ attemptsUsed: -2, maxAttempts: 3 })).toEqual({
      allowed: true,
      attemptNumber: 1,
    });
  });

  it("es pura: mismo resultado y sin mutar la entrada", () => {
    const input = { attemptsUsed: 3, maxAttempts: 3 };
    const copy = { ...input };

    expect(checkAttemptLimit(input)).toEqual(checkAttemptLimit(input));
    expect(input).toEqual(copy);
  });
});
