import { z } from "zod";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import { paginatedSchema } from "./common";
import { competencyCodeSchema } from "./progress";
import { unlockStatusSchema } from "./unlock";

/**
 * Contrato de entrevistas (`contratos-api.md` §4.12 y
 * `sprint-10-entrevistas.md` §4).
 *
 * El guion lo impone el servidor: las fases, su número máximo de turnos y los
 * pesos de la rúbrica forman parte del contrato. La solución de referencia
 * **nunca** aparece aquí: vive solo en `InterviewScenario.referenceSolution` y
 * el adaptador no la copia a ningún objeto que se sirva al cliente.
 */

/** Fases del guion, en orden (`sprint-10-entrevistas.md` §3.2). */
export const INTERVIEW_PHASES = [
  "warmup",
  "conceptual",
  "live-coding",
  "code-review",
  "follow-ups",
  "candidate-questions",
] as const;

export type InterviewPhase = (typeof INTERVIEW_PHASES)[number];

/** Etiquetas legibles para la web; no alteran el contrato de la API. */
export const INTERVIEW_PHASE_LABELS: Record<InterviewPhase, string> = {
  warmup: "Presentación",
  conceptual: "Conceptos",
  "live-coding": "Código en vivo",
  "code-review": "Revisión de código",
  "follow-ups": "Repreguntas",
  "candidate-questions": "Tus preguntas",
};

/** Máquina de estados de la sesión (§3.1). */
export const INTERVIEW_STATUSES = [
  "IN_PROGRESS",
  "COMPLETED",
  "REVIEWED",
  "ABANDONED",
] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/** Criterios de la rúbrica de entrevista (`rubricas-evaluacion.md` §2.6). */
export const INTERVIEW_CRITERIA = [
  "razonamiento",
  "correctitud",
  "comunicacion",
  "seguimiento",
  "limites",
] as const;

export type InterviewCriterion = (typeof INTERVIEW_CRITERIA)[number];

export const INTERVIEW_CRITERION_LABELS: Record<InterviewCriterion, string> = {
  razonamiento: "Razonamiento y descomposición del problema",
  correctitud: "Correctitud técnica de las respuestas",
  comunicacion: "Comunicación y claridad",
  seguimiento: "Seguimiento de repreguntas y correcciones",
  limites: "Reconocimiento de límites y honestidad técnica",
};

/** Pesos de `rubricas-evaluacion.md` §2.6; suman 100. */
export const DEFAULT_INTERVIEW_RUBRIC: Readonly<
  Record<InterviewCriterion, number>
> = {
  razonamiento: 30,
  correctitud: 25,
  comunicacion: 20,
  seguimiento: 15,
  limites: 10,
};

/** Niveles de la rúbrica: 0 = no cumple; 4 = dominio. */
export const INTERVIEW_SCORE_MIN = 0;
export const INTERVIEW_SCORE_MAX = 4;

/** Tope duro por sesión: cada turno es una llamada real al proveedor. */
export const INTERVIEW_MAX_TURNS = 40;

/** Longitud del mensaje del candidato (§3.3). */
export const INTERVIEW_MESSAGE_MAX = 2_000;

/** Un bloque de código más largo que esto no es una respuesta de entrevista. */
export const INTERVIEW_MESSAGE_MAX_LINES = 400;

/** Reflexión mínima de la autoevaluación (§3.5). */
export const INTERVIEW_REFLECTION_MIN = 200;
export const INTERVIEW_REFLECTION_MAX = 2_000;

/** Tope de la retroalimentación del instructor. */
export const INTERVIEW_FEEDBACK_MAX = 2_000;

/** Un extracto de transcripción no necesita más; evita filas enormes. */
export const INTERVIEW_TRANSCRIPT_CONTENT_MAX = 4_000;

/** Nota mínima que deja evidencia de competencia (§3.5). */
export const INTERVIEW_EVIDENCE_MIN_SCORE = 80;

/** Competencia que acredita una entrevista aprobada. */
export const INTERVIEW_EVIDENCE_COMPETENCY = "C10";

