import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { PasswordService } from "../../common/security/password.service";
import { RateLimitGuard } from "../../common/security/rate-limit.guard";
import { PrismaModule } from "../../database/prisma.module";
import { AUTH_REPOSITORY } from "./auth.repository";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PrismaAuthRepository } from "./prisma-auth.repository";
import { TokenService } from "./token.service";

/**
 * Identidad y sesión. El secreto JWT se pasa por firma (viene de `Env`), así que
 * `JwtModule` no necesita configuración global.
 */
@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    JwtAuthGuard,
    RolesGuard,
    RateLimitGuard,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
  ],
  exports: [AuthService, TokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
