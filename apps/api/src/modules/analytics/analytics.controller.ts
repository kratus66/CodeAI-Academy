import type {
  AnalyticsRangeQuery,
  CohortAnalytics,
  ErrorBreakdown,
  StudentSummary,
} from "@codeai/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AccessTokenPayload } from "../auth/token.service";
import { AnalyticsRangePipe } from "./analytics-range.pipe";
// Import de valor obligatorio: Nest resuelve `AnalyticsService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AnalyticsService } from "./analytics.service";

/**
 * Analítica (`contratos-api.md` §4.13 y `sprint-11-analitica-lanzamiento.md`
 * §4.2).
 *
 * `me/*` usa siempre el `userId` del token: no hay forma de pedir el resumen de
 * otro estudiante. `cohort` es la única ruta con rol y devuelve sólo agregados
 * y nombres visibles.
 */
@ApiTags("analytics")
@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("me/summary")
  async getSummary(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new AnalyticsRangePipe()) query: AnalyticsRangeQuery,
  ): Promise<StudentSummary> {
    return this.analytics.getSummary(user.sub, query.range);
  }

  @Get("me/errors")
  async getErrors(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new AnalyticsRangePipe()) query: AnalyticsRangeQuery,
  ): Promise<ErrorBreakdown> {
    return this.analytics.getErrors(user.sub, query.range);
  }

  @Get("cohort")
  @Roles("INSTRUCTOR", "ADMIN")
  @UseGuards(RolesGuard)
  async getCohort(
    @Query(new AnalyticsRangePipe()) query: AnalyticsRangeQuery,
  ): Promise<CohortAnalytics> {
    return this.analytics.getCohort(query.range);
  }
}
