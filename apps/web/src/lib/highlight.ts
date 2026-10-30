"use server";

import {
  bundledLanguages,
  createHighlighter,
  createJavaScriptRegexEngine,
} from "shiki";
import type { BundledLanguage, Highlighter } from "shiki";

const LIGHT_THEME = "github-light";
const DARK_THEME = "github-dark";

/**
 * Un único resaltador por proceso: crear gramáticas cuesta y las lecciones
 * repiten los mismos lenguajes. El motor es JavaScript puro para no depender de
 * WASM al empaquetar el servidor de Next.
 */
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [LIGHT_THEME, DARK_THEME],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  }).catch((error: unknown) => {
    // Un fallo de arranque no debe envenenar el proceso: el siguiente bloque
    // vuelve a intentarlo y, si falla, cae a texto plano.
    highlighterPromise = null;
    throw error;
  });

  return highlighterPromise;
}

/** Solo se aceptan los lenguajes que viajan con Shiki; el resto cae a texto plano. */
function isBundledLanguage(value: string): value is BundledLanguage {
  return Object.hasOwn(bundledLanguages, value);
}

/**
 * Resalta un bloque de código en el servidor y devuelve su HTML, o `null` si el
 * lenguaje no está soportado (la vista pinta entonces el texto plano).
 *
 * Se ejecuta como Server Action: el resaltador y sus gramáticas nunca viajan al
 * navegador. El tema claro queda emitido como variables CSS (`--shiki-light`)
 * mientras el oscuro se aplica en línea, que es el tema vigente hasta T6.
 */
export async function highlightCode(
  code: string,
  language: string | null,
): Promise<string | null> {
  const normalized = language?.trim().toLowerCase() ?? "";

  if (code.trim() === "" || !isBundledLanguage(normalized)) {
    return null;
  }

  const highlighter = await getHighlighter();
  await highlighter.loadLanguage(normalized);

  return highlighter.codeToHtml(code, {
    lang: normalized,
    themes: { light: LIGHT_THEME, dark: DARK_THEME },
    defaultColor: "dark",
  });
}
