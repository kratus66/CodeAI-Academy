/** Formato de los paneles de analítica: español, sin depender del locale del navegador. */

/** `34.5` → `34,5 %`. */
export function percentLabel(value: number): string {
  return `${String(value).replace(".", ",")} %`;
}

/** `0.12` → `0,12 USD`. */
export function usdLabel(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} USD`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });

export function dateLabel(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? iso : DATE_FORMAT.format(date);
}

/** `1, "unidad", "unidades"` → `1 unidad`; `3` → `3 unidades`. */
export function countLabel(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
