import { Global, Module } from "@nestjs/common";

import type { Env } from "./env";
import { loadEnv } from "./env";

/** Token de inyección para la configuración validada. */
export const ENV = Symbol("ENV");

/** Publica `Env` como provider global: los servicios no leen `process.env`. */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: (): Env => loadEnv() }],
  exports: [ENV],
})
export class EnvModule {}
