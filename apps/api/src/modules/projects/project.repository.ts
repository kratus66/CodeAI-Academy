import type {
  ProjectRubricScores,
  ProjectSubmissionStatus,
} from "@codeai/shared";

/**
 * Puerto de persistencia de proyectos (`sprint-09-proyectos-rubricas.md` §4).
 *
 * Devuelve datos ya normalizados (fechas como `Date`) y deja el `rubric` como
 * `unknown`: el servicio lo valida con `readRubric` antes de puntuar, porque la
 * base no puede garantizar la forma del `Json`.
 */
export const PROJECTS_REPOSITORY = Symbol("PROJECTS_REPOSITORY");

/** Fila de `Project` que necesita el módulo. */
export interface ProjectRecord {
  id: string;
  slug: string;
  stageId: number;
  title: string;
  brief: string;
  requirements: readonly string[];
  /** `Json` sin validar; el motor lo comprueba con `readRubric`. */
  rubric: unknown;
  /** Códigos C1–C14 que reciben evidencia al aprobar. */
  competencies: readonly string[];
  isPublished: boolean;
  createdAt: Date;
}

/** Entrega con su proyecto embebido: evita una segunda consulta al mapear. */
export interface ProjectSubmissionRecord {
  id: string;
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
  project: ProjectRecord;
}

/** Proyecto del catálogo con lo que el usuario autenticado ya hizo en él. */
export interface ProjectCatalogRow extends ProjectRecord {
  /** El usuario del token tiene al menos una entrega. */
  submitted: boolean;
  /** Mejor nota propia; `null` si ninguna entrega fue revisada. */
  bestScore: number | null;
}

/** Detalle de un proyecto: catálogo + entregas propias, más reciente primero. */
export interface ProjectDetailRow extends ProjectCatalogRow {
  mySubmissions: readonly ProjectSubmissionRecord[];
}

/** Filtros ya validados por `projectListQuerySchema`. */
export interface ListProjectsFilter {
  stageId?: number;
  page: number;
  pageSize: number;
}

export interface ProjectsPage {
  items: ProjectCatalogRow[];
  total: number;
}

export interface CreateProjectSubmissionRecord {
  /** Se resuelve por `slug` para comprobar publicación y existencia en la misma escritura. */
  projectSlug: string;
  userId: string;
  repoUrl: string;
  deployUrl: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface SaveProjectReviewRecord {
  submissionId: string;
  reviewerId: string;
  score: number;
  rubricScores: ProjectRubricScores;
  feedback: string | null;
  reviewedAt: Date;
}

/** Autor del portafolio: nunca incluye `email` ni `role`. */
export interface PortfolioUserRecord {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** Nivel mínimo que deja una revisión aprobada (nota ≥ 80) en una competencia. */
export const PROJECT_APPROVED_COMPETENCY_LEVEL = 3;

export interface ProjectsRepository {
  /** Sólo proyectos publicados; orden estable por etapa y creación. */
  listPublishedProjects(
    filter: ListProjectsFilter,
    userId: string,
  ): Promise<ProjectsPage>;
  /** `null` si el proyecto no existe o no está publicado. */
  findPublishedProjectBySlug(
    slug: string,
    userId: string,
  ): Promise<ProjectDetailRow | null>;
  /** `null` si el proyecto no existe o no está publicado. */
  createSubmission(
    input: CreateProjectSubmissionRecord,
  ): Promise<ProjectSubmissionRecord | null>;
  /** `null` si la entrega no existe (la revisión no depende de la publicación). */
  findSubmissionById(
    submissionId: string,
  ): Promise<ProjectSubmissionRecord | null>;
  /** `null` si la entrega desapareció antes de guardar la revisión. */
  saveReview(
    input: SaveProjectReviewRecord,
  ): Promise<ProjectSubmissionRecord | null>;
  /**
   * Cambia la visibilidad sólo si la entrega pertenece a `userId`; `null` en
   * otro caso, para que el servicio responda `404` sin confirmar que existe.
   */
  setSubmissionVisibility(
    submissionId: string,
    userId: string,
    isPublic: boolean,
    at: Date,
  ): Promise<ProjectSubmissionRecord | null>;
  findPortfolioUser(userId: string): Promise<PortfolioUserRecord | null>;
  /** Portafolio público: sólo publicadas, con `publishedAt` descendente. */
  listPublicSubmissions(
    userId: string,
  ): Promise<ProjectSubmissionRecord[]>;
  /** Portafolio propio: incluye privadas, con `createdAt` descendente. */
  listOwnSubmissions(userId: string): Promise<ProjectSubmissionRecord[]>;
  /**
   * Deja evidencia de competencia sin bajar el nivel ya alcanzado: sube a 3
   * como mínimo, incrementa `evidenceCount` y sella `lastEvaluated`.
   */
  addCompetencyEvidence(
    userId: string,
    competencies: readonly string[],
    evaluatedAt: Date,
  ): Promise<void>;
}
