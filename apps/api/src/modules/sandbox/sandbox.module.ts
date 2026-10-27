import { Module } from "@nestjs/common";

import type { Env } from "../../config/env";
import { ENV } from "../../config/env.module";
import { AuthModule } from "../auth/auth.module";
import { MockSandboxService } from "./mock-sandbox.service";
import { SandboxController, SandboxQuotaGuard } from "./sandbox.controller";
import type { SandboxService } from "./sandbox.service";
import { SANDBOX_SERVICE } from "./sandbox.service";

/**
 * Registra el adaptador del sandbox según `SANDBOX_MODE`.
 *
 * S5 sólo implementa `mock`: si el operador pide `subprocess` o `docker`, el
 * arranque falla con un mensaje explícito en vez de fingir que ejecuta código
 * (`sandbox-ejecucion.md` §3). El puerto se exporta para que `exercises` lo
 * inyecte sin conocer el adaptador.
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
        if (env.SANDBOX_MODE !== "mock") {
          throw new Error(
            `Variables de entorno inválidas → SANDBOX_MODE: ${env.SANDBOX_MODE} no tiene adaptador todavía; usa mock`,
          );
        }

        return new MockSandboxService();
      },
    },
  ],
  exports: [SANDBOX_SERVICE],
})
export class SandboxModule {}
