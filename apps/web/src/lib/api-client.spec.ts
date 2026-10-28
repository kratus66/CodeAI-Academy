import {
  DEFAULT_INTERVIEW_RUBRIC,
  DEFAULT_PROJECT_RUBRIC,
  LESSON_STEP_KINDS,
} from "@codeai/shared";
import type { SandboxRunRequest } from "@codeai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  aiApi,
  ApiError,
  authApi,
  contentApi,
  exercisesApi,
  interviewsApi,
  portfolioApi,
  progressApi,
  projectsApi,
  resolveApiBaseUrl,
  restoreSession,
  reviewApi,
  sandboxApi,
} from "./api-client";

const USER = {
  id: "usr_1",
  email: "ana@example.com",
  name: "Ana",
  role: "STUDENT",
  createdAt: "2026-10-26T14:30:00.000Z",
} as const;

const UNAUTHENTICATED = {
  error: {
    code: "UNAUTHENTICATED",
    message: "La sesión no es válida o ha expirado",
    traceId: "trace-401",
  },
} as const;

const PROJECT = {
  id: "prj_1",
  slug: "entorno-reproducible",
  stageId: 0,
  title: "Entorno reproducible",
  brief: "Deja un repositorio que arranque en cualquier máquina.",
  requirements: ["README con requisitos", "Script de verificación"],
  isPublished: true,
  submitted: false,
} as const;

const PROJECT_DETAIL = {
  ...PROJECT,
  rubric: DEFAULT_PROJECT_RUBRIC,
  competencies: ["C1"],
  bestScore: null,
  mySubmissions: [],
} as const;

const PROJECT_SUBMISSION = {
  id: "psub_1",
  projectId: "prj_1",
  projectSlug: "entorno-reproducible",
  projectTitle: "Entorno reproducible",
  stageId: 0,
  userId: "usr_1",
  status: "SUBMITTED",
  repoUrl: "https://github.com/ana/entorno",
  deployUrl: null,
  notes: "Documenté el arranque",
  score: null,
  rubricScores: null,
  feedback: null,
  reviewedAt: null,
  isPublic: false,
  publishedAt: null,
  createdAt: "2026-10-28T10:00:00.000Z",
} as const;

const REVIEWED_SUBMISSION = {
  ...PROJECT_SUBMISSION,
  status: "REVIEWED",
  score: 85,
  rubricScores: {
    correctitud: 4,
    calidad: 4,
    pruebas: 4,
    seguridad: 4,
    justificacion: 0,
  },
  feedback: "Falta la explicación propia",
  reviewedAt: "2026-10-28T11:00:00.000Z",
} as const;

const STAGE = {
  id: 0,
  slug: "e0-fundamentos",
  title: "Fundamentos de la IA",
  objective: "Entender qué es la inteligencia artificial.",
  level: 1,
  estimatedMin: 900,
  order: 1,
  moduleCount: 1,
} as const;

const UNIT = {
  id: "unit_1",
  code: "U0.1.1",
  title: "Qué es la inteligencia artificial",
  objective: "Distinguir IA de automatización clásica.",
  estimatedMin: 90,
  order: 1,
  stageId: 0,
  moduleCode: "M0.1",
  prerequisiteIds: [],
} as const;

const STAGE_DETAIL = {
  ...STAGE,
  modules: [
    {
      id: "module_1",
      code: "M0.1",
      title: "Pensamiento computacional",
      order: 1,
      unitCount: 1,
      units: [UNIT],
    },
  ],
} as const;

const UNIT_DETAIL = {
  ...UNIT,
  lessons: [
    {
      id: "lesson_1",
      slug: "hola-mundo",
      title: "Hola mundo",
      estimatedMin: 25,
      order: 1,
    },
  ],
  exercises: [],
} as const;

const LESSON = {
  id: "lesson_1",
  slug: "hola-mundo",
  title: "Hola mundo",
  estimatedMin: 25,
  order: 1,
  unitCode: "U0.1.1",
  content: [
    {
      type: "paragraph",
      text: "Un programa es una secuencia de instrucciones.",
    },
  ],
  steps: LESSON_STEP_KINDS.map((kind) => ({
    kind,
    title: `Paso ${kind}`,
    body: `Cuerpo del paso ${kind}`,
  })),
  resources: [],
} as const;

const fetchMock =
  vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }

    throw error;
  }

  throw new Error("Se esperaba un ApiError");
}

