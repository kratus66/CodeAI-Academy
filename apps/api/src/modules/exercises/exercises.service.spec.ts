import type {
  ExerciseDetail,
  SandboxRunRequest,
  SandboxRunResponse,
} from "@codeai/shared";
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { MockSandboxService } from "../sandbox/mock-sandbox.service";
import type { SandboxService } from "../sandbox/sandbox.service";
import type { ExerciseRow } from "./exercises.repository";
import { InMemoryExercisesRepository } from "./in-memory-exercises.repository";
import { ExercisesService } from "./exercises.service";

const LIST_QUERY = { page: 1, pageSize: 20 } as const;

function row(overrides: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id: "ex_1",
    unitId: "unit_1",
    unitCode: "U1.1.1",
    slug: "valida-el-status",
    type: "LAB",
    title: "Valida el status antes de parsear",
    statement: "Implementa fetchUser validando el status.",
    config: { starterCode: "export async function fetchUser() {}" },
    solution: { code: "solución" },
    ladder: "GUIDED",
    difficulty: 2,
    competencies: ["C1"],
    estimatedMin: 25,
    language: "typescript",
    hintLevels: [1],
    tests: [
      { id: "t1", name: "devuelve el usuario", isHidden: false, weight: 1 },
      { id: "t2", name: "lanza con 404", isHidden: false, weight: 3 },
      { id: "t3", name: "caso oculto", isHidden: true, weight: 1 },
    ],
    ...overrides,
  };
}

/** Sandbox guionizado: devuelve lo que diga la prueba y registra la petición. */
function stubSandbox(
  answer: (request: SandboxRunRequest) => Promise<SandboxRunResponse>,
): SandboxService & { readonly calls: SandboxRunRequest[] } {
  const calls: SandboxRunRequest[] = [];

  return {
    calls,
    run: (request) => {
      calls.push(request);

      return answer(request);
    },
    status: () => ({ provider: "stub", mode: "mock" }),
  };
}

function passedAll(request: SandboxRunRequest): Promise<SandboxRunResponse> {
  return Promise.resolve({
    outcome: "PASSED",
    score: 100,
    stdout: "ok",
    stderr: "",
    durationMs: 42,
    results: request.tests.map((test) => ({
      testId: test.id,
      passed: true,
      durationMs: 5,
    })),
  });
}

function serviceWith(
  exercises: readonly ExerciseRow[],
  sandbox: SandboxService = stubSandbox(passedAll),
  unitCodes?: readonly string[],
): {
  readonly service: ExercisesService;
  readonly repository: InMemoryExercisesRepository;
} {
  const repository = new InMemoryExercisesRepository({
    exercises,
    submissions: [],
    ...(unitCodes === undefined ? {} : { unitCodes }),
  });

  return { service: new ExercisesService(repository, sandbox), repository };
}

