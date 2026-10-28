import type {
  CreateProjectSubmissionInput,
  PortfolioResponse,
  ProjectDetail,
  ProjectListQuery,
  ProjectListResponse,
  ProjectSubmission,
  ProjectSummary,
} from "@codeai/shared";
import {
  createProjectSubmissionSchema,
  reviewProjectSubmissionSchema,
} from "@codeai/shared";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { toErrorDetails } from "../../common/pipes/zod-validation.pipe";
import type {
  ProjectCatalogRow,
  ProjectDetailRow,
  ProjectSubmissionRecord,
  ProjectsRepository,
} from "./project.repository";
import { PROJECTS_REPOSITORY } from "./project.repository";
import { readRubric, scoreSubmission } from "./rubric";

/** Mismo texto para «no existe» y «no publicado»: no se revela el catálogo oculto. */
const PROJECT_NOT_FOUND = "El proyecto no existe o no está publicado";
const SUBMISSION_NOT_FOUND = "La entrega no existe";
const USER_NOT_FOUND = "El usuario no existe";
const INCOMPLETE_RUBRIC =
  "La revisión debe puntuar los cinco criterios con niveles enteros de 0 a 4";
const CORRECTITUD_ZERO =
  "La correctitud 0 invalida el entregable: no se guarda la revisión";

/** Reloj inyectable: las pruebas fijan `createdAt`/`publishedAt` sin tocar el sistema. */
export const PROJECTS_CLOCK = Symbol("PROJECTS_CLOCK");

export type ProjectsClock = () => Date;

/**
 * Catálogo y detalle de proyectos (`contratos-api.md` §4.11).
 *
 * `userId` llega del token, nunca de la ruta ni del cuerpo: `submitted`,
 * `bestScore` y `mySubmissions` son siempre los del usuario autenticado.
 */
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECTS_REPOSITORY) private readonly repository: ProjectsRepository,
    @Inject(PROJECTS_CLOCK) private readonly now: ProjectsClock,
  ) {}

  async listProjects(
    query: ProjectListQuery,
    userId: string,
  ): Promise<ProjectListResponse> {
    const { items, total } = await this.repository.listPublishedProjects(
      { stageId: query.stage, page: query.page, pageSize: query.pageSize },
      userId,
    );

    return {
      data: items.map(toProjectSummary),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getProject(slug: string, userId: string): Promise<ProjectDetail> {
    const row = await this.repository.findPublishedProjectBySlug(slug, userId);

    if (!row) {
      throw new NotFoundException(PROJECT_NOT_FOUND);
    }

    return toProjectDetail(row);
  }

  /**
   * Registra una entrega del usuario autenticado. Cada llamada crea una fila
   * nueva: las entregas son acumulables y conservan la nota anterior.
   */
  async submit(
    slug: string,
    input: CreateProjectSubmissionInput,
    userId: string,
  ): Promise<ProjectSubmission> {
    // Se revalida aquí aunque el controlador ya use el mismo esquema: el
    // servicio es el último punto antes de escribir y no confía en el llamador.
    const parsed = createProjectSubmissionSchema.safeParse(input);

    if (!parsed.success) {
      throw new BadRequestException({
        message: toErrorDetails(parsed.error),
      });
    }

    // Una explicación vacía se guarda como `null`: es la señal de que la
    // justificación resta el 15 % completo, no un texto que exista.
    const notes =
      parsed.data.notes && parsed.data.notes.length > 0
        ? parsed.data.notes
        : null;

    const created = await this.repository.createSubmission({
      projectSlug: slug,
      userId,
      repoUrl: parsed.data.repoUrl,
      deployUrl: parsed.data.deployUrl ?? null,
      notes,
      createdAt: this.now(),
    });

    if (!created) {
      throw new NotFoundException(PROJECT_NOT_FOUND);
    }

    return toProjectSubmission(created);
  }

  /**
   * Revisa una entrega con la rúbrica del proyecto (`sprint-09-proyectos-rubricas.md` §4).
   *
   * Orden de las reglas: la rúbrica completa se exige antes de tocar la fila;
   * correctitud 0 responde `422` sin persistir; una nota ≥ 80 deja evidencia de
   * competencia en el **autor** de la entrega, no en el revisor.
   */
  async review(
    submissionId: string,
    input: unknown,
    reviewerId: string,
  ): Promise<ProjectSubmission> {
    const submission = await this.repository.findSubmissionById(submissionId);

    if (!submission) {
      throw new NotFoundException(SUBMISSION_NOT_FOUND);
    }

    const parsed = reviewProjectSubmissionSchema.safeParse(input);

    if (!parsed.success) {
      const detail = toErrorDetails(parsed.error)
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join("; ");

      throw new UnprocessableEntityException({
        message: `${INCOMPLETE_RUBRIC}. ${detail}`,
      });
    }

    const result = scoreSubmission({
      rubric: submission.project.rubric,
      scores: parsed.data.rubricScores,
      notes: submission.notes,
    });

    if (
      !result.valid ||
      result.score === null ||
      result.rubricScores === null
    ) {
      throw new UnprocessableEntityException({ message: CORRECTITUD_ZERO });
    }

    const reviewedAt = this.now();
    const feedback =
      parsed.data.feedback && parsed.data.feedback.length > 0
        ? parsed.data.feedback
        : null;

    const reviewed = await this.repository.saveReview({
      submissionId,
      reviewerId,
      score: result.score,
      rubricScores: result.rubricScores,
      feedback,
      reviewedAt,
    });

    if (!reviewed) {
      throw new NotFoundException(SUBMISSION_NOT_FOUND);
    }

    if (result.grantsEvidence) {
      await this.repository.addCompetencyEvidence(
        submission.userId,
        submission.project.competencies,
        reviewedAt,
      );
    }

    return toProjectSubmission(reviewed);
  }

  /** Publica una entrega propia; un tercero recibe `404` (no se confirma que exista). */
  async publish(
    submissionId: string,
    userId: string,
  ): Promise<ProjectSubmission> {
    return this.setVisibility(submissionId, userId, true);
  }

  /** Retira una entrega del portafolio público; la entrega y su nota siguen intactas. */
  async unpublish(
    submissionId: string,
    userId: string,
  ): Promise<ProjectSubmission> {
    return this.setVisibility(submissionId, userId, false);
  }

  /** Portafolio propio: incluye privadas y cuenta sólo las públicas incluidas. */
  async getMyPortfolio(userId: string): Promise<PortfolioResponse> {
    return this.buildPortfolio(userId, "ALL");
  }

  /**
   * Portafolio público: ruta sin cookie. Nunca incluye `email`, entregas
   * privadas ni el rol del autor.
   */
  async getPortfolio(userId: string): Promise<PortfolioResponse> {
    return this.buildPortfolio(userId, "PUBLIC");
  }

  private async setVisibility(
    submissionId: string,
    userId: string,
    isPublic: boolean,
  ): Promise<ProjectSubmission> {
    const updated = await this.repository.setSubmissionVisibility(
      submissionId,
      userId,
      isPublic,
      this.now(),
    );

    if (!updated) {
      throw new NotFoundException(SUBMISSION_NOT_FOUND);
    }

    return toProjectSubmission(updated);
  }

  private async buildPortfolio(
    userId: string,
    visibility: "ALL" | "PUBLIC",
  ): Promise<PortfolioResponse> {
    const user = await this.repository.findPortfolioUser(userId);

    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND);
    }

    const entries =
      visibility === "ALL"
        ? await this.repository.listOwnSubmissions(userId)
        : await this.repository.listPublicSubmissions(userId);

    return {
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
      entries: entries.map(toProjectSubmission),
      publicCount: entries.filter((entry) => entry.isPublic).length,
    };
  }
}

