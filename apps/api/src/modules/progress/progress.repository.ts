import type { UnitState } from "@codeai/shared";

/**
 * Puerto de persistencia del progreso. Devuelve datos **publicados** y filas ya
 * normalizadas (fechas como `Date`), de modo que el servicio no conozca Prisma.
 */
export const PROGRESS_REPOSITORY = Symbol("PROGRESS_REPOSITORY");

/** Unidad publicada con lo que exigen las reglas de desbloqueo y el resumen. */
export interface ProgressUnitRow {
  id: string;
  code: string;
  /** Etapa 0–11; ordena el currículo y resuelve `currentStage`. */
  stageId: number;
  moduleCode: string;
  order: number;
  /** Códigos de unidad declarados como prerrequisito (`Unit.prerequisiteIds`). */
  prerequisiteCodes: readonly string[];
  /** Lecciones **publicadas**: el denominador del avance en S4. */
  lessonsTotal: number;
}

/** Fila de `UnitProgress` ya normalizada. */
export interface UnitProgressRecord {
  unitId: string;
  state: UnitState;
  progressPct: number;
  lessonsDone: number;
  exercisesDone: number;
  bestScore: number | null;
  /** Clave de idempotencia de `complete-lesson`; `lessonsDone` es su tamaño. */
  completedLessonIds: readonly string[];
  lastActivityAt: Date | null;
  completedAt: Date | null;
}

/** Fila de `CompetencyProgress` ya normalizada. */
export interface CompetencyProgressRecord {
  competency: string;
  level: number;
  evidenceCount: number;
}

export interface ProgressUserRecord {
  id: string;
  name: string;
}

/** Lección publicada junto a la unidad a la que pertenece. */
export interface LessonLookup {
  id: string;
  unitId: string;
}

/**
 * Estado que el servicio ya calculó con las reglas puras. El adaptador solo
 * escribe: no decide `state` ni `progressPct`.
 */
export interface SaveUnitProgressInput {
  userId: string;
  unitId: string;
  state: UnitState;
  progressPct: number;
  lessonsDone: number;
  completedLessonIds: readonly string[];
  lastActivityAt: Date;
}

export interface ProgressRepository {
  findUser(userId: string): Promise<ProgressUserRecord | null>;
  listPublishedUnits(): Promise<ProgressUnitRow[]>;
  findPublishedUnit(unitId: string): Promise<ProgressUnitRow | null>;
  /** `null` si la lección no existe o no está publicada con su unidad. */
  findPublishedLesson(lessonId: string): Promise<LessonLookup | null>;
  listUnitProgress(userId: string): Promise<UnitProgressRecord[]>;
  listCompetencyProgress(userId: string): Promise<CompetencyProgressRecord[]>;
  saveUnitProgress(input: SaveUnitProgressInput): Promise<UnitProgressRecord>;
}
