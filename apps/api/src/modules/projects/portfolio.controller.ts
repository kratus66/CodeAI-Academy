import { portfolioUserParamsSchema } from "@codeai/shared";
import type {
  PortfolioResponse,
  PortfolioUserParams,
} from "@codeai/shared";
import {
  Controller,
  Get,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RateLimit } from "../../common/security/rate-limit.decorator";
import { RateLimitGuard } from "../../common/security/rate-limit.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AccessTokenPayload } from "../auth/token.service";
// Import de valor obligatorio: Nest resuelve `ProjectsService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProjectsService } from "./projects.service";

/**
 * 120 peticiones por minuto y **por IP**: el portafolio público no tiene sesión
 * (`contratos-api.md` §6 y §4.11).
 */
const PORTFOLIO_LIMIT = { limit: 120, windowMs: 60_000 };

/**
 * Portafolio propio y público (`contratos-api.md` §4.11).
 *
 * `GET /api/portfolio/:userId` es la primera ruta pública fuera de contenido y
 * autenticación: no acepta cookie y nunca devuelve `email` ni entregas privadas.
 * `GET /api/portfolio/me` sí exige sesión y añade las privadas.
 */
@ApiTags("portfolio")
@Controller("portfolio")
@UseGuards(RateLimitGuard)
export class PortfolioController {
  constructor(private readonly projects: ProjectsService) {}

  /** Se declara antes de `:userId` para que Nest no lea `me` como identificador. */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMyPortfolio(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PortfolioResponse> {
    return this.projects.getMyPortfolio(user.sub);
  }

  @Get(":userId")
  @RateLimit(PORTFOLIO_LIMIT)
  async getPortfolio(
    @Param(new ZodValidationPipe(portfolioUserParamsSchema))
    params: PortfolioUserParams,
  ): Promise<PortfolioResponse> {
    return this.projects.getPortfolio(params.userId);
  }
}
