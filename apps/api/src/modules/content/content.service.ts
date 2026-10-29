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

// Import de valor obligatorio: Nest resuelve `ContentCache` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ContentCache } from "./content-cache";
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
 * contenido inexistente o no publicado. Las lecturas pasan por `ContentCache`:
 * la segunda petición idéntica no toca la base y una mutación llama a
 * `invalidateCache()` para que el cambio se vea al instante.
 */
@Injectable()
export class ContentService {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly repository: ContentRepository,
    private readonly cache: ContentCache,
  ) {}

  async listStages(query: StageListQuery): Promise<StageListResponse> {
    const window = toWindow(query);
    const key = `stages:${query.page}:${query.pageSize}:${query.level ?? "all"}`;

    return this.cache.getOrLoad(key, async () =>
      toPaginated(
        await this.repository.listStages({
          ...window,
          ...(query.level === undefined ? {} : { level: query.level }),
        }),
        query,
      ),
    );
  }

  async getStage(id: number): Promise<StageDetailResponse> {
    return this.cache.getOrLoad(`stage:${id}`, async () => {
      const stage = await this.repository.findStage(id);

      if (!stage) {
        throw new NotFoundException(STAGE_NOT_FOUND);
      }

      return { stage };
    });
  }

  async getUnit(code: string): Promise<UnitDetailResponse> {
    return this.cache.getOrLoad(`unit:${code}`, async () => {
      const unit = await this.repository.findUnit(code);

      if (!unit) {
        throw new NotFoundException(UNIT_NOT_FOUND);
      }

      return { unit };
    });
  }

  async getLesson(slug: string): Promise<LessonDetailResponse> {
    return this.cache.getOrLoad(`lesson:${slug}`, async () => {
      const lesson = await this.repository.findLesson(slug);

      if (!lesson) {
        throw new NotFoundException(LESSON_NOT_FOUND);
      }

      return { lesson };
    });
  }

  async listResources(query: ResourceListQuery): Promise<ResourceListResponse> {
    const window = toWindow(query);
    const key =
      `resources:${query.page}:${query.pageSize}:` +
      `${query.stage ?? "all"}:${query.type ?? "all"}`;

    return this.cache.getOrLoad(key, async () =>
      toPaginated(
        await this.repository.listResources({
          ...window,
          ...(query.stage === undefined ? {} : { stage: query.stage }),
          ...(query.type === undefined ? {} : { type: query.type }),
        }),
        query,
      ),
    );
  }

  /**
   * Punto de invalidación para cualquier mutación de contenido (siembra desde
   * un panel, edición, publicación). Devuelve la versión resultante para el log.
   */
  invalidateCache(): number {
    return this.cache.invalidate();
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
