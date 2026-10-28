import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { PrismaUsersRepository } from "./prisma-users.repository";
import { USERS_REPOSITORY } from "./users.repository";
import { UsersService } from "./users.service";

/**
 * Perfil, preferencias y listado de administración (`arquitectura-general.md` §5).
 *
 * El puerto `UsersRepository` se inyecta por token para que las pruebas
 * sustituyan Prisma por el adaptador en memoria; `AuthModule` aporta el
 * `JwtAuthGuard` y el `RolesGuard` que protegen las rutas.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
  ],
  exports: [UsersService],
})
export class UsersModule {}
