import { describe, expect, it } from "vitest";

import { formatMinutes } from "./format";

describe("formatMinutes", () => {
  it("no inventa una duración cuando la API no la declara", () => {
    expect(formatMinutes(null)).toBeNull();
  });

  it("usa minutos por debajo de una hora", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(59)).toBe("59 min");
  });

  it("usa horas exactas sin arrastrar minutos", () => {
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(900)).toBe("15 h");
    expect(formatMinutes(1500)).toBe("25 h");
  });

  it("combina horas y minutos", () => {
    expect(formatMinutes(90)).toBe("1 h 30 min");
    expect(formatMinutes(725)).toBe("12 h 5 min");
  });
});