/** Inactividad que convierte una sesión en `ABANDONED` al leerla. */
export const INTERVIEW_STALE_HOURS = 48;

/** Duración aceptada de una sesión cerrada (minutos). */
export const INTERVIEW_DURATION_MIN_MINUTES = 1;
export const INTERVIEW_DURATION_MAX_MINUTES = 240;

/** Roles, niveles y lenguajes del catálogo (§4.1). */
export const INTERVIEW_ROLES = [
  "backend",
  "frontend",
  "fullstack",
  "data",
  "qa",
] as const;

export type InterviewRole = (typeof INTERVIEW_ROLES)[number];

export const INTERVIEW_LEVELS = ["junior", "semi-senior", "senior"] as const;

export type InterviewLevel = (typeof INTERVIEW_LEVELS)[number];

export const INTERVIEW_LANGUAGES = ["ts", "py", "java", "go"] as const;

export type InterviewLanguage = (typeof INTERVIEW_LANGUAGES)[number];

/**
 * Réplica estática de cada fase (§3.7): sin proveedor o con presupuesto
 * agotado, la entrevista sigue existiendo y el turno se marca `degraded`.
 */
export const INTERVIEW_STATIC_REPLIES: Readonly<
  Record<InterviewPhase, string>
> = {
  warmup:
    "Gracias por la presentación. Cuéntame brevemente un problema técnico que hayas resuelto y cómo mediste que funcionaba.",
  conceptual:
    "Vamos a los conceptos. ¿Qué garantiza una función pura y qué efectos observas cuando deja de serlo?",
  "live-coding":
    "Pasemos al código. Escribe la función que resolvería el caso y explica en voz alta los casos límite antes de implementarlos.",
  "code-review":
    "Te paso un fragmento con un problema. ¿Qué cambiarías y por qué? Prioriza el riesgo antes que el estilo.",
  "follow-ups":
    "Repregunto sobre tu última respuesta: ¿qué supuesto cambia si el volumen se multiplica por cien?",
  "candidate-questions":
    "Para cerrar, hazme una pregunta sobre el equipo o el producto y explica por qué te ayudaría a decidir.",
};

/** Texto con el que arranca la sesión, antes de cualquier llamada al proveedor. */
export const INTERVIEW_OPENING =
  "Entrevista de práctica de CodeAI Academy. Responde con tus palabras: valoro cómo razonas más que la respuesta exacta. Empecemos.";

export const interviewPhaseSchema = z.enum(INTERVIEW_PHASES);
export const interviewStatusSchema = z.enum(INTERVIEW_STATUSES);
export const interviewCriterionSchema = z.enum(INTERVIEW_CRITERIA);
export const interviewRoleSchema = z.enum(INTERVIEW_ROLES);
export const interviewLevelSchema = z.enum(INTERVIEW_LEVELS);
export const interviewLanguageSchema = z.enum(INTERVIEW_LANGUAGES);

const isoTimestampSchema = z
  .string({ invalid_type_error: "La fecha debe ser texto ISO 8601" })
  .datetime("La fecha debe estar en formato ISO 8601");

/** Una fase declara cuántos turnos del candidato admite y qué se busca. */
export const interviewScenarioPhaseSchema = z
  .object({
    phase: interviewPhaseSchema,
    maxTurns: z
      .number({ invalid_type_error: "Los turnos deben ser un número entero" })
      .int("Los turnos deben ser un número entero")
      .min(1, "Cada fase admite al menos un turno")
      .max(20, "Ninguna fase admite más de 20 turnos"),
    objective: z
      .string({ required_error: "El objetivo de la fase es obligatorio" })
      .min(1, "El objetivo de la fase no puede estar vacío")
      .max(280, "El objetivo de la fase no puede superar 280 caracteres"),
  })
  .strict();

export type InterviewScenarioPhase = z.infer<
  typeof interviewScenarioPhaseSchema
>;

