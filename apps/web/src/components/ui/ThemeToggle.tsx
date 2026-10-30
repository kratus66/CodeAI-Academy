"use client";

import { useEffect } from "react";

import { applyTheme, toggleTheme, useTheme } from "@/lib/theme-preference";

const BUTTON_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-2 text-xs font-medium text-slate-300 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-3";

/**
 * Conmutador de tema claro/oscuro. Es un `switch` real —el estado viaja en
 * `aria-checked`, no en el color— y la etiqueta visible coincide con el nombre
 * accesible, así que el lector de pantalla anuncia «Modo claro, activado». En
 * pantallas muy estrechas solo queda el icono y el nombre lo aporta
 * `aria-label`, que es el mismo texto.
 */
export function ThemeToggle() {
  const theme = useTheme();
  const light = theme === "light";

  // El script de arranque ya fijó `data-theme`; esto cubre el caso de que no
  // llegara a ejecutarse (CSP, HTML en caché) para que el documento y el
  // conmutador nunca discrepen.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      aria-label="Modo claro"
      onClick={toggleTheme}
      className={BUTTON_CLASSES}
    >
      <span aria-hidden>{light ? "☀" : "☾"}</span>
      <span className="hidden sm:inline">Modo claro</span>
    </button>
  );
}
