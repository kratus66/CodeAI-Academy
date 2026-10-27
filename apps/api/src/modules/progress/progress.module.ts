import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ProgressController } from "./progress.controller";
import { PROGRESS_REPOSITORY } from "./progress.repository";
import { ProgressService } from "./progress.service";
import { PrismaProgressRepository } from "./prisma-progress.repository";

/**
 * Progreso por estudiante. El puerto `ProgressRepository` se inyecta por token
 * para que las pruebas cambien Prisma por el adaptador en memoria. `AuthModule`
 * aporta el `JwtAuthGuard` que protege todas las rutas.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProgressController],
  providers: [
    ProgressService,
    { provide: PROGRESS_REPOSITORY, useClass: PrismaProgressRepository },
  ],
  exports: [ProgressService],
})
export class ProgressModule {}
