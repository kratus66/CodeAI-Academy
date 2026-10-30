import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme-bootstrap";

/** Monta el conmutador con el módulo de tema recién importado (sin caché). */
async function renderToggle() {
  vi.resetModules();
  const { ThemeToggle } = await import("./ThemeToggle");
  render(<ThemeToggle />);
  return screen.getByRole("switch", { name: "Modo claro" });
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
});

describe("ThemeToggle", () => {
  it("se anuncia como interruptor de modo claro apagado en tema oscuro", async () => {
    const toggle = await renderToggle();

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("al pulsarlo pasa a claro, repinta el documento y lo recuerda", async () => {
    const toggle = await renderToggle();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveTextContent("☀");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("arranca encendido cuando la elección guardada es el tema claro", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    const toggle = await renderToggle();

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("es un botón de formulario seguro y vuelve al tema oscuro al pulsarlo otra vez", async () => {
    const toggle = await renderToggle();
    expect(toggle).toHaveAttribute("type", "button");

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveTextContent("☾");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
