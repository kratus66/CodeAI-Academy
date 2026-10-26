import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  ContentRepository,
  Page,
  ResourceListFilter,
  StageListFilter,
} from "./content.repository";
import type { ResourceSummary, StageDetail, StageSummary, UnitDetail, LessonDetail } from "@codeai/shared";
import {
  toExerciseSummary,
  toLessonDetail,
  toLessonSummary,
  toModuleSummary,
  toResourceSummary,
  toStageDetail,
  toStageSummary,
  toUnitDetail,
} from "./content.mapper";

/**
 * Columnas de recurso que se sirven. Es explícito a propósito: `notes`
 * (curaduría interna) no sale de la API y añadir una columna nueva no la expone
 * por accidente.
 */
const RESOURCE_SELECT = {
  id: true,
  slug: true,
  title: true,
  provider: true,
  url: true,
  type: true,
  language: true,
  level: true,
  durationMin: true,
  license: true,
  embedAllowed: true,
  status: true,
  reviewedAt: true,
} as const;

/**
 * Columnas de ejercicio visibles para el estudiante. `solution`, `sources` y
 * `maxAttempts` quedan fuera del `select`: no se traen de la base de datos, no
 * solo se ocultan al serializar.
 */
const EXERCISE_SELECT = {
  id: true,
  slug: true,
  type: true,
  title: true,
  statement: true,
  ladder: true,
  difficulty: true,
  concepts: true,
  competencies: true,
  estimatedMin: true,
  order: true,
} as const;

/** Unidad publicada con toda su ascendencia publicada. */
const PUBLISHED_UNIT = {
  isPublished: true,
  module: { isPublished: true, stage: { isPublished: true } },
} as const;

/** Adaptador Prisma del puerto `ContentRepository`. */
@Injectable()
export class PrismaContentRepository implements ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listStages(filter: StageListFilter): Promise<Page<StageSummary>> {
    const where: Prisma.StageWhereInput = {
      isPublished: true,
      ...(filter.level === undefined ? {} : { level: filter.level }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.stage.findMany({
        where,
        orderBy: [{ order: "asc" }, { id: "asc" }],
        skip: filter.skip,
        take: filter.take,
        include: {
          _count: { select: { modules: { where: { isPublished: true } } } },
        },
      }),
      this.prisma.stage.count({ where }),
    ]);

    return {
      items: rows.map((row) => toStageSummary(row, row._count.modules)),
      total,
    };
  }

  async findStage(id: number): Promise<StageDetail | null> {
    const row = await this.prisma.stage.findFirst({
      where: { id, isPublished: true },
      include: {
        modules: {
          where: { isPublished: true },
          orderBy: [{ order: "asc" }, { code: "asc" }],
          include: {
            _count: { select: { units: { where: { isPublished: true } } } },
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return toStageDetail(
      row,
      row.modules.map((module) => toModuleSummary(module, module._count.units)),
    );
  }

  async findUnit(code: string): Promise<UnitDetail | null> {
    const row = await this.prisma.unit.findFirst({
      where: { code, ...PUBLISHED_UNIT },
      include: {
        module: { select: { code: true } },
        lessons: {
          where: { isPublished: true },
          orderBy: [{ order: "asc" }, { slug: "asc" }],
          select: { id: true, slug: true, title: true, estimatedMin: true, order: true },
        },
        exercises: {
          where: { isPublished: true },
          orderBy: [{ order: "asc" }, { slug: "asc" }],
          select: EXERCISE_SELECT,
        },
      },
    });

    if (!row) {
      return null;
    }

    return toUnitDetail(
      row,
      row.module.code,
      row.lessons.map(toLessonSummary),
      row.exercises.map(toExerciseSummary),
    );
  }

  async findLesson(slug: string): Promise<LessonDetail | null> {
    const row = await this.prisma.lesson.findFirst({
      where: { slug, isPublished: true, unit: PUBLISHED_UNIT },
      include: {
        unit: { select: { code: true } },
        resources: {
          where: { resource: { status: "VERIFIED" } },
          orderBy: { order: "asc" },
          select: {
            order: true,
            note: true,
            resource: { select: RESOURCE_SELECT },
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return toLessonDetail(
      row,
      row.unit.code,
      row.resources.map((link) => ({
        order: link.order,
        note: link.note,
        resource: toResourceSummary(link.resource),
      })),
    );
  }

  async listResources(filter: ResourceListFilter): Promise<Page<ResourceSummary>> {
    const where: Prisma.ResourceWhereInput = {
      status: "VERIFIED",
      ...(filter.type === undefined ? {} : { type: filter.type }),
      lessons: {
        some: {
          lesson: {
            isPublished: true,
            unit: {
              isPublished: true,
              module: {
                isPublished: true,
                stage: {
                  isPublished: true,
                  ...(filter.stage === undefined ? {} : { id: filter.stage }),
                },
              },
            },
          },
        },
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        orderBy: [{ title: "asc" }, { id: "asc" }],
        skip: filter.skip,
        take: filter.take,
        select: RESOURCE_SELECT,
      }),
      this.prisma.resource.count({ where }),
    ]);

    return { items: rows.map(toResourceSummary), total };
  }
}
