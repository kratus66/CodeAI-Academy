import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import {
  CONTENT_CACHE_TTL_MS,
  ContentCache,
  DEFAULT_CONTENT_CACHE_TTL_MS,
} from "./content-cache";
import { ContentController } from "./content.controller";
import { CONTENT_REPOSITORY } from "./content.repository";
import { ContentService } from "./content.service";
import { PrismaContentRepository } from "./prisma-content.repository";

/**
 * Currículo público de solo lectura. El puerto `ContentRepository` se inyecta
 * por token para que las pruebas cambien Prisma por el adaptador en memoria sin
 * tocar el controlador ni el servicio. `ContentCache` es un singleton del
 * módulo: comparte versión e invalidación entre todas las lecturas.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ContentController],
  providers: [
    ContentService,
    ContentCache,
    { provide: CONTENT_CACHE_TTL_MS, useValue: DEFAULT_CONTENT_CACHE_TTL_MS },
    { provide: CONTENT_REPOSITORY, useClass: PrismaContentRepository },
  ],
  exports: [ContentService],
})
export class ContentModule {}
