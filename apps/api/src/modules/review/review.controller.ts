import type {
  ReviewAnswerInput,
  ReviewAnswerResult,
  ReviewQueueResponse,
} from "@codeai/shared";
import { reviewAnswerSchema } from "@codeai/shared";
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
// Import de valor obligatorio: Nest resuelve `ReviewService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewService } from "./review.service";

/** El id llega de la fila de Prisma; sólo se comprueba que no venga vacío. */
const reviewItemIdParamsSchema = z.object({
  id: z.string().min(1, "El ítem de repaso es obligatorio"),
});

type ReviewItemIdParams = z.infer<typeof reviewItemIdParamsSchema>;

/**
 * Repaso espaciado (`contratos-api.md` §4.5). Todo el controlador está detrás
 * de `JwtAuthGuard`: el `userId` de la cola y de las respuestas sale del token,
 * así que un estudiante no puede leer ni reprogramar el repaso de otro.
 */
@ApiTags("review")
@Controller("review")
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get("queue")
  async getQueue(@CurrentUser() user: AccessTokenPayload): Promise<ReviewQueueResponse> {
    return this.review.getQueue(user.sub);
  }

  /** `200` y no `201`: responder no crea un recurso, reprograma el ítem. */
  @Post("items/:id/answer")
  @HttpCode(HttpStatus.OK)
  async answer(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(reviewItemIdParamsSchema)) params: ReviewItemIdParams,
    @Body(new ZodValidationPipe(reviewAnswerSchema)) body: ReviewAnswerInput,
  ): Promise<ReviewAnswerResult> {
    return this.review.answer(user.sub, params.id, body);
  }
}
