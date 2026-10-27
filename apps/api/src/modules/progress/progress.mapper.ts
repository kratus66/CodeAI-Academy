import type { CompetencyProgress, UnitProgressSummary, UnitState } from "@codeai/shared";

import type {
  CompetencyProgressRecord,
  ProgressUnitRow,
  UnitProgressRecord,
} from "./progress.repository";

/**
 * Traducciones fila → contrato del progreso. Los tipos de fila son
 * estructurales: el mapper no importa Prisma, se prueba con objetos planos y el
 * adaptador le pasa las filas tal cual.
 */

/** Fila de `Unit` con su módulo y el conteo de lecciones publicadas. */
export interface ProgressUnitDbRow {
  id: string;
  code: string;
  order: number;
  prerequisiteIds: string[];
  module: { code: string; stageId: number };
  _count: { lessons: number };
}

export function toProgressUnitRow(row: ProgressUnitDbRow): ProgressUnitRow {
  return {
    id: row.id,
    code: row.code,
    stageId: row.module.stageId,
    moduleCode: row.module.code,
    order: row.order,
    prerequisiteCodes: [...row.prerequisiteIds],
    lessonsTotal: row._count.lessons,
  };
}

export interface UnitProgressDbRow {
  unitId: string;
  state: UnitState;
  progressPct: number;
  lessonsDone: number;
  exercisesDone: number;
  bestScore: number | null;
  completedLessonIds: string[];
  lastActivityAt: Date | null;
  completedAt: Date | null;
}

export function toUnitProgressRecord(row: UnitProgressDbRow): UnitProgressRecord {
  return {
    unitId: row.unitId,
    state: row.state,
    progressPct: row.progressPct,
    lessonsDone: row.lessonsDone,
    exercisesDone: row.exercisesDone,
    bestScore: row.bestScore,
    completedLessonIds: [...row.completedLessonIds],
    lastActivityAt: row.lastActivityAt,
    completedAt: row.completedAt,
  };
}

export interface CompetencyProgressDbRow {
  competency: string;
  level: number;
  evidenceCount: number;
}

export function toCompetencyProgressRecord(
  row: CompetencyProgressDbRow,
): CompetencyProgressRecord {
  return {
    competency: row.competency,
    level: row.level,
    evidenceCount: row.evidenceCount,
  };
}

/**
 * `state` y `progressPct` llegan ya calculados por las reglas puras: el mapper
 * nunca los lee de la fila, para que un valor obsoleto en la base no se sirva.
 */
export function toUnitProgressSummary(
  unit: ProgressUnitRow,
  record: UnitProgressRecord | null,
  state: UnitState,
  progressPct: number,
): UnitProgressSummary {
  return {
    unitId: unit.id,
    unitCode: unit.code,
    state,
    progressPct,
    lessonsDone: record?.lessonsDone ?? 0,
    exercisesDone: record?.exercisesDone ?? 0,
    bestScore: record?.bestScore ?? null,
    lastActivityAt: record?.lastActivityAt?.toISOString() ?? null,
    completedAt: record?.completedAt?.toISOString() ?? null,
  };
}

/** `competency` en la base, `code` en el contrato. */
export function toCompetencyProgress(record: CompetencyProgressRecord): CompetencyProgress {
  return {
    code: record.competency,
    level: record.level,
    evidenceCount: record.evidenceCount,
  };
}
