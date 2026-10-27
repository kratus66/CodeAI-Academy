import {
  DEFAULT_ERROR_MESSAGE_BY_CODE,
  ERROR_CODE_BY_HTTP_STATUS,
  competencyProgressSchema,
  errorResponseSchema,
  exerciseDetailResponseSchema,
  exerciseListResponseSchema,
  hintResponseEnvelopeSchema,
  lessonDetailSchema,
  paginatedSchema,
  progressOverviewSchema,
  reviewAnswerResultSchema,
  reviewQueueResponseSchema,
  sandboxRunEnvelopeSchema,
  stageDetailSchema,
  stageSummarySchema,
  submissionListResponseSchema,
  submissionResponseSchema,
  unitDetailSchema,
  unitProgressSummarySchema,
  userResponseSchema,
} from "@codeai/shared";
import type {
  CompetencyProgress,
  CreateSubmissionInput,
  ErrorCode,
  ErrorDetail,
  ExerciseDetail,
  ExerciseListItem,
  HintLevel,
  HintResponse,
  LessonDetail,
  LoginInput,
  PaginationMeta,
  ProgressOverview,
  RegisterInput,
  ReviewAnswerInput,
  ReviewAnswerResult,
  ReviewQueueResponse,
  SandboxRunRequest,
  SandboxRunResponse,
  StageDetail,
  StageSummary,
  SubmissionSummary,
  UnitDetail,
  UnitProgressSummary,
  UserPublic,
} from "@codeai/shared";
import { z } from "zod";
import type { ZodType } from "zod";

/**
 * Destino por defecto en desarrollo. `NEXT_PUBLIC_API_URL` lo sobreescribe
 * (ver `.env.example`); se declara aquí para que la web arranque sin `.env`.
 */
export const DEFAULT_API_BASE_URL = "http://localhost:3001/api";

const CONTRACT_ERROR_MESSAGE =
  "La respuesta de la API no cumple el contrato esperado";

/** Normaliza la base para concatenar rutas que empiezan por `/`. */
export function resolveApiBaseUrl(rawUrl: string | undefined): string {
  const value = rawUrl?.trim();

  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  return value.replace(/\/+$/, "");
}

interface ApiErrorInit {
  readonly status: number;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
  readonly traceId?: string;
  readonly retryAfterSeconds?: number;
}

/**
 * Error normalizado del cliente: conserva el catálogo de `@codeai/shared` y el
 * `traceId` para poder reportar un fallo sin exponer la respuesta cruda.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[];
  readonly traceId?: string;
  readonly retryAfterSeconds?: number;

  constructor(init: ApiErrorInit) {
    super(init.message);

    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.traceId = init.traceId;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }

  /** `details` indexados por campo, listos para pintar junto a cada input. */
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const detail of this.details) {
      if (detail.field && !errors[detail.field]) {
        errors[detail.field] = detail.message;
      }
    }

    return errors;
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

/**
 * Petición JSON a la API con cookies de sesión incluidas. Los tokens viven en
 * cookies httpOnly, así que el navegador los envía y JavaScript nunca los lee.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const { method = "GET", body, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${normalizePath(path)}`, {
    method,
    headers,
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload as T;
}

export const authApi = {
  async register(input: RegisterInput): Promise<UserPublic> {
    return parseUserResponse(
      await apiRequest<unknown>("/auth/register", {
        method: "POST",
        body: input,
      }),
    );
  },

  async login(input: LoginInput): Promise<UserPublic> {
    return parseUserResponse(
      await apiRequest<unknown>("/auth/login", { method: "POST", body: input }),
    );
  },

  async me(signal?: AbortSignal): Promise<UserPublic> {
    return parseUserResponse(
      await apiRequest<unknown>("/auth/me", signal ? { signal } : {}),
    );
  },

  async refresh(): Promise<UserPublic> {
    return parseUserResponse(
      await apiRequest<unknown>("/auth/refresh", { method: "POST" }),
    );
  },

  async logout(): Promise<void> {
    await apiRequest<void>("/auth/logout", { method: "POST" });
  },
};

/** Catálogo paginado de etapas publicadas que consume la web. */
export interface StageCatalogPage {
  readonly stages: readonly StageSummary[];
  readonly meta: PaginationMeta;
}

const stagePageSchema = paginatedSchema(stageSummarySchema);
const stageResponseSchema = z.object({ stage: stageDetailSchema });
const unitResponseSchema = z.object({ unit: unitDetailSchema });
const lessonResponseSchema = z.object({ lesson: lessonDetailSchema });

