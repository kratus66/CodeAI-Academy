import type {
  CompetencyProgress,
  ProgressOverview,
  UnitProgressSummary,
  UnitState,
} from "@codeai/shared";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { toCompetencyProgress, toUnitProgressSummary } from "./progress.mapper";
import type {
  CompetencyProgressRecord,
  ProgressRepository,
  ProgressUnitRow,
  UnitProgressRecord,
} from "./progress.repository";
import { PROGRESS_REPOSITORY } from "./progress.repository";
import {
  countUnitsByState,
  overallProgressPct,
  resolveUnitState,
  stateAfterLessonSeen,
  unitProgressPct,
} from "./progress.rules";

const UNIT_NOT_FOUND = "La unidad solicitada no existe o no está publicada";
const LESSON_NOT_FOUND =
  "La lección solicitada no existe, no está publicada o no pertenece a la unidad";
const UNIT_LOCKED = "La unidad está bloqueada: completa sus prerrequisitos para continuar";
const USER_NOT_FOUND = "El usuario autenticado no existe";

/**
 * Competencias del perfil profesional (`mapa-competencias.md`). El mapa se
 * publica completo: las que no tienen evidencia salen con nivel 0, y así el
 * panel puede dibujar C1–C14 sin huecos. Los códigos guardados fuera de rango
 * no se sirven, porque el contrato solo admite C1–C14.
 */
const COMPETENCY_CODES: readonly string[] = Array.from(
  { length: 14 },
  (_, index) => `C${index + 1}`,
);

/** Unidad con el estado y el avance ya resueltos por las reglas puras. */
interface ResolvedUnit {
  unit: ProgressUnitRow;
  record: UnitProgressRecord | null;
  state: UnitState;
  progressPct: number;
}

/**
 * Reglas de aplicación del progreso: resuelve estados, compone el resumen global
 * y registra lecciones vistas. No conoce Prisma ni HTTP; `userId` llega ya
 * validado por el guard, nunca desde el cuerpo ni desde la ruta.
 */
@Injectable()
export class ProgressService {
  constructor(
    @Inject(PROGRESS_REPOSITORY) private readonly repository: ProgressRepository,
  ) {}

  async getOverview(userId: string): Promise<ProgressOverview> {
    const [user, units, records, competencies] = await Promise.all([
      this.repository.findUser(userId),
      this.repository.listPublishedUnits(),
      this.repository.listUnitProgress(userId),
      this.repository.listCompetencyProgress(userId),
    ]);

    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND);
    }

    const resolved = resolveUnits(units, records);

    return {
      user,
      currentStage: currentStage(resolved),
      overallPct: overallProgressPct(resolved),
      units: countUnitsByState(resolved),
      competencies: toCompetencyMap(competencies),
      // Los repasos vencidos llegan con `ReviewItem` (S7).
      dueReviews: 0,
    };
  }

  async listUnits(userId: string): Promise<UnitProgressSummary[]> {
    const [units, records] = await Promise.all([
      this.repository.listPublishedUnits(),
      this.repository.listUnitProgress(userId),
    ]);

    return resolveUnits(units, records).map((resolved) =>
      toUnitProgressSummary(
        resolved.unit,
        resolved.record,
        resolved.state,
        resolved.progressPct,
      ),
    );
  }

  async listCompetencies(userId: string): Promise<CompetencyProgress[]> {
    return toCompetencyMap(await this.repository.listCompetencyProgress(userId));
  }

  /**
   * Marca una lección vista. Es idempotente por lección: `completedLessonIds`
   * es un conjunto, así que repetir la llamada no infla el avance. Nunca
   * acredita `MASTERED`; eso lo decide S6 con los envíos.
   */
  async completeLesson(
    userId: string,
    unitId: string,
    lessonId: string,
  ): Promise<UnitProgressSummary> {
    const [units, records, lesson] = await Promise.all([
      this.repository.listPublishedUnits(),
      this.repository.listUnitProgress(userId),
      this.repository.findPublishedLesson(lessonId),
    ]);

    const target = resolveUnits(units, records).find((entry) => entry.unit.id === unitId);

    if (!target) {
      throw new NotFoundException(UNIT_NOT_FOUND);
    }

    if (!lesson || lesson.unitId !== unitId) {
      throw new NotFoundException(LESSON_NOT_FOUND);
    }

    if (target.state === "LOCKED") {
      throw new ConflictException(UNIT_LOCKED);
    }

    const completedLessonIds = [
      ...new Set([...(target.record?.completedLessonIds ?? []), lesson.id]),
    ];
    const lessonsDone = completedLessonIds.length;
    const progressPct = unitProgressPct(lessonsDone, target.unit.lessonsTotal);
    const state = stateAfterLessonSeen(target.state, progressPct);

    const saved = await this.repository.saveUnitProgress({
      userId,
      unitId,
      state,
      progressPct,
      lessonsDone,
      completedLessonIds,
      lastActivityAt: new Date(),
    });

    return toUnitProgressSummary(target.unit, saved, state, progressPct);
  }
}

/**
 * Recorre las unidades en orden de currículo: un prerrequisito puede resolverse
 * antes que la unidad que lo exige, y así el estado servido no depende del orden
 * en que llegaron las filas.
 */
function resolveUnits(
  units: readonly ProgressUnitRow[],
  records: readonly UnitProgressRecord[],
): ResolvedUnit[] {
  const recordsByUnitId = new Map(records.map((record) => [record.unitId, record]));
  const statesByCode: Record<string, UnitState> = {};

  return units.map((unit) => {
    const record = recordsByUnitId.get(unit.id) ?? null;
    const progressPct = unitProgressPct(record?.lessonsDone ?? 0, unit.lessonsTotal);
    const state = resolveUnitState({
      prerequisiteCodes: unit.prerequisiteCodes,
      prerequisiteStates: statesByCode,
      currentState: record?.state,
    });

    statesByCode[unit.code] = state;

    return { unit, record, state, progressPct };
  });
}

/**
 * Etapa en curso: la de la primera unidad no dominada. Sin unidades pendientes
 * se queda en la última publicada, y sin currículo en la etapa 0.
 */
function currentStage(units: readonly ResolvedUnit[]): number {
  const pending = units.find((entry) => entry.state !== "MASTERED");
  const last = units[units.length - 1];

  return (pending ?? last)?.unit.stageId ?? 0;
}

function toCompetencyMap(records: readonly CompetencyProgressRecord[]): CompetencyProgress[] {
  const byCode = new Map(records.map((record) => [record.competency, record]));

  return COMPETENCY_CODES.map((code) => {
    const record = byCode.get(code);

    return record ? toCompetencyProgress(record) : { code, level: 0, evidenceCount: 0 };
  });
}
