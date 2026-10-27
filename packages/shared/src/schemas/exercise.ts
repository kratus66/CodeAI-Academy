import { z } from "zod";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import { EXERCISE_TYPES, LADDERS, SUBMISSION_OUTCOMES } from "../enums/exercise";
import { paginatedSchema } from "./common";
import { competencyCodeSchema } from "./progress";
import { sandboxLanguageSchema } from "./sandbox";

/**
 * Contrato del laboratorio de código (`contratos-api.md` §4.3 y §4.6).
 *
 * El resumen se llama `ExerciseListItem` y no `ExerciseSummary` porque
 * `schemas/content.ts` ya exporta ese nombre para el ejercicio incrustado en el
 * detalle de una unidad; con dos `export *` en `index.ts`, los nombres
 * repetidos quedarían ambiguos.
 */

const TITLE_MAX_CHARS = 200;
const NAME_MAX_CHARS = 200;
const FEEDBACK_MAX_CHARS = 1_000;
const CODE_MAX_CHARS = 100_000;
const SELF_EXPLANATION_MAX_CHARS = 2_000;

/** `banco-ejercicios.md` §6: la dificultad es 1–4, no 1–5. */
export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 4;

export const difficultySchema = z
  .number({ invalid_type_error: "La dificultad debe ser un número" })
  .int("La dificultad debe ser un número entero")
  .min(DIFFICULTY_MIN, `La dificultad debe estar entre ${DIFFICULTY_MIN} y ${DIFFICULTY_MAX}`)
  .max(DIFFICULTY_MAX, `La dificultad debe estar entre ${DIFFICULTY_MIN} y ${DIFFICULTY_MAX}`);

/** Nivel demostrado en un envío (`modelo-datos.md` §3: `achievedLevel` 1–4). */
export const achievedLevelSchema = z
  .number({ invalid_type_error: "El nivel debe ser un número" })
  .int("El nivel debe ser un número entero")
  .min(1, "El nivel debe estar entre 1 y 4")
  .max(DIFFICULTY_MAX, "El nivel debe estar entre 1 y 4");

/** Fila del listado de ejercicios de una unidad (`GET /api/exercises/units/:code`). */
export const exerciseListItemSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  unitCode: z.string().min(1),
  type: z.enum(EXERCISE_TYPES),
  title: z
    .string({ invalid_type_error: "El título debe ser texto" })
    .min(1, "El título es obligatorio")
    .max(TITLE_MAX_CHARS, `El título no puede superar ${TITLE_MAX_CHARS} caracteres`),
  ladder: z.enum(LADDERS),
  difficulty: difficultySchema,
  estimatedMin: z
    .number({ invalid_type_error: "La duración debe ser un número" })
    .int("La duración debe ser un número entero")
    .positive("La duración debe ser mayor que cero")
    .nullable(),
  language: sandboxLanguageSchema.nullable(),
  competencies: z.array(competencyCodeSchema),
});

export type ExerciseListItem = z.infer<typeof exerciseListItemSchema>;

/**
 * Prueba visible del ejercicio: identificador y nombre, nunca el código de la
 * aserción ni el resultado esperado. Los tests con `isHidden: true` no salen del
 * servidor (`modelo-datos.md` §3).
 */
export const exercisePublicTestSchema = z.object({
  testId: z.string().min(1),
  name: z.string().min(1).max(NAME_MAX_CHARS),
});

export type ExercisePublicTest = z.infer<typeof exercisePublicTestSchema>;

/** Detalle del ejercicio: sin `solution`, sin `sources` y sin tests ocultos. */
export const exerciseDetailSchema = exerciseListItemSchema.extend({
  statement: z.string().min(1),
  config: z.record(z.unknown()),
  publicTests: z.array(exercisePublicTestSchema),
  /** Cantidad de pistas, nunca su texto (el texto llega con S6). */
  hintsAvailable: z.number().int().nonnegative(),
  starterCode: z.string().nullable(),
});

export type ExerciseDetail = z.infer<typeof exerciseDetailSchema>;

/** Resultado de una prueba en un envío. */
export const submissionTestResultSchema = z.object({
  testId: z.string().min(1),
  name: z.string().min(1).max(NAME_MAX_CHARS),
  passed: z.boolean(),
  durationMs: z.number().int().nonnegative().optional(),
});

export type SubmissionTestResult = z.infer<typeof submissionTestResultSchema>;

/**
 * Envío tal como lo ve su dueño. `achievedLevel` es `null` en S5: el nivel por
 * pistas y las pruebas ocultas llegan con S6.
 */
export const submissionSummarySchema = z.object({
  id: z.string().min(1),
  outcome: z.enum(SUBMISSION_OUTCOMES),
  score: z.number().min(0).max(100),
  achievedLevel: achievedLevelSchema.nullable(),
  hintsUsed: z.number().int().nonnegative(),
  results: z.array(submissionTestResultSchema),
  feedback: z.string().max(FEEDBACK_MAX_CHARS),
  createdAt: z.string().datetime(),
});

export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;

/** `POST /api/exercises/:id/submissions` — cuerpo de la petición. */
export const createSubmissionSchema = z.object({
  code: z
    .string({
      required_error: "El código es obligatorio",
      invalid_type_error: "El código debe ser texto",
    })
    .min(1, "El código es obligatorio")
    .max(CODE_MAX_CHARS, `El código no puede superar ${CODE_MAX_CHARS} caracteres`),
  selfExplanation: z
    .string({ invalid_type_error: "La explicación debe ser texto" })
    .max(
      SELF_EXPLANATION_MAX_CHARS,
      `La explicación no puede superar ${SELF_EXPLANATION_MAX_CHARS} caracteres`,
    )
    .optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

/**
 * Paginación de los listados del laboratorio. Es la misma forma que
 * `pageQuerySchema` de `schemas/content.ts`, que no se exporta; se extraerá a
 * `common.ts` cuando un tercer contrato la necesite.
 */
export const exerciseListQuerySchema = z
  .object({
    page: z.coerce
      .number({ invalid_type_error: "La página debe ser un número entero" })
      .int("La página debe ser un número entero")
      .min(1, "La página debe ser 1 o mayor")
      .default(1),
    pageSize: z.coerce
      .number({ invalid_type_error: "El tamaño de página debe ser un número entero" })
      .int("El tamaño de página debe ser un número entero")
      .min(1, "El tamaño de página debe ser 1 o mayor")
      .max(PAGE_SIZE_MAX, `El tamaño de página no puede superar ${PAGE_SIZE_MAX}`)
      .default(PAGE_SIZE_DEFAULT),
  })
  .strict();

export type ExerciseListQuery = z.infer<typeof exerciseListQuerySchema>;

export const exerciseListResponseSchema = paginatedSchema(exerciseListItemSchema);
export const exerciseDetailResponseSchema = z.object({ exercise: exerciseDetailSchema });
export const submissionResponseSchema = z.object({ submission: submissionSummarySchema });
export const submissionListResponseSchema = paginatedSchema(submissionSummarySchema);

export type ExerciseListResponse = z.infer<typeof exerciseListResponseSchema>;
export type ExerciseDetailResponse = z.infer<typeof exerciseDetailResponseSchema>;
export type SubmissionResponse = z.infer<typeof submissionResponseSchema>;
export type SubmissionListResponse = z.infer<typeof submissionListResponseSchema>;

