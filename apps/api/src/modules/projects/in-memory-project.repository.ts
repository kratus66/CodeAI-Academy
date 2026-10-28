import type {
  ProjectRubricScores,
  ProjectSubmissionStatus,
} from "@codeai/shared";

import type {
  CreateProjectSubmissionRecord,
  ListProjectsFilter,
  PortfolioUserRecord,
  ProjectCatalogRow,
  ProjectDetailRow,
  ProjectRecord,
  ProjectSubmissionRecord,
  ProjectsPage,
  ProjectsRepository,
  SaveProjectReviewRecord,
} from "./project.repository";
import { PROJECT_APPROVED_COMPETENCY_LEVEL } from "./project.repository";

/** Fila interna de una entrega; el proyecto se resuelve al mapear. */
interface StoredSubmission {
  id: string;
  projectId: string;
  userId: string;
  status: ProjectSubmissionStatus;
  repoUrl: string;
  deployUrl: string | null;
  notes: string | null;
  score: number | null;
  rubricScores: ProjectRubricScores | null;
  feedback: string | null;
  reviewedAt: Date | null;
  isPublic: boolean;
  publishedAt: Date | null;
  createdAt: Date;
}

/** Estado de una competencia, con la misma forma que `CompetencyProgress`. */
export interface InMemoryCompetencyEvidence {
  level: number;
  evidenceCount: number;
  lastEvaluated: Date;
}

export interface InMemoryProjectsSeed {
  projects?: readonly ProjectRecord[];
  users?: readonly PortfolioUserRecord[];
}

export interface SeedSubmissionInput {
  id: string;
  projectId: string;
  userId: string;
  status?: ProjectSubmissionStatus;
  repoUrl?: string;
  deployUrl?: string | null;
  notes?: string | null;
  score?: number | null;
  rubricScores?: ProjectRubricScores | null;
  feedback?: string | null;
  reviewedAt?: Date | null;
  isPublic?: boolean;
  publishedAt?: Date | null;
  createdAt?: Date;
}

/**
 * Implementación en memoria de `ProjectsRepository` para pruebas y entornos sin
 * base de datos. Imita al adaptador Prisma: mismo orden, mismas reglas de
 * autoría en la publicación y la misma evidencia de competencia (nivel 3 como
 * mínimo, sin bajar lo ya alcanzado).
 */
export class InMemoryProjectsRepository implements ProjectsRepository {
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly submissions = new Map<string, StoredSubmission>();
  private readonly users = new Map<string, PortfolioUserRecord>();
  private readonly competencies = new Map<string, InMemoryCompetencyEvidence>();
  private sequence = 0;

  constructor(seed: InMemoryProjectsSeed = {}) {
    for (const project of seed.projects ?? []) {
      this.projects.set(project.id, { ...project });
    }

    for (const user of seed.users ?? []) {
      this.users.set(user.id, { ...user });
    }
  }

  /** Prepara una entrega existente; las pruebas de T7–T10 la usan como estado inicial. */
  seedSubmission(input: SeedSubmissionInput): ProjectSubmissionRecord {
    const stored: StoredSubmission = {
      id: input.id,
      projectId: input.projectId,
      userId: input.userId,
      status: input.status ?? "SUBMITTED",
      repoUrl: input.repoUrl ?? "https://github.com/ejemplo/proyecto",
      deployUrl: input.deployUrl ?? null,
      notes: input.notes ?? null,
      score: input.score ?? null,
      rubricScores: input.rubricScores ?? null,
      feedback: input.feedback ?? null,
      reviewedAt: input.reviewedAt ?? null,
      isPublic: input.isPublic ?? false,
      publishedAt: input.publishedAt ?? null,
      createdAt: input.createdAt ?? new Date(),
    };

    this.submissions.set(stored.id, stored);

    return this.toSubmissionRecord(stored);
  }

  /** Competencia tal como quedó tras `addCompetencyEvidence`; `null` si no hay fila. */
  getCompetencyEvidence(
    userId: string,
    competency: string,
  ): InMemoryCompetencyEvidence | null {
    const evidence = this.competencies.get(`${userId}:${competency}`);

    return evidence ? { ...evidence } : null;
  }

  async listPublishedProjects(
    filter: ListProjectsFilter,
    userId: string,
  ): Promise<ProjectsPage> {
    const matches = [...this.projects.values()]
      .filter((project) => project.isPublished)
      .filter(
        (project) => filter.stageId === undefined || project.stageId === filter.stageId,
      )
      .sort(
        (a, b) =>
          a.stageId - b.stageId ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );

    const start = (filter.page - 1) * filter.pageSize;
    const page = matches.slice(start, start + filter.pageSize);

    return {
      items: page.map((project) => this.toCatalogRow(project, userId)),
      total: matches.length,
    };
  }

  async findPublishedProjectBySlug(
    slug: string,
    userId: string,
  ): Promise<ProjectDetailRow | null> {
    const project = [...this.projects.values()].find(
      (candidate) => candidate.slug === slug,
    );

    if (!project || !project.isPublished) {
      return null;
    }

    const mySubmissions = this.submissionsOf(userId, project.id);

    return {
      ...this.toCatalogRow(project, userId),
      mySubmissions,
    };
  }

