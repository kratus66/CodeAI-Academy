import { z } from "zod";

import { paginatedSchema } from "./common";

export const COURSE_SLUGS = ["fullstack-ia", "aws-cloud"] as const;
export type CourseSlug = (typeof COURSE_SLUGS)[number];
export const DEFAULT_COURSE_SLUG: CourseSlug = "fullstack-ia";
export const courseSlugSchema = z.enum(COURSE_SLUGS);

export interface CourseDefinition {
  readonly slug: CourseSlug;
  /** Primer y último id de etapa de la ruta (inclusive). */
  readonly stageIdMin: number;
  readonly stageIdMax: number;
  /** Prefijo de módulos y unidades: "" → "M2.3"/"U2.3.1"; "AWS-" → "AWS-M2.3"/"AWS-U2.3.1". */
  readonly codePrefix: "" | "AWS-";
  /** Prefijo del slug de etapa: "e" → "e2-…"; "aws" → "aws2-…". */
  readonly stageSlugPrefix: "e" | "aws";
  /** Letra de la etiqueta visible de la etapa: "E2" / "A2". */
  readonly stageLabelPrefix: "E" | "A";
  /** Prefijo de competencias: "C" → "C4"; "AWS-C" → "AWS-C4". */
  readonly competencyPrefix: "C" | "AWS-C";
  /** Número máximo de competencia (C1…C14; AWS-C1…AWS-C15). */
  readonly competencyMax: number;
}

export const COURSE_REGISTRY: Readonly<Record<CourseSlug, CourseDefinition>> = {
  "fullstack-ia": {
    slug: "fullstack-ia", stageIdMin: 0, stageIdMax: 11, codePrefix: "",
    stageSlugPrefix: "e", stageLabelPrefix: "E", competencyPrefix: "C", competencyMax: 14,
  },
  "aws-cloud": {
    slug: "aws-cloud", stageIdMin: 100, stageIdMax: 112, codePrefix: "AWS-",
    stageSlugPrefix: "aws", stageLabelPrefix: "A", competencyPrefix: "AWS-C", competencyMax: 15,
  },
};

/** Aviso legal que la web muestra en la ruta (null = ninguno). */
export const COURSE_NOTICES: Readonly<Record<CourseSlug, string | null>> = {
  "fullstack-ia": null,
  "aws-cloud":
    "Ruta independiente de preparación. No está afiliada ni avalada por Amazon Web Services. AWS y los nombres de sus servicios son marcas de Amazon.com, Inc. o sus filiales.",
};

/** Patrones válidos en cualquier ruta. */
export const MODULE_CODE_PATTERN = /^(?:AWS-)?M\d{1,2}\.\d{1,2}$/;
export const UNIT_CODE_PATTERN = /^(?:AWS-)?U\d{1,2}\.\d{1,2}\.\d{1,2}$/;
export const COMPETENCY_CODE_PATTERN = /^(?:C(?:[1-9]|1[0-4])|AWS-C(?:[1-9]|1[0-5]))$/;

export function courseForStageId(stageId: number): CourseDefinition | null {
  if (!Number.isInteger(stageId)) {
    return null;
  }
  for (const definition of Object.values(COURSE_REGISTRY)) {
    if (stageId >= definition.stageIdMin && stageId <= definition.stageIdMax) {
      return definition;
    }
  }
  return null;
}

export function isKnownStageId(stageId: number): boolean {
  return courseForStageId(stageId) !== null;
}

export function stageNumberInCourse(stageId: number): number | null {
  const course = courseForStageId(stageId);
  return course ? stageId - course.stageIdMin : null;
}

export function stageLabel(stageId: number): string | null {
  const course = courseForStageId(stageId);
  if (!course) {
    return null;
  }
  return `${course.stageLabelPrefix}${stageId - course.stageIdMin}`;
}

export function courseForCode(code: string): CourseDefinition | null {
  if (code.startsWith(COURSE_REGISTRY["aws-cloud"].codePrefix)) {
    return COURSE_REGISTRY["aws-cloud"];
  }
  if (/^[MUC]\d/.test(code)) {
    return COURSE_REGISTRY[DEFAULT_COURSE_SLUG];
  }
  return null;
}

/** Id de etapa de un código de unidad o de módulo de cualquier ruta: "U2.3.1" → 2, "AWS-U2.3.1" → 102, "AWS-M0.1" → 100. Código mal formado, o número fuera del rango de su ruta → null. */
export function stageIdOfCode(code: string): number | null {
  if (!UNIT_CODE_PATTERN.test(code) && !MODULE_CODE_PATTERN.test(code)) {
    return null;
  }
  const course = courseForCode(code);
  if (!course) {
    return null;
  }
  const stageNumber = Number(code.slice(course.codePrefix.length + 1).split(".")[0]);
  const stageId = course.stageIdMin + stageNumber;
  return stageId <= course.stageIdMax ? stageId : null;
}

export function moduleCodePrefix(stageId: number): string | null {
  const course = courseForStageId(stageId);
  if (!course) {
    return null;
  }
  return `${course.codePrefix}M${stageId - course.stageIdMin}.`;
}

export function unitCodePrefix(moduleCode: string): string | null {
  if (!MODULE_CODE_PATTERN.test(moduleCode)) {
    return null;
  }
  const course = courseForCode(moduleCode);
  if (!course) {
    return null;
  }
  return `${course.codePrefix}U${moduleCode.slice(course.codePrefix.length + 1)}.`;
}

export function stageSlugMatchesCourse(slug: string, stageId: number): boolean {
  const course = courseForStageId(stageId);
  if (!course) {
    return false;
  }
  return slug.startsWith(`${course.stageSlugPrefix}${stageId - course.stageIdMin}-`);
}

export function isCompetencyOfCourse(code: string, course: CourseSlug): boolean {
  if (!COMPETENCY_CODE_PATTERN.test(code)) {
    return false;
  }
  const definition = COURSE_REGISTRY[course];
  if (!code.startsWith(definition.competencyPrefix)) {
    return false;
  }
  return Number(code.slice(definition.competencyPrefix.length)) <= definition.competencyMax;
}

export const courseSummarySchema = z.object({
  slug: courseSlugSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  stageLabelPrefix: z.enum(["E", "A"]),
  order: z.number().int().nonnegative(),
  stageCount: z.number().int().nonnegative(),
  notice: z.string().min(1).nullable(),
});
export type CourseSummary = z.infer<typeof courseSummarySchema>;

export const courseListResponseSchema = paginatedSchema(courseSummarySchema);
export type CourseListResponse = z.infer<typeof courseListResponseSchema>;
