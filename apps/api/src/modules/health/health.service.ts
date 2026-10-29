import { Injectable } from "@nestjs/common";
import type { HealthResponse, ReadinessResponse } from "@codeai/shared";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";

const SERVICE_NAME = "codeai-api" as const;
const DEFAULT_VERSION = "0.1.0";
/** `§3.5`: si la base no responde en 2 s, el proceso no puede atender. */
export const READINESS_TIMEOUT_MS = 2_000;

/** Carrera entre la consulta y el reloj; el temporizador siempre se limpia. */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("readiness timeout")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: SERVICE_NAME,
      version: process.env.APP_VERSION || DEFAULT_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * `ready` comprueba la base con un `SELECT 1` acotado. Nunca propaga el
   * mensaje del motor ni la cadena de conexión: sólo `ok` y `latencyMs`.
   */
  async getReadiness(): Promise<ReadinessResponse> {
    const startedAt = Date.now();
    let ok = false;

    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, READINESS_TIMEOUT_MS);
      ok = true;
    } catch {
      ok = false;
    }

    return {
      status: ok ? "ready" : "degraded",
      checks: [
        {
          name: "database",
          ok,
          latencyMs: Math.max(0, Date.now() - startedAt),
        },
      ],
      version: process.env.APP_VERSION || DEFAULT_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}
