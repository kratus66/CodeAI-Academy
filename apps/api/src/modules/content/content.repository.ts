import type {
  LessonDetail,
  ResourceSummary,
  ResourceType,
  StageDetail,
  StageSummary,
  UnitDetail,
} from "@codeai/shared";

/**
 * Puerto de lectura del currículo. Todo lo que devuelve está **publicado**: el
 * filtro de `isPublished` vive en el adaptador para que ninguna consulta nueva
 * pueda olvidarlo.
 */
export const CONTENT_REPOSITORY = Symbol("CONTENT_REPOSITORY");

/** Ventana de paginación ya calculada por el servicio (1-based → `skip`). */
export interface PageWindow {
  skip: number;
  take: number;
}

export interface StageListFilter extends PageWindow {
  level?: number;
}

export interface ResourceListFilter extends PageWindow {
  stage?: number;
  type?: ResourceType;
}

/** Página de resultados: el total lo cuenta el adaptador, no la página. */
export interface Page<TItem> {
  items: TItem[];
  total: number;
}

export interface ContentRepository {
  listStages(filter: StageListFilter): Promise<Page<StageSummary>>;
  findStage(id: number): Promise<StageDetail | null>;
  findUnit(code: string): Promise<UnitDetail | null>;
  findLesson(slug: string): Promise<LessonDetail | null>;
  listResources(filter: ResourceListFilter): Promise<Page<ResourceSummary>>;
}
