import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CourseCatalogPage } from "@/lib/api-client";

import { CourseCatalog } from "./CourseCatalog";

const COURSES: CourseCatalogPage["courses"] = [
  {
    slug: "fullstack-ia",
    title: "Full Stack con IA",
    objective: "Construir aplicaciones completas apoyándote en la IA.",
    stageLabelPrefix: "E",
    order: 1,
    stageCount: 12,
    notice: null,
  },
  {
    slug: "aws-cloud",
    title: "Nube con AWS",
    objective: "Prepararte para trabajar con servicios en la nube.",
    stageLabelPrefix: "A",
    order: 2,
    stageCount: 1,
    notice: "Ruta independiente de preparación. No está afiliada a AWS.",
  },
];

function page(courses: CourseCatalogPage["courses"]): CourseCatalogPage {
  return {
    courses,
    meta: { page: 1, pageSize: 20, total: courses.length, totalPages: 1 },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CourseCatalog", () => {
  it("anuncia la carga mientras el catálogo llega", () => {
    const loadCourses = vi.fn(
      () => new Promise<CourseCatalogPage>(() => undefined),
    );

    render(<CourseCatalog loadCourses={loadCourses} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando el catálogo de rutas…",
    );
  });

  it("lista las rutas con su número de etapas, aviso y enlace a sus etapas", async () => {
    const loadCourses = vi.fn(async () => page(COURSES));

    render(<CourseCatalog loadCourses={loadCourses} />);

    const fullstack = await screen.findByRole("link", {
      name: /Full Stack con IA/,
    });
    const aws = screen.getByRole("link", { name: /Nube con AWS/ });

    expect(fullstack).toHaveAttribute(
      "href",
      "/learn/stages?course=fullstack-ia",
    );
    expect(fullstack).toHaveTextContent(
      "Construir aplicaciones completas apoyándote en la IA.",
    );
    expect(fullstack).toHaveTextContent("12 etapas");
    expect(fullstack).not.toHaveTextContent("No está afiliada");
    expect(aws).toHaveAttribute("href", "/learn/stages?course=aws-cloud");
    expect(aws).toHaveTextContent("1 etapa");
    expect(aws).not.toHaveTextContent("1 etapas");
    expect(aws).toHaveTextContent(
      "Ruta independiente de preparación. No está afiliada a AWS.",
    );
  });

  it("declara el vacío cuando no hay rutas publicadas", async () => {
    const loadCourses = vi.fn(async () => page([]));

    render(<CourseCatalog loadCourses={loadCourses} />);

    expect(
      await screen.findByText("Todavía no hay rutas publicadas."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadCourses = vi
      .fn<() => Promise<CourseCatalogPage>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(page(COURSES));

    render(<CourseCatalog loadCourses={loadCourses} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar las rutas.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Full Stack con IA/ }),
      ).toBeInTheDocument();
    });
    expect(loadCourses).toHaveBeenCalledTimes(2);
  });
});
