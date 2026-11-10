import {
  certificationCodeSchema,
  registerRealResultSchema,
  startExamAttemptSchema,
  updateExamItemSchema,
} from "@codeai/shared";
import type {
  ExamAttemptResponse,
  ExamHistoryResponse,
  ExamItemUpdateResponse,
  ExamReadinessResponse,
  ExamResultResponse,
  RealResultResponse,
  RegisterRealResultInput,
  StartExamAttemptInput,
  UpdateExamItemInput,
} from "@codeai/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RateLimit } from "../../common/security/rate-limit.decorator";
import { RateLimitGuard } from "../../common/security/rate-limit.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AccessTokenPayload } from "../auth/token.service";
// Import de valor obligatorio: Nest resuelve `ExamsService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ExamsService } from "./exams.service";

/** 120 peticiones por minuto y usuario. */
const EXAMS_LIMIT = { limit: 120, windowMs: 60_000, keyFromUser: true };

/** 10 simulacros nuevos por hora y usuario. */
const START_LIMIT = { limit: 10, windowMs: 3_600_000, keyFromUser: true };

const certificationParamsSchema = z.object({ certification: certificationCodeSchema });

const attemptParamsSchema = z.object({ id: z.string().min(1) });

const itemParamsSchema = z.object({
  id: z.string().min(1),
  position: z.coerce.number().int().min(1),
});

type CertificationParams = z.infer<typeof certificationParamsSchema>;
type AttemptParams = z.infer<typeof attemptParamsSchema>;
type ItemParams = z.infer<typeof itemParamsSchema>;

/**
 * Simulador de examen de certificación (S15). Todo el controlador está detrás de
 * `JwtAuthGuard` y el `userId` sale del token: el cliente no elige de quién es un
 * intento. Las rutas de `attempts/*` se declaran antes de `:certification/*`.
 */
@ApiTags("exams")
@Controller("exams")
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get("attempts/:id")
  @RateLimit(EXAMS_LIMIT)
  async getAttempt(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(attemptParamsSchema)) params: AttemptParams,
  ): Promise<ExamAttemptResponse> {
    return { attempt: await this.exams.get(user.sub, params.id) };
  }

  @Put("attempts/:id/items/:position")
  @RateLimit(EXAMS_LIMIT)
  async updateItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(itemParamsSchema)) params: ItemParams,
    @Body(new ZodValidationPipe(updateExamItemSchema)) body: UpdateExamItemInput,
  ): Promise<ExamItemUpdateResponse> {
    return this.exams.updateItem(user.sub, params.id, params.position, body);
  }

  @Post("attempts/:id/submit")
  @RateLimit(EXAMS_LIMIT)
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(attemptParamsSchema)) params: AttemptParams,
  ): Promise<ExamResultResponse> {
    return { result: await this.exams.submit(user.sub, params.id) };
  }

  @Get("attempts/:id/result")
  @RateLimit(EXAMS_LIMIT)
  async getResult(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(attemptParamsSchema)) params: AttemptParams,
  ): Promise<ExamResultResponse> {
    return { result: await this.exams.result(user.sub, params.id) };
  }

  @Post(":certification/attempts")
  @RateLimit(START_LIMIT)
  @HttpCode(HttpStatus.CREATED)
  async start(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(certificationParamsSchema)) params: CertificationParams,
    @Body(new ZodValidationPipe(startExamAttemptSchema)) body: StartExamAttemptInput,
  ): Promise<ExamAttemptResponse> {
    return { attempt: await this.exams.start(user.sub, params.certification, body) };
  }

  @Get(":certification/history")
  @RateLimit(EXAMS_LIMIT)
  async history(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(certificationParamsSchema)) params: CertificationParams,
  ): Promise<ExamHistoryResponse> {
    return { attempts: await this.exams.history(user.sub, params.certification) };
  }

  @Get(":certification/readiness")
  @RateLimit(EXAMS_LIMIT)
  async readiness(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(certificationParamsSchema)) params: CertificationParams,
  ): Promise<ExamReadinessResponse> {
    return { readiness: await this.exams.readiness(user.sub, params.certification) };
  }

  @Post(":certification/real-results")
  @RateLimit(EXAMS_LIMIT)
  @HttpCode(HttpStatus.CREATED)
  async registerRealResult(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(certificationParamsSchema)) params: CertificationParams,
    @Body(new ZodValidationPipe(registerRealResultSchema)) body: RegisterRealResultInput,
  ): Promise<RealResultResponse> {
    return {
      realResult: await this.exams.registerRealResult(user.sub, params.certification, body),
    };
  }
}