describe("resolveApiBaseUrl", () => {
  it("usa el destino local cuando no hay variable de entorno", () => {
    expect(resolveApiBaseUrl(undefined)).toBe("http://localhost:3001/api");
    expect(resolveApiBaseUrl("  ")).toBe("http://localhost:3001/api");
  });

  it("respeta NEXT_PUBLIC_API_URL y elimina la barra final", () => {
    expect(resolveApiBaseUrl("http://localhost:4000/api/")).toBe(
      "http://localhost:4000/api",
    );
  });
});

describe("apiRequest a través de authApi", () => {
  it("envía cookies, JSON y devuelve el usuario del contrato", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: USER }));

    const user = await authApi.login({
      email: "ana@example.com",
      password: "S3gura!pass",
    });

    expect(user).toEqual(USER);
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://localhost:3001/api/auth/login");
    expect(call?.[1]?.method).toBe("POST");
    expect(call?.[1]?.credentials).toBe("include");
    expect(call?.[1]?.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(call?.[1]?.body).toBe(
      JSON.stringify({ email: "ana@example.com", password: "S3gura!pass" }),
    );
  });

  it("convierte el envelope de error en ApiError con detalles por campo", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Datos de entrada inválidos",
            details: [{ field: "email", message: "Debe ser un correo válido" }],
            traceId: "trace-400",
          },
        },
        { status: 400 },
      ),
    );

    const error = await captureApiError(
      authApi.login({ email: "ana", password: "S3gura!pass" }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.traceId).toBe("trace-400");
    expect(error.fieldErrors()).toEqual({ email: "Debe ser un correo válido" });
  });

  it("usa el mensaje por defecto si la respuesta de error no cumple el envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "sin envelope" }, { status: 503 }),
    );

    const error = await captureApiError(authApi.me());

    expect(error.status).toBe(503);
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
    expect(error.message).toBe(
      "Un servicio necesario no está disponible",
    );
  });

  it("expone Retry-After en segundos cuando la API limita los intentos", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Demasiados intentos",
            traceId: "trace-429",
          },
        },
        { status: 429, headers: { "Retry-After": "120" } },
      ),
    );

    const error = await captureApiError(
      authApi.login({ email: "ana@example.com", password: "S3gura!pass" }),
    );

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(120);
  });

  it("acepta 204 sin cuerpo al cerrar sesión", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(authApi.logout()).resolves.toBeUndefined();
  });

  it("rechaza una respuesta que no cumple el contrato de usuario", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: { name: "Ana" } }));

    const error = await captureApiError(
      authApi.login({ email: "ana@example.com", password: "S3gura!pass" }),
    );

    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toContain("contrato");
  });
});

describe("contentApi", () => {
  it("lista las etapas con sus metadatos de paginación", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [STAGE],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    );

    const page = await contentApi.listStages();

    expect(page.stages.map((item) => item.id)).toEqual([0]);
    expect(page.meta.total).toBe(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/content/stages",
    );
  });

  it("devuelve el detalle de la etapa con las unidades de cada módulo", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stage: STAGE_DETAIL }));

    const stage = await contentApi.getStage(0);

    expect(stage.modules[0]?.units.map((item) => item.code)).toEqual(["U0.1.1"]);
    expect(stage.modules[0]?.units[0]?.stageId).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/content/stages/0",
    );
  });

  it("pide la unidad por su código y devuelve lecciones y ejercicios", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unit: UNIT_DETAIL }));

    const unit = await contentApi.getUnit("U0.1.1");

    expect(unit.lessons.map((item) => item.slug)).toEqual(["hola-mundo"]);
    expect(unit.exercises).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/content/units/U0.1.1",
    );
  });

  it("devuelve la lección con sus siete pasos", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ lesson: LESSON }));

    const lesson = await contentApi.getLesson("hola-mundo");

    expect(lesson.steps).toHaveLength(7);
    expect(lesson.unitCode).toBe("U0.1.1");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/content/lessons/hola-mundo",
    );
  });

  it("rechaza una etapa cuyo módulo llega sin unidades", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        stage: {
          ...STAGE_DETAIL,
          modules: [
            {
              id: "module_1",
              code: "M0.1",
              title: "Pensamiento",
              order: 1,
              unitCount: 0,
            },
          ],
        },
      }),
    );

    const error = await captureApiError(contentApi.getStage(0));

    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toContain("contrato");
  });

  it("propaga el 404 de una unidad inexistente", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "NOT_FOUND",
            message: "La unidad no existe o no está publicada",
            traceId: "trace-404",
          },
        },
        { status: 404 },
      ),
    );

    const error = await captureApiError(contentApi.getUnit("U9.1.1"));

    expect(error.status).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.traceId).toBe("trace-404");
  });
});

