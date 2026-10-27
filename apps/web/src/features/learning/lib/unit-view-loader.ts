import type { StageDetail, UnitDetail } from "@codeai/shared";

import { contentApi } from "@/lib/api-client";

/** Todo lo que la vista de unidad necesita, en un solo estado de carga. */
export interface UnitViewContent {
  readonly unit: UnitDetail;
  readonly stage: StageDetail;
}

export type LoadUnitView = (
  code: string,
  signal?: AbortSignal,
) => Promise<UnitViewContent>;

/**
 * La unidad llega de `/content/units/:code` y la etapa solo por su `stageId`:
 * así se resuelven prerrequisitos y vecinos sin deducir nada del código. Si la
 * unidad falla no se pide la etapa, y si la etapa falla no se pinta media vista.
 */
export async function loadUnitView(
  code: string,
  signal?: AbortSignal,
): Promise<UnitViewContent> {
  const unit = await contentApi.getUnit(code, signal);
  const stage = await contentApi.getStage(unit.stageId, signal);

  return { unit, stage };
}
