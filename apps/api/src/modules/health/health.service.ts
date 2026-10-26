import { Injectable } from "@nestjs/common";
import type { HealthResponse } from "@codeai/shared";

const SERVICE_NAME = "codeai-api" as const;
const DEFAULT_VERSION = "0.1.0";

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: SERVICE_NAME,
      version: process.env.APP_VERSION || DEFAULT_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
