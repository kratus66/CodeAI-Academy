/**
 * Motor de puntuación por pesos, compartido por proyectos (S9) y entrevistas
 * (S10). Es una función pura: recibe pesos que suman 100 y niveles 0–4 y
 * devuelve la nota con dos decimales. Cada módulo valida su propia rúbrica y
 * decide qué hacer con la nota; aquí no hay HTTP, ni Prisma, ni reloj.
 */

/** Nivel máximo de la rúbrica: 4 = dominio. */
export const RUBRIC_LEVEL_MAX = 4;

/** `EPSILON` evita que 84.99999999999999 se redondee a 85 con `Math.round` directo. */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * `nota(criterio) = peso(criterio) × nivel(criterio) / 4`, sumada y redondeada.
 * Un criterio sin nivel cuenta como 0: la validación del contrato ocurre antes.
 */
export function scoreLevels(
  weights: Readonly<Record<string, number>>,
  levels: Readonly<Record<string, number>>,
  levelMax: number = RUBRIC_LEVEL_MAX,
): number {
  const weighted = Object.entries(weights).reduce(
    (total, [criterion, weight]) =>
      total + (weight * (levels[criterion] ?? 0)) / levelMax,
    0,
  );

  return roundToTwoDecimals(weighted);
}
