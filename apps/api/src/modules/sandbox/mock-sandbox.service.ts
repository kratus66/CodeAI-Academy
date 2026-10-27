import type { SandboxRunRequest, SandboxRunResponse, SandboxTestResult } from "@codeai/shared";
import { Injectable } from "@nestjs/common";

import type { SandboxService, SandboxStatus } from "./sandbox.service";

/**
 * Única señal que el mock interpreta: una marca `TODO` sin resolver. No ejecuta
 * código, así que no puede detectar nada más; la heurística es determinista para
 * que el CI no dependa de azar ni de reloj (`sandbox-ejecucion.md` §3).
 */
const UNRESOLVED_TODO = /\bTODO\b/i;

const TODO_MESSAGE = "La solución contiene un TODO sin resolver";

/** Duración fija: el mock no mira el reloj. */
const MOCK_DURATION_MS = 1;

/**
 * Adaptador `mock` del sandbox: responde en el proceso de la API sin ejecutar el
 * código del estudiante. Sirve para cerrar S5–S6 sin infraestructura; el
 * adaptador real debe cumplir el mismo contrato y el checklist de límites.
 */
@Injectable()
export class MockSandboxService implements SandboxService {
  status(): SandboxStatus {
    return { provider: "mock", mode: "mock" };
  }

  async run(request: SandboxRunRequest): Promise<SandboxRunResponse> {
    const offending = request.files.find((file) => UNRESOLVED_TODO.test(file.content));
    const failed = offending !== undefined;

    const results: SandboxTestResult[] = request.tests.map((test) => ({
      testId: test.id,
      passed: !failed,
      ...(failed ? { message: TODO_MESSAGE } : {}),
      durationMs: MOCK_DURATION_MS,
    }));

    return {
      outcome: failed ? "FAILED" : "PASSED",
      score: failed ? 0 : 100,
      results,
      stdout: "",
      stderr: offending ? `${TODO_MESSAGE} en ${offending.path}` : "",
      durationMs: MOCK_DURATION_MS,
    };
  }
}