  async createSubmission(
    input: CreateProjectSubmissionRecord,
  ): Promise<ProjectSubmissionRecord | null> {
    const project = [...this.projects.values()].find(
      (candidate) => candidate.slug === input.projectSlug,
    );

    if (!project || !project.isPublished) {
      return null;
    }

    this.sequence += 1;

    const stored: StoredSubmission = {
      id: `sub-${this.sequence}`,
      projectId: project.id,
      userId: input.userId,
      status: "SUBMITTED",
      repoUrl: input.repoUrl,
      deployUrl: input.deployUrl,
      notes: input.notes,
      score: null,
      rubricScores: null,
      feedback: null,
      reviewedAt: null,
      isPublic: false,
      publishedAt: null,
      createdAt: input.createdAt,
    };

    this.submissions.set(stored.id, stored);

    return this.toSubmissionRecord(stored);
  }

  async findSubmissionById(
    submissionId: string,
  ): Promise<ProjectSubmissionRecord | null> {
    const stored = this.submissions.get(submissionId);

    return stored ? this.toSubmissionRecord(stored) : null;
  }

  async saveReview(
    input: SaveProjectReviewRecord,
  ): Promise<ProjectSubmissionRecord | null> {
    const stored = this.submissions.get(input.submissionId);

    if (!stored) {
      return null;
    }

    const reviewed: StoredSubmission = {
      ...stored,
      status: "REVIEWED",
      score: input.score,
      rubricScores: { ...input.rubricScores },
      feedback: input.feedback,
      reviewedAt: input.reviewedAt,
    };

    this.submissions.set(reviewed.id, reviewed);

    return this.toSubmissionRecord(reviewed);
  }

  async setSubmissionVisibility(
    submissionId: string,
    userId: string,
    isPublic: boolean,
    at: Date,
  ): Promise<ProjectSubmissionRecord | null> {
    const stored = this.submissions.get(submissionId);

    // Igual que el `updateMany` de Prisma: la autoría forma parte del filtro.
    if (!stored || stored.userId !== userId) {
      return null;
    }

    const updated: StoredSubmission = {
      ...stored,
      isPublic,
      publishedAt: isPublic ? at : null,
    };

    this.submissions.set(updated.id, updated);

    return this.toSubmissionRecord(updated);
  }

  async findPortfolioUser(
    userId: string,
  ): Promise<PortfolioUserRecord | null> {
    const user = this.users.get(userId);

    return user ? { ...user } : null;
  }

  async listPublicSubmissions(
    userId: string,
  ): Promise<ProjectSubmissionRecord[]> {
    return [...this.submissions.values()]
      .filter((submission) => submission.userId === userId && submission.isPublic)
      .sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      )
      .map((submission) => this.toSubmissionRecord(submission));
  }

  async listOwnSubmissions(
    userId: string,
  ): Promise<ProjectSubmissionRecord[]> {
    return [...this.submissions.values()]
      .filter((submission) => submission.userId === userId)
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      )
      .map((submission) => this.toSubmissionRecord(submission));
  }

  async addCompetencyEvidence(
    userId: string,
    competencies: readonly string[],
    evaluatedAt: Date,
  ): Promise<void> {
    for (const competency of new Set(competencies)) {
      const key = `${userId}:${competency}`;
      const current = this.competencies.get(key);

      this.competencies.set(key, {
        level: Math.max(
          current?.level ?? 0,
          PROJECT_APPROVED_COMPETENCY_LEVEL,
        ),
        evidenceCount: (current?.evidenceCount ?? 0) + 1,
        lastEvaluated: evaluatedAt,
      });
    }
  }

  private submissionsOf(
    userId: string,
    projectId: string,
  ): ProjectSubmissionRecord[] {
    return [...this.submissions.values()]
      .filter(
        (submission) =>
          submission.userId === userId && submission.projectId === projectId,
      )
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      )
      .map((submission) => this.toSubmissionRecord(submission));
  }

  private toCatalogRow(project: ProjectRecord, userId: string): ProjectCatalogRow {
    const submissions = this.submissionsOf(userId, project.id);

    return {
      ...copyProject(project),
      submitted: submissions.length > 0,
      bestScore: bestScore(submissions),
    };
  }

  private toSubmissionRecord(stored: StoredSubmission): ProjectSubmissionRecord {
    const project = this.projects.get(stored.projectId);

    if (!project) {
      throw new Error(
        `Entrega sin proyecto en memoria: ${stored.id} → ${stored.projectId}`,
      );
    }

    return {
      id: stored.id,
      userId: stored.userId,
      status: stored.status,
      repoUrl: stored.repoUrl,
      deployUrl: stored.deployUrl,
      notes: stored.notes,
      score: stored.score,
      rubricScores: stored.rubricScores
        ? { ...stored.rubricScores }
        : null,
      feedback: stored.feedback,
      reviewedAt: stored.reviewedAt,
      isPublic: stored.isPublic,
      publishedAt: stored.publishedAt,
      createdAt: stored.createdAt,
      project: copyProject(project),
    };
  }
}

function copyProject(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    requirements: [...project.requirements],
    competencies: [...project.competencies],
  };
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