/** Ficha del catálogo: sin rúbrica ni competencias, que sólo viajan en el detalle. */
export function toProjectSummary(row: ProjectCatalogRow): ProjectSummary {
  return {
    id: row.id,
    slug: row.slug,
    stageId: row.stageId,
    title: row.title,
    brief: row.brief,
    requirements: [...row.requirements],
    isPublished: row.isPublished,
    submitted: row.submitted,
  };
}

export function toProjectSubmission(
  record: ProjectSubmissionRecord,
): ProjectSubmission {
  return {
    id: record.id,
    projectId: record.project.id,
    projectSlug: record.project.slug,
    projectTitle: record.project.title,
    stageId: record.project.stageId,
    userId: record.userId,
    status: record.status,
    repoUrl: record.repoUrl,
    deployUrl: record.deployUrl,
    notes: record.notes,
    score: record.score,
    rubricScores: record.rubricScores ? { ...record.rubricScores } : null,
    feedback: record.feedback,
    reviewedAt: toIsoString(record.reviewedAt),
    isPublic: record.isPublic,
    publishedAt: toIsoString(record.publishedAt),
    createdAt: toIsoString(record.createdAt)!,
  };
}

/**
 * Detalle del proyecto: la rúbrica se valida antes de publicarla, así una fila
 * corrupta falla aquí y no en la revisión.
 */
export function toProjectDetail(row: ProjectDetailRow): ProjectDetail {
  return {
    ...toProjectSummary(row),
    rubric: readRubric(row.rubric),
    competencies: [...row.competencies],
    bestScore: row.bestScore,
    mySubmissions: row.mySubmissions.map(toProjectSubmission),
  };
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