const UNIT_PROGRESS = {
  unitId: "unit_1",
  unitCode: "U0.1.1",
  state: "IN_PROGRESS",
  progressPct: 50,
  lessonsDone: 1,
  exercisesDone: 0,
  bestScore: null,
  lastActivityAt: "2026-10-26T14:30:00.000Z",
  completedAt: null,
} as const;

const OVERVIEW = {
  user: { id: "usr_1", name: "Ana" },
  currentStage: 0,
  overallPct: 16.7,
  units: { mastered: 0, inProgress: 1, needsReview: 0, locked: 2 },
  competencies: [{ code: "C1", level: 3, evidenceCount: 14 }],
  dueReviews: 0,
} as const;

describe("progressApi", () => {
  it("devuelve el resumen global del contrato", async () => {
    fetchMock.mockResolvedValue(jsonResponse(OVERVIEW));

    const overview = await progressApi.getOverview();

    expect(overview.overallPct).toBe(16.7);
    expect(overview.units.locked).toBe(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/progress/overview",
    );
  });

  it("desenvuelve la lista de unidades", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ units: [UNIT_PROGRESS] }));

    const units = await progressApi.listUnits();

    expect(units).toHaveLength(1);
    expect(units[0]?.unitCode).toBe("U0.1.1");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/progress/units",
    );
  });

  it("desenvuelve el mapa de competencias", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ competencies: OVERVIEW.competencies }),
    );

    const competencies = await progressApi.listCompetencies();

    expect(competencies[0]).toEqual({ code: "C1", level: 3, evidenceCount: 14 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/progress/competencies",
    );
  });

  it("marca una lección vista con POST y devuelve el resumen de la unidad", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unit: UNIT_PROGRESS }));

    const unit = await progressApi.completeLesson("unit_1", "lesson_1");

    expect(unit.progressPct).toBe(50);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/progress/units/unit_1/complete-lesson",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ lessonId: "lesson_1" }),
    });
  });

  it("propaga el 409 de una unidad bloqueada", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "CONFLICT",
            message: "La unidad está bloqueada",
            traceId: "trace-409",
          },
        },
        { status: 409 },
      ),
    );

    const error = await captureApiError(
      progressApi.completeLesson("unit_1", "lesson_1"),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe("CONFLICT");
    expect(error.traceId).toBe("trace-409");
  });

  it("rechaza un estado fuera del contrato sin tocar la vista", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ units: [{ ...UNIT_PROGRESS, state: "DONE" }] }));

    const error = await captureApiError(progressApi.listUnits());

    expect(error.status).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
  });
});

const EXERCISE_ITEM = {
  id: "ex_1",
  unitId: "unit_1",
  unitCode: "U0.1.1",
  type: "LAB",
  title: "Suma de dos números",
  ladder: "GUIDED",
  difficulty: 1,
  estimatedMin: 15,
  language: "typescript",
  competencies: ["C1"],
} as const;

const EXERCISE_DETAIL = {
  ...EXERCISE_ITEM,
  statement: "Escribe una función que sume dos números.",
  config: {},
  publicTests: [{ testId: "t1", name: "suma positivos" }],
  hintsAvailable: 2,
  starterCode: "export function sumar(a: number, b: number): number {}",
} as const;

const SUBMISSION = {
  id: "sub_1",
  outcome: "PARTIAL",
  score: 66.7,
  achievedLevel: null,
  hintsUsed: 0,
  results: [
    { testId: "t1", name: "suma positivos", passed: true, durationMs: 1 },
    { testId: "t2", name: "suma negativos", passed: false },
  ],
  feedback: "1 de 2 pruebas visibles superadas",
  createdAt: "2026-10-27T10:00:00.000Z",
} as const;

const HINT = {
  level: 2,
  text: "Piensa en qué operador combina dos números.",
  nextLevelAvailable: true,
} as const;

