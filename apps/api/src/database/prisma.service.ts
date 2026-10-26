import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
// Import de valor obligatorio: `PrismaClient` se usa como clase base.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma con el ciclo de vida atado al de Nest: conecta al arrancar y
 * desconecta al apagar para no dejar conexiones colgadas.
 *
 * `enableShutdownHooks` no se usa a propósito: el apagado se gestiona con
 * `onModuleDestroy`, que también se ejecuta en pruebas.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
