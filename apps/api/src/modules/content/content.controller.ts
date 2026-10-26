import {
  lessonSlugParamsSchema,
  resourceListQuerySchema,
  stageIdParamsSchema,
  stageListQuerySchema,
  unitCodeParamsSchema,
} from "@codeai/shared";
import type {
  LessonDetailResponse,
  LessonSlugParams,
  ResourceListQuery,
  ResourceListResponse,
  StageDetailResponse,
  StageIdParams,
  StageListQuery,
  StageListResponse,
  UnitCodeParams,
  UnitDetailResponse,
} from "@codeai/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
// Import de valor obligatorio: Nest resuelve `ContentService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ContentService } from "./content.service";

/**
 * Catálogo público del currículo (`docs/03-arquitectura/contratos-api.md` §3).
 * Sin autenticación: solo se sirve contenido publicado y verificado. Los
 * parámetros se validan en el borde para responder `400 VALIDATION_ERROR`
 * cuando el cliente envía un id o un código mal formado.
 */
@ApiTags("content")
@Controller("content")
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get("stages")
  async listStages(
    @Query(new ZodValidationPipe(stageListQuerySchema)) query: StageListQuery,
  ): Promise<StageListResponse> {
    return this.content.listStages(query);
  }

  @Get("stages/:id")
  async getStage(
    @Param(new ZodValidationPipe(stageIdParamsSchema)) params: StageIdParams,
  ): Promise<StageDetailResponse> {
    return this.content.getStage(params.id);
  }

  @Get("units/:code")
  async getUnit(
    @Param(new ZodValidationPipe(unitCodeParamsSchema)) params: UnitCodeParams,
  ): Promise<UnitDetailResponse> {
    return this.content.getUnit(params.code);
  }

  @Get("lessons/:slug")
  async getLesson(
    @Param(new ZodValidationPipe(lessonSlugParamsSchema)) params: LessonSlugParams,
  ): Promise<LessonDetailResponse> {
    return this.content.getLesson(params.slug);
  }

  @Get("resources")
  async listResources(
    @Query(new ZodValidationPipe(resourceListQuerySchema)) query: ResourceListQuery,
  ): Promise<ResourceListResponse> {
    return this.content.listResources(query);
  }
}
