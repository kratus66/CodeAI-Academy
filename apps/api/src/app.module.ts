import { Module } from "@nestjs/common";
import type { MiddlewareConsumer, NestModule } from "@nestjs/common";

import { TraceIdMiddleware } from "./common/trace/trace-id.middleware";
import { EnvModule } from "./config/env.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ContentModule } from "./modules/content/content.module";
import { ExercisesModule } from "./modules/exercises/exercises.module";
import { HealthModule } from "./modules/health/health.module";
import { ProgressModule } from "./modules/progress/progress.module";
import { ReviewModule } from "./modules/review/review.module";
import { SandboxModule } from "./modules/sandbox/sandbox.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    EnvModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ContentModule,
    ProgressModule,
    SandboxModule,
    ExercisesModule,
    ReviewModule,
  ],
  providers: [TraceIdMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceIdMiddleware).forRoutes("*");
  }
}
