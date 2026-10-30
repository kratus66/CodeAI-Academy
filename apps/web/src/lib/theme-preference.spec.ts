import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "./theme-bootstrap";

type ThemeModule = typeof import("./theme-preference");

/**
 * El tema recordado vive a nivel de módulo, así que cada caso importa el
 * módulo de cero: sin esto, la primera lectura contaminaría las siguientes.
 */
async function loadTheme(): Promise<ThemeModule> {
  vi.resetModules();
  return import("./theme-preference");
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

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  stubSystemTheme(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("theme-preference", () => {
  it("arranca en oscuro sin elección guardada y con el sistema oscuro", async () => {
    const { getTheme } = await loadTheme();

    expect(getTheme()).toBe("dark");
  });

  it("hereda el tema claro del sistema cuando no hay elección", async () => {
    stubSystemTheme(true);
    const { getTheme } = await loadTheme();

    expect(getTheme()).toBe("light");
  });

  it("la elección guardada manda sobre el sistema", async () => {
    stubSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const { getTheme } = await loadTheme();

    expect(getTheme()).toBe("dark");
  });

  it("ignora un valor guardado que no es un tema", async () => {
    stubSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    const { getTheme } = await loadTheme();

    expect(getTheme()).toBe("light");
  });

  it("setTheme guarda, pinta `data-theme` y avisa a los suscriptores", async () => {
    const { setTheme, subscribeTheme } = await loadTheme();
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    setTheme("light");

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setTheme("dark");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("toggleTheme alterna y recuerda la elección", async () => {
    const { getTheme, toggleTheme } = await loadTheme();

    toggleTheme();

    expect(getTheme()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    toggleTheme();

    expect(getTheme()).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("sigue funcionando si el almacenamiento está bloqueado", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });
    const { getTheme, setTheme } = await loadTheme();

    expect(getTheme()).toBe("dark");
    expect(() => setTheme("light")).not.toThrow();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
