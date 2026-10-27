/**
 * Intercalado de la cola de repaso (`prerequisitos-y-progreso.md` §5.3).
 *
 * «Al menos el 30 % de la cola diaria debe mezclar conceptos distintos»: la
 * consulta llega ordenada por prioridad y vencimiento, y este paso la reparte
 * por turnos entre conceptos **sin** perder el orden relativo dentro de cada
 * uno. Es una función pura para que la regla se pueda probar sin base de datos.
 */

/** Cualquier fila con concepto; la cola real añade ejercicio y fechas. */
export interface ConceptTagged {
  readonly concept: string;
}

/** Fracción mínima de parejas adyacentes con conceptos distintos (§5.3). */
export const MIN_INTERLEAVED_RATIO = 0.3;

/**
 * Reparte los ítems por concepto conservando su orden de llegada.
 *
 * El primer concepto encontrado abre cada turno, así que una cola ya ordenada
 * por prioridad mantiene arriba sus ítems más urgentes en la primera vuelta.
 */
export function interleaveByConcept<T extends ConceptTagged>(
  items: readonly T[],
): T[] {
  if (items.length < 2) {
    return [...items];
  }

  const groups = new Map<string, T[]>();

  for (const item of items) {
    const group = groups.get(item.concept);

    if (group) {
      group.push(item);
    } else {
      groups.set(item.concept, [item]);
    }
  }

  if (groups.size === 1) {
    return [...items];
  }

  const queues = [...groups.values()];
  const interleaved: T[] = [];

  for (let index = 0; interleaved.length < items.length; index += 1) {
    const queue = queues[index % queues.length];
    const next = queue?.shift();

    if (next) {
      interleaved.push(next);
    }
  }

  return interleaved;
}

/** Proporción de parejas adyacentes con conceptos distintos; `0` si hay < 2. */
export function distinctAdjacentRatio(items: readonly ConceptTagged[]): number {
  if (items.length < 2) {
    return 0;
  }

  let distinct = 0;

  for (let index = 1; index < items.length; index += 1) {
    if (items[index]?.concept !== items[index - 1]?.concept) {
      distinct += 1;
    }
  }

  return distinct / (items.length - 1);
}
