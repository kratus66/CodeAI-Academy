import { Module } from "@nestjs/common";

import type { Env } from "../../config/env";
import { ENV } from "../../config/env.module";
import { AuthModule } from "../auth/auth.module";
import { DockerSandboxService } from "./docker-sandbox.service";
import { MockSandboxService } from "./mock-sandbox.service";
import { SandboxController, SandboxQuotaGuard } from "./sandbox.controller";
import type { SandboxService } from "./sandbox.service";
import { SANDBOX_SERVICE } from "./sandbox.service";

/**
 * Registra el adaptador del sandbox según `SANDBOX_MODE`.
 *
 * `mock` sirve al desarrollo y al CI; `docker` es el único modo que ejecuta de
 * verdad y el único que `env.ts` acepta con `NODE_ENV=production`. `subprocess`
 * sigue sin adaptador a propósito (`sandbox-ejecucion.md` §3): si el operador lo
 * pide, el arranque falla con un mensaje explícito en vez de fingir aislamiento.
 * El puerto se exporta para que `exercises` lo inyecte sin conocer el adaptador.
 */
@Module({
  imports: [AuthModule],
  controllers: [SandboxController],
  providers: [
    SandboxQuotaGuard,
    {
      provide: SANDBOX_SERVICE,
      inject: [ENV],
      useFactory: (env: Env): SandboxService => {
        if (env.SANDBOX_MODE === "mock") {
          return new MockSandboxService();
        }

        if (env.SANDBOX_MODE === "docker") {
          return new DockerSandboxService();
        }

        throw new Error(
          `Variables de entorno inválidas → SANDBOX_MODE: ${env.SANDBOX_MODE} no tiene adaptador todavía; usa mock o docker`,
        );
      },
    },
  ],
  exports: [SANDBOX_SERVICE],
})
export class SandboxModule {}
