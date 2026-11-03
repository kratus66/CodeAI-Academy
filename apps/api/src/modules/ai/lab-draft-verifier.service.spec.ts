import type { ExerciseDraft, SandboxRunRequest, SandboxRunResponse } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { DockerSandboxService } from "../sandbox/docker-sandbox.service";
import type { SandboxService, SandboxStatus } from "../sandbox/sandbox.service";
import { LabDraftVerifierService } from "./lab-draft-verifier.service";

const SOURCE = "https://developer.mozilla.org/es/docs/Web/JavaScript";

function draft(overrides: Partial<ExerciseDraft> = {}): ExerciseDraft {
  return {
    slug: "suma-segura",
    type: "LAB",
    title: "Suma segura",
    statement: "Implementa suma(a, b).",
    ladder: "AUTONOMOUS",
    difficulty: 2,
    concepts: ["funciones"],
    competencies: ["C2"],
    estimatedMin: 5,
    language: "javascript",
    starterCode: "function suma(a, b) { return 0; }",
    solution: { code: "function suma(a, b) { return a + b; }" },
    quiz: null,
    flashcard: null,
    memory: null,
    sources: [SOURCE],
    hints: [],
    tests: [
      { name: "suma", isHidden: false, weight: 1, spec: { code: "assert.strictEqual(suma(1, 2), 3);" } },
      { name: "negativos", isHidden: true, weight: 1, spec: { code: "assert.strictEqual(suma(-1, 1), 0);" } },
    ],
    reviewedByHuman: false,
    ...overrides,
  };
}

/**
 * Sandbox de prueba que "ejecuta" de verdad: evalúa el código y cada aserción en
 * el proceso de la prueba. Es lo bastante fiel para distinguir una solución buena
 * de una mala; el comportamiento con Docker real se comprueba más abajo.
 */
class EvaluatingSandbox implements SandboxService {
  constructor(private readonly mode: SandboxStatus["mode"] = "docker") {}

  status(): SandboxStatus {
    return { provider: "test", mode: this.mode };
  }

  async run(request: SandboxRunRequest): Promise<SandboxRunResponse> {
    const code = request.files[0]?.content ?? "";
    const results = await Promise.all(
      request.tests.map(async (test) => {
        const body = (JSON.parse(test.code) as { code: string }).code;

        try {
          const assert = await import("node:assert");
          new Function("assert", `${code}\n${body}`)(assert);
          return { testId: test.id, passed: true };
        } catch (error) {
          return { testId: test.id, passed: false, message: error instanceof Error ? error.message : "" };
        }
      }),
    );
    const passed = results.filter((result) => result.passed).length;

    return {
      outcome: passed === results.length ? "PASSED" : passed === 0 ? "FAILED" : "PARTIAL",
      score: Math.round((passed / results.length) * 100),
      results,
      durationMs: 5,
    };
  }
}

describe("LabDraftVerifierService", () => {
  it("verifica un LAB cuya solución pasa todo y cuyo inicial no resuelve el ejercicio", async () => {
    const result = await new LabDraftVerifierService(new EvaluatingSandbox()).verify(draft());

    expect(result.status).toBe("verified");
  });

  it("rechaza una solución que no pasa sus propias pruebas y nombra cuáles", async () => {
    const result = await new LabDraftVerifierService(new EvaluatingSandbox()).verify(
      draft({ solution: { code: "function suma(a, b) { return Math.abs(a) + Math.abs(b); }" } }),
    );

    expect(result).toMatchObject({ status: "rejected", reason: "solution_fails" });
    expect(result.status === "rejected" ? result.failedTests : []).toEqual(["negativos"]);
  });

  it("rechaza un código inicial que ya resuelve el ejercicio", async () => {
    const result = await new LabDraftVerifierService(new EvaluatingSandbox()).verify(
      draft({ starterCode: "function suma(a, b) { return a + b; }" }),
    );

    expect(result).toMatchObject({ status: "rejected", reason: "starter_passes_all" });
  });

  it("rechaza una solución que no se ejecuta", async () => {
    const sandbox: SandboxService = {
      status: () => ({ provider: "test", mode: "docker" }),
      run: () =>
        Promise.resolve({ outcome: "TIMEOUT", score: 0, results: [], stderr: "tarda", durationMs: 5000 }),
    };
    const result = await new LabDraftVerifierService(sandbox).verify(draft());

    expect(result).toMatchObject({ status: "rejected", reason: "solution_error" });
  });

  it("no aprueba a ciegas con el sandbox mock", async () => {
    const result = await new LabDraftVerifierService(new EvaluatingSandbox("mock")).verify(draft());

    expect(result).toEqual({ status: "unverifiable", reason: "sandbox_mock" });
  });

  it("marca como no verificable si el sandbox cae o el lenguaje no se ejecuta", async () => {
    const caido: SandboxService = {
      status: () => ({ provider: "test", mode: "docker" }),
      run: () => Promise.reject(new Error("daemon caído")),
    };
    const down: SandboxService = {
      status: () => ({ provider: "test", mode: "docker" }),
      run: () =>
        Promise.resolve({
          outcome: "ERROR",
          score: 0,
          results: [],
          stderr: "El servicio de ejecución no está disponible. Inténtalo en un minuto.",
          durationMs: 1,
        }),
    };

    await expect(new LabDraftVerifierService(caido).verify(draft())).resolves.toEqual({
      status: "unverifiable",
      reason: "sandbox_unavailable",
    });
    await expect(new LabDraftVerifierService(down).verify(draft())).resolves.toEqual({
      status: "unverifiable",
      reason: "sandbox_unavailable",
    });
    await expect(
      new LabDraftVerifierService(new EvaluatingSandbox()).verify(draft({ language: "sql" })),
    ).resolves.toEqual({ status: "unverifiable", reason: "language_unsupported" });
  });

  it("no aplica a quizzes ni tarjetas", async () => {
    const result = await new LabDraftVerifierService(new EvaluatingSandbox()).verify(
      draft({ type: "QUIZ", starterCode: null, solution: null, tests: [] }),
    );

    expect(result).toEqual({ status: "not_applicable" });
  });
});

describe.skipIf(process.env.SANDBOX_DOCKER_TESTS !== "1")("LabDraftVerifierService con Docker real", () => {
  const verifier = new LabDraftVerifierService(new DockerSandboxService());

  it("verifica un LAB real de JavaScript con export en la solución", async () => {
    const result = await verifier.verify(
      draft({
        starterCode: "export function suma(a, b) { return 0; }",
        solution: { code: "export function suma(a, b) { return a + b; }" },
      }),
    );

    expect(result.status).toBe("verified");
  }, 120_000);

  it("verifica un LAB real de TypeScript", async () => {
    const result = await verifier.verify(
      draft({
        language: "typescript",
        starterCode: "export function suma(a: number, b: number): number { return 0; }",
        solution: { code: "export function suma(a: number, b: number): number { return a + b; }" },
      }),
    );

    expect(result.status).toBe("verified");
  }, 120_000);

  it("rechaza una solución incorrecta ejecutada de verdad", async () => {
    const result = await verifier.verify(draft({ solution: { code: "function suma(a, b) { return a * b; }" } }));

    expect(result).toMatchObject({ status: "rejected", reason: "solution_fails" });
  }, 120_000);
});