/** Pesos por criterio: enteros no negativos que suman 100. */
export const interviewRubricSchema = z
  .object({
    razonamiento: z.number().int().min(0).max(100),
    correctitud: z.number().int().min(0).max(100),
    comunicacion: z.number().int().min(0).max(100),
    seguimiento: z.number().int().min(0).max(100),
    limites: z.number().int().min(0).max(100),
  })
  .strict()
  .refine(
    (rubric) =>
      INTERVIEW_CRITERIA.reduce(
        (total, criterion) => total + rubric[criterion],
        0,
      ) === 100,
    { message: "Los pesos de la rúbrica deben sumar 100" },
  );

export type InterviewRubric = z.infer<typeof interviewRubricSchema>;

/** Niveles 0–4 de los cinco criterios; faltar uno es un contrato inválido. */
export const interviewScoresSchema = z
  .object({
    razonamiento: z.number().int().min(INTERVIEW_SCORE_MIN).max(INTERVIEW_SCORE_MAX),
    correctitud: z.number().int().min(INTERVIEW_SCORE_MIN).max(INTERVIEW_SCORE_MAX),
    comunicacion: z.number().int().min(INTERVIEW_SCORE_MIN).max(INTERVIEW_SCORE_MAX),
    seguimiento: z.number().int().min(INTERVIEW_SCORE_MIN).max(INTERVIEW_SCORE_MAX),
    limites: z.number().int().min(INTERVIEW_SCORE_MIN).max(INTERVIEW_SCORE_MAX),
  })
  .strict();

export type InterviewScores = z.infer<typeof interviewScoresSchema>;

/** Nota calculada al revisar: guarda la rúbrica aplicada junto a los niveles. */
export const interviewEvaluationSchema = z
  .object({
    rubric: interviewRubricSchema,
    levels: interviewScoresSchema,
    score: z.number().min(0).max(100),
  })
  .strict();

export type InterviewEvaluation = z.infer<typeof interviewEvaluationSchema>;

/**
 * Autoevaluación guardada en `InterviewSession.selfScores`: los niveles que el
 * candidato se puso, la nota derivada y la reflexión que la justifica.
 */
export const interviewSelfReviewRecordSchema = z
  .object({
    scores: interviewScoresSchema,
    score: z.number().min(0).max(100),
    reflection: z
      .string()
      .min(INTERVIEW_REFLECTION_MIN)
      .max(INTERVIEW_REFLECTION_MAX),
  })
  .strict();

export type InterviewSelfReviewRecord = z.infer<
  typeof interviewSelfReviewRecordSchema
>;

const slugSchema = z
  .string({ invalid_type_error: "El slug debe ser texto" })
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug en minúsculas separado por guiones");

const estimatedMinutesSchema = z
  .number({ invalid_type_error: "La duración debe ser un número entero" })
  .int("La duración debe ser un número entero")
  .min(10, "La entrevista dura al menos 10 minutos")
  .max(180, "La entrevista no supera 180 minutos");

const competenciesSchema = z
  .array(competencyCodeSchema)
  .min(1, "El escenario debe declarar al menos una competencia");

/** Fila del catálogo: nunca incluye `referenceSolution`. */
export const interviewScenarioSummarySchema = z
  .object({
    slug: slugSchema,
    title: z.string().min(1),
    role: interviewRoleSchema,
    level: interviewLevelSchema,
    language: interviewLanguageSchema,
    competencies: competenciesSchema,
    phaseCount: z.number().int().min(1).max(INTERVIEW_PHASES.length),
    estimatedMinutes: estimatedMinutesSchema,
    attempts: z.number().int().nonnegative(),
    /** Ausente = sin regla de desbloqueo (p. ej. un cliente anterior). */
    unlock: unlockStatusSchema.optional(),
  })
  .strict();

export type InterviewScenarioSummary = z.infer<
  typeof interviewScenarioSummarySchema
>;

