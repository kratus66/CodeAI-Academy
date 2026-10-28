import { DEFAULT_PROJECT_RUBRIC } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { InMemoryProjectsRepository } from "./in-memory-project.repository";
import type { ProjectRecord } from "./project.repository";

const AUTHOR = "user-1";
const OTHER = "user-2";

function project(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: overrides.id ?? "project-1",
    slug: overrides.slug ?? "entorno-reproducible",
    stageId: overrides.stageId ?? 0,
    title: overrides.title ?? "Entorno reproducible",
    brief: overrides.brief ?? "Deja un repositorio que arranque en cualquier máquina.",
    requirements: overrides.requirements ?? ["README con requisitos"],
    rubric: overrides.rubric ?? DEFAULT_PROJECT_RUBRIC,
    competencies: overrides.competencies ?? ["C1"],
    isPublished: overrides.isPublished ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-10-01T10:00:00.000Z"),
  };
}

function secondProject(): ProjectRecord {
  return project({
    id: "project-2",
    slug: "retos-de-logica-en-consola",
    stageId: 1,
    title: "Retos de lógica en consola",
    createdAt: new Date("2026-10-02T10:00:00.000Z"),
  });
}

function repository(): InMemoryProjectsRepository {
  return new InMemoryProjectsRepository({
    projects: [project(), secondProject()],
    users: [{ id: AUTHOR, name: "Ada", avatarUrl: null }],
  });
}

describe("InMemoryProjectsRepository — catálogo", () => {
  it("lista sólo proyectos publicados, ordenados por etapa", async () => {
    const repo = new InMemoryProjectsRepository({
      projects: [
        secondProject(),
        project(),
        project({ id: "p3", slug: "oculto", isPublished: false }),
      ],
    });

    const page = await repo.listPublishedProjects({ page: 1, pageSize: 10 }, AUTHOR);

    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.slug)).toEqual([
      "entorno-reproducible",
      "retos-de-logica-en-consola",
    ]);
  });

  it("filtra por etapa y pagina con el total sin filtrar por página", async () => {
    const repo = repository();

    const stageOne = await repo.listPublishedProjects(
      { stageId: 1, page: 1, pageSize: 10 },
      AUTHOR,
    );
    const page = await repo.listPublishedProjects({ page: 2, pageSize: 1 }, AUTHOR);

    expect(stageOne.items.map((item) => item.slug)).toEqual([
      "retos-de-logica-en-consola",
    ]);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.slug).toBe("retos-de-logica-en-consola");
    expect(page.total).toBe(2);
  });

  it("marca `submitted` y la mejor nota sólo con las entregas del usuario", async () => {
    const repo = repository();
    repo.seedSubmission({ id: "s1", projectId: "project-1", userId: AUTHOR, score: 72 });
    repo.seedSubmission({ id: "s2", projectId: "project-1", userId: AUTHOR, score: 88 });
    repo.seedSubmission({ id: "s3", projectId: "project-2", userId: OTHER, score: 95 });

    const page = await repo.listPublishedProjects({ page: 1, pageSize: 10 }, AUTHOR);
    const [first, second] = page.items;

    expect(first).toMatchObject({ submitted: true, bestScore: 88 });
    expect(second).toMatchObject({ submitted: false, bestScore: null });
  });
});

describe("InMemoryProjectsRepository — entregas", () => {
  it("crea una entrega acumulable sobre un proyecto publicado", async () => {
    const repo = repository();

    const first = await repo.createSubmission({
      projectSlug: "entorno-reproducible",
      userId: AUTHOR,
      repoUrl: "https://github.com/ada/entorno",
      deployUrl: null,
      notes: "Documenté el arranque",
      createdAt: new Date("2026-10-05T10:00:00.000Z"),
    });
    const second = await repo.createSubmission({
      projectSlug: "entorno-reproducible",
      userId: AUTHOR,
      repoUrl: "https://github.com/ada/entorno",
      deployUrl: "https://entorno.vercel.app",
      notes: null,
      createdAt: new Date("2026-10-06T10:00:00.000Z"),
    });

    expect(first?.status).toBe("SUBMITTED");
    expect(first?.score).toBeNull();
    expect(first?.id).not.toBe(second?.id);
    expect(second?.project.slug).toBe("entorno-reproducible");

    const detail = await repo.findPublishedProjectBySlug(
      "entorno-reproducible",
      AUTHOR,
    );
    expect(detail?.mySubmissions).toHaveLength(2);
  });

  it("no crea entregas para proyectos no publicados o inexistentes", async () => {
    const repo = new InMemoryProjectsRepository({
      projects: [project({ isPublished: false })],
    });
    const input = {
      userId: AUTHOR,
      repoUrl: "https://github.com/ada/entorno",
      deployUrl: null,
      notes: null,
      createdAt: new Date(),
    };

    await expect(
      repo.createSubmission({ ...input, projectSlug: "entorno-reproducible" }),
    ).resolves.toBeNull();
    await expect(
      repo.createSubmission({ ...input, projectSlug: "no-existe" }),
    ).resolves.toBeNull();
  });

  it("guarda la revisión y devuelve null si la entrega no existe", async () => {
    const repo = repository();
    repo.seedSubmission({ id: "s1", projectId: "project-1", userId: AUTHOR });

    const reviewed = await repo.saveReview({
      submissionId: "s1",
      reviewerId: "instructor-1",
      score: 85,
      rubricScores: {
        correctitud: 4,
        calidad: 4,
        pruebas: 4,
        seguridad: 4,
        justificacion: 0,
      },
      feedback: "Falta la explicación propia",
      reviewedAt: new Date("2026-10-07T10:00:00.000Z"),
    });

    expect(reviewed?.status).toBe("REVIEWED");
    expect(reviewed?.score).toBe(85);
    expect(reviewed?.feedback).toBe("Falta la explicación propia");
    expect(reviewed?.reviewedAt).toEqual(new Date("2026-10-07T10:00:00.000Z"));

    await expect(
      repo.saveReview({
        submissionId: "no-existe",
        reviewerId: "instructor-1",
        score: 85,
        rubricScores: {
          correctitud: 4,
          calidad: 4,
          pruebas: 4,
          seguridad: 4,
          justificacion: 4,
        },
        feedback: null,
        reviewedAt: new Date(),
      }),
    ).resolves.toBeNull();
  });
});