describe("exercisesApi", () => {
  it("lista los ejercicios de una unidad por su código", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [EXERCISE_ITEM],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    );

    const page = await exercisesApi.listByUnit("U0.1.1");

    expect(page.exercises.map((item) => item.id)).toEqual(["ex_1"]);
    expect(page.meta.total).toBe(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/exercises/units/U0.1.1",
    );
  });

  it("devuelve el detalle sin solución ni pruebas ocultas", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ exercise: EXERCISE_DETAIL }));

    const exercise = await exercisesApi.getDetail("ex_1");

    expect(exercise.publicTests).toHaveLength(1);
    expect(exercise.hintsAvailable).toBe(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/exercises/ex_1",
    );
  });

  it("desenvuelve el historial de envíos del estudiante", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [SUBMISSION],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    );

    const submissions = await exercisesApi.listSubmissions("ex_1");

    expect(submissions[0]?.outcome).toBe("PARTIAL");
    expect(submissions[0]?.results).toHaveLength(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/exercises/ex_1/submissions",
    );
  });

  it("envía el código con POST y devuelve el desenlace", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submission: SUBMISSION }));

    const submission = await exercisesApi.submit("ex_1", {
      code: "export function sumar(a, b) { return a + b; }",
      selfExplanation: "Uso el operador suma",
    });

    expect(submission.score).toBe(66.7);
    expect(submission.achievedLevel).toBeNull();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        code: "export function sumar(a, b) { return a + b; }",
        selfExplanation: "Uso el operador suma",
      }),
    });
  });

  it("propaga el 404 de un ejercicio no publicado", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "NOT_FOUND",
            message: "El ejercicio no existe o no está publicado",
            traceId: "trace-404",
          },
        },
        { status: 404 },
      ),
    );

    const error = await captureApiError(exercisesApi.getDetail("ex_404"));

    expect(error.status).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("pide la pista de un nivel con POST", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hint: HINT }));

    const hint = await exercisesApi.requestHint("ex_1", 2);

    expect(hint).toEqual(HINT);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/exercises/ex_1/hints",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ level: 2 }),
    });
  });

  it("rechaza una pista que filtra campos de más", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ hint: { ...HINT, solution: "return a + b" } }),
    );

    const error = await captureApiError(exercisesApi.requestHint("ex_1", 2));

    expect(error.status).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  it("propaga el 422 al pedir un nivel sin el anterior", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "RULE_VIOLATION",
            message: "Pide primero la pista del nivel 1",
            traceId: "trace-422",
          },
        },
        { status: 422 },
      ),
    );

    const error = await captureApiError(exercisesApi.requestHint("ex_1", 2));

    expect(error.status).toBe(422);
    expect(error.code).toBe("RULE_VIOLATION");
  });
});

const SANDBOX_RUN = {
  outcome: "PASSED",
  score: 100,
  results: [{ testId: "t1", passed: true, durationMs: 1 }],
  stdout: "ok",
  durationMs: 1,
} as const;

describe("sandboxApi", () => {
  const request: SandboxRunRequest = {
    language: "typescript",
    files: [{ path: "index.ts", content: "console.log(1)" }],
    tests: [{ id: "t1", code: "assert(true)", weight: 1 }],
    limits: { timeoutMs: 5_000, memoryMb: 256 },
  };

  it("ejecuta en /sandbox/run y desenvuelve la ejecución", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ run: SANDBOX_RUN }));

    const run = await sandboxApi.run(request);

    expect(run.outcome).toBe("PASSED");
    expect(run.results).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/sandbox/run",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(request),
    });
  });

  it("expone Retry-After cuando se agota la cuota de ejecuciones", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Has alcanzado el límite de 20 ejecuciones por minuto.",
            traceId: "trace-429",
          },
        },
        { status: 429, headers: { "Retry-After": "47" } },
      ),
    );

    const error = await captureApiError(sandboxApi.run(request));

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(47);
  });

  it("rechaza una ejecución fuera del contrato", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ run: { ...SANDBOX_RUN, outcome: "DESCONOCIDO" } }),
    );

    const error = await captureApiError(sandboxApi.run(request));

    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toContain("contrato");
  });
});

