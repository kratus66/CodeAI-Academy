/**
 * Duración legible para las vistas de contenido. `null` significa que la API no
 * declara estimación: la vista omite el dato en vez de inventarlo.
 */
export function formatMinutes(minutes: number | null): string | null {
  if (minutes === null) {
    return null;
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
