import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ProgressModule } from "../progress/progress.module";
import { PortfolioController } from "./portfolio.controller";
import { PrismaProjectsRepository } from "./prisma-project.repository";
import { PROJECTS_REPOSITORY } from "./project.repository";
import { ProjectsController } from "./projects.controller";
import { PROJECTS_CLOCK, ProjectsService } from "./projects.service";

/**
 * Proyectos, rúbricas y portafolio (`arquitectura-general.md` §5).
 *
 * El puerto `ProjectsRepository` se inyecta por token para que las pruebas lo
 * sustituyan por el adaptador en memoria, y `PROJECTS_CLOCK` mantiene las
 * fechas de entrega y publicación fuera del servicio. `AuthModule` aporta
 * `JwtAuthGuard` y `RolesGuard`.
 */
@Module({
  imports: [PrismaModule, AuthModule, ProgressModule],
  controllers: [ProjectsController, PortfolioController],
  providers: [
    ProjectsService,
    { provide: PROJECTS_REPOSITORY, useClass: PrismaProjectsRepository },
    { provide: PROJECTS_CLOCK, useValue: () => new Date() },
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