/**
 * Contenido público del currículo. Cada respuesta se valida contra el contrato
 * de `@codeai/shared`: si la API cambia de forma, falla aquí y no en la vista.
 */
export const contentApi = {
  async listStages(signal?: AbortSignal): Promise<StageCatalogPage> {
    const page = await requestParsed(
      stagePageSchema,
      "/content/stages",
      signal,
    );

    return { stages: page.data, meta: page.meta };
  },

  /**
   * El `id` se acepta como texto: una URL con `abc` debe devolver el `400` de la
   * API y no reventar al convertirla en el cliente.
   */
  async getStage(
    id: number | string,
    signal?: AbortSignal,
  ): Promise<StageDetail> {
    const response = await requestParsed(
      stageResponseSchema,
      `/content/stages/${encodeURIComponent(String(id))}`,
      signal,
    );

    return response.stage;
  },

  async getUnit(code: string, signal?: AbortSignal): Promise<UnitDetail> {
    const response = await requestParsed(
      unitResponseSchema,
      `/content/units/${encodeURIComponent(code)}`,
      signal,
    );

    return response.unit;
  },

  async getLesson(slug: string, signal?: AbortSignal): Promise<LessonDetail> {
    const response = await requestParsed(
      lessonResponseSchema,
      `/content/lessons/${encodeURIComponent(slug)}`,
      signal,
    );

    return response.lesson;
  },
};

const unitProgressListSchema = z.object({ units: z.array(unitProgressSummarySchema) });
const competencyListSchema = z.object({
  competencies: z.array(competencyProgressSchema),
});
const unitProgressResponseSchema = z.object({ unit: unitProgressSummarySchema });

/**
 * Progreso del estudiante autenticado (`contratos-api.md` §4.4). Toda petición
 * viaja con cookies de sesión y la API responde `401` si no hay sesión válida,
 * así que el cliente no necesita conocer el token.
 */
export const progressApi = {
  async getOverview(signal?: AbortSignal): Promise<ProgressOverview> {
    return requestParsed(progressOverviewSchema, "/progress/overview", signal);
  },

  async listUnits(signal?: AbortSignal): Promise<UnitProgressSummary[]> {
    const response = await requestParsed(
      unitProgressListSchema,
      "/progress/units",
      signal,
    );

    return response.units;
  },

  async listCompetencies(signal?: AbortSignal): Promise<CompetencyProgress[]> {
    const response = await requestParsed(
      competencyListSchema,
      "/progress/competencies",
      signal,
    );

    return response.competencies;
  },

  /** Idempotente en el servidor: repetir la misma lección no cambia el avance. */
  async completeLesson(
    unitId: string,
    lessonId: string,
  ): Promise<UnitProgressSummary> {
    const response = parseContract(
      unitProgressResponseSchema,
      await apiRequest<unknown>(
        `/progress/units/${encodeURIComponent(unitId)}/complete-lesson`,
        { method: "POST", body: { lessonId } },
      ),
    );

    return response.unit;
  },
};

/** Catálogo paginado de ejercicios de una unidad. */
export interface ExerciseCatalogPage {
  readonly exercises: readonly ExerciseListItem[];
  readonly meta: PaginationMeta;
}

/**
 * Laboratorio de código (`contratos-api.md` §4.3). Igual que `progressApi`,
 * depende de la cookie de sesión; la API responde `401` sin ella y el cliente
 * deja que la vista decida qué hacer.
 *
 * El listado se pide por **código de unidad** porque es lo único que conoce la
 * web al entrar desde el currículo: el `id` del ejercicio se usa después para el
 * detalle y los envíos.
 */