describe("InMemoryProjectsRepository — publicación y portafolio", () => {
  it("sólo el autor cambia la visibilidad y despublicar limpia `publishedAt`", async () => {
    const repo = repository();
    repo.seedSubmission({ id: "s1", projectId: "project-1", userId: AUTHOR });

    await expect(
      repo.setSubmissionVisibility("s1", OTHER, true, new Date()),
    ).resolves.toBeNull();

    const published = await repo.setSubmissionVisibility(
      "s1",
      AUTHOR,
      true,
      new Date("2026-10-08T10:00:00.000Z"),
    );
    const unpublished = await repo.setSubmissionVisibility(
      "s1",
      AUTHOR,
      false,
      new Date("2026-10-09T10:00:00.000Z"),
    );

    expect(published?.isPublic).toBe(true);
    expect(published?.publishedAt).toEqual(new Date("2026-10-08T10:00:00.000Z"));
    expect(unpublished?.isPublic).toBe(false);
    expect(unpublished?.publishedAt).toBeNull();
  });

  it("el portafolio público excluye privadas y ordena por publicación reciente", async () => {
    const repo = repository();
    repo.seedSubmission({
      id: "privada",
      projectId: "project-1",
      userId: AUTHOR,
      createdAt: new Date("2026-10-09T10:00:00.000Z"),
    });
    repo.seedSubmission({
      id: "publica-vieja",
      projectId: "project-1",
      userId: AUTHOR,
      isPublic: true,
      createdAt: new Date("2026-10-02T10:00:00.000Z"),
      publishedAt: new Date("2026-10-02T10:00:00.000Z"),
    });
    repo.seedSubmission({
      id: "publica-nueva",
      projectId: "project-2",
      userId: AUTHOR,
      isPublic: true,
      createdAt: new Date("2026-10-05T10:00:00.000Z"),
      publishedAt: new Date("2026-10-05T10:00:00.000Z"),
    });

    const publicEntries = await repo.listPublicSubmissions(AUTHOR);
    const ownEntries = await repo.listOwnSubmissions(AUTHOR);

    expect(publicEntries.map((entry) => entry.id)).toEqual([
      "publica-nueva",
      "publica-vieja",
    ]);
    expect(ownEntries.map((entry) => entry.id)).toEqual([
      "privada",
      "publica-nueva",
      "publica-vieja",
    ]);
  });

  it("no expone el correo del autor en el portafolio", async () => {
    const repo = repository();

    const user = await repo.findPortfolioUser(AUTHOR);

    expect(user).toEqual({ id: AUTHOR, name: "Ada", avatarUrl: null });
    await expect(repo.findPortfolioUser("no-existe")).resolves.toBeNull();
  });
});

describe("InMemoryProjectsRepository — evidencia de competencia", () => {
  it("sube a nivel 3 como mínimo e incrementa la evidencia", async () => {
    const repo = repository();
    const at = new Date("2026-10-10T10:00:00.000Z");

    await repo.addCompetencyEvidence(AUTHOR, ["C1", "C5"], at);
    await repo.addCompetencyEvidence(AUTHOR, ["C1"], at);

    expect(repo.getCompetencyEvidence(AUTHOR, "C1")).toEqual({
      level: 3,
      evidenceCount: 2,
      lastEvaluated: at,
    });
    expect(repo.getCompetencyEvidence(AUTHOR, "C5")).toEqual({
      level: 3,
      evidenceCount: 1,
      lastEvaluated: at,
    });
    expect(repo.getCompetencyEvidence(AUTHOR, "C2")).toBeNull();
  });
});

describe("InMemoryProjectsRepository — detalle", () => {
  it("devuelve null para un proyecto no publicado", async () => {
    const repo = new InMemoryProjectsRepository({
      projects: [project({ isPublished: false })],
    });

    await expect(
      repo.findPublishedProjectBySlug("entorno-reproducible", AUTHOR),
    ).resolves.toBeNull();
  });

  it("devuelve las entregas propias de la más reciente a la más antigua", async () => {
    const repo = repository();
    repo.seedSubmission({
      id: "vieja",
      projectId: "project-1",
      userId: AUTHOR,
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
    });
    repo.seedSubmission({
      id: "nueva",
      projectId: "project-1",
      userId: AUTHOR,
      createdAt: new Date("2026-10-03T10:00:00.000Z"),
    });
    repo.seedSubmission({ id: "ajena", projectId: "project-1", userId: OTHER });

    const detail = await repo.findPublishedProjectBySlug(
      "entorno-reproducible",
      AUTHOR,
    );

    expect(detail?.mySubmissions.map((submission) => submission.id)).toEqual([
      "nueva",
      "vieja",
    ]);
    expect(detail?.submitted).toBe(true);
  });
});