/** Detalle del escenario: añade fases y rúbrica, nunca la solución de referencia. */
export const interviewScenarioSchema = interviewScenarioSummarySchema
  .extend({
    phases: z
      .array(interviewScenarioPhaseSchema)
      .min(1)
      .max(INTERVIEW_PHASES.length),
    rubric: interviewRubricSchema,
  })
  .strict()
  .refine((scenario) => scenario.phases.length === scenario.phaseCount, {
    message: "phaseCount debe coincidir con el número de fases",
  });

export type InterviewScenario = z.infer<typeof interviewScenarioSchema>;

/** Entrada de la transcripción; se valida al leer el `Json`. */
export const interviewTranscriptEntrySchema = z
  .object({
    role: z.enum(["interviewer", "candidate"], {
      errorMap: () => ({ message: "El rol debe ser interviewer o candidate" }),
    }),
    phase: interviewPhaseSchema,
    content: z.string().min(1).max(INTERVIEW_TRANSCRIPT_CONTENT_MAX),
    at: isoTimestampSchema,
  })
  .strict();

export type InterviewTranscriptEntry = z.infer<
  typeof interviewTranscriptEntrySchema
>;

export const interviewSessionSummarySchema = z
  .object({
    id: z.string().min(1),
    scenarioSlug: slugSchema,
    scenarioTitle: z.string().min(1),
    status: interviewStatusSchema,
    phase: interviewPhaseSchema,
    turns: z.number().int().min(0).max(INTERVIEW_MAX_TURNS),
    startedAt: isoTimestampSchema,
    finishedAt: isoTimestampSchema.nullable(),
    durationMinutes: z
      .number()
      .int()
      .min(INTERVIEW_DURATION_MIN_MINUTES)
      .max(INTERVIEW_DURATION_MAX_MINUTES)
      .nullable(),
    score: z.number().min(0).max(100).nullable(),
    selfScore: z.number().min(0).max(100).nullable(),
  })
  .strict();

export type InterviewSessionSummary = z.infer<
  typeof interviewSessionSummarySchema
>;

/** Detalle de una sesión: solo dueño e instructores/admin. */
export const interviewSessionSchema = interviewSessionSummarySchema
  .extend({
    transcript: z.array(interviewTranscriptEntrySchema),
    selfScores: interviewSelfReviewRecordSchema.nullable(),
    scores: interviewEvaluationSchema.nullable(),
    feedback: z.string().max(INTERVIEW_FEEDBACK_MAX).nullable(),
    degraded: z.boolean(),
  })
  .strict();

export type InterviewSession = z.infer<typeof interviewSessionSchema>;

/** `POST /api/interviews/sessions` */
export const startInterviewSessionSchema = z
  .object({ scenarioSlug: slugSchema })
  .strict();

export type StartInterviewSessionInput = z.infer<
  typeof startInterviewSessionSchema
>;

/** `POST /api/interviews/sessions/:id/messages` */
export const sendInterviewMessageSchema = z
  .object({
    message: z
      .string({
        required_error: "El mensaje es obligatorio",
        invalid_type_error: "El mensaje debe ser texto",
      })
      .min(1, "El mensaje no puede estar vacío")
      .max(
        INTERVIEW_MESSAGE_MAX,
        `El mensaje no puede superar ${INTERVIEW_MESSAGE_MAX} caracteres`,
      ),
  })
  .strict()
  .refine(
    (input) => input.message.split("\n").length <= INTERVIEW_MESSAGE_MAX_LINES,
    {
      message: `El mensaje no puede superar ${INTERVIEW_MESSAGE_MAX_LINES} líneas`,
      path: ["message"],
    },
  );

export type SendInterviewMessageInput = z.infer<
  typeof sendInterviewMessageSchema
>;

/** Respuesta de un turno; `degraded` indica que no respondió el proveedor. */
export const interviewTurnResponseSchema = z
  .object({
    reply: z.string().min(1),
    phase: interviewPhaseSchema,
    turn: z.number().int().min(1).max(INTERVIEW_MAX_TURNS),
    turnsRemaining: z.number().int().min(0).max(INTERVIEW_MAX_TURNS - 1),
    degraded: z.boolean(),
    budgetRemainingUsd: z.number().nonnegative(),
  })
  .strict();

