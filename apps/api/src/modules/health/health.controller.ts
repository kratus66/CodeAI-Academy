import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { HealthResponse } from "@codeai/shared";

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
}
