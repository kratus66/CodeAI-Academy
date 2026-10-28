/**
 * Guardas en código de la capa de IA (`capa-ia.md` §4): «los prompts se pueden
 * eludir; los filtros no». Funciones puras, sin dependencias.
 */

/** Pista segura (texto fijo) que sustituye a una respuesta filtrada. */
export const SAFE_HINT =
  "No puedo darte la solución completa. Antes de seguir: ¿qué parte de tu intento crees que falla primero?";

/** Mínimo de caracteres normalizados para considerar una solución «literal». */
export const MIN_LITERAL_LENGTH = 20;
/** Un bloque cercado con más de estas líneas se compara contra la solución. */
export const MAX_SAFE_BLOCK_LINES = 8;
export const BLOCK_SIMILARITY_THRESHOLD = 0.8;

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignora\s+(todas\s+)?(las\s+)?instrucciones\s+(anteriores|previas)/gi,
  /ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+instructions/gi,
  /mu[eé]strame\s+(tu|el)\s+(prompt|mensaje\s+del\s+sistema)/gi,
  /show\s+me\s+your\s+(system\s+)?prompt/gi,
  /eres\s+ahora\s+[^.!?\n]*/gi,
  /you\s+are\s+now\s+[^.!?\n]*/gi,
  /<\/?student_input>/gi,
];

export const REDACTED = "[contenido eliminado]";

/** Elimina patrones de inyección conocidos del mensaje del estudiante. */
export function sanitizeStudentInput(text: string): { text: string; flagged: boolean } {
  let flagged = false;
  let result = text;

  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, () => {
      flagged = true;
      return REDACTED;
    });
  }

  return { text: result, flagged };
}

/** Minúsculas y sin ningún espacio en blanco: resiste reformateos de la solución. */
export function normalizeCompact(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/** `true` si la respuesta contiene literalmente alguna solución (≥ 20 caracteres). */
export function containsLiteralSolution(reply: string, solutions: readonly string[]): boolean {
  const haystack = normalizeCompact(reply);

  return solutions.some((solution) => {
    const needle = normalizeCompact(solution);

    return needle.length >= MIN_LITERAL_LENGTH && haystack.includes(needle);
  });
}

/** Líneas con contenido, sin comentarios de una línea ni espacios sobrantes. */
export function normalizedLines(code: string): string[] {
  return code
    .split(/\r?\n/)
    .map((line) => line.replace(/(\/\/|#).*$/, "").replace(/\s+/g, " ").trim().toLowerCase())
    .filter((line) => line.length > 0);
}

/** Similitud de Jaccard entre los conjuntos de líneas normalizadas. */
export function lineSimilarity(a: string, b: string): number {
  const left = new Set(normalizedLines(a));
  const right = new Set(normalizedLines(b));

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const line of left) {
    if (right.has(line)) shared += 1;
  }

  return shared / (left.size + right.size - shared);
}

/** Cuerpos de los bloques cercados (```) de la respuesta. */
export function extractCodeBlocks(reply: string): string[] {
  return [...reply.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
}

/** `true` si hay un bloque de más de 8 líneas muy parecido a una solución oficial. */
export function containsCompleteCodeBlock(reply: string, solutions: readonly string[]): boolean {
  return extractCodeBlocks(reply).some(
    (block) =>
      block.split(/\r?\n/).filter((line) => line.trim() !== "").length > MAX_SAFE_BLOCK_LINES &&
      solutions.some((solution) => lineSimilarity(block, solution) >= BLOCK_SIMILARITY_THRESHOLD),
  );
}

/** Recorta en el último espacio y añade `…` si supera el límite. */
export function truncateAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Aplica las tres guardas en orden: solución literal, bloque completo y
 * longitud. Una respuesta filtrada se sustituye por `SAFE_HINT`.
 */
export function applyReplyGuards(
  reply: string,
  solutions: readonly string[],
  maxChars: number,
): { reply: string; filtered: boolean } {
  if (containsLiteralSolution(reply, solutions) || containsCompleteCodeBlock(reply, solutions)) {
    return { reply: SAFE_HINT, filtered: true };
  }

  return { reply: truncateAtWord(reply, maxChars), filtered: false };
}
