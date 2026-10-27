import { z } from "zod";

import { UNIT_STATES } from "../enums/exercise";
import { CURRICULUM_STAGE_COUNT } from "./content";

/**
 * Avance de una unidad o global, en porcentaje 0–100
 * (`docs/03-arquitectura/modelo-datos.md` §4). Es un porcentaje, no un importe:
 * no interviene ninguna operación monetaria.
 */
export const progressPctSchema = z
  .number({ invalid_type_error: "El avance debe ser un número" })
  .min(0, "El avance no puede ser negativo")
  .max(100, "El avance no puede superar 100");

/** Competencias del perfil profesional: C1–C14 (`mapa-competencias.md`). */
export const competencyCodeSchema = z
  .string({ invalid_type_error: "La competencia debe ser un código" })
  .regex(/^C([1-9]|1[0-4])$/, "La competencia debe ser un código entre C1 y C14");

/** Nivel de dominio de una competencia: 0 (sin evidencia) a 4 (autónomo). */
export const competencyLevelSchema = z
  .number({ invalid_type_error: "El nivel debe ser un número" })
  .int("El nivel debe ser un número entero")
  .min(0, "El nivel debe estar entre 0 y 4")
  .max(4, "El nivel debe estar entre 0 y 4");

const countSchema = z
  .number({ invalid_type_error: "El contador debe ser un número" })
  .int("El contador debe ser un número entero")
  .nonnegative("El contador no puede ser negativo");

const isoTimestampSchema = z
  .string({ invalid_type_error: "La fecha debe ser texto ISO 8601" })
  .datetime("La fecha debe estar en formato ISO 8601");

/** Resumen de una unidad para su dueño (`GET /api/progress/units`). */
export const unitProgressSummarySchema = z.object({
  unitId: z.string().min(1),
  unitCode: z.string().min(1),
  state: z.enum(UNIT_STATES),
  progressPct: progressPctSchema,
  lessonsDone: countSchema,
  exercisesDone: countSchema,
  bestScore: progressPctSchema.nullable(),
  lastActivityAt: isoTimestampSchema.nullable(),
  completedAt: isoTimestampSchema.nullable(),
});

export type UnitProgressSummary = z.infer<typeof unitProgressSummarySchema>;

/** Nivel alcanzado en una competencia (`GET /api/progress/competencies`). */
export const competencyProgressSchema = z.object({
  code: competencyCodeSchema,
  level: competencyLevelSchema,
  evidenceCount: countSchema,
});

export type CompetencyProgress = z.infer<typeof competencyProgressSchema>;

/** Contadores por estado de unidad que publica `GET /api/progress/overview`. */
export const progressCountsSchema = z.object({
  mastered: countSchema,
  inProgress: countSchema,
  needsReview: countSchema,
  locked: countSchema,
});

export type ProgressCounts = z.infer<typeof progressCountsSchema>;

/**
 * Resumen global del avance. `currentStage` es la etapa en curso (0–11) y
 * `dueReviews` cuenta los repasos vencidos; mientras no exista `ReviewItem`
 * (S7) el servicio responde `0`.
 */
export const progressOverviewSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  currentStage: z
    .number({ invalid_type_error: "La etapa actual debe ser un número" })
    .int("La etapa actual debe ser un número entero")
    .min(0, "La etapa actual debe estar entre 0 y 11")
    .max(CURRICULUM_STAGE_COUNT - 1, "La etapa actual debe estar entre 0 y 11"),
  overallPct: progressPctSchema,
  units: progressCountsSchema,
  competencies: z.array(competencyProgressSchema),
  dueReviews: countSchema,
});

export type ProgressOverview = z.infer<typeof progressOverviewSchema>;
