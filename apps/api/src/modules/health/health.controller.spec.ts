import { healthResponseSchema } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  const controller = new HealthController(new HealthService());

  it("devuelve una respuesta válida contra el contrato compartido", () => {
    const response = controller.getHealth();
    const parsed = healthResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    expect(response.status).toBe("ok");
    expect(response.service).toBe("codeai-api");
  });

  it("reporta un uptime no negativo", () => {
    expect(controller.getHealth().uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
