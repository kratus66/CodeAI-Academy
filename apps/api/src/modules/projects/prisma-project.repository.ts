import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  Project as PrismaProject,
  ProjectSubmission as PrismaProjectSubmission,
} from "@prisma/client";

import {
  PROJECT_SUBMISSION_STATUSES,
  projectRubricScoresSchema,
  type ProjectRubricScores,
  type ProjectSubmissionStatus,
} from "@codeai/shared";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type {
  CreateProjectSubmissionRecord,
  ListProjectsFilter,
  PortfolioUserRecord,
  ProjectDetailRow,
  ProjectRecord,
  ProjectSubmissionRecord,
  ProjectsPage,
  ProjectsRepository,
  SaveProjectReviewRecord,
} from "./project.repository";
import { PROJECT_APPROVED_COMPETENCY_LEVEL } from "./project.repository";

/** Columnas de `Project` que el contrato publica; nunca se selecciona de más. */
const PROJECT_SELECT = {
  id: true,
  slug: true,
  stageId: true,
  title: true,
  brief: true,
  requirements: true,
  rubric: true,
  competencies: true,
  isPublished: true,
  createdAt: true,
};

const SUBMISSION_INCLUDE = { project: { select: PROJECT_SELECT } };

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SELECT }>;
type SubmissionRow = Prisma.ProjectSubmissionGetPayload<{
  include: typeof SUBMISSION_INCLUDE;
}>;

/** Adaptador Prisma del puerto `ProjectsRepository`. */
@Injectable()
export class PrismaProjectsRepository implements ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublishedProjects(
    filter: ListProjectsFilter,
    userId: string,
  ): Promise<ProjectsPage> {
    const where: Prisma.ProjectWhereInput = { isPublished: true };

    if (filter.stageId !== undefined) {
      where.stageId = filter.stageId;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: [{ stageId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        select: {
          ...PROJECT_SELECT,
          submissions: {
            where: { userId },
            select: { score: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        ...toProjectRecord(row),
        submitted: row.submissions.length > 0,
        bestScore: bestScore(row.submissions),
      })),
      total,
    };
  }

  async findPublishedProjectBySlug(
    slug: string,
    userId: string,
  ): Promise<ProjectDetailRow | null> {
    const row = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        submissions: {
          where: { userId },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!row || !row.isPublished) {
      return null;
    }

    const project = toProjectRecord(row);
    const mySubmissions = row.submissions.map((submission) =>
      toSubmissionWithProject(submission, project),
    );

    return {
      ...project,
      submitted: mySubmissions.length > 0,
      bestScore: bestScore(mySubmissions),
      mySubmissions,
    };
  }

  async createSubmission(
    input: CreateProjectSubmissionRecord,
  ): Promise<ProjectSubmissionRecord | null> {
    const project = await this.prisma.project.findUnique({
      where: { slug: input.projectSlug },
      select: { id: true, isPublished: true },
    });

    if (!project || !project.isPublished) {
      return null;
    }

    const row = await this.prisma.projectSubmission.create({
      data: {
        projectId: project.id,
        userId: input.userId,
        repoUrl: input.repoUrl,
        deployUrl: input.deployUrl,
        notes: input.notes,
        createdAt: input.createdAt,
      },
      include: SUBMISSION_INCLUDE,
    });

    return toSubmissionRecord(row);
  }

  async findSubmissionById(
    submissionId: string,
  ): Promise<ProjectSubmissionRecord | null> {
    const row = await this.prisma.projectSubmission.findUnique({
      where: { id: submissionId },
      include: SUBMISSION_INCLUDE,
    });

    return row ? toSubmissionRecord(row) : null;
  }

  async saveReview(
    input: SaveProjectReviewRecord,
  ): Promise<ProjectSubmissionRecord | null> {
    try {
      const row = await this.prisma.projectSubmission.update({
        where: { id: input.submissionId },
        data: {
          status: "REVIEWED",
          score: input.score,
          rubricScores: input.rubricScores,
          feedback: input.feedback,
          reviewedById: input.reviewerId,
          reviewedAt: input.reviewedAt,
        },
        include: SUBMISSION_INCLUDE,
      });

      return toSubmissionRecord(row);
    } catch (error) {
      // P2025: la entrega desapareció entre la lectura y la escritura.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }

      throw error;
    }
  }

  async setSubmissionVisibility(
    submissionId: string,
    userId: string,
    isPublic: boolean,
    at: Date,
  ): Promise<ProjectSubmissionRecord | null> {
    // `userId` en el `where` es la comprobación de autoría: un tercero no
    // distingue «no existe» de «no es tuya», y el servicio responde 404.
    const result = await this.prisma.projectSubmission.updateMany({
      where: { id: submissionId, userId },
      data: { isPublic, publishedAt: isPublic ? at : null },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findSubmissionById(submissionId);
  }

  async findPortfolioUser(
    userId: string,
  ): Promise<PortfolioUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true },
    });
  }

  async listPublicSubmissions(
    userId: string,
  ): Promise<ProjectSubmissionRecord[]> {
    const rows = await this.prisma.projectSubmission.findMany({
      where: { userId, isPublic: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: SUBMISSION_INCLUDE,
    });

    return rows.map(toSubmissionRecord);
  }

  async listOwnSubmissions(
    userId: string,
  ): Promise<ProjectSubmissionRecord[]> {
    const rows = await this.prisma.projectSubmission.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: SUBMISSION_INCLUDE,
    });

    return rows.map(toSubmissionRecord);
  }

  async addCompetencyEvidence(
    userId: string,
    competencies: readonly string[],
    evaluatedAt: Date,
  ): Promise<void> {
    const codes = [...new Set(competencies)];

    if (codes.length === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.competencyProgress.findMany({
        where: { userId, competency: { in: codes } },
        select: { competency: true, level: true },
      });
      const currentLevel = new Map(
        existing.map((row) => [row.competency, row.level]),
      );

      for (const competency of codes) {
        await tx.competencyProgress.upsert({
          where: { userId_competency: { userId, competency } },
          create: {
            userId,
            competency,
            level: PROJECT_APPROVED_COMPETENCY_LEVEL,
            evidenceCount: 1,
            lastEvaluated: evaluatedAt,
          },
          // Nunca baja un nivel ya alcanzado por otra evidencia (S5).
          update: {
            level: Math.max(
              currentLevel.get(competency) ?? 0,
              PROJECT_APPROVED_COMPETENCY_LEVEL,
            ),
            evidenceCount: { increment: 1 },
            lastEvaluated: evaluatedAt,
          },
        });
      }
    });
  }
}

