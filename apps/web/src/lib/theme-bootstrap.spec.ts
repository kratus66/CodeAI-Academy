import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  THEME_BOOTSTRAP,
  THEME_COLORS,
  THEME_STORAGE_KEY,
} from "./theme-bootstrap";

/**
 * Ejecuta el script exactamente como lo ejecuta el navegador: es una cadena
 * opaca, así que la única prueba honesta es correrla contra el DOM real.
 */
function runBootstrap(): void {
  new Function(THEME_BOOTSTRAP)();
}

function stubSystemTheme(light: boolean): void {
  vi.stubGlobal("matchMedia", ((query: string) => ({
    matches: light,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia);
}

function themeColor(): string | null {
  return (
    document
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute("content") ?? null
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.querySelector('meta[name="theme-color"]')?.remove();
  stubSystemTheme(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("THEME_BOOTSTRAP", () => {
  it("respeta el tema del sistema cuando no hay elección guardada", () => {
    stubSystemTheme(true);

    runBootstrap();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(themeColor()).toBe(THEME_COLORS.light);
  });

  it("deja el tema oscuro si el sistema no pide claro", () => {
    runBootstrap();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(themeColor()).toBe(THEME_COLORS.dark);
  });

  it("la elección guardada manda sobre el sistema", () => {
    stubSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    runBootstrap();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(themeColor()).toBe(THEME_COLORS.dark);
  });

  it("reutiliza la meta `theme-color` que ya pintó el servidor", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", THEME_COLORS.dark);
    document.head.append(meta);
    stubSystemTheme(true);

    runBootstrap();

    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(
      1,
    );
    expect(themeColor()).toBe(THEME_COLORS.light);
  });

  it("sigue resolviendo el tema si el almacenamiento está bloqueado", () => {
    stubSystemTheme(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });

    expect(runBootstrap).not.toThrow();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
