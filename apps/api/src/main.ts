import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/errors/all-exceptions.filter";
import { loadEnv, loadEnvFile } from "./config/env";

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("CodeAI Academy API")
      .setDescription(
        "Contratos REST de la plataforma. Formato de error único documentado en docs/03-arquitectura/contratos-api.md.",
      )
      .setVersion(env.APP_VERSION)
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  await app.listen(env.PORT);
  Logger.log(
    `API escuchando en http://localhost:${env.PORT}/api`,
    "Bootstrap",
  );
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    "No se pudo iniciar la API",
    error instanceof Error ? error.stack : String(error),
    "Bootstrap",
  );
  process.exitCode = 1;
});