export const exercisesApi = {
  async listByUnit(
    unitCode: string,
    signal?: AbortSignal,
  ): Promise<ExerciseCatalogPage> {
    const page = await requestParsed(
      exerciseListResponseSchema,
      `/exercises/units/${encodeURIComponent(unitCode)}`,
      signal,
    );

    return { exercises: page.data, meta: page.meta };
  },

  async getDetail(
    id: string,
    signal?: AbortSignal,
  ): Promise<ExerciseDetail> {
    const response = await requestParsed(
      exerciseDetailResponseSchema,
      `/exercises/${encodeURIComponent(id)}`,
      signal,
    );

    return response.exercise;
  },

  /**
   * Pide la pista de un nivel (`contratos-api.md` §4.3). El servidor valida la
   * progresión: pedir el nivel 2 sin el 1 responde `422 RULE_VIOLATION` y el
   * cliente lo deja subir como `ApiError` para que la vista lo explique.
   */
  async requestHint(id: string, level: HintLevel): Promise<HintResponse> {
    const response = parseContract(
      hintResponseEnvelopeSchema,
      await apiRequest<unknown>(`/exercises/${encodeURIComponent(id)}/hints`, {
        method: "POST",
        body: { level },
      }),
    );

    return response.hint;
  },

  /** Historial del propio estudiante; la API nunca devuelve envíos ajenos. */
  async listSubmissions(
    id: string,
    signal?: AbortSignal,
  ): Promise<SubmissionSummary[]> {
    const page = await requestParsed(
      submissionListResponseSchema,
      `/exercises/${encodeURIComponent(id)}/submissions`,
      signal,
    );

    return page.data;
  },

  async submit(
    id: string,
    input: CreateSubmissionInput,
  ): Promise<SubmissionSummary> {
    const response = parseContract(
      submissionResponseSchema,
      await apiRequest<unknown>(
        `/exercises/${encodeURIComponent(id)}/submissions`,
        { method: "POST", body: input },
      ),
    );

    return response.submission;
  },
};

/**
 * Ejecución suelta en el sandbox (`contratos-api.md` §4.6), para el botón
 * «Probar» antes de enviar. Comparte cuota con los envíos: la API limita a
 * veinte ejecuciones por minuto y responde `429` con `Retry-After`, que
 * `apiRequest` ya expone en `ApiError.retryAfterSeconds`.
 */
export const sandboxApi = {
  async run(
    input: SandboxRunRequest,
    signal?: AbortSignal,
  ): Promise<SandboxRunResponse> {
    const response = parseContract(
      sandboxRunEnvelopeSchema,
      await apiRequest<unknown>("/sandbox/run", {
        method: "POST",
        body: input,
        ...(signal ? { signal } : {}),
      }),
    );

    return response.run;
  },
};

/**
 * Repaso espaciado (`contratos-api.md` §4.5). La cola llega acotada y
 * intercalada por el servidor; el cliente no reordena ni calcula intervalos: sólo
 * valida el contrato y envía la calidad elegida.
 */
export const reviewApi = {
  async getQueue(signal?: AbortSignal): Promise<ReviewQueueResponse> {
    return requestParsed(reviewQueueResponseSchema, "/review/queue", signal);
  },

  async answer(
    itemId: string,
    input: ReviewAnswerInput,
  ): Promise<ReviewAnswerResult> {
    return parseContract(
      reviewAnswerResultSchema,
      await apiRequest<unknown>(
        `/review/items/${encodeURIComponent(itemId)}/answer`,
        { method: "POST", body: input },
      ),
    );
  },
};

/**
 * Sesión inicial de la aplicación: usa `/auth/me` y, si el access token caducó,
 * rota el refresh una sola vez. Devuelve `null` cuando no hay sesión válida.
 */
export async function restoreSession(
  signal?: AbortSignal,
): Promise<UserPublic | null> {
  try {
    return await authApi.me(signal);
  } catch (error) {
    if (!isUnauthenticated(error)) {
      throw error;
    }
  }

  try {
    return await authApi.refresh();
  } catch (error) {
    if (isUnauthenticated(error)) {
      return null;
    }

    throw error;
  }
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  const retryAfterSeconds = readRetryAfter(response.headers.get("Retry-After"));
  const parsed = errorResponseSchema.safeParse(payload);

  if (parsed.success) {
    return new ApiError({
      status: response.status,
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      details: parsed.data.error.details,
      traceId: parsed.data.error.traceId,
      retryAfterSeconds,
    });
  }

  const code = ERROR_CODE_BY_HTTP_STATUS[response.status] ?? "INTERNAL_ERROR";

  return new ApiError({
    status: response.status,
    code,
    message: DEFAULT_ERROR_MESSAGE_BY_CODE[code],
    retryAfterSeconds,
  });
}

/** La API publica `Retry-After` en segundos (ver `contratos-api.md` §6). */
function readRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
}

function parseUserResponse(payload: unknown): UserPublic {
  return parseContract(userResponseSchema, payload).user;
}

/** `GET` con validación de contrato antes de tocar la vista. */
async function requestParsed<T>(
  schema: ZodType<T>,
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  return parseContract(
    schema,
    await apiRequest<unknown>(path, signal ? { signal } : {}),
  );
}

/**
 * Una respuesta fuera de esquema se reporta como error interno: el estudiante ve
 * el mensaje del catálogo, nunca la forma cruda de la respuesta.
 */
function parseContract<T>(schema: ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: CONTRACT_ERROR_MESSAGE,
    });
  }

  return parsed.data;
}

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
