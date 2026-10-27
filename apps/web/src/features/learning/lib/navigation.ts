import type { ModuleSummary, UnitSummary } from "@codeai/shared";

type StageModules = readonly Pick<ModuleSummary, "units">[];

export interface UnitNeighbours {
  readonly previous: UnitSummary | null;
  readonly next: UnitSummary | null;
}

/**
 * Unidades de la etapa en el orden en que se recorren: módulos en su orden y,
 * dentro de cada uno, sus unidades publicadas. Es la base de la navegación y de
 * la resolución de prerrequisitos.
 */
export function flattenStageUnits(
  modules: StageModules,
): readonly UnitSummary[] {
  return modules.flatMap((module) => module.units);
}

/**
 * Vecinos de una unidad dentro de su etapa. La primera unidad no tiene anterior
 * y la última no tiene siguiente; un código ajeno a la etapa no tiene vecinos.
 */
export function findUnitNeighbours(
  modules: StageModules,
  code: string,
): UnitNeighbours {
  const units = flattenStageUnits(modules);
  const index = units.findIndex((unit) => unit.code === code);

  if (index === -1) {
    return { previous: null, next: null };
  }

  const previous = index > 0 ? units[index - 1] : undefined;
  const next = index < units.length - 1 ? units[index + 1] : undefined;

  return { previous: previous ?? null, next: next ?? null };
}

/** Unidades que la unidad declara como prerrequisito, en su orden declarado. */
export function resolvePrerequisites(
  modules: StageModules,
  prerequisiteIds: readonly string[],
): readonly UnitSummary[] {
  const units = flattenStageUnits(modules);

  return prerequisiteIds
    .map((id) => units.find((unit) => unit.id === id))
    .filter((unit): unit is UnitSummary => unit !== undefined);
}
