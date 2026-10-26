import type {
  LessonDetailResponse,
  PaginationMeta,
  ResourceListQuery,
  ResourceListResponse,
  StageDetailResponse,
  StageListQuery,
  StageListResponse,
  UnitDetailResponse,
} from "@codeai/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { ContentRepository, Page, PageWindow } from "./content.repository";
import { CONTENT_REPOSITORY } from "./content.repository";

const STAGE_NOT_FOUND = "La etapa solicitada no existe o no está publicada";
const UNIT_NOT_FOUND = "La unidad solicitada no existe o no está publicada";
const LESSON_NOT_FOUND = "La lección solicitada no existe o no está publicada";

interface PaginationQuery {
  page: number;
  pageSize: number;
}

/**
 * Reglas de lectura del catálogo: ventana de paginación, metadatos y `404` para
 * contenido inexistente o no publicado. No conoce Prisma ni HTTP.
 */
@Injectable()
export class ContentService {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly repository: ContentRepository,
  ) {}

  async listStages(query: StageListQuery): Promise<StageListResponse> {
    const page = await this.repository.listStages({
      ...toWindow(query),
      ...(query.level === undefined ? {} : { level: query.level }),
    });

    return toPaginated(page, query);
  }

  async getStage(id: number): Promise<StageDetailResponse> {
    const stage = await this.repository.findStage(id);

    if (!stage) {
      throw new NotFoundException(STAGE_NOT_FOUND);
    }

    return { stage };
  }

  async getUnit(code: string): Promise<UnitDetailResponse> {
    const unit = await this.repository.findUnit(code);

    if (!unit) {
      throw new NotFoundException(UNIT_NOT_FOUND);
    }

    return { unit };
  }

  async getLesson(slug: string): Promise<LessonDetailResponse> {
    const lesson = await this.repository.findLesson(slug);

    if (!lesson) {
      throw new NotFoundException(LESSON_NOT_FOUND);
    }

    return { lesson };
  }

  async listResources(query: ResourceListQuery): Promise<ResourceListResponse> {
    const page = await this.repository.listResources({
      ...toWindow(query),
      ...(query.stage === undefined ? {} : { stage: query.stage }),
      ...(query.type === undefined ? {} : { type: query.type }),
    });

    return toPaginated(page, query);
  }
}

/** `page` es 1-based: la primera página empieza en la fila 0. */
function toWindow(query: PaginationQuery): PageWindow {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

function toPaginated<TItem>(
  page: Page<TItem>,
  query: PaginationQuery,
): { data: TItem[]; meta: PaginationMeta } {
  return {
    data: page.items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: page.total,
      totalPages: Math.ceil(page.total / query.pageSize),
    },
  };
}
