import type { AiBudgetLevel } from "@codeai/shared";

/** Umbrales de `capa-ia.md` §6, como fracción del presupuesto mensual. */
export const ECONOMY_THRESHOLD = 0.7;
export const TUTOR_ONLY_THRESHOLD = 0.9;
export const DISABLED_THRESHOLD = 1;

const roundCents = (value: number): number => Math.round(value * 100) / 100;

/** Primer instante del mes UTC de `now`. */
export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Etiqueta `AAAA-MM` del mes UTC de `now`. */
export function monthLabelUtc(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Nivel de gasto: `< 70 %` normal, `70–90 %` economy, `90–100 %` tutor_only, `≥ 100 %` disabled. */
export function resolveBudgetPolicy(spentUsd: number, budgetUsd: number): AiBudgetLevel {
  const ratio = spentUsd / budgetUsd;

  if (ratio >= DISABLED_THRESHOLD) return "disabled";
  if (ratio >= TUTOR_ONLY_THRESHOLD) return "tutor_only";
  if (ratio >= ECONOMY_THRESHOLD) return "economy";

  return "normal";
}

/** Saldo restante con dos decimales; nunca negativo. */
export function remainingUsd(spentUsd: number, budgetUsd: number): number {
  return roundCents(Math.max(0, budgetUsd - spentUsd));
}

/** Porcentaje gastado con dos decimales; puede superar 100 si el gasto excede el tope. */
export function percentUsed(spentUsd: number, budgetUsd: number): number {
  return roundCents((spentUsd / budgetUsd) * 100);
}
