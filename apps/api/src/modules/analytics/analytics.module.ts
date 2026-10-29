import { Module } from "@nestjs/common";

import type { Env } from "../../config/env";
import { ENV } from "../../config/env.module";
import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AnalyticsController } from "./analytics.controller";
import { ANALYTICS_REPOSITORY } from "./analytics.repository";
import {
  ANALYTICS_AI_BUDGET_USD,
  ANALYTICS_CLOCK,
  AnalyticsService,
} from "./analytics.service";
import { PrismaAnalyticsRepository } from "./prisma-analytics.repository";

/**
 * Analítica de S11. `ANALYTICS_REPOSITORY` se sustituye por el adaptador en
 * memoria en las pruebas; el reloj y el presupuesto de IA se inyectan para que
 * el servicio no lea el entorno ni `Date.now()` por su cuenta.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    { provide: ANALYTICS_REPOSITORY, useClass: PrismaAnalyticsRepository },
    { provide: ANALYTICS_CLOCK, useValue: () => new Date() },
    {
      provide: ANALYTICS_AI_BUDGET_USD,
      inject: [ENV],
      useFactory: (env: Env): number => env.AI_MONTHLY_BUDGET_USD,
    },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