function bestScore(
  submissions: readonly { score: number | null }[],
): number | null {
  let best: number | null = null;

  for (const submission of submissions) {
    if (submission.score === null) {
      continue;
    }

    if (best === null || submission.score > best) {
      best = submission.score;
    }
  }

  return best;
}

function toProjectRecord(row: ProjectRow | PrismaProject): ProjectRecord {
  return {
    id: row.id,
    slug: row.slug,
    stageId: row.stageId,
    title: row.title,
    brief: row.brief,
    requirements: row.requirements,
    rubric: row.rubric,
    competencies: row.competencies,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
  };
}

function toSubmissionRecord(row: SubmissionRow): ProjectSubmissionRecord {
  return toSubmissionWithProject(row, toProjectRecord(row.project));
}

/** Variante para filas donde el proyecto se cargó aparte (detalle por slug). */
function toSubmissionWithProject(
  row: PrismaProjectSubmission,
  project: ProjectRecord,
): ProjectSubmissionRecord {
  return {
    id: row.id,
    userId: row.userId,
    status: toSubmissionStatus(row.status),
    repoUrl: row.repoUrl,
    deployUrl: row.deployUrl,
    notes: row.notes,
    score: row.score,
    rubricScores: toRubricScores(row.rubricScores),
    feedback: row.feedback,
    reviewedAt: row.reviewedAt,
    isPublic: row.isPublic,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    project,
  };
}

function toSubmissionStatus(value: string): ProjectSubmissionStatus {
  if (!PROJECT_SUBMISSION_STATUSES.includes(value as ProjectSubmissionStatus)) {
    throw new Error(
      `Estado de entrega desconocido en la base de datos: ${value}`,
    );
  }

  return value as ProjectSubmissionStatus;
}

function toRubricScores(
  value: Prisma.JsonValue | null,
): ProjectRubricScores | null {
  if (value === null) {
    return null;
  }

  const parsed = projectRubricScoresSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error("Niveles de rúbrica corruptos en la base de datos");
  }

  return parsed.data;
}
