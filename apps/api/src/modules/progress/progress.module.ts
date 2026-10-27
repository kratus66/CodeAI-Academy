import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ReviewModule } from "../review/review.module";
import { ReviewService } from "../review/review.service";
import { ProgressController } from "./progress.controller";
import { PROGRESS_REPOSITORY } from "./progress.repository";
import { ProgressService, REVIEW_DUE_COUNTER } from "./progress.service";
import { PrismaProgressRepository } from "./prisma-progress.repository";

/**
 * Progreso por estudiante. El puerto `ProgressRepository` se inyecta por token
 * para que las pruebas cambien Prisma por el adaptador en memoria. `AuthModule`
 * aporta el `JwtAuthGuard` que protege todas las rutas.
 *
 * S7 añade `REVIEW_DUE_COUNTER`, que reutiliza el `ReviewService` exportado por
 * `ReviewModule` para publicar la deuda real de repaso en el resumen.
 */
@Module({
  imports: [PrismaModule, AuthModule, ReviewModule],
  controllers: [ProgressController],
  providers: [
    ProgressService,
    { provide: PROGRESS_REPOSITORY, useClass: PrismaProgressRepository },
    { provide: REVIEW_DUE_COUNTER, useExisting: ReviewService },
  ],
  exports: [ProgressService],
})
export class ProgressModule {}
