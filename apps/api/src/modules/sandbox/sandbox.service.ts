import type { SandboxRunRequest, SandboxRunResponse } from "@codeai/shared";

/**
 * Puerto del sandbox (`sandbox-ejecucion.md` §3 y §8). Ningún módulo importa un
 * runtime concreto: S5 sólo registra el adaptador `mock` y el real llegará con
 * el checklist de límites del §9 sin cambiar este contrato.
 */
export const SANDBOX_SERVICE = Symbol("SANDBOX_SERVICE");

/** Modos admitidos por `sandbox-ejecucion.md` §3. */
export const SANDBOX_MODES = ["mock", "subprocess", "docker"] as const;

export type SandboxMode = (typeof SANDBOX_MODES)[number];

export interface SandboxStatus {
  /** Adaptador que responde, para diagnóstico. */
  readonly provider: string;
  readonly mode: SandboxMode;
}

export interface SandboxService {
  /** Ejecuta el código contra las pruebas indicadas y devuelve el resultado. */
  run(request: SandboxRunRequest): Promise<SandboxRunResponse>;
  /** Estado del adaptador; `GET /api/sandbox/status` lo publica. */
  status(): SandboxStatus;
}
