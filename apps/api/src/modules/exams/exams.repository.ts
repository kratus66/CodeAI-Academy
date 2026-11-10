import type {
  CertificationCode,
  ExamAttemptStatus,
  ExamFormCode,
  ExamMode,
} from "@codeai/shared";

/**
 * Puerto de persistencia del simulador (`sprint-15-simulador-examen.md` §2.6,
 * S15-T6a).
 *
 * Devuelve filas ya normalizadas (fechas como `Date`) y deja como `unknown` lo
 * que la base guarda en columnas `Json` —`config`, `solution`, `answer` y
 * `domainScores`—: el servicio lo valida o lo puntúa con las reglas puras de
 * S15-T4 y T5. El puerto no decide nada de negocio: solo lee y escribe.
 */

export const EXAMS_REPOSITORY = Symbol("EXAMS_REPOSITORY");
/** Reloj inyectable: `() => Date`. */
export const EXAMS_CLOCK = Symbol("EXAMS_CLOCK");
/** Aleatoriedad inyectable: `() => number` en `[0, 1)` para ordenar las tandas. */
export const EXAMS_RANDOM = Symbol("EXAMS_RANDOM");

/** Pregunta publicada del banco reservado, con su solución. */
export interface ReservedQuestionRow {
  exerciseId: string;
  slug: string;
  domain: number;
  unitCode: string;
  statement: string;
  /** `config` del quiz sin validar; el servicio lo lee con el esquema de la forma. */
  config: unknown;
  /** Solución sin validar; solo la usa la corrección al cerrar el intento. */
  solution: unknown;
  reviewedByHuman: boolean;
  competencies: string[];
}

/** Ítem guardado con su pregunta embebida: evita una segunda consulta al mapear. */
export interface AttemptItemRow {
  position: number;
  exerciseId: string;
  domain: number;
  answer: unknown | null;
  flagged: boolean;
  correct: boolean | null;
  question: ReservedQuestionRow;
}

export interface AttemptRow {
  id: string;
  userId: string;
  certification: CertificationCode;
  mode: ExamMode;
  domain: number | null;
  extraTime: boolean;
  status: ExamAttemptStatus;
  orientative: boolean;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
  correctCount: number | null;
  scorePct: number | null;
  domainScores: unknown | null;
  items: AttemptItemRow[];
}

/** Ítem del armado: solo la posición, la pregunta y su dominio. */
export interface CreateAttemptItemInput {
  position: number;
  exerciseId: string;
  domain: number;
}

export interface CreateAttemptInput {
  userId: string;
  certification: CertificationCode;
  mode: ExamMode;
  domain: number | null;
  extraTime: boolean;
  orientative: boolean;
  startedAt: Date;
  deadlineAt: Date;
  items: CreateAttemptItemInput[];
}

export interface UpdateItemPatch {
  answer?: unknown | null;
  flagged?: boolean;
  /** Solo lo persiste el adaptador Prisma; el adaptador en memoria no lo guarda. */
  answeredAt?: Date | null;
}

export interface FinishAttemptInput {
  status: "SUBMITTED" | "EXPIRED";
  submittedAt: Date;
  correctCount: number;
  scorePct: number;
  domainScores: unknown;
  itemCorrectness: { position: number; correct: boolean }[];
}

/** Lo que la regla «listo para presentar» necesita consultar de la etapa (S15-T5). */
export interface ReadinessFactsRow {
  unitsTotal: number;
  pendingUnitCodes: string[];
  overdueReviewCount: number;
  projectAvailable: boolean;
  bestReviewedProjectScore: number | null;
}

export interface CreateRealResultInput {
  userId: string;
  certification: CertificationCode;
  passed: boolean;
  scaledScore: number | null;
  takenOn: Date;
  readyAtRegistration: boolean;
}

/** Resultado real del examen oficial, tal como lo registró la persona. */
export interface RealResultRow {
  id: string;
  userId: string;
  certification: CertificationCode;
  passed: boolean;
  scaledScore: number | null;
  takenOn: Date;
  readyAtRegistration: boolean;
  createdAt: Date;
}

export interface ExamsRepository {
  /** QUIZ + RESERVED + publicado. */
  listReservedPool(certification: CertificationCode): Promise<ReservedQuestionRow[]>;
  /** `null` si la forma no está sembrada. */
  findFormSlugs(certification: CertificationCode, code: ExamFormCode): Promise<string[] | null>;
  countForms(certification: CertificationCode): Promise<number>;
  /** Ejercicios de los N últimos intentos terminados de esa certificación. */
  recentExerciseIds(
    userId: string,
    certification: CertificationCode,
    lastAttempts: number,
  ): Promise<Set<string>>;
  findOpenAttemptId(userId: string, certification: CertificationCode): Promise<string | null>;
  createAttempt(input: CreateAttemptInput): Promise<AttemptRow>;
  /** `null` si es ajeno o no existe. */
  findOwnedAttempt(userId: string, attemptId: string): Promise<AttemptRow | null>;
  updateItem(
    attemptId: string,
    position: number,
    patch: UpdateItemPatch,
  ): Promise<AttemptItemRow>;
  /** Cierra solo si sigue IN_PROGRESS; devuelve false si ya estaba cerrado (doble entrega). */
  finishAttempt(attemptId: string, input: FinishAttemptInput): Promise<boolean>;
  /** Más reciente primero. */
  listAttempts(
    userId: string,
    certification: CertificationCode,
  ): Promise<Omit<AttemptRow, "items">[]>;
  readinessFacts(
    userId: string,
    stageId: number,
    now: Date,
  ): Promise<ReadinessFactsRow>;
  createRealResult(input: CreateRealResultInput): Promise<RealResultRow>;
  latestRealResult(
    userId: string,
    certification: CertificationCode,
  ): Promise<RealResultRow | null>;
}