describe("restoreSession", () => {
  it("rota el refresh cuando el access token caducó", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(UNAUTHENTICATED, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ user: USER }));

    const user = await restoreSession();

    expect(user).toEqual(USER);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://localhost:3001/api/auth/me",
      "http://localhost:3001/api/auth/refresh",
    ]);
  });

  it("devuelve null cuando tampoco hay refresh válido", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(UNAUTHENTICATED, { status: 401 }),
    );

    await expect(restoreSession()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

const REVIEW_ITEM = {
  id: "item_1",
  exerciseId: "ex_1",
  exerciseTitle: "Suma segura",
  exerciseSlug: "suma-segura-001",
  concept: "funciones",
  competencies: ["C1"],
  dueAt: "2026-10-27T08:00:00.000Z",
  intervalDays: 1,
  repetitions: 1,
  easeFactor: 2.6,
  priority: 0,
} as const;

const REVIEW_ANSWER = {
  nextDueAt: "2026-11-02T09:00:00.000Z",
  intervalDays: 6,
  easeFactor: 2.6,
  repetitions: 2,
} as const;

describe("reviewApi", () => {
  it("pide la cola y devuelve los ítems validados", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ items: [REVIEW_ITEM], dueReviews: 7, limit: 30 }),
    );

    const queue = await reviewApi.getQueue();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/review/queue",
    );
    expect(queue.items[0]).toEqual(REVIEW_ITEM);
    expect(queue.dueReviews).toBe(7);
    expect(queue.limit).toBe(30);
  });

  it("envía la calidad al ítem correcto y devuelve el próximo repaso", async () => {
    fetchMock.mockResolvedValue(jsonResponse(REVIEW_ANSWER));

    const result = await reviewApi.answer("item_1", { quality: 4 });

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe("http://localhost:3001/api/review/items/item_1/answer");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ quality: 4 }));
    expect(result).toEqual(REVIEW_ANSWER);
  });

  it("codifica el id del ítem en la ruta", async () => {
    fetchMock.mockResolvedValue(jsonResponse(REVIEW_ANSWER));

    await reviewApi.answer("item/1", { quality: 5 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/review/items/item%2F1/answer",
    );
  });

  it("propaga el 404 de un ítem ajeno", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "NOT_FOUND",
            message: "El ítem de repaso no existe o no te pertenece",
            traceId: "trace-404",
          },
        },
        { status: 404 },
      ),
    );

    const error = await captureApiError(reviewApi.answer("item_9", { quality: 3 }));

    expect(error.status).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.traceId).toBe("trace-404");
  });

  it("rechaza una cola fuera de contrato antes de tocar la vista", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ items: [{ ...REVIEW_ITEM, easeFactor: 1.2 }], dueReviews: 0, limit: 30 }),
    );

    const error = await captureApiError(reviewApi.getQueue());

    expect(error.status).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toContain("contrato");
  });

  it("rechaza una respuesta SM-2 fuera de contrato", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...REVIEW_ANSWER, intervalDays: 0 }),
    );

    const error = await captureApiError(reviewApi.answer("item_1", { quality: 4 }));

    expect(error.code).toBe("INTERNAL_ERROR");
  });
});

const AI_TUTOR_RESPONSE = {
  reply: "¿Qué devuelve fetch cuando el estado es 404?",
  suggestedHints: ["promesas"],
  tokensUsed: 412,
  budgetRemainingUsd: 4.98,
  source: "provider",
  filtered: false,
} as const;

