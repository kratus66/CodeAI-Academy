import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AiModule } from "../ai/ai.module";
// Import de valor obligatorio: `useExisting` necesita la clase, no sólo el tipo.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiService } from "../ai/ai.service";
import { AuthModule } from "../auth/auth.module";
import { PrismaInterviewRepository } from "./prisma-interview.repository";
import { INTERVIEW_AI } from "./interview-ai.port";
import { INTERVIEWS_REPOSITORY } from "./interview.repository";
import { InterviewsController } from "./interviews.controller";
import { INTERVIEWS_CLOCK, InterviewsService } from "./interviews.service";

/**
 * Entrevistas (`arquitectura-general.md` §5 y `sprint-10-entrevistas.md`).
 *
 * `INTERVIEWS_REPOSITORY` se sustituye por el adaptador en memoria en las
 * pruebas y `INTERVIEWS_CLOCK` mantiene las fechas fuera del servicio. El turno
 * usa `AiService` de S8 a través de `INTERVIEW_AI`: presupuesto, auditoría,
 * filtro de fuga y degradación viven allí, no aquí.
 */
@Module({
  imports: [PrismaModule, AuthModule, AiModule],
  controllers: [InterviewsController],
  providers: [
    InterviewsService,
    { provide: INTERVIEWS_REPOSITORY, useClass: PrismaInterviewRepository },
    { provide: INTERVIEWS_CLOCK, useValue: () => new Date() },
    { provide: INTERVIEW_AI, useExisting: AiService },
  ],
  exports: [InterviewsService],
})
export class InterviewsModule {}
