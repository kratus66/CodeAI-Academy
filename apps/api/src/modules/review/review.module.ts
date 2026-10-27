import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaReviewRepository } from "./prisma-review.repository";
import { ReviewController } from "./review.controller";
import { REVIEW_REPOSITORY } from "./review.repository";
import { REVIEW_CLOCK, ReviewService } from "./review.service";

/**
 * Repaso espaciado (`contratos-api.md` §4.5). `AuthModule` aporta el
 * `JwtAuthGuard`; el puerto `ReviewRepository` y el reloj se inyectan por token
 * para que las pruebas cambien Prisma y el tiempo. Exporta `ReviewService`
 * porque el envío de ejercicios (S7-T8) programa el repaso tras corregir.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReviewController],
  providers: [
    ReviewService,
    { provide: REVIEW_REPOSITORY, useClass: PrismaReviewRepository },
    { provide: REVIEW_CLOCK, useValue: () => new Date() },
  ],
  exports: [ReviewService],
})
export class ReviewModule {}
