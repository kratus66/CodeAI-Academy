import type {
  ExerciseSummary,
  ExerciseType,
  Ladder,
  LessonContentBlock,
  LessonDetail,
  LessonResource,
  LessonStep,
  LessonSummary,
  ModuleSummary,
  ResourceStatus,
  ResourceSummary,
  ResourceType,
  StageDetail,
  StageSummary,
  UnitDetail,
  UnitSummary,
} from "@codeai/shared";
import { lessonContentSchema, lessonStepsSchema } from "@codeai/shared";
import type { ZodType } from "zod";

/**
 * Fila con contenido guardado que no cumple el contrato (por ejemplo, una
 * lección sin los 7 pasos). Se lanza al servir y el filtro global la convierte
 * en `500 INTERNAL_ERROR` sin exponer el JSON roto al estudiante.
 */
export class InvalidStoredContentError extends Error {
  constructor(
    readonly lessonSlug: string,
    readonly reason: string,
  ) {
    super(`La lección "${lessonSlug}" tiene contenido inválido: ${reason}`);
    this.name = "InvalidStoredContentError";
  }
}

/**
 * Formas de fila que el mapper necesita. Son estructurales a propósito: el
 * mapper no importa Prisma, así que se puede probar con objetos planos y el
 * adaptador puede pasarle las filas tal cual.
 */
export interface StageRow {
  id: number;
  slug: string;
  title: string;
  objective: string;
  level: number;
  estimatedMin: number | null;
  order: number;
}

export interface ModuleRow {
  id: string;
  code: string;
  title: string;
  order: number;
}

export interface UnitRow {
  id: string;
  code: string;
  title: string;
  objective: string;
  estimatedMin: number | null;
  order: number;
  prerequisiteIds: string[];
}

export interface LessonRow {
  id: string;
  slug: string;
  title: string;
  estimatedMin: number | null;
  order: number;
}

export interface LessonContentRow extends LessonRow {
  content: unknown;
  steps: unknown;
}

export interface ExerciseRow {
  id: string;
  slug: string;
  type: ExerciseType;
  title: string;
  statement: string;
  ladder: Ladder;
  difficulty: number;
  concepts: string[];
  competencies: string[];
  estimatedMin: number | null;
  order: number;
}

export interface ResourceRow {
  id: string;
  slug: string;
  title: string;
  provider: string;
  url: string;
  type: ResourceType;
  language: string;
  level: string | null;
  durationMin: number | null;
  license: string | null;
  embedAllowed: boolean;
  status: ResourceStatus;
  reviewedAt: Date | null;
}

export function toStageSummary(row: StageRow, moduleCount: number): StageSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    objective: row.objective,
    level: row.level,
    estimatedMin: row.estimatedMin,
    order: row.order,
    moduleCount,
  };
}

export function toStageDetail(
  row: StageRow,
  modules: ModuleSummary[],
): StageDetail {
  return { ...toStageSummary(row, modules.length), modules };
}

/**
 * `units` son las unidades publicadas del módulo, ya ordenadas: el conteo se
 * deriva de la lista para que `unitCount` y `units` no puedan contradecirse.
 */
export function toModuleSummary(row: ModuleRow, units: UnitSummary[]): ModuleSummary {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    order: row.order,
    unitCount: units.length,
    units,
  };
}

export function toUnitSummary(
  row: UnitRow,
  stageId: number,
  moduleCode: string,
): UnitSummary {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    objective: row.objective,
    estimatedMin: row.estimatedMin,
    order: row.order,
    stageId,
    moduleCode,
    prerequisiteIds: [...row.prerequisiteIds],
  };
}

export function toUnitDetail(
  row: UnitRow,
  stageId: number,
  moduleCode: string,
  lessons: LessonSummary[],
  exercises: ExerciseSummary[],
): UnitDetail {
  return {
    ...toUnitSummary(row, stageId, moduleCode),
    lessons,
    exercises,
  };
}

export function toLessonSummary(row: LessonRow): LessonSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    estimatedMin: row.estimatedMin,
    order: row.order,
  };
}

/** El adaptador selecciona solo estos campos: `solution` nunca llega aquí. */
export function toExerciseSummary(row: ExerciseRow): ExerciseSummary {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    statement: row.statement,
    ladder: row.ladder,
    difficulty: row.difficulty,
    concepts: [...row.concepts],
    competencies: [...row.competencies],
    estimatedMin: row.estimatedMin,
    order: row.order,
  };
}

export function toResourceSummary(row: ResourceRow): ResourceSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    provider: row.provider,
    url: row.url,
    type: row.type,
    language: row.language,
    level: row.level,
    durationMin: row.durationMin,
    license: row.license,
    embedAllowed: row.embedAllowed,
    status: row.status,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}

/**
 * `content` y `steps` se validan al servir: la regla «7 pasos o no se publica»
 * no depende de que el cargador de la semilla se haya ejecutado bien.
 */
export function toLessonDetail(
  row: LessonContentRow,
  unitCode: string,
  resources: LessonResource[],
): LessonDetail {
  const content = parseStored<LessonContentBlock[]>(
    lessonContentSchema,
    row.content,
    row.slug,
    "content",
  );
  const steps = parseStored<LessonStep[]>(lessonStepsSchema, row.steps, row.slug, "steps");

  return {
    ...toLessonSummary(row),
    unitCode,
    content,
    steps,
    resources,
  };
}

function parseStored<T>(
  schema: ZodType<T>,
  value: unknown,
  lessonSlug: string,
  field: string,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    const reason = result.error.issues
      .map((issue) => `${issue.path.join(".") || field}: ${issue.message}`)
      .join("; ");

    throw new InvalidStoredContentError(lessonSlug, reason);
  }

  return result.data;
}
