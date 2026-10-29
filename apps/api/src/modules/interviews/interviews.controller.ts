import type {
  InterviewHistoryResponse,
  InterviewScenario,
  InterviewScenarioListQuery,
  InterviewScenarioListResponse,
  InterviewSession,
  InterviewTurnResponse,
  ReviewInterviewInput,
  SelfReviewInput,
  SendInterviewMessageInput,
  StartInterviewSessionInput,
} from "@codeai/shared";
import {
  interviewScenarioListQuerySchema,
  interviewScenarioParamsSchema,
  interviewSessionParamsSchema,
  reviewInterviewSchema,
  selfReviewSchema,
  sendInterviewMessageSchema,
  startInterviewSessionSchema,
} from "@codeai/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RateLimit } from "../../common/security/rate-limit.decorator";
import { RateLimitGuard } from "../../common/security/rate-limit.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AccessTokenPayload } from "../auth/token.service";
// Import de valor obligatorio: Nest resuelve `InterviewsService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InterviewsService } from "./interviews.service";

/** Catálogo y ciclo de la sesión: 120 peticiones por minuto y usuario. */
const INTERVIEWS_LIMIT = { limit: 120, windowMs: 60_000, keyFromUser: true };

/**
 * Turnos: 120 por hora. El tope real es 40 por sesión y lo impone el servicio
 * con `429 TURN_LIMIT_REACHED`; esta cuota sólo frena ráfagas entre sesiones.
 */
const TURN_LIMIT = { limit: 120, windowMs: 3_600_000, keyFromUser: true };

/**
 * Entrevistas (`contratos-api.md` §4.12).
 *
 * Todo pasa por `JwtAuthGuard`: el `userId` sale del token, nunca del cuerpo ni
 * de la ruta. `sessions/me` se declara **antes** de `sessions/:id` para que Nest
 * no interprete `me` como un identificador. Sólo la revisión exige rol.
 */
@ApiTags("interviews")
@Controller("interviews")
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get("scenarios")
  @RateLimit(INTERVIEWS_LIMIT)
  async listScenarios(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(interviewScenarioListQuerySchema))
    query: InterviewScenarioListQuery,
  ): Promise<InterviewScenarioListResponse> {
    return this.interviews.listScenarios(user.sub, query, user.role);
  }

  @Get("scenarios/:slug")
  @RateLimit(INTERVIEWS_LIMIT)
  async getScenario(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(interviewScenarioParamsSchema))
    params: { slug: string },
  ): Promise<InterviewScenario> {
    return this.interviews.getScenario(user.sub, params.slug, user.role);
  }

  @Post("sessions")
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(INTERVIEWS_LIMIT)
  async startSession(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(startInterviewSessionSchema))
    body: StartInterviewSessionInput,
  ): Promise<InterviewSession> {
    return this.interviews.startSession(user.sub, body, user.role);
  }

  /** Antes de `sessions/:id`: si no, `me` se leería como id. */
  @Get("sessions/me")
  @RateLimit(INTERVIEWS_LIMIT)
  async history(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<InterviewHistoryResponse> {
    return this.interviews.getHistory(user.sub);
  }

  @Get("sessions/:id")
  @RateLimit(INTERVIEWS_LIMIT)
  async getSession(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(interviewSessionParamsSchema))
    params: { id: string },
  ): Promise<InterviewSession> {
    return this.interviews.getSession(
      { id: user.sub, role: user.role },
      params.id,
    );
  }

  @Post("sessions/:id/messages")
  @HttpCode(HttpStatus.OK)
  @RateLimit(TURN_LIMIT)
  async sendMessage(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(interviewSessionParamsSchema))
    params: { id: string },
    @Body(new ZodValidationPipe(sendInterviewMessageSchema))
    body: SendInterviewMessageInput,
  ): Promise<InterviewTurnResponse> {
    return this.interviews.sendMessage(user.sub, params.id, body);
  }

  @Post("sessions/:id/finish")
  @HttpCode(HttpStatus.OK)
  @RateLimit(INTERVIEWS_LIMIT)
  async finishSession(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(interviewSessionParamsSchema))
    params: { id: string },
  ): Promise<InterviewSession> {
    return this.interviews.finishSession(user.sub, params.id);
  }

  @Post("sessions/:id/self-review")
  @HttpCode(HttpStatus.OK)
  @RateLimit(INTERVIEWS_LIMIT)
  async selfReview(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(interviewSessionParamsSchema))
    params: { id: string },
    @Body(new ZodValidationPipe(selfReviewSchema))
    body: SelfReviewInput,
  ): Promise<InterviewSession> {
    return this.interviews.selfReview(user.sub, params.id, body);
  }

  @Post("sessions/:id/review")
  @HttpCode(HttpStatus.OK)
  @RateLimit(INTERVIEWS_LIMIT)
  @Roles("INSTRUCTOR", "ADMIN")
  @UseGuards(RolesGuard)
  async review(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(interviewSessionParamsSchema))
    params: { id: string },
    @Body(new ZodValidationPipe(reviewInterviewSchema))
    body: ReviewInterviewInput,
  ): Promise<InterviewSession> {
    return this.interviews.review(
      { id: user.sub, role: user.role },
      params.id,
      body,
    );
  }
}
