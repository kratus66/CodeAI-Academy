import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ProgressModule } from "../progress/progress.module";
import { ReviewModule } from "../review/review.module";
import { ReviewService } from "../review/review.service";
import { SandboxModule } from "../sandbox/sandbox.module";
import { ExercisesController } from "./exercises.controller";
import { EXERCISES_REPOSITORY } from "./exercises.repository";
import { ExercisesService, REVIEW_SCHEDULER } from "./exercises.service";
import { HINT_REQUESTS_REPOSITORY } from "./hint-requests.repository";
import { HintsService } from "./hints.service";
import { PrismaHintRequestsRepository } from "./prisma-hint-requests.repository";
import { PrismaExercisesRepository } from "./prisma-exercises.repository";
import { UnitOpenGuard } from "./unit-open.guard";

/**
 * Laboratorio de código. `AuthModule` aporta el `JwtAuthGuard` y `SandboxModule`
 * el puerto `SANDBOX_SERVICE`. Hay dos puertos de persistencia inyectados por
 * token (`EXERCISES_REPOSITORY` y `HINT_REQUESTS_REPOSITORY`) para poder
 * sustituir Prisma por adaptadores en memoria en las pruebas; el segundo lo
 * consumen `HintsService` y `ExercisesService`.
 *
 * S7 añade `REVIEW_SCHEDULER`, que apunta al `ReviewService` exportado por
 * `ReviewModule`: el envío avisa del resultado corregido y el repaso decide la
 * fecha. La dependencia es en un solo sentido, así que no hay ciclo de módulos.
 */
@Module({
  imports: [PrismaModule, AuthModule, SandboxModule, ReviewModule, ProgressModule],
  controllers: [ExercisesController],
  providers: [
    ExercisesService,
    HintsService,
    UnitOpenGuard,
    { provide: EXERCISES_REPOSITORY, useClass: PrismaExercisesRepository },
    { provide: HINT_REQUESTS_REPOSITORY, useClass: PrismaHintRequestsRepository },
    { provide: REVIEW_SCHEDULER, useExisting: ReviewService },
  ],
  exports: [ExercisesService],
})
export class ExercisesModule {}
