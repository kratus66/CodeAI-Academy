import { updateProfileSchema, userListQuerySchema } from "@codeai/shared";
import type {
  UpdateProfileInput,
  UserListQuery,
  UserListResponse,
  UserProfileResponse,
} from "@codeai/shared";
import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AccessTokenPayload } from "../auth/token.service";
// Import de valor obligatorio: Nest resuelve `UsersService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UsersService } from "./users.service";

/**
 * Perfil y preferencias (`contratos-api.md` §4.10).
 *
 * Todo el controlador está detrás de `JwtAuthGuard`: el `userId` sale del token
 * y nunca de la ruta ni del cuerpo. Solo `GET /api/users` es global, y exige
 * rol `ADMIN` mediante `RolesGuard`.
 */
@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  async getProfile(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<UserProfileResponse> {
    return { user: await this.users.getProfile(user.sub) };
  }

  /** Devuelve el perfil completo: el cliente refresca su copia con la respuesta. */
  @Patch("me")
  async updateProfile(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<UserProfileResponse> {
    return { user: await this.users.updateProfile(user.sub, body) };
  }

  @Get()
  @Roles("ADMIN")
  @UseGuards(RolesGuard)
  async listUsers(
    @Query(new ZodValidationPipe(userListQuerySchema)) query: UserListQuery,
  ): Promise<UserListResponse> {
    return this.users.listUsers(query);
  }
}