describe("aiApi", () => {
  it("envía lessonId, mensaje e historial al tutor y valida la respuesta", async () => {
    fetchMock.mockResolvedValue(jsonResponse(AI_TUTOR_RESPONSE));

    const result = await aiApi.tutor({ lessonId: "les_1", message: "No entiendo el await" });
    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe("http://localhost:3001/api/ai/tutor");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe(JSON.stringify({ lessonId: "les_1", message: "No entiendo el await" }));
    expect(result).toEqual(AI_TUTOR_RESPONSE);
  });

  it("pide la explicación de un envío por su id", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        explanation: "Tu función devuelve antes de esperar la promesa.",
        errorCategory: "async",
        suggestedHints: [],
        tokensUsed: 214,
        budgetRemainingUsd: 4.97,
        source: "cache",
        filtered: false,
      }),
    );

    const result = await aiApi.explainError("sub_1");
    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe("http://localhost:3001/api/ai/explain-error");
    expect(init?.body).toBe(JSON.stringify({ submissionId: "sub_1" }));
    expect(result.errorCategory).toBe("async");
  });

  it("lee el gasto del mes", async () => {
    const usage = {
      month: "2026-10",
      spentUsd: 3.62,
      budgetUsd: 5,
      remainingUsd: 1.38,
      percentUsed: 72.4,
      level: "economy",
      interactions: 27,
    };
    fetchMock.mockResolvedValue(jsonResponse(usage));

    expect(await aiApi.usage()).toEqual(usage);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3001/api/ai/usage");
  });

  it("propaga el 429 con la espera de Retry-After", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "RATE_LIMITED", message: "Demasiadas peticiones", traceId: "trace-429" } },
        { status: 429, headers: { "Retry-After": "120" } },
      ),
    );

    const error = await captureApiError(aiApi.tutor({ lessonId: "les_1", message: "hola" }));

    expect(error.status).toBe(429);
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(120);
  });

  it("propaga el 401 sin sesión", async () => {
    fetchMock.mockResolvedValue(jsonResponse(UNAUTHENTICATED, { status: 401 }));

    const error = await captureApiError(aiApi.usage());

    expect(error.status).toBe(401);
    expect(error.code).toBe("UNAUTHENTICATED");
  });

  it("rechaza una respuesta del tutor fuera de contrato", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...AI_TUTOR_RESPONSE, suggestedHints: ["a", "b", "c", "d"] }),
    );

    const error = await captureApiError(aiApi.tutor({ lessonId: "les_1", message: "hola" }));

    expect(error.code).toBe("INTERNAL_ERROR");
  });
});

describe("projectsApi", () => {
  it("lista el catálogo con filtros y desenvuelve `data`/`meta`", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [PROJECT],
        meta: { page: 2, pageSize: 5, total: 6, totalPages: 2 },
      }),
    );

    const page = await projectsApi.list({ stage: 0, page: 2, pageSize: 5 });

    expect(page.projects).toEqual([PROJECT]);
    expect(page.meta).toEqual({
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/projects?stage=0&page=2&pageSize=5",
    );
  });

  it("pide `/projects` sin query cuando no hay filtros", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }),
    );

    await projectsApi.list();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/projects",
    );
  });

  it("devuelve el detalle con la rúbrica y las entregas propias", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...PROJECT_DETAIL,
        mySubmissions: [REVIEWED_SUBMISSION],
        bestScore: 85,
      }),
    );

    const detail = await projectsApi.getDetail("entorno-reproducible");

    expect(detail.rubric.criteria).toHaveLength(5);
    expect(detail.mySubmissions[0]).toEqual(REVIEWED_SUBMISSION);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/projects/entorno-reproducible",
    );
  });

  it("rechaza un detalle cuya rúbrica no cumple el contrato", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...PROJECT_DETAIL,
        rubric: { criteria: [], correctitudGate: false },
      }),
    );

    const error = await captureApiError(
      projectsApi.getDetail("entorno-reproducible"),
    );

    expect(error.status).toBe(500);
    expect(error.message).toContain("contrato");
  });

  it("envía la entrega con POST y devuelve el estado resultante", async () => {
    fetchMock.mockResolvedValue(jsonResponse(PROJECT_SUBMISSION, { status: 201 }));

    const submission = await projectsApi.submit("entorno-reproducible", {
      repoUrl: "https://github.com/ana/entorno",
      notes: "Documenté el arranque",
    });

    expect(submission.status).toBe("SUBMITTED");
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe(
      "http://localhost:3001/api/projects/entorno-reproducible/submissions",
    );
    expect(call?.[1]?.method).toBe("POST");
    expect(call?.[1]?.body).toBe(
      JSON.stringify({
        repoUrl: "https://github.com/ana/entorno",
        notes: "Documenté el arranque",
      }),
    );
  });

  it("propaga el 400 con el campo culpable de una entrega inválida", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Datos de entrada inválidos",
            details: [
              {
                field: "repoUrl",
                message: "La URL del repositorio debe apuntar a http o https",
              },
            ],
            traceId: "trace-400",
          },
        },
        { status: 400 },
      ),
    );

    const error = await captureApiError(
      projectsApi.submit("entorno-reproducible", { repoUrl: "ftp://ana" }),
    );

    expect(error.status).toBe(400);
    expect(error.fieldErrors()).toEqual({
      repoUrl: "La URL del repositorio debe apuntar a http o https",
    });
  });
});

