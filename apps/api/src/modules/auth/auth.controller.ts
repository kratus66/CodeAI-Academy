import { loginSchema, registerSchema } from "@codeai/shared";
import type { LoginInput, RegisterInput, UserResponse } from "@codeai/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RateLimit } from "../../common/security/rate-limit.decorator";
import { RateLimitGuard } from "../../common/security/rate-limit.guard";
import type { Env } from "../../config/env";
import { ENV } from "../../config/env.module";
import {
  REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
  readCookie,
  setSessionCookies,
} from "./auth.cookies";
import type { AuthSession } from "./auth.service";
// Import de valor obligatorio: Nest resuelve `AuthService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AccessTokenPayload } from "./token.service";

/** Límites de `contratos-api.md` §6. */
const LOGIN_LIMIT = { limit: 5, windowMs: 15 * 60_000, keyFromBody: "email" };
const REGISTER_LIMIT = { limit: 3, windowMs: 60 * 60_000 };

@ApiTags("auth")
@Controller("auth")
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post("register")
  @RateLimit(REGISTER_LIMIT)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    return this.respondWithSession(response, await this.auth.register(body));
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @RateLimit(LOGIN_LIMIT)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    return this.respondWithSession(response, await this.auth.login(body));
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const session = await this.auth.refresh(this.refreshTokenOf(request));

    return this.respondWithSession(response, session);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.refreshTokenOf(request));
    clearSessionCookies(response, this.env);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AccessTokenPayload): Promise<UserResponse> {
    return { user: await this.auth.getCurrentUser(user.sub) };
  }

  /** Emite cookies httpOnly y devuelve solo el usuario público. */
  private respondWithSession(
    response: Response,
    session: AuthSession,
  ): UserResponse {
    setSessionCookies(response, this.env, session);

    return { user: session.user };
  }

  private refreshTokenOf(request: Request): string | undefined {
    return readCookie(request.headers.cookie, REFRESH_TOKEN_COOKIE);
  }
}
