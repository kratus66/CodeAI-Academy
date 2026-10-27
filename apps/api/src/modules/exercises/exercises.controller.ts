import type {
  CreateSubmissionInput,
  ExerciseDetailResponse,
  ExerciseListQuery,
  ExerciseListResponse,
  HintRequestInput,
  HintResponseEnvelope,
  SubmissionListResponse,
  SubmissionResponse,
  UnitCodeParams,
} from "@codeai/shared";
import {
  createSubmissionSchema,
  exerciseListQuerySchema,
  hintRequestSchema,
  unitCodeParamsSchema,
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
import { z } from "zod";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AccessTokenPayload } from "../auth/token.service";
// Import de valor obligatorio: Nest resuelve `ExercisesService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ExercisesService } from "./exercises.service";
// Import de valor obligatorio: Nest resuelve `HintsService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HintsService } from "./hints.service";

/** El id llega de la fila de Prisma; sólo se comprueba que no venga vacío. */
const exerciseIdParamsSchema = z.object({
  id: z.string().min(1, "El ejercicio es obligatorio"),
});

type ExerciseIdParams = z.infer<typeof exerciseIdParamsSchema>;

/**
 * Laboratorio de código y pistas (`contratos-api.md` §4.3). Todo el controlador está
 * detrás de `JwtAuthGuard` y el `userId` de los envíos sale del token: el
 * cliente nunca elige de quién es un envío ni puede leer el de otro.
 *
 * `GET units/:code` se declara antes de `GET :id` para que Nest no interprete
 * `units` como un identificador, y el parámetro se llama `code` para validarlo
 * con el `unitCodeParamsSchema` de `@codeai/shared` sin duplicar la expresión
 * regular del código de unidad.
 */
@ApiTags("exercises")
@Controller("exercises")
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(
    private readonly exercises: ExercisesService,
    private readonly hints: HintsService,
  ) {}

  @Get("units/:code")
  async listByUnit(
    @Param(new ZodValidationPipe(unitCodeParamsSchema)) params: UnitCodeParams,
    @Query(new ZodValidationPipe(exerciseListQuerySchema)) query: ExerciseListQuery,
  ): Promise<ExerciseListResponse> {
    return this.exercises.listByUnit(params.code, query);
  }

  @Get(":id")
  async getDetail(
    @Param(new ZodValidationPipe(exerciseIdParamsSchema)) params: ExerciseIdParams,
  ): Promise<ExerciseDetailResponse> {
    return this.exercises.getDetail(params.id);
  }

  @Get(":id/submissions")
  async listSubmissions(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(exerciseIdParamsSchema)) params: ExerciseIdParams,
    @Query(new ZodValidationPipe(exerciseListQuerySchema)) query: ExerciseListQuery,
  ): Promise<SubmissionListResponse> {
    return this.exercises.listSubmissions(user.sub, params.id, query);
  }

  @Post(":id/submissions")
  async submit(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(exerciseIdParamsSchema)) params: ExerciseIdParams,
    @Body(new ZodValidationPipe(createSubmissionSchema)) body: CreateSubmissionInput,
  ): Promise<SubmissionResponse> {
    return this.exercises.submit(user.sub, params.id, body);
  }

  /**
   * La pista se sirve con el `userId` del token; el cuerpo sólo lleva `level`
   * y la respuesta nunca incluye la solución.
   */
  @Post(":id/hints")
  @HttpCode(HttpStatus.CREATED)
  async requestHint(
    @CurrentUser() user: AccessTokenPayload,
    @Param(new ZodValidationPipe(exerciseIdParamsSchema)) params: ExerciseIdParams,
    @Body(new ZodValidationPipe(hintRequestSchema)) body: HintRequestInput,
  ): Promise<HintResponseEnvelope> {
    return this.hints.requestHint(user.sub, params.id, body);
  }
}
