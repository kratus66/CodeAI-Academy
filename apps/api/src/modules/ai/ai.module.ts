import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import type { Env } from "../../config/env";
import { ENV } from "../../config/env.module";
import { AuthModule } from "../auth/auth.module";
import { AiController } from "./ai.controller";
import { AI_REPOSITORY } from "./ai.repository";
import { AI_CLOCK, AiService } from "./ai.service";
import type { AiProvider } from "./interfaces/ai-provider.interface";
import { AI_PROVIDER } from "./interfaces/ai-provider.interface";
import { MockAiProvider } from "./providers/mock.provider";
import { OpenAiProvider } from "./providers/openai.provider";
import { PrismaAiRepository } from "./prisma-ai.repository";

/**
 * Capa de IA (`capa-ia.md`). El proveedor se elige por `AI_PROVIDER`: ningún
 * servicio ni controlador importa un adaptador concreto, sólo el puerto
 * `AI_PROVIDER`. `loadEnv` ya garantiza que `openai` trae `AI_API_KEY`.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiController],
  providers: [
    AiService,
    { provide: AI_REPOSITORY, useClass: PrismaAiRepository },
    { provide: AI_CLOCK, useValue: () => new Date() },
    {
      provide: AI_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env): AiProvider =>
        env.AI_PROVIDER === "openai"
          ? new OpenAiProvider({
              apiKey: env.AI_API_KEY ?? "",
              model: env.AI_MODEL,
              timeoutMs: env.AI_TIMEOUT_MS,
            })
          : new MockAiProvider(),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
