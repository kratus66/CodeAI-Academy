import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { HealthResponse, ReadinessResponse } from "@codeai/shared";
import type { Response } from "express";

// Import de valor a propósito: Nest resuelve la dependencia con
// `design:paramtypes`. Con `import type`, TypeScript emitiría `Object` y la
// inyección fallaría en tiempo de ejecución.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Estado del servicio" })
  @ApiOkResponse({ description: "La API está operativa" })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  /**
   * `GET /api/health/ready`: `200` si la base responde dentro del timeout y
   * `503` con el mismo cuerpo si no. No pasa por el filtro de errores porque la
   * respuesta de `503` también es el contrato de readiness.
   */
  @Get("ready")
  @ApiOperation({ summary: "Estado de las dependencias" })
  @ApiOkResponse({ description: "La API puede atender peticiones" })
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessResponse> {
    const readiness = await this.healthService.getReadiness();

    response.status(
      readiness.status === "ready"
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return readiness;
  }
}
