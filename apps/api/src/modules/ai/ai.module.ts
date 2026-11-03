import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import type { Env } from "../../config/env";
import { ENV } from "../../config/env.module";
import { AuthModule } from "../auth/auth.module";
import { SandboxModule } from "../sandbox/sandbox.module";
import { AiController } from "./ai.controller";
import { ExerciseGeneratorService } from "./exercise-generator.service";
import { LabDraftVerifierService } from "./lab-draft-verifier.service";
import { AI_REPOSITORY } from "./ai.repository";
import { AI_CLOCK, AiService } from "./ai.service";
import type { AiProvider } from "./interfaces/ai-provider.interface";
import { AI_PROVIDER } from "./interfaces/ai-provider.interface";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { MockAiProvider } from "./providers/mock.provider";
import { OpenAiProvider } from "./providers/openai.provider";
import { PrismaAiRepository } from "./prisma-ai.repository";

/**
 * Capa de IA (`capa-ia.md`). El proveedor se elige por `AI_PROVIDER`: ningún
 * servicio ni controlador importa un adaptador concreto, sólo el puerto
 * `AI_PROVIDER`. `loadEnv` ya garantiza que `openai` trae `AI_API_KEY`.
 */
@Module({
  imports: [PrismaModule, AuthModule, SandboxModule],
  controllers: [AiController],
  providers: [
    AiService,
    ExerciseGeneratorService,
    LabDraftVerifierService,
    { provide: AI_REPOSITORY, useClass: PrismaAiRepository },
    { provide: AI_CLOCK, useValue: () => new Date() },
    {
      provide: AI_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env): AiProvider => {
        const config = {
          apiKey: env.AI_API_KEY ?? "",
          model: env.AI_MODEL,
          timeoutMs: env.AI_TIMEOUT_MS,
        };

        switch (env.AI_PROVIDER) {
          case "openai":
            return new OpenAiProvider(config);
          case "anthropic":
            return new AnthropicProvider(config);
          default:
            return new MockAiProvider();
        }
      },
    },
  ],
  exports: [AiService, ExerciseGeneratorService, LabDraftVerifierService],
})
export class AiModule {}