describe("projectsApi — revisión y publicación", () => {
  it("envía la revisión con POST y devuelve la nota persistida", async () => {
    fetchMock.mockResolvedValue(jsonResponse(REVIEWED_SUBMISSION));

    const reviewed = await projectsApi.review("psub_1", {
      rubricScores: {
        correctitud: 4,
        calidad: 4,
        pruebas: 4,
        seguridad: 4,
        justificacion: 0,
      },
      feedback: "Falta la explicación propia",
    });

    expect(reviewed.status).toBe("REVIEWED");
    expect(reviewed.score).toBe(85);
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe(
      "http://localhost:3001/api/projects/submissions/psub_1/review",
    );
    expect(call?.[1]?.method).toBe("POST");
  });

  it("propaga el 422 de una rúbrica incompleta con su mensaje", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "RULE_VIOLATION",
            message:
              "La revisión debe puntuar los cinco criterios con niveles enteros de 0 a 4",
            traceId: "trace-422",
          },
        },
        { status: 422 },
      ),
    );

    const error = await captureApiError(
      projectsApi.review("psub_1", {
        rubricScores: {
          correctitud: 4,
          calidad: 4,
          pruebas: 4,
          seguridad: 4,
          justificacion: 4,
        },
      }),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe("RULE_VIOLATION");
    expect(error.message).toContain("cinco criterios");
  });

  it("publica y despublica con POST sin cuerpo", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ...REVIEWED_SUBMISSION,
          isPublic: true,
          publishedAt: "2026-10-28T12:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(jsonResponse(REVIEWED_SUBMISSION));

    const published = await projectsApi.publish("psub_1");
    const unpublished = await projectsApi.unpublish("psub_1");

    expect(published).toMatchObject({
      isPublic: true,
      publishedAt: "2026-10-28T12:00:00.000Z",
    });
    expect(unpublished).toMatchObject({ isPublic: false, publishedAt: null });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://localhost:3001/api/projects/submissions/psub_1/publish",
      "http://localhost:3001/api/projects/submissions/psub_1/unpublish",
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined();
  });
});

describe("portfolioApi", () => {
  const PORTFOLIO = {
    user: { id: "usr_1", name: "Ana", avatarUrl: null },
    entries: [
      {
        ...REVIEWED_SUBMISSION,
        isPublic: true,
        publishedAt: "2026-10-28T12:00:00.000Z",
      },
    ],
    publicCount: 1,
  } as const;

  it("lee el portafolio público sin cookie y con las entregas publicadas", async () => {
    fetchMock.mockResolvedValue(jsonResponse(PORTFOLIO));

    const portfolio = await portfolioApi.get("usr_1");

    expect(portfolio).toEqual(PORTFOLIO);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/portfolio/usr_1",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("include");
  });

  it("lee el portafolio propio desde `/portfolio/me`", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...PORTFOLIO, entries: [PROJECT_SUBMISSION], publicCount: 0 }),
    );

    const portfolio = await portfolioApi.getMine();

    expect(portfolio.entries[0]?.id).toBe("psub_1");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/portfolio/me",
    );
  });

  it("rechaza un portafolio que intenta filtrar el correo del autor", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...PORTFOLIO,
        user: { ...PORTFOLIO.user, email: "ana@example.com" },
      }),
    );

    const error = await captureApiError(portfolioApi.get("usr_1"));

    expect(error.status).toBe(500);
    expect(error.message).toContain("contrato");
  });
});

