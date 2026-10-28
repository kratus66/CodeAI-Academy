import type {
  CreateProjectSubmissionInput,
  ProjectDetail,
  ProjectSubmission,
} from "@codeai/shared";
import { DEFAULT_PROJECT_RUBRIC } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { ProjectWorkspace } from "./ProjectWorkspace";

const RECORDED: ProjectSubmission = {
  id: "psub_1",
  projectId: "prj_1",
  projectSlug: "entorno-reproducible",
  projectTitle: "Entorno reproducible",
  stageId: 0,
  userId: "usr_1",
  status: "REVIEWED",
  repoUrl: "https://github.com/ana/entorno",
  deployUrl: "https://entorno.vercel.app",
  notes: "Elegí un script único de verificación.",
  score: 85,
  rubricScores: {
    correctitud: 4,
    calidad: 4,
    pruebas: 4,
    seguridad: 4,
    justificacion: 0,
  },
  feedback: "Falta explicar las decisiones del README.",
  reviewedAt: "2026-10-28T11:00:00.000Z",
  isPublic: false,
  publishedAt: null,
  createdAt: "2026-10-27T10:00:00.000Z",
};

function detail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: "prj_1",
    slug: "entorno-reproducible",
    stageId: 0,
    title: "Entorno reproducible",
    brief: "Deja un repositorio que arranque en cualquier máquina.",
    requirements: ["README con requisitos", "Script de verificación"],
    isPublished: true,
    submitted: false,
    rubric: DEFAULT_PROJECT_RUBRIC,
    competencies: ["C1"],
    bestScore: null,
    mySubmissions: [],
    ...overrides,
  };
}

function renderWorkspace(overrides: {
  loadProject?: (slug: string, signal: AbortSignal) => Promise<ProjectDetail>;
  submitProject?: (
    slug: string,
    input: CreateProjectSubmissionInput,
  ) => Promise<ProjectSubmission>;
  setPublished?: (
    submissionId: string,
    isPublic: boolean,
  ) => Promise<ProjectSubmission>;
} = {}) {
  return render(
    <ProjectWorkspace slug="entorno-reproducible" {...overrides} />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectWorkspace", () => {
  it("anuncia la carga mientras llega el proyecto", () => {
    const loadProject = vi.fn(
      () => new Promise<ProjectDetail>(() => undefined),
    );

    renderWorkspace({ loadProject });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando el proyecto…",
    );
  });

  it("muestra requisitos, rúbrica legible e historial con nota y retroalimentación", async () => {
    const loadProject = vi.fn(async () => detail({
      submitted: true,
      bestScore: 85,
      mySubmissions: [RECORDED],
    }));

    renderWorkspace({ loadProject });

    expect(
      await screen.findByRole("heading", { name: "Entorno reproducible" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("README con requisitos"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Correctitud funcional y cumplimiento de requisitos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Peso 30 %")).toBeInTheDocument();
    expect(screen.getAllByText(/Nivel 4:/)).toHaveLength(5);
    expect(screen.getByText("Mejor nota:")).toHaveTextContent("85.00 / 100");
    expect(screen.getByText("Revisada")).toBeInTheDocument();
    expect(
      screen.getByText("Retroalimentación: Falta explicar las decisiones del README."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Repositorio" }),
    ).toHaveAttribute("href", "https://github.com/ana/entorno");
  });

  it("declara el vacío del historial cuando no hay entregas", async () => {
    const loadProject = vi.fn(async () => detail());

    renderWorkspace({ loadProject });

    expect(
      await screen.findByText("Aún no has entregado este proyecto."),
    ).toBeInTheDocument();
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadProject = vi
      .fn<(slug: string, signal: AbortSignal) => Promise<ProjectDetail>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(detail());

    renderWorkspace({ loadProject });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar el proyecto.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Entorno reproducible" }),
      ).toBeInTheDocument();
    });
    expect(loadProject).toHaveBeenCalledTimes(2);
  });

  it("registra una entrega, anuncia el éxito y la añade al historial", async () => {
    const loadProject = vi.fn(async () => detail());
    const submitProject = vi.fn(
      async (_slug: string, input: CreateProjectSubmissionInput) => ({
        ...RECORDED,
        status: "SUBMITTED" as const,
        score: null,
        rubricScores: null,
        feedback: null,
        reviewedAt: null,
        repoUrl: input.repoUrl,
      }),
    );

    renderWorkspace({ loadProject, submitProject });
    await screen.findByRole("heading", { name: "Entorno reproducible" });

    fireEvent.change(screen.getByLabelText("Repositorio (obligatorio)"), {
      target: { value: "https://github.com/ana/entorno" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrega" }));

    await waitFor(() => {
      expect(submitProject).toHaveBeenCalledWith("entorno-reproducible", {
        repoUrl: "https://github.com/ana/entorno",
      });
    });
    expect(
      await screen.findByText(
        "Entrega registrada. Un instructor la revisará con la rúbrica.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Pendiente de revisión")).toBeInTheDocument();
    expect(screen.getAllByText("Sin revisar")).toHaveLength(2);
    expect(screen.getByLabelText("Repositorio (obligatorio)")).toHaveValue("");
  });

  it("pinta el error de campo que devuelve la API al entregar", async () => {
    const loadProject = vi.fn(async () => detail());
    const submitProject = vi.fn(async () => {
      throw new ApiError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Datos de entrada inválidos",
        details: [
          {
            field: "repoUrl",
            message: "La URL del repositorio debe apuntar a http o https",
          },
        ],
      });
    });

    renderWorkspace({ loadProject, submitProject });
    await screen.findByRole("heading", { name: "Entorno reproducible" });

    fireEvent.change(screen.getByLabelText("Repositorio (obligatorio)"), {
      target: { value: "ftp://ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrega" }));

    expect(
      await screen.findByText(
        "La URL del repositorio debe apuntar a http o https",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Repositorio/ }),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("publica una entrega en el portafolio y refleja el estado", async () => {
    const loadProject = vi.fn(async () =>
      detail({ submitted: true, bestScore: 85, mySubmissions: [RECORDED] }),
    );
    const setPublished = vi.fn(
      async (_submissionId: string, isPublic: boolean) => ({
        ...RECORDED,
        isPublic,
        publishedAt: isPublic ? "2026-10-28T12:00:00.000Z" : null,
      }),
    );

    renderWorkspace({ loadProject, setPublished });
    await screen.findByRole("heading", { name: "Entorno reproducible" });

    fireEvent.click(
      screen.getByRole("button", { name: "Publicar en el portafolio" }),
    );

    await waitFor(() => {
      expect(setPublished).toHaveBeenCalledWith("psub_1", true);
    });
    expect(
      await screen.findByText("Pública en tu portafolio"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retirar del portafolio" }),
    ).toBeInTheDocument();
  });
});
