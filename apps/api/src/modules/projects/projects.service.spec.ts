import type {
  ProjectRubricScores,
  ReviewProjectSubmissionInput,
} from "@codeai/shared";
import { DEFAULT_PROJECT_RUBRIC } from "@codeai/shared";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { InMemoryProjectsRepository } from "./in-memory-project.repository";
import type { ProjectRecord } from "./project.repository";
import { ProjectsService } from "./projects.service";
import { InvalidRubricError } from "./rubric";

const AUTHOR = "user-1";
const OTHER = "user-2";

/** Reloj fijo: la fecha de entrega no depende de cuándo se ejecute la prueba. */
const CLOCK = (): Date => new Date("2026-10-10T10:00:00.000Z");

function project(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: overrides.id ?? "project-1",
    slug: overrides.slug ?? "entorno-reproducible",
    stageId: overrides.stageId ?? 0,
    title: overrides.title ?? "Entorno reproducible",
    brief: overrides.brief ?? "Deja un repositorio que arranque en cualquier máquina.",
    requirements: overrides.requirements ?? [
      "README con requisitos",
      "Script de verificación",
    ],
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
    competencies: ["C1", "C5"],
    createdAt: new Date("2026-10-02T10:00:00.000Z"),
  });
}

function reviewedScores(justificacion: number): ProjectRubricScores {
  return {
    correctitud: 4,
    calidad: 4,
    pruebas: 4,
    seguridad: 4,
    justificacion,
  };
}

function setup(): {
  repo: InMemoryProjectsRepository;
  service: ProjectsService;
} {
  const repo = new InMemoryProjectsRepository({
    projects: [project(), secondProject()],
    users: [{ id: AUTHOR, name: "Ada", avatarUrl: null }],
  });

  return { repo, service: new ProjectsService(repo, CLOCK) };
}

