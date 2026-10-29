import { z } from "zod";

/**
 * Contrato de analítica de S11 (`sprint-11-analitica-lanzamiento.md` §4.1).
 *
 * Se mide lo que existe: hay actividad (envíos y repasos), no tiempo de
 * permanencia. El resumen no inventa minutos que la base nunca guardó.
 */

/** Rangos admitidos por `range`; `all` empieza en la época. */
export const ANALYTICS_RANGES = ["7d", "30d", "90d", "all"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** Rango por defecto del contrato. */
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = "30d";

/** `range` como query string: ausente usa `30d`; cualquier otro valor es inválido. */
export const analyticsRangeQuerySchema = z.object({
  range: z
    .enum(ANALYTICS_RANGES, {
      errorMap: () => ({
        message: `El rango debe ser uno de: ${ANALYTICS_RANGES.join(", ")}`,
      }),
    })
    .default(DEFAULT_ANALYTICS_RANGE),
});

export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;

const countSchema = z
  .number({ invalid_type_error: "El contador debe ser un número" })
  .int("El contador debe ser un número entero")
  .nonnegative("El contador no puede ser negativo");

const pctSchema = z
  .number({ invalid_type_error: "El porcentaje debe ser un número" })
  .min(0, "El porcentaje no puede ser negativo")
  .max(100, "El porcentaje no puede superar 100");

const shareSchema = z
  .number({ invalid_type_error: "La cuota debe ser un número" })
  .min(0, "La cuota no puede ser negativa")
  .max(1, "La cuota no puede superar 1");

const isoTimestampSchema = z
  .string({ invalid_type_error: "La fecha debe ser texto ISO 8601" })
  .datetime("La fecha debe estar en formato ISO 8601");

/** Nivel de gasto de IA que expone el resumen (`§4.1`). */
export const analyticsBudgetLevelSchema = z.enum(["ok", "warning", "exceeded"]);

export type AnalyticsBudgetLevel = z.infer<typeof analyticsBudgetLevelSchema>;

/** Resumen del estudiante autenticado (`GET /api/analytics/me/summary`). */
export const studentSummarySchema = z.object({
  range: z.enum(ANALYTICS_RANGES),
  /** Media del avance de las unidades publicadas, 0–100. */
  overallPct: pctSchema,
  /** Días con al menos un envío o repaso dentro del rango. */
  activeDays: countSchema,
  lastActivityAt: isoTimestampSchema.nullable(),
  units: z.object({
    mastered: countSchema,
    inProgress: countSchema,
    needsReview: countSchema,
    locked: countSchema,
    total: countSchema,
  }),
  submissions: z.object({
    total: countSchema,
    passed: countSchema,
    failed: countSchema,
    avgScore: pctSchema.nullable(),
  }),
  reviews: z.object({
    due: countSchema,
    completed: countSchema,
    lapses: countSchema,
  }),
  ai: z.object({
    calls: countSchema,
    costUsd: z
      .number({ invalid_type_error: "El costo debe ser un número" })
      .nonnegative("El costo no puede ser negativo"),
    budgetLevel: analyticsBudgetLevelSchema,
  }),
});

export type StudentSummary = z.infer<typeof studentSummarySchema>;

/** Desglose de errores propio (`GET /api/analytics/me/errors`). */
export const errorBreakdownSchema = z.object({
  range: z.enum(ANALYTICS_RANGES),
  total: countSchema,
  byCategory: z.array(
    z.object({
      category: z.string().min(1),
      count: countSchema,
      share: shareSchema,
    }),
  ),
  byConcept: z.array(
    z.object({
      conceptSlug: z.string().min(1),
      conceptName: z.string().min(1),
      count: countSchema,
    }),
  ),
});

export type ErrorBreakdown = z.infer<typeof errorBreakdownSchema>;

/** Máximo de filas de `atRisk` (`§4.4`): el resto se resume en `reviewBacklog`. */
export const COHORT_AT_RISK_LIMIT = 20;

/** Agregados de cohorte (`GET /api/analytics/cohort`, sólo instructor/admin). */
export const cohortAnalyticsSchema = z.object({
  range: z.enum(ANALYTICS_RANGES),
  students: z.object({
    total: countSchema,
    active: countSchema,
  }),
  avgOverallPct: pctSchema,
  stageCompletion: z.array(
    z.object({
      stage: z.string().min(1),
      completedPct: pctSchema,
      studentsAtStage: countSchema,
    }),
  ),
  topErrors: z.array(
    z.object({
      category: z.string().min(1),
      count: countSchema,
      share: shareSchema,
    }),
  ),
  reviewBacklog: countSchema,
  /** Sin correo ni nombre completo: `displayName` basta para el panel. */
  atRisk: z
    .array(
      z.object({
        userId: z.string().min(1),
        displayName: z.string().min(1),
        overallPct: pctSchema,
        daysSinceActivity: countSchema,
      }),
    )
    .max(COHORT_AT_RISK_LIMIT),
});

export type CohortAnalytics = z.infer<typeof cohortAnalyticsSchema>;

/** Estado de dependencias (`GET /api/health/ready`). Nunca incluye la URL. */
export const readinessResponseSchema = z.object({
  status: z.enum(["ready", "degraded"]),
  checks: z.array(
    z.object({
      name: z.literal("database"),
      ok: z.boolean(),
      latencyMs: countSchema,
    }),
  ),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
