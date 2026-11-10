import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ReviewModule } from "../review/review.module";
import { EXAMS_CLOCK, EXAMS_RANDOM, EXAMS_REPOSITORY } from "./exams.repository";
import { ExamsService } from "./exams.service";
import { PrismaExamsRepository } from "./prisma-exams.repository";

/**
 * Simulador de examen (S15). El puerto, el reloj y el azar se inyectan por token
 * para que las pruebas los sustituyan. `ReviewModule` aporta `ReviewService`,
 * que programa el repaso de las preguntas falladas. Sin controlador todavía (T8).
 */
@Module({
  imports: [PrismaModule, AuthModule, ReviewModule],
  providers: [
    ExamsService,
    { provide: EXAMS_REPOSITORY, useClass: PrismaExamsRepository },
    { provide: EXAMS_CLOCK, useValue: () => new Date() },
    { provide: EXAMS_RANDOM, useValue: Math.random },
  ],
  exports: [ExamsService],
})
export class ExamsModule {}
