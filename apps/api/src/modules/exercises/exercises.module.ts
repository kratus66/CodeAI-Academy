import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { SandboxModule } from "../sandbox/sandbox.module";
import { ExercisesController } from "./exercises.controller";
import { EXERCISES_REPOSITORY } from "./exercises.repository";
import { ExercisesService } from "./exercises.service";
import { PrismaExercisesRepository } from "./prisma-exercises.repository";

/**
 * Laboratorio de código. `AuthModule` aporta el `JwtAuthGuard` y `SandboxModule`
 * el puerto `SANDBOX_SERVICE`; el repositorio se inyecta por token para poder
 * sustituir Prisma por el adaptador en memoria en las pruebas.
 */
@Module({
  imports: [PrismaModule, AuthModule, SandboxModule],
  controllers: [ExercisesController],
  providers: [
    ExercisesService,
    { provide: EXERCISES_REPOSITORY, useClass: PrismaExercisesRepository },
  ],
  exports: [ExercisesService],
})
export class ExercisesModule {}