export type InterviewTurnResponse = z.infer<typeof interviewTurnResponseSchema>;

/** `POST /api/interviews/sessions/:id/self-review` */
export const selfReviewSchema = z
  .object({
    scores: interviewScoresSchema,
    reflection: z
      .string({ required_error: "La reflexión es obligatoria" })
      .min(
        INTERVIEW_REFLECTION_MIN,
        `La reflexión debe tener al menos ${INTERVIEW_REFLECTION_MIN} caracteres`,
      )
      .max(
        INTERVIEW_REFLECTION_MAX,
        `La reflexión no puede superar ${INTERVIEW_REFLECTION_MAX} caracteres`,
      ),
  })
  .strict();

export type SelfReviewInput = z.infer<typeof selfReviewSchema>;

/**
 * `POST /api/interviews/sessions/:id/review`.
 *
 * `feedback` es obligatorio salvo cuando la sesión se invalida: una nota sin
 * explicación no enseña nada y una invalidación no necesita justificar niveles.
 */
export const reviewInterviewSchema = z
  .object({
    scores: interviewScoresSchema,
    feedback: z
      .string()
      .max(
        INTERVIEW_FEEDBACK_MAX,
        `La retroalimentación no puede superar ${INTERVIEW_FEEDBACK_MAX} caracteres`,
      )
      .optional(),
    invalidate: z.boolean().default(false),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!input.invalidate && (input.feedback ?? "").trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["feedback"],
        message: "La retroalimentación es obligatoria para puntuar la sesión",
      });
    }
  });

export type ReviewInterviewInput = z.input<typeof reviewInterviewSchema>;
/** Cuerpo ya validado: `invalidate` siempre presente tras el `default`. */
export type ReviewInterviewPayload = z.output<typeof reviewInterviewSchema>;

/** `GET /api/interviews/sessions/me` */
export const interviewHistoryResponseSchema = z
  .object({
    items: z.array(interviewSessionSummarySchema),
    best: z
      .object({
        score: z.number().min(0).max(100),
        sessionId: z.string().min(1),
      })
      .strict()
      .nullable(),
    average: z.number().min(0).max(100),
  })
  .strict();

export type InterviewHistoryResponse = z.infer<
  typeof interviewHistoryResponseSchema
>;

/** `GET /api/interviews/scenarios?role&level&language&page&pageSize` */
export const interviewScenarioListQuerySchema = z
  .object({
    role: interviewRoleSchema.optional(),
    level: interviewLevelSchema.optional(),
    language: interviewLanguageSchema.optional(),
    page: z.coerce
      .number({ invalid_type_error: "La página debe ser un número entero" })
      .int("La página debe ser un número entero")
      .min(1, "La página debe ser 1 o mayor")
      .default(1),
    pageSize: z.coerce
      .number({
        invalid_type_error: "El tamaño de página debe ser un número entero",
      })
      .int("El tamaño de página debe ser un número entero")
      .min(1, "El tamaño de página debe ser 1 o mayor")
      .max(PAGE_SIZE_MAX, `El tamaño de página no puede superar ${PAGE_SIZE_MAX}`)
      .default(PAGE_SIZE_DEFAULT),
  })
  .strict();

export type InterviewScenarioListQuery = z.infer<
  typeof interviewScenarioListQuerySchema
>;

export const interviewScenarioListResponseSchema = paginatedSchema(
  interviewScenarioSummarySchema,
);

export type InterviewScenarioListResponse = z.infer<
  typeof interviewScenarioListResponseSchema
>;

export const interviewScenarioParamsSchema = z
  .object({ slug: slugSchema })
  .strict();

export type InterviewScenarioParams = z.infer<
  typeof interviewScenarioParamsSchema
>;

export const interviewSessionParamsSchema = z
  .object({ id: z.string().min(1) })
  .strict();

export type InterviewSessionParams = z.infer<
  typeof interviewSessionParamsSchema
>;