describe("ProjectsService.listProjects", () => {
  it("devuelve sólo publicados, sin rúbrica, con metadatos de paginación", async () => {
    const repo = new InMemoryProjectsRepository({
      projects: [
        project(),
        secondProject(),
        project({ id: "p3", slug: "oculto", isPublished: false }),
      ],
    });
    const service = new ProjectsService(repo, CLOCK);

    const response = await service.listProjects(
      { page: 1, pageSize: 10 },
      AUTHOR,
    );

    expect(response.meta).toEqual({
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    });
    expect(response.data.map((item) => item.slug)).toEqual([
      "entorno-reproducible",
      "retos-de-logica-en-consola",
    ]);
    expect(response.data[0]).not.toHaveProperty("rubric");
    expect(response.data[0]!.requirements).toEqual([
      "README con requisitos",
      "Script de verificación",
    ]);
  });

  it("respeta el filtro por etapa y la página solicitada", async () => {
    const { service } = setup();

    const stageOne = await service.listProjects(
      { stage: 1, page: 1, pageSize: 10 },
      AUTHOR,
    );
    const secondPage = await service.listProjects(
      { page: 2, pageSize: 1 },
      AUTHOR,
    );

    expect(stageOne.data.map((item) => item.slug)).toEqual([
      "retos-de-logica-en-consola",
    ]);
    expect(secondPage.data.map((item) => item.slug)).toEqual([
      "retos-de-logica-en-consola",
    ]);
    expect(secondPage.meta).toEqual({
      page: 2,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it("marca `submitted` sólo con las entregas del usuario del token", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({ id: "s1", projectId: "project-1", userId: AUTHOR });
    repo.seedSubmission({ id: "s2", projectId: "project-2", userId: OTHER });

    const response = await service.listProjects(
      { page: 1, pageSize: 10 },
      AUTHOR,
    );

    expect(response.data.map((item) => item.submitted)).toEqual([true, false]);
  });
});

describe("ProjectsService.getProject", () => {
  it("publica la rúbrica validada, las competencias y la mejor nota propia", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({
      id: "s1",
      projectId: "project-1",
      userId: AUTHOR,
      status: "REVIEWED",
      score: 85,
      rubricScores: reviewedScores(0),
      feedback: "Falta la justificación",
      reviewedAt: new Date("2026-10-05T10:00:00.000Z"),
      createdAt: new Date("2026-10-05T09:00:00.000Z"),
    });
    repo.seedSubmission({
      id: "s2",
      projectId: "project-1",
      userId: AUTHOR,
      status: "REVIEWED",
      score: 92,
      rubricScores: reviewedScores(4),
      reviewedAt: new Date("2026-10-06T10:00:00.000Z"),
      createdAt: new Date("2026-10-06T09:00:00.000Z"),
    });
    repo.seedSubmission({
      id: "s3",
      projectId: "project-1",
      userId: OTHER,
      score: 100,
    });

    const detail = await service.getProject("entorno-reproducible", AUTHOR);

    expect(detail.rubric.criteria).toHaveLength(5);
    expect(detail.competencies).toEqual(["C1"]);
    expect(detail.bestScore).toBe(92);
    expect(detail.mySubmissions.map((submission) => submission.id)).toEqual([
      "s2",
      "s1",
    ]);
    expect(detail.mySubmissions[0]).toMatchObject({
      projectSlug: "entorno-reproducible",
      projectTitle: "Entorno reproducible",
      stageId: 0,
      score: 92,
      reviewedAt: "2026-10-06T10:00:00.000Z",
      createdAt: "2026-10-06T09:00:00.000Z",
    });
    expect(detail.mySubmissions[1]).toMatchObject({
      feedback: "Falta la justificación",
      rubricScores: reviewedScores(0),
    });
  });

  it("devuelve `null` en mejor nota y lista vacía cuando no hay entregas", async () => {
    const { service } = setup();

    const detail = await service.getProject("entorno-reproducible", AUTHOR);

    expect(detail.bestScore).toBeNull();
    expect(detail.mySubmissions).toEqual([]);
    expect(detail.submitted).toBe(false);
  });

  it("responde 404 para un proyecto inexistente o no publicado", async () => {
    const repo = new InMemoryProjectsRepository({
      projects: [project({ isPublished: false })],
    });
    const service = new ProjectsService(repo, CLOCK);

    await expect(service.getProject("no-existe", AUTHOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.getProject("entorno-reproducible", AUTHOR),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("falla con error de dominio si la rúbrica guardada está corrupta", async () => {
    const repo = new InMemoryProjectsRepository({
      projects: [project({ rubric: { criteria: [], correctitudGate: false } })],
    });
    const service = new ProjectsService(repo, CLOCK);

    await expect(
      service.getProject("entorno-reproducible", AUTHOR),
    ).rejects.toBeInstanceOf(InvalidRubricError);
  });
});

describe("ProjectsService.submit", () => {
  it("registra la entrega del usuario del token con el reloj del servicio", async () => {
    const { repo, service } = setup();

    const submission = await service.submit(
      "entorno-reproducible",
      {
        repoUrl: "  https://github.com/ada/entorno  ",
        notes: "  Documenté el arranque  ",
      },
      AUTHOR,
    );

    expect(submission).toMatchObject({
      projectSlug: "entorno-reproducible",
      projectTitle: "Entorno reproducible",
      stageId: 0,
      userId: AUTHOR,
      status: "SUBMITTED",
      repoUrl: "https://github.com/ada/entorno",
      deployUrl: null,
      notes: "Documenté el arranque",
      score: null,
      rubricScores: null,
      feedback: null,
      reviewedAt: null,
      isPublic: false,
      publishedAt: null,
      createdAt: "2026-10-10T10:00:00.000Z",
    });

    await expect(repo.findSubmissionById(submission.id)).resolves.toMatchObject({
      userId: AUTHOR,
      repoUrl: "https://github.com/ada/entorno",
    });
  });

  it("guarda una explicación vacía como `null`", async () => {
    const { service } = setup();

    const submission = await service.submit(
      "entorno-reproducible",
      { repoUrl: "https://github.com/ada/entorno", notes: "   " },
      AUTHOR,
    );

    expect(submission.notes).toBeNull();
  });

  it("responde 404 si el proyecto no existe o no está publicado", async () => {
    const repo = new InMemoryProjectsRepository({
      projects: [project({ isPublished: false })],
    });
    const service = new ProjectsService(repo, CLOCK);
    const input = { repoUrl: "https://github.com/ada/entorno" };

    await expect(
      service.submit("entorno-reproducible", input, AUTHOR),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.submit("no-existe", input, AUTHOR)).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it("responde 400 si falta `repoUrl`, no es http(s) o supera 500 caracteres", async () => {
    const { service } = setup();

    await expect(
      service.submit(
        "entorno-reproducible",
        { repoUrl: "" },
        AUTHOR,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.submit(
        "entorno-reproducible",
        { repoUrl: "git@github.com:ada/entorno.git" },
        AUTHOR,
      ),
    ).rejects.toMatchObject({ status: 400 });

    const tooLong = `https://github.com/ada/${"a".repeat(500)}`;
    const error = await service
      .submit("entorno-reproducible", { repoUrl: tooLong }, AUTHOR)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);

    const response = (error as BadRequestException).getResponse() as {
      message: { field: string; message: string }[];
    };

    expect(response.message[0]!.field).toBe("repoUrl");
    expect(response.message[0]!.message).toContain("500");
  });

  it("responde 400 si `notes` supera 2000 caracteres o el cuerpo trae claves extra", async () => {
    const { service } = setup();

    await expect(
      service.submit(
        "entorno-reproducible",
        {
          repoUrl: "https://github.com/ada/entorno",
          notes: "a".repeat(2_001),
        },
        AUTHOR,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.submit(
        "entorno-reproducible",
        {
          repoUrl: "https://github.com/ada/entorno",
          score: 100,
        } as unknown as { repoUrl: string },
        AUTHOR,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("acumula entregas y las devuelve de la más reciente a la más antigua", async () => {
    const { service } = setup();

    const first = await service.submit(
      "entorno-reproducible",
      { repoUrl: "https://github.com/ada/entorno" },
      AUTHOR,
    );
    const second = await service.submit(
      "entorno-reproducible",
      { repoUrl: "https://github.com/ada/entorno", deployUrl: "https://entorno.vercel.app" },
      AUTHOR,
    );

    const detail = await service.getProject("entorno-reproducible", AUTHOR);

    expect(first.id).not.toBe(second.id);
    expect(detail.mySubmissions).toHaveLength(2);
    expect(detail.mySubmissions[0]!.id).toBe(second.id);
    expect(detail.mySubmissions[0]!.deployUrl).toBe("https://entorno.vercel.app");
    expect(detail.submitted).toBe(true);
  });
});

describe("ProjectsService.review", () => {
  it("aplica la rúbrica, fuerza la justificación y deja evidencia", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({
      id: "s1",
      projectId: "project-1",
      userId: AUTHOR,
    });

    const reviewed = await service.review(
      "s1",
      {
        rubricScores: reviewedScores(4),
        feedback: "Falta la explicación propia",
      },
      "instructor-1",
    );

    expect(reviewed).toMatchObject({
      id: "s1",
      status: "REVIEWED",
      score: 85,
      feedback: "Falta la explicación propia",
      reviewedAt: "2026-10-10T10:00:00.000Z",
      rubricScores: reviewedScores(0),
    });
    expect(repo.getCompetencyEvidence(AUTHOR, "C1")).toEqual({
      level: 3,
      evidenceCount: 1,
      lastEvaluated: new Date("2026-10-10T10:00:00.000Z"),
    });
  });

  it("da 100 con explicación propia y no deja evidencia por debajo de 80", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({
      id: "s1",
      projectId: "project-1",
      userId: AUTHOR,
      notes: "Expliqué las decisiones del README",
    });
    repo.seedSubmission({
      id: "s2",
      projectId: "project-1",
      userId: OTHER,
      notes: "También expliqué",
    });

    const approved = await service.review(
      "s1",
      { rubricScores: reviewedScores(4) },
      "instructor-1",
    );
    const failed = await service.review(
      "s2",
      {
        rubricScores: {
          correctitud: 2,
          calidad: 2,
          pruebas: 2,
          seguridad: 2,
          justificacion: 2,
        },
      },
      "instructor-1",
    );

    expect(approved.score).toBe(100);
    expect(approved.feedback).toBeNull();
    expect(failed.score).toBe(50);
    expect(repo.getCompetencyEvidence(AUTHOR, "C1")).toMatchObject({
      level: 3,
      evidenceCount: 1,
    });
    expect(repo.getCompetencyEvidence(OTHER, "C1")).toBeNull();
  });

  it("acumula evidencia sin bajar el nivel ya alcanzado", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({
      id: "s1",
      projectId: "project-1",
      userId: AUTHOR,
      notes: "Explicación",
    });

    await service.review("s1", { rubricScores: reviewedScores(4) }, "instructor-1");
    await service.review("s1", { rubricScores: reviewedScores(4) }, "instructor-2");

    expect(repo.getCompetencyEvidence(AUTHOR, "C1")).toMatchObject({
      level: 3,
      evidenceCount: 2,
    });
  });

  it("responde 422 con criterios faltantes, sobrantes o fuera de rango", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({ id: "s1", projectId: "project-1", userId: AUTHOR });

    const missingCriterion = {
      rubricScores: {
        correctitud: 4,
        calidad: 4,
        pruebas: 4,
        seguridad: 4,
      },
    } as unknown as ReviewProjectSubmissionInput;
    const extraCriterion = {
      rubricScores: { ...reviewedScores(4), originalidad: 4 },
    } as unknown as ReviewProjectSubmissionInput;
    const outOfRange = {
      rubricScores: { ...reviewedScores(4), correctitud: 5 },
    } as unknown as ReviewProjectSubmissionInput;

    for (const input of [missingCriterion, extraCriterion, outOfRange]) {
      await expect(
        service.review("s1", input, "instructor-1"),
      ).rejects.toMatchObject({ status: 422 });
    }

    const stored = await repo.findSubmissionById("s1");
    expect(stored).toMatchObject({ status: "SUBMITTED", score: null });
    expect(repo.getCompetencyEvidence(AUTHOR, "C1")).toBeNull();
  });

  it("correctitud 0 responde 422 y conserva la revisión anterior", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({
      id: "s1",
      projectId: "project-1",
      userId: AUTHOR,
      status: "REVIEWED",
      score: 90,
      rubricScores: reviewedScores(4),
      reviewedAt: new Date("2026-10-01T10:00:00.000Z"),
    });

    await expect(
      service.review(
        "s1",
        { rubricScores: { ...reviewedScores(4), correctitud: 0 } },
        "instructor-1",
      ),
    ).rejects.toMatchObject({ status: 422 });

    const stored = await repo.findSubmissionById("s1");
    expect(stored).toMatchObject({
      status: "REVIEWED",
      score: 90,
      reviewedAt: new Date("2026-10-01T10:00:00.000Z"),
    });
  });

  it("responde 404 si la entrega no existe", async () => {
    const { service } = setup();

    await expect(
      service.review("no-existe", { rubricScores: reviewedScores(4) }, "instructor-1"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("guarda una retroalimentación vacía como `null`", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({
      id: "s1",
      projectId: "project-1",
      userId: AUTHOR,
      notes: "Explicación",
    });

    const reviewed = await service.review(
      "s1",
      { rubricScores: reviewedScores(4), feedback: "   " },
      "instructor-1",
    );

    expect(reviewed.feedback).toBeNull();
  });
});

describe("ProjectsService — publicación y portafolio", () => {
  it("publica y retira una entrega propia con el reloj del servicio", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({ id: "s1", projectId: "project-1", userId: AUTHOR });
    repo.seedSubmission({ id: "s2", projectId: "project-2", userId: AUTHOR });

    const published = await service.publish("s1", AUTHOR);
    const unpublished = await service.unpublish("s1", AUTHOR);

    expect(published).toMatchObject({
      isPublic: true,
      publishedAt: "2026-10-10T10:00:00.000Z",
    });
    expect(unpublished).toMatchObject({ isPublic: false, publishedAt: null });

    const publicEntries = await service.getPortfolio(AUTHOR);
    expect(publicEntries.entries).toEqual([]);
    expect(publicEntries.publicCount).toBe(0);
    expect(await repo.findSubmissionById("s2")).toBeTruthy();
  });

  it("responde 404 si la entrega es de otro autor o no existe", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({ id: "s1", projectId: "project-1", userId: AUTHOR });

    await expect(service.publish("s1", OTHER)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.unpublish("no-existe", AUTHOR)).rejects.toMatchObject({
      status: 404,
    });

    const stored = await repo.findSubmissionById("s1");
    expect(stored).toMatchObject({ isPublic: false, publishedAt: null });
  });

  it("el portafolio público sólo incluye publicadas y no expone el correo", async () => {
    const { repo, service } = setup();
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

    const portfolio = await service.getPortfolio(AUTHOR);

    expect(portfolio.user).toEqual({ id: AUTHOR, name: "Ada", avatarUrl: null });
    expect(Object.keys(portfolio.user).sort()).toEqual([
      "avatarUrl",
      "id",
      "name",
    ]);
    expect(portfolio.entries.map((entry) => entry.id)).toEqual([
      "publica-nueva",
      "publica-vieja",
    ]);
    expect(portfolio.publicCount).toBe(2);
  });

  it("el portafolio propio incluye privadas y cuenta sólo las públicas", async () => {
    const { repo, service } = setup();
    repo.seedSubmission({
      id: "privada",
      projectId: "project-1",
      userId: AUTHOR,
      createdAt: new Date("2026-10-09T10:00:00.000Z"),
    });
    repo.seedSubmission({
      id: "publica",
      projectId: "project-2",
      userId: AUTHOR,
      isPublic: true,
      createdAt: new Date("2026-10-05T10:00:00.000Z"),
      publishedAt: new Date("2026-10-05T10:00:00.000Z"),
    });

    const portfolio = await service.getMyPortfolio(AUTHOR);

    expect(portfolio.entries.map((entry) => entry.id)).toEqual([
      "privada",
      "publica",
    ]);
    expect(portfolio.publicCount).toBe(1);
  });

  it("responde 404 si el usuario del portafolio no existe", async () => {
    const { service } = setup();

    await expect(service.getPortfolio("no-existe")).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.getMyPortfolio("no-existe")).rejects.toMatchObject({
      status: 404,
    });
  });
});
