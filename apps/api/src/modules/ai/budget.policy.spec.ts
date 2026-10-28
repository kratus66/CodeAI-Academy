import { describe, expect, it } from "vitest";

import {
  monthLabelUtc,
  percentUsed,
  remainingUsd,
  resolveBudgetPolicy,
  startOfMonthUtc,
} from "./budget.policy";

describe("resolveBudgetPolicy", () => {
  it.each([
    [0, "normal"],
    [3.49, "normal"],
    [3.5, "economy"],
    [4.49, "economy"],
    [4.5, "tutor_only"],
    [4.99, "tutor_only"],
    [5, "disabled"],
    [12, "disabled"],
  ])("gasto %s de 5 USD → %s", (spent, level) => {
    expect(resolveBudgetPolicy(spent, 5)).toBe(level);
  });
});

describe("remainingUsd y percentUsed", () => {
  it("redondean a dos decimales", () => {
    expect(remainingUsd(3.62, 5)).toBe(1.38);
    expect(percentUsed(3.62, 5)).toBe(72.4);
  });

  it("el saldo nunca es negativo", () => {
    expect(remainingUsd(7, 5)).toBe(0);
    expect(percentUsed(7, 5)).toBe(140);
  });
});

describe("mes UTC", () => {
  it("calcula inicio y etiqueta sin depender de la zona horaria local", () => {
    const now = new Date("2026-10-31T23:59:59.000Z");

    expect(startOfMonthUtc(now).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(monthLabelUtc(now)).toBe("2026-10");
    expect(monthLabelUtc(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01");
  });
});
