import type { CompetencyProgress, ProgressOverview, UnitProgressSummary } from "@codeai/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AccessTokenPayload } from "../auth/token.service";
// Import de valor obligatorio: Nest resuelve `ProgressService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProgressService } from "./progress.service";

/**
 * Cuerpo de `complete-lesson`. El contrato §4.4 fija la ruta y la respuesta,
 * pero no publica el cuerpo: se valida aquí para responder `400` antes de tocar
 * la base, y se comparte con la web a través del tipo exportado.
 */
const completeLessonBodySchema = z.object({
  lessonId: z
    .string({ required_error: "La lección es obligatoria", invalid_type_error: "La lección debe ser un identificador" })
    .min(1, "La lección es obligatoria"),
});

type CompleteLessonBody = z.infer<typeof completeLessonBodySchema>;

const unitIdParamsSchema = z.object({
  id: z.string().min(1, "La unidad es obligatoria"),
});

type UnitIdParams = z.infer<typeof unitIdParamsSchema>;

/**
 * Progreso del estudiante autenticado (`contratos-api.md` §4.4). Todo el
 * controlador está detrás de `JwtAuthGuard`: el `userId` sale del token y nunca
 * de la ruta ni del cuerpo, así que un estudiante no puede leer ni escribir el
 * progreso de otro.
 */
@ApiTags("progress")
@Controller("progress")
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get("overview")
  async getOverview(@CurrentUser() user: AccessTokenPayload): Promise<ProgressOverview> {
    return this.progress.getOverview(user.sub);
  }

  @Get("units")
  async listUnits(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<{ units: UnitProgressSummary[] }> {
    return { units: await this.progress.listUnits(user.sub) };
  }

  @Get("competencies")
  async listCompetencies(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<{ competencies: CompetencyProgress[] }> {
    return { competencies: await this.progress.listCompetencies(user.sub) };
  }

  /** Idempotente: repetir la misma lección no cambia el porcentaje. */
  @Post("units/:id/complete-lesson")
  @HttpCode(HttpStatus.OK)
  async completeLesson(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(unitIdParamsSchema)) params: UnitIdParams,
    @Body(new ZodValidationPipe(completeLessonBodySchema)) body: CompleteLessonBody,
  ): Promise<{ unit: UnitProgressSummary }> {
    return {
      unit: await this.progress.completeLesson(user.sub, params.id, body.lessonId),
    };
  }
}
