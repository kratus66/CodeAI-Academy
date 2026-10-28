import type {
  AiExplainErrorRequest,
  AiExplainErrorResponse,
  AiTutorInput,
  AiTutorResponse,
  AiUsageResponse,
} from "@codeai/shared";
import { aiExplainErrorRequestSchema, aiTutorRequestSchema } from "@codeai/shared";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RateLimit } from "../../common/security/rate-limit.decorator";
import { RateLimitGuard } from "../../common/security/rate-limit.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AccessTokenPayload } from "../auth/token.service";
// Import de valor obligatorio: Nest resuelve `AiService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiService } from "./ai.service";

/** 30 mensajes por hora y estudiante (`contratos-api.md` §6): la cuota es por usuario, no por IP. */
const TUTOR_LIMIT = { limit: 30, windowMs: 3_600_000, keyFromUser: true };

/**
 * Capa de IA (`contratos-api.md` §4.7). Todo el controlador está detrás de
 * `JwtAuthGuard`: el `userId` sale del token, así que un estudiante no puede
 * leer el gasto ni el envío de otro. Las tres rutas responden `200`: la
 * degradación es una respuesta válida, nunca un `5xx`.
 */
@ApiTags("ai")
@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("tutor")
  @HttpCode(HttpStatus.OK)
  @RateLimit(TUTOR_LIMIT)
  // `JwtAuthGuard` (de clase) corre antes y `request.user` ya existe cuando
  // el limitador calcula la clave.
  @UseGuards(RateLimitGuard)
  async tutor(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(aiTutorRequestSchema)) body: AiTutorInput,
  ): Promise<AiTutorResponse> {
    return this.ai.tutor(user.sub, body);
  }

  @Post("explain-error")
  @HttpCode(HttpStatus.OK)
  async explainError(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(aiExplainErrorRequestSchema)) body: AiExplainErrorRequest,
  ): Promise<AiExplainErrorResponse> {
    return this.ai.explainError(user.sub, body.submissionId);
  }

  @Get("usage")
  async usage(@CurrentUser() user: AccessTokenPayload): Promise<AiUsageResponse> {
    return this.ai.getMonthlyUsage(user.sub);
  }
}
