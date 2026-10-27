import { z } from "zod";

import { SUBMISSION_OUTCOMES } from "../enums/exercise";

/**
 * Lenguajes que el sandbox sabe ejecutar (`sandbox-ejecucion.md` §5). Se extrae
 * del cuerpo del documento para que el contrato del ejercicio lo reutilice sin
 * repetir los literales.
 */
export const sandboxLanguageSchema = z.enum(["typescript", "javascript", "sql"]);

export type SandboxLanguage = z.infer<typeof sandboxLanguageSchema>;

/** Límites de tamaño del código y de la salida (`sandbox-ejecucion.md` §4 y §7). */
const FILE_PATH_MAX_CHARS = 200;
const FILE_CONTENT_MAX_CHARS = 100_000;
const TEST_CODE_MAX_CHARS = 20_000;
const FILES_MAX = 10;
const TESTS_MAX = 30;
const OUTPUT_MAX_CHARS = 65_536;
const MESSAGE_MAX_CHARS = 500;

const sandboxFileSchema = z.object({
  path: z.string().max(FILE_PATH_MAX_CHARS),
  content: z.string().max(FILE_CONTENT_MAX_CHARS),
});

const sandboxTestSchema = z.object({
  id: z.string(),
  code: z.string().max(TEST_CODE_MAX_CHARS),
  weight: z.number().default(1),
});

/** El sandbox aplica además sus propios topes de contenedor; aquí sólo se valida la petición. */
const sandboxLimitsSchema = z.object({
  timeoutMs: z.number().min(500).max(5000).default(5000),
  memoryMb: z.number().min(64).max(512).default(256),
});

/** `POST /api/sandbox/run` — cuerpo de la petición. */
export const sandboxRunRequestSchema = z.object({
  language: sandboxLanguageSchema,
  files: z.array(sandboxFileSchema).min(1).max(FILES_MAX),
  tests: z.array(sandboxTestSchema).max(TESTS_MAX),
  limits: sandboxLimitsSchema.default({}),
});

export type SandboxRunRequest = z.infer<typeof sandboxRunRequestSchema>;

const sandboxTestResultSchema = z.object({
  testId: z.string(),
  passed: z.boolean(),
  message: z.string().max(MESSAGE_MAX_CHARS).optional(),
  durationMs: z.number().optional(),
});

export type SandboxTestResult = z.infer<typeof sandboxTestResultSchema>;

/**
 * Resultado de una ejecución. `outcome` reutiliza los desenlaces de envío
 * (`SUBMISSION_OUTCOMES`): un sandbox no inventa estados propios
 * (`sandbox-ejecucion.md` §6).
 */
export const sandboxRunResponseSchema = z.object({
  outcome: z.enum(SUBMISSION_OUTCOMES),
  score: z.number().min(0).max(100),
  results: z.array(sandboxTestResultSchema),
  stdout: z.string().max(OUTPUT_MAX_CHARS).optional(),
  stderr: z.string().max(OUTPUT_MAX_CHARS).optional(),
  durationMs: z.number(),
});

export type SandboxRunResponse = z.infer<typeof sandboxRunResponseSchema>;

/** Respuesta del endpoint: la ejecución viaja bajo la clave `run`. */
export const sandboxRunEnvelopeSchema = z.object({
  run: sandboxRunResponseSchema,
});

export type SandboxRunEnvelope = z.infer<typeof sandboxRunEnvelopeSchema>;
