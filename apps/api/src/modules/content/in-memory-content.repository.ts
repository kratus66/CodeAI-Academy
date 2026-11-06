import type {
  CourseSlug,
  CourseSummary,
  LessonDetail,
  ResourceSummary,
  StageDetail,
  StageSummary,
  UnitDetail,
} from "@codeai/shared";
import { COURSE_REGISTRY, courseForStageId, DEFAULT_COURSE_SLUG } from "@codeai/shared";

import type {
  ContentRepository,
  Page,
  PageWindow,
  ResourceListFilter,
  StageListFilter,
} from "./content.repository";

/** Ruta del conjunto en memoria: como el resto del conjunto, publicada por definición. */
export interface InMemoryCourse {
  slug: CourseSlug;
  title: string;
  objective: string;
  notice: string | null;
  order: number;
}

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
  /** Rutas del catálogo. Ausente equivale a `[]`: no todos los conjuntos las traen. */
  courses?: readonly InMemoryCourse[];
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
    const course = filter.course ?? DEFAULT_COURSE_SLUG;
    const stages = this.dataset.stages
      .filter((stage) => courseForStageId(stage.id)?.slug === course)
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

  async listCourses(window: PageWindow): Promise<Page<CourseSummary>> {
    const stages = this.dataset.stages;
    const courses = [...(this.dataset.courses ?? [])].sort(compareCourses).map((course) => ({
      slug: course.slug,
      title: course.title,
      objective: course.objective,
      stageLabelPrefix: COURSE_REGISTRY[course.slug].stageLabelPrefix,
      order: course.order,
      stageCount: stages.filter(
        (stage) => courseForStageId(stage.id)?.slug === course.slug,
      ).length,
      notice: course.notice,
    }));

    return paginate(courses, window);
  }
}

/** Mismo orden que el adaptador Prisma: `order` ascendente y, a igualdad, `slug`. */
function compareCourses(left: InMemoryCourse, right: InMemoryCourse): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  if (left.slug === right.slug) {
    return 0;
  }

  return left.slug < right.slug ? -1 : 1;
}

function paginate<TItem>(items: readonly TItem[], window: PageWindow): Page<TItem> {
  return {
    items: items.slice(window.skip, window.skip + window.take),
    total: items.length,
  };
}