describe("interviewsApi", () => {
  const SUMMARY = {
    slug: "backend-junior",
    title: "Backend junior",
    role: "backend",
    level: "junior",
    language: "ts",
    competencies: ["C4", "C10"],
    phaseCount: 2,
    estimatedMinutes: 45,
    attempts: 2,
  } as const;

  const SCENARIO = {
    ...SUMMARY,
    phases: [
      { phase: "warmup", maxTurns: 2, objective: "Conocer al candidato." },
      { phase: "conceptual", maxTurns: 3, objective: "Comprobar fundamentos." },
    ],
    rubric: DEFAULT_INTERVIEW_RUBRIC,
  };

  const SESSION = {
    id: "ses_1",
    scenarioSlug: "backend-junior",
    scenarioTitle: "Backend junior",
    status: "IN_PROGRESS",
    phase: "warmup",
    turns: 0,
    startedAt: "2026-10-28T12:00:00.000Z",
    finishedAt: null,
    durationMinutes: null,
    score: null,
    selfScore: null,
    transcript: [
      {
        role: "interviewer",
        phase: "warmup",
        content: "Empecemos.",
        at: "2026-10-28T12:00:00.000Z",
      },
    ],
    selfScores: null,
    scores: null,
    feedback: null,
    degraded: false,
  } as const;

  const SELF = {
    scores: {
      razonamiento: 4,
      correctitud: 4,
      comunicacion: 4,
      seguimiento: 3,
      limites: 3,
    },
    reflection: "a".repeat(200),
  };

  it("lista escenarios con filtros y valida el sobre paginado", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [SUMMARY],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    );

    const page = await interviewsApi.list({
      role: "backend",
      level: "junior",
    });

    expect(page.scenarios[0]?.slug).toBe("backend-junior");
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/interviews/scenarios?",
    );
    expect(fetchMock.mock.calls[0]?.[0]).toContain("role=backend");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("level=junior");
  });

  it("lee el detalle sin la solución de referencia y rechaza un fugado", async () => {
    fetchMock.mockResolvedValue(jsonResponse(SCENARIO));

    const scenario = await interviewsApi.getScenario("backend-junior");

    expect(scenario.phases).toHaveLength(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/interviews/scenarios/backend-junior",
    );

    fetchMock.mockResolvedValue(
      jsonResponse({ ...SCENARIO, referenceSolution: "return values;" }),
    );

    const error = await captureApiError(
      interviewsApi.getScenario("backend-junior"),
    );

    expect(error.status).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  it("arranca la sesión con POST y devuelve el primer turno", async () => {
    fetchMock.mockResolvedValue(jsonResponse(SESSION, { status: 201 }));

    const session = await interviewsApi.start({
      scenarioSlug: "backend-junior",
    });

    expect(session.status).toBe("IN_PROGRESS");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ scenarioSlug: "backend-junior" }),
    });
  });

  it("propaga el 409 de una sesión ya abierta", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "CONFLICT",
            message: "SESSION_IN_PROGRESS: Ya hay una entrevista abierta",
            traceId: "trace-409",
          },
        },
        { status: 409 },
      ),
    );

    const error = await captureApiError(
      interviewsApi.start({ scenarioSlug: "backend-junior" }),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("SESSION_IN_PROGRESS");
  });

  it("envía un turno degradado con fase y turnos restantes", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        reply: "Réplica del guion.",
        phase: "conceptual",
        turn: 1,
        turnsRemaining: 39,
        degraded: true,
        budgetRemainingUsd: 4.5,
      }),
    );

    const turn = await interviewsApi.sendMessage("ses_1", {
      message: "Empezaría por el caso vacío.",
    });

    expect(turn).toMatchObject({ degraded: true, turnsRemaining: 39 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/interviews/sessions/ses_1/messages",
    );
  });

  it("propaga el 429 del tope de turnos con su espera", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message: "TURN_LIMIT_REACHED: La sesión alcanzó el tope",
            traceId: "trace-429",
          },
        },
        { status: 429, headers: { "Retry-After": "3600" } },
      ),
    );

    const error = await captureApiError(
      interviewsApi.sendMessage("ses_1", { message: "Otra idea." }),
    );

    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(3600);
  });

  it("lee el historial con mejor nota y promedio", async () => {
    const {
      transcript: _transcript,
      selfScores: _selfScores,
      scores: _scores,
      feedback: _feedback,
      degraded: _degraded,
      ...summary
    } = SESSION;
    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [{ ...summary, status: "REVIEWED", score: 85 }],
        best: { score: 85, sessionId: "ses_1" },
        average: 85,
      }),
    );

    const history = await interviewsApi.history();

    expect(history.best).toEqual({ score: 85, sessionId: "ses_1" });
    expect(history.average).toBe(85);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/interviews/sessions/me",
    );
  });

  it("envía la autoevaluación y la revisión con los cuerpos del contrato", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...SESSION, status: "COMPLETED" }),
    );

    await interviewsApi.selfReview("ses_1", SELF);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(SELF),
    });

    fetchMock.mockResolvedValue(
      jsonResponse({ ...SESSION, status: "REVIEWED", score: 85 }),
    );

    await interviewsApi.review("ses_1", {
      scores: SELF.scores,
      feedback: "Buen razonamiento.",
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://localhost:3001/api/interviews/sessions/ses_1/review",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        scores: SELF.scores,
        feedback: "Buen razonamiento.",
      }),
    });
  });
});

