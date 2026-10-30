import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme-bootstrap";

export type Theme = "dark" | "light";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

type Listener = () => void;

const listeners = new Set<Listener>();
let override: Theme | null | undefined;

/** jsdom no implementa `matchMedia`: sin ella, el sistema pide oscuro. */
function prefersLight(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(LIGHT_QUERY).matches
  );
}

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** Tema vigente: la elección guardada manda; sin ella, el del sistema. */
export function getTheme(): Theme {
  if (override === undefined) {
    override = readStored();
  }
  return override ?? (prefersLight() ? "light" : "dark");
}

/**
 * Fija `data-theme` en `<html>`: es el gancho de los tokens de `globals.css`.
 * Idempotente, para que el script de arranque y el toggle coincidan siempre.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme): void {
  override = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento: la elección dura solo la sesión.
  }
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

/** Alterna claro/oscuro y recuerda la elección. */
export function toggleTheme(): void {
  setTheme(getTheme() === "light" ? "dark" : "light");
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `"dark"` en el servidor: es el tema que pinta `:root` por defecto. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, () => "dark");
}
