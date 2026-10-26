import { Module } from "@nestjs/common";
import type { MiddlewareConsumer, NestModule } from "@nestjs/common";

import { TraceIdMiddleware } from "./common/trace/trace-id.middleware";
import { EnvModule } from "./config/env.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ContentModule } from "./modules/content/content.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [EnvModule, HealthModule, AuthModule, ContentModule],
  providers: [TraceIdMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceIdMiddleware).forRoutes("*");
  }
}
