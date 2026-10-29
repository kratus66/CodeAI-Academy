import { Module } from "@nestjs/common";
import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { TraceInterceptor } from "./common/interceptors/trace.interceptor";
import { TraceIdMiddleware } from "./common/trace/trace-id.middleware";
import { EnvModule } from "./config/env.module";
import { AiModule } from "./modules/ai/ai.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ContentModule } from "./modules/content/content.module";
import { ExercisesModule } from "./modules/exercises/exercises.module";
import { HealthModule } from "./modules/health/health.module";
import { InterviewsModule } from "./modules/interviews/interviews.module";
import { ProgressModule } from "./modules/progress/progress.module";
import { ProjectsModule } from "./modules/projects/projects.module";
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
    ProjectsModule,
    AiModule,
    InterviewsModule,
    AnalyticsModule,
  ],
  providers: [
    TraceIdMiddleware,
    // APP_INTERCEPTOR permite inyectar `ENV` (LOG_LEVEL) sin leer `process.env`.
    { provide: APP_INTERCEPTOR, useClass: TraceInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceIdMiddleware).forRoutes("*");
  }
}
