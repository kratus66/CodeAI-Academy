import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { SandboxModule } from "../sandbox/sandbox.module";
import { ExercisesController } from "./exercises.controller";
import { EXERCISES_REPOSITORY } from "./exercises.repository";
import { ExercisesService } from "./exercises.service";
import { HINT_REQUESTS_REPOSITORY } from "./hint-requests.repository";
import { HintsService } from "./hints.service";
import { PrismaHintRequestsRepository } from "./prisma-hint-requests.repository";
import { PrismaExercisesRepository } from "./prisma-exercises.repository";

/**
 * Laboratorio de código. `AuthModule` aporta el `JwtAuthGuard` y `SandboxModule`
 * el puerto `SANDBOX_SERVICE`. Hay dos puertos de persistencia inyectados por
 * token (`EXERCISES_REPOSITORY` y `HINT_REQUESTS_REPOSITORY`) para poder
 * sustituir Prisma por adaptadores en memoria en las pruebas; el segundo lo
 * consumen `HintsService` y `ExercisesService`.
 */
@Module({
  imports: [PrismaModule, AuthModule, SandboxModule],
  controllers: [ExercisesController],
  providers: [
    ExercisesService,
    HintsService,
    { provide: EXERCISES_REPOSITORY, useClass: PrismaExercisesRepository },
    { provide: HINT_REQUESTS_REPOSITORY, useClass: PrismaHintRequestsRepository },
  ],
  exports: [ExercisesService],
})
export class ExercisesModule {}
