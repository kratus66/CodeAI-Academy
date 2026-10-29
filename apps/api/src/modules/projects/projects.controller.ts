import {
  createProjectSubmissionSchema,
  projectListQuerySchema,
  projectSlugParamsSchema,
  projectSubmissionIdParamsSchema,
} from "@codeai/shared";
import type {
  CreateProjectSubmissionInput,
  ProjectDetail,
  ProjectListQuery,
  ProjectListResponse,
  ProjectSlugParams,
  ProjectSubmission,
  ProjectSubmissionIdParams,
} from "@codeai/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RateLimit } from "../../common/security/rate-limit.decorator";
import { RateLimitGuard } from "../../common/security/rate-limit.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AccessTokenPayload } from "../auth/token.service";
// Import de valor obligatorio: Nest resuelve `ProjectsService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProjectsService } from "./projects.service";

/** 120 peticiones por minuto y usuario (`contratos-api.md` §6 y §4.11). */
const PROJECTS_LIMIT = { limit: 120, windowMs: 60_000, keyFromUser: true };

/**
 * Catálogo, entregas y revisión de proyectos (`contratos-api.md` §4.11).
 *
 * Todo el controlador está detrás de `JwtAuthGuard` y el `userId` sale del token:
 * el cliente no elige de quién es una entrega. Sólo la revisión exige rol, y lo
 * hace con `RolesGuard` sobre el rol firmado en el token.
 *
 * Las rutas de `submissions/*` se declaran **antes** de `:slug/submissions` para
 * que Nest no interprete `submissions` como un slug.
 */
@ApiTags("projects")
@Controller("projects")
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RateLimit(PROJECTS_LIMIT)
  async listProjects(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(projectListQuerySchema)) query: ProjectListQuery,
  ): Promise<ProjectListResponse> {
    return this.projects.listProjects(query, user.sub, user.role);
  }

  @Get(":slug")
  @RateLimit(PROJECTS_LIMIT)
  async getProject(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(projectSlugParamsSchema)) params: ProjectSlugParams,
  ): Promise<ProjectDetail> {
    return this.projects.getProject(params.slug, user.sub, user.role);
  }

  @Post("submissions/:id/review")
  @RateLimit(PROJECTS_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Roles("INSTRUCTOR", "ADMIN")
  @UseGuards(RolesGuard)
  async review(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(projectSubmissionIdParamsSchema))
    params: ProjectSubmissionIdParams,
    // Sin pipe: una rúbrica incompleta es `422 RULE_VIOLATION`, no `400`
    // (`contratos-api.md` §4.11); el servicio valida con el mismo esquema.
    @Body() body: unknown,
  ): Promise<ProjectSubmission> {
    return this.projects.review(params.id, body, user.sub);
  }

  @Post("submissions/:id/publish")
  @RateLimit(PROJECTS_LIMIT)
  @HttpCode(HttpStatus.OK)
  async publish(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(projectSubmissionIdParamsSchema))
    params: ProjectSubmissionIdParams,
  ): Promise<ProjectSubmission> {
    return this.projects.publish(params.id, user.sub);
  }

  @Post("submissions/:id/unpublish")
  @RateLimit(PROJECTS_LIMIT)
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(projectSubmissionIdParamsSchema))
    params: ProjectSubmissionIdParams,
  ): Promise<ProjectSubmission> {
    return this.projects.unpublish(params.id, user.sub);
  }

  @Post(":slug/submissions")
  @RateLimit(PROJECTS_LIMIT)
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(projectSlugParamsSchema)) params: ProjectSlugParams,
    @Body(new ZodValidationPipe(createProjectSubmissionSchema))
    body: CreateProjectSubmissionInput,
  ): Promise<ProjectSubmission> {
    return this.projects.submit(params.slug, body, user.sub, user.role);
  }
}
