/**
 * Arranque del tema. El script viaja en línea al principio del `<body>`, así que
 * corre antes de que se pinte cualquier contenido y antes de que React hidrate:
 * no hay FOUC ni parpadeo del tema por defecto. No puede importar nada, por eso
 * repite los literales dentro de una cadena.
 */

/** Clave compartida con `theme-preference`; el script la lleva embebida. */
export const THEME_STORAGE_KEY = "codeai:theme";

/** Colores de la barra del navegador (`theme-color`) por tema. */
export const THEME_COLORS = {
  dark: "#070b14",
  light: "#f8fafc",
} as const;

/**
 * Lee la elección guardada, cae a `prefers-color-scheme` si no hay ninguna y
 * fija `data-theme` en `<html>` —el selector que define los tokens de tema—,
 * además de `theme-color`. Cada paso va en su propio `try`: si el
 * almacenamiento está bloqueado (modo privado, cookies de terceros) el tema
 * sigue resolviéndose por el sistema, y si algo del DOM falla, los tokens que
 * pinta `:root` dejan el tema oscuro por defecto.
 */
export const THEME_BOOTSTRAP = `(function(){var stored=null;try{stored=window.localStorage.getItem("${THEME_STORAGE_KEY}")}catch(err){}var theme=stored==="light"||stored==="dark"?stored:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");try{document.documentElement.setAttribute("data-theme",theme)}catch(err){}try{var meta=document.querySelector('meta[name="theme-color"]');if(!meta){meta=document.createElement("meta");meta.setAttribute("name","theme-color");document.head.appendChild(meta)}meta.setAttribute("content",theme==="light"?"${THEME_COLORS.light}":"${THEME_COLORS.dark}")}catch(err){}})();`;

