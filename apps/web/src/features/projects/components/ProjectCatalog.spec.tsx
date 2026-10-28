import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectCatalogPage } from "@/lib/api-client";

import { ProjectCatalog } from "./ProjectCatalog";

const PROJECTS = [
  {
    id: "prj_1",
    slug: "entorno-reproducible",
    stageId: 0,
    title: "Entorno reproducible",
    brief: "Deja un repositorio que arranque en cualquier máquina.",
    requirements: ["README con requisitos", "Script de verificación"],
    isPublished: true,
    submitted: true,
  },
  {
    id: "prj_2",
    slug: "retos-de-logica-en-consola",
    stageId: 1,
    title: "Retos de lógica en consola",
    brief: "Resuelve tres problemas nuevos con funciones puras.",
    requirements: ["Tres funciones puras"],
    isPublished: true,
    submitted: false,
  },
] as const;

function page(projects: readonly unknown[]): ProjectCatalogPage {
  return {
    projects: projects as unknown as ProjectCatalogPage["projects"],
    meta: { page: 1, pageSize: 50, total: projects.length, totalPages: 1 },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectCatalog", () => {
  it("anuncia la carga mientras llegan los proyectos", () => {
    const loadProjects = vi.fn(
      () => new Promise<ProjectCatalogPage>(() => undefined),
    );

    render(<ProjectCatalog loadProjects={loadProjects} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando los proyectos…",
    );
  });

  it("lista los proyectos publicados con etapa, requisitos y marca de entrega", async () => {
    const loadProjects = vi.fn(async () => page(PROJECTS));

    render(<ProjectCatalog loadProjects={loadProjects} />);

    const first = await screen.findByRole("link", {
      name: /Entorno reproducible/,
    });

    expect(first).toHaveAttribute("href", "/learn/projects/entorno-reproducible");
    expect(first).toHaveTextContent("Etapa E0");
    expect(first).toHaveTextContent("2 requisitos");
    expect(first).toHaveTextContent("Entregado");

    const second = screen.getByRole("link", {
      name: /Retos de lógica en consola/,
    });

    expect(second).toHaveTextContent("1 requisito");
    expect(second).toHaveTextContent("Sin entregar");
  });

  it("declara el vacío cuando no hay proyectos publicados", async () => {
    const loadProjects = vi.fn(async () => page([]));

    render(<ProjectCatalog loadProjects={loadProjects} />);

    expect(
      await screen.findByText("Todavía no hay proyectos publicados."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadProjects = vi
      .fn<(signal: AbortSignal) => Promise<ProjectCatalogPage>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(page(PROJECTS));

    render(<ProjectCatalog loadProjects={loadProjects} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar los proyectos.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Entorno reproducible/ }),
      ).toBeInTheDocument();
    });
    expect(loadProjects).toHaveBeenCalledTimes(2);
  });
});