describe("ExercisesService: catálogo", () => {
  it("lista los ejercicios de la unidad con metadatos de paginación", async () => {
    const { service } = serviceWith([
      row(),
      row({ id: "ex_2", slug: "otro", unitCode: "U1.1.2" }),
    ]);

    const response = await service.listByUnit("U1.1.1", LIST_QUERY);

    expect(response.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(response.data.map((item) => item.id)).toEqual(["ex_1"]);
    expect(response.data[0]).not.toHaveProperty("statement");
  });

  it("devuelve el detalle sin solución, sin tests ocultos y con su código inicial", async () => {
    const { service } = serviceWith([row()]);

    const detail: ExerciseDetail = (await service.getDetail("ex_1")).exercise;

    expect(detail.starterCode).toBe("export async function fetchUser() {}");
    expect(detail.publicTests.map((test) => test.testId)).toEqual(["t1", "t2"]);
    expect(JSON.stringify(detail)).not.toContain("solución");
  });

  it("responde 404 con un ejercicio inexistente", async () => {
    const { service } = serviceWith([row()]);

    await expect(service.getDetail("ex_inexistente")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("responde 404 si la unidad no existe o no está publicada", async () => {
    const { service } = serviceWith([row()]);

    await expect(
      service.listByUnit("U9.9.9", LIST_QUERY),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deja la lista vacía en una unidad publicada sin ejercicios", async () => {
    const { service } = serviceWith([row()], undefined, ["U1.1.3"]);

    const response = await service.listByUnit("U1.1.3", LIST_QUERY);

    expect(response.data).toEqual([]);
    expect(response.meta.total).toBe(0);
  });
});

describe("ExercisesService: envío", () => {
  it("ejecuta sólo las pruebas visibles con el código y los límites del contrato", async () => {
    const sandbox = stubSandbox(passedAll);
    const { service } = serviceWith([row()], sandbox);

    await service.submit("user_a", "ex_1", { code: "const a = 1;" });

    expect(sandbox.calls).toHaveLength(1);
    expect(sandbox.calls[0]).toMatchObject({
      language: "typescript",
      files: [{ path: "index.ts", content: "const a = 1;" }],
      limits: { timeoutMs: 5_000, memoryMb: 256 },
    });
    expect(sandbox.calls[0]?.tests.map((test) => test.id)).toEqual(["t1", "t2"]);
    expect(sandbox.calls[0]?.tests[1]).toEqual({
      id: "t2",
      code: JSON.stringify(null),
      weight: 3,
    });
  });

  it("persiste el envío aprobado con 100, sin nivel y sin pistas", async () => {
    const { service } = serviceWith([row()]);

    const { submission } = await service.submit("user_a", "ex_1", {
      code: "const a = 1;",
      selfExplanation: "Valido el status antes de parsear.",
    });

    expect(submission.outcome).toBe("PASSED");
    expect(submission.score).toBe(100);
    expect(submission.achievedLevel).toBeNull();
    expect(submission.hintsUsed).toBe(0);
    expect(submission.feedback).toBe("2 de 2 pruebas visibles superadas.");
    expect(submission.results).toHaveLength(2);
  });

  it("puntúa con el peso de cada prueba y marca PARTIAL si falla una", async () => {
    const { service } = serviceWith(
      [row()],
      stubSandbox(() =>
        Promise.resolve({
          outcome: "FAILED",
          score: 25,
          stdout: "",
          stderr: "AssertionError",
          durationMs: 30,
          results: [
            { testId: "t1", passed: true, durationMs: 2 },
            { testId: "t2", passed: false, durationMs: 1 },
          ],
        }),
      ),
    );

    const { submission } = await service.submit("user_a", "ex_1", { code: "x" });

    // t1 pesa 1 y t2 pesa 3: 1 de 4 → 25.
    expect(submission.outcome).toBe("PARTIAL");
    expect(submission.score).toBe(25);
  });

  it("deja la nota en 0 y todas las pruebas fallidas cuando el sandbox da ERROR", async () => {
    const { service } = serviceWith(
      [row()],
      stubSandbox(() =>
        Promise.resolve({
          outcome: "ERROR",
          score: 0,
          stdout: "",
          stderr: "SyntaxError",
          durationMs: 4,
          results: [],
        }),
      ),
    );

    const { submission } = await service.submit("user_a", "ex_1", { code: "x" });

    expect(submission.outcome).toBe("ERROR");
    expect(submission.score).toBe(0);
    expect(submission.results.every((result) => !result.passed)).toBe(true);
    expect(submission.results).toHaveLength(2);
  });

  it("usa el mock del laboratorio y suspende un código con TODO", async () => {
    const { service } = serviceWith([row()], new MockSandboxService());

    const { submission } = await service.submit("user_a", "ex_1", {
      code: "// TODO: implementar",
    });

    expect(submission.outcome).toBe("FAILED");
    expect(submission.score).toBe(0);
  });

  it("responde 400 si el ejercicio no tiene lenguaje de sandbox", async () => {
    const { service } = serviceWith([row({ language: null })]);

    await expect(
      service.submit("user_a", "ex_1", { code: "x" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("responde 404 al enviar a un ejercicio inexistente o no publicado", async () => {
    const { service } = serviceWith([row()]);

    await expect(
      service.submit("user_a", "ex_inexistente", { code: "x" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("responde 503 sin persistir nada si el adaptador del sandbox falla", async () => {
    const { service, repository } = serviceWith(
      [row()],
      stubSandbox(() => Promise.reject(new Error("spawn ENOENT"))),
    );

    await expect(
      service.submit("user_a", "ex_1", { code: "x" }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      repository.listSubmissions("user_a", "ex_1", { skip: 0, take: 20 }),
    ).resolves.toEqual({ items: [], total: 0 });
  });

  it("aísla el historial: cada usuario sólo ve sus propios envíos", async () => {
    const { service } = serviceWith([row()]);

    await service.submit("user_a", "ex_1", { code: "a" });
    await service.submit("user_b", "ex_1", { code: "b" });
    await service.submit("user_b", "ex_1", { code: "c" });

    const own = await service.listSubmissions("user_a", "ex_1", LIST_QUERY);
    const other = await service.listSubmissions("user_b", "ex_1", LIST_QUERY);

    expect(own.meta.total).toBe(1);
    expect(own.data.map((item) => item.id)).toEqual(["sub_1"]);
    expect(other.meta.total).toBe(2);
    expect(other.data.map((item) => item.id).sort()).toEqual(["sub_2", "sub_3"]);
  });
});
