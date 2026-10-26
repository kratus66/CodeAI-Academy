import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { ContentController } from "./content.controller";
import { CONTENT_REPOSITORY } from "./content.repository";
import { ContentService } from "./content.service";
import { PrismaContentRepository } from "./prisma-content.repository";

/**
 * Currículo público de solo lectura. El puerto `ContentRepository` se inyecta
 * por token para que las pruebas cambien Prisma por el adaptador en memoria sin
 * tocar el controlador ni el servicio.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ContentController],
  providers: [
    ContentService,
    { provide: CONTENT_REPOSITORY, useClass: PrismaContentRepository },
  ],
  exports: [ContentService],
})
export class ContentModule {}
