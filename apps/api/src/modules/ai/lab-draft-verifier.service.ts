import type { ExerciseDraft, SandboxRunRequest, SandboxRunResponse } from "@codeai/shared";
import { Inject, Injectable } from "@nestjs/common";

import type { SandboxService } from "../sandbox/sandbox.service";
import { SANDBOX_SERVICE } from "../sandbox/sandbox.service";

const RUN_LIMITS = { timeoutMs: 5_000, memoryMb: 256 } as const;

const FILE_NAME_BY_LANGUAGE: Record<"typescript" | "javascript", string> = {
  typescript: "index.ts",
  javascript: "index.js",
};

export type LabDraftVerification =
  /** QUIZ, FLASHCARD…: no hay código que ejecutar. */
  | { status: "not_applicable" }
  /** La solución pasa todas las pruebas y el código inicial no las pasa todas. */
  | { status: "verified"; durationMs: number }
  /** El borrador está mal: no debe llegar a revisión humana. */
  | {
      status: "rejected";
      reason: "solution_fails" | "solution_error" | "starter_passes_all";
      detail: string;
      failedTests: string[];
    }
  /** No se pudo comprobar: la verificación no cuenta como hecha. */
  | {
      status: "unverifiable";
      reason: "sandbox_mock" | "sandbox_unavailable" | "language_unsupported";
    };

/**
 * Bucle cerrado de la autoría asistida (`banco-ejercicios.md` §3.1): un LAB/DEBUG
 * generado sólo pasa a revisión humana si su propia solución oficial pasa todas
 * sus pruebas en el sandbox **y** su código inicial no las resuelve ya. Con el
 * sandbox `mock` no se ejecuta nada, así que devuelve `unverifiable` en lugar de
 * aprobar a ciegas. Nunca lanza.
 */
@Injectable()
export class LabDraftVerifierService {
  constructor(@Inject(SANDBOX_SERVICE) private readonly sandbox: SandboxService) {}

  async verify(draft: ExerciseDraft): Promise<LabDraftVerification> {
    if (draft.type !== "LAB" && draft.type !== "DEBUG") {
      return { status: "not_applicable" };
    }

    if (this.sandbox.status().mode === "mock") {
      return { status: "unverifiable", reason: "sandbox_mock" };
    }

    if (draft.language !== "javascript" && draft.language !== "typescript") {
      return { status: "unverifiable", reason: "language_unsupported" };
    }

    const solution = draft.solution?.code;
    const starter = draft.starterCode;

    if (solution === undefined || starter === null) {
      return {
        status: "rejected",
        reason: "solution_error",
        detail: "Falta la solución oficial o el código inicial",
        failedTests: [],
      };
    }

    const request = (code: string): SandboxRunRequest => ({
      language: draft.language as "javascript" | "typescript",
      files: [{ path: FILE_NAME_BY_LANGUAGE[draft.language as "javascript" | "typescript"], content: code }],
      tests: draft.tests.map((test, index) => ({
        id: testId(index),
        code: JSON.stringify(test.spec),
        weight: test.weight,
      })),
      limits: { ...RUN_LIMITS },
    });

    let solved: SandboxRunResponse;
    let started: SandboxRunResponse;

    try {
      solved = await this.sandbox.run(request(solution));
      started = await this.sandbox.run(request(starter));
    } catch {
      return { status: "unverifiable", reason: "sandbox_unavailable" };
    }

    if (solved.outcome === "ERROR" && solved.results.length === 0 && /no está disponible/.test(solved.stderr ?? "")) {
      return { status: "unverifiable", reason: "sandbox_unavailable" };
    }

    if (solved.outcome === "ERROR" || solved.outcome === "TIMEOUT") {
      return {
        status: "rejected",
        reason: "solution_error",
        detail: solved.outcome === "TIMEOUT" ? "La solución excede el tiempo" : (solved.stderr ?? "La solución no se ejecuta"),
        failedTests: [],
      };
    }

    const failedTests = draft.tests
      .filter((_test, index) => !solved.results.some((result) => result.testId === testId(index) && result.passed))
      .map((test) => test.name);

    if (failedTests.length > 0) {
      return {
        status: "rejected",
        reason: "solution_fails",
        detail: "La solución oficial no pasa sus propias pruebas",
        failedTests,
      };
    }

    const starterPassesAll =
      started.outcome === "PASSED" &&
      draft.tests.every((_test, index) =>
        started.results.some((result) => result.testId === testId(index) && result.passed),
      );

    if (starterPassesAll) {
      return {
        status: "rejected",
        reason: "starter_passes_all",
        detail: "El código inicial ya resuelve el ejercicio: no hay nada que aprender",
        failedTests: [],
      };
    }

    return { status: "verified", durationMs: solved.durationMs + started.durationMs };
  }
}

function testId(index: number): string {
  return `t${index}`;
}
