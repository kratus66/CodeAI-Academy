import { LESSON_STEP_KINDS } from "@codeai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  authApi,
  contentApi,
  progressApi,
  resolveApiBaseUrl,
  restoreSession,
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
