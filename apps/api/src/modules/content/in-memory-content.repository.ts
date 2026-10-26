import type {
  LessonDetail,
  ResourceSummary,
  StageDetail,
  StageSummary,
  UnitDetail,
} from "@codeai/shared";

import type {
  ContentRepository,
  Page,
  PageWindow,
  ResourceListFilter,
  StageListFilter,
} from "./content.repository";

/**
 * Currículo ya publicado y listo para servir. El adaptador en memoria no
 * conoce `isPublished`: el conjunto que recibe es, por definición, publicado.
 */
export interface ContentDataset {
  stages: readonly StageDetail[];
  units: readonly UnitDetail[];
  lessons: readonly LessonDetail[];
  /** Recursos verificados junto a la etapa a la que pertenecen (`?stage=`). */
  resources: readonly { stageId: number; resource: ResourceSummary }[];
}

export const EMPTY_CONTENT_DATASET: ContentDataset = {
  stages: [],
  units: [],
  lessons: [],
  resources: [],
};

/**
 * Implementación en memoria de `ContentRepository` para pruebas y entornos sin
 * base de datos. Respeta el orden declarado en el conjunto (el mismo `order`
 * ascendente que aplica Prisma) y pagina con la misma semántica que el adaptador.
 */
export class InMemoryContentRepository implements ContentRepository {
  constructor(private readonly dataset: ContentDataset = EMPTY_CONTENT_DATASET) {}

  async listStages(filter: StageListFilter): Promise<Page<StageSummary>> {
    const stages = this.dataset.stages
      .filter((stage) => filter.level === undefined || stage.level === filter.level)
      .map(({ modules: _modules, ...summary }) => summary);

    return paginate(stages, filter);
  }

  async findStage(id: number): Promise<StageDetail | null> {
    return this.dataset.stages.find((stage) => stage.id === id) ?? null;
  }

  async findUnit(code: string): Promise<UnitDetail | null> {
    return this.dataset.units.find((unit) => unit.code === code) ?? null;
  }

  async findLesson(slug: string): Promise<LessonDetail | null> {
    return this.dataset.lessons.find((lesson) => lesson.slug === slug) ?? null;
  }

  async listResources(filter: ResourceListFilter): Promise<Page<ResourceSummary>> {
    const resources = this.dataset.resources
      .filter((entry) => filter.stage === undefined || entry.stageId === filter.stage)
      .filter((entry) => filter.type === undefined || entry.resource.type === filter.type)
      .map(({ resource }) => resource);

    return paginate(resources, filter);
  }
}

function paginate<TItem>(items: readonly TItem[], window: PageWindow): Page<TItem> {
  return {
    items: items.slice(window.skip, window.skip + window.take),
    total: items.length,
  };
}
