/**
 * Selección de pista (`sprint-06-correccion-pistas.md` §4 y §6).
 *
 * Función pura: sólo decide si el nivel pedido puede servirse. No conoce
 * Prisma, ni Nest, ni el texto de las pistas; el servicio lee el catálogo y
 * devuelve el texto tal cual. La idempotencia del registro vive en el
 * repositorio, no aquí.
 */

export interface HintSelectionInput {
  readonly requestedLevel: number;
  /** Niveles que el catálogo del ejercicio declara (normalmente 1, 2 y 3). */
  readonly availableLevels: readonly number[];
  /** Niveles que este usuario ya usó en este ejercicio. */
  readonly usedLevels: readonly number[];
}

/** `NOT_AVAILABLE` → 404; `PROGRESSION_REQUIRED` → 422 `RULE_VIOLATION`. */
export type HintSelectionFailure = "NOT_AVAILABLE" | "PROGRESSION_REQUIRED";

export type HintSelectionResult =
  | { readonly ok: true; readonly nextLevelAvailable: boolean }
  | { readonly ok: false; readonly reason: HintSelectionFailure };

export function selectHint(input: HintSelectionInput): HintSelectionResult {
  const { requestedLevel, availableLevels, usedLevels } = input;

  if (
    !Number.isInteger(requestedLevel) ||
    requestedLevel < 1 ||
    !availableLevels.includes(requestedLevel)
  ) {
    return { ok: false, reason: "NOT_AVAILABLE" };
  }

  for (let level = 1; level < requestedLevel; level += 1) {
    if (!usedLevels.includes(level)) {
      return { ok: false, reason: "PROGRESSION_REQUIRED" };
    }
  }

  return { ok: true, nextLevelAvailable: availableLevels.includes(requestedLevel + 1) };
}
