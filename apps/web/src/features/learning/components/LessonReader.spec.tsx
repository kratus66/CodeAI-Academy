import type { LessonDetail } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { LessonReader } from "./LessonReader";

const LESSON: LessonDetail = {
  id: "lesson_1",
  slug: "que-es-la-ia",
  title: "Qué es la inteligencia artificial",
  estimatedMin: 35,
  order: 1,
  unitCode: "U0.1.1",
  content: [
    {
      type: "paragraph",
      text: "La inteligencia artificial es una disciplina de la informática.",
    },
    {
      type: "list",
      title: "Tres ideas clave",
      items: ["Razonar", "Aprender", "Decidir"],
    },
    {
      type: "code",
      title: "Ejemplo",
      language: "python",
      code: "print('hola')",
    },
    {
      type: "callout",
      title: "Ojo",
      text: "Una hoja de cálculo con fórmulas no es IA.",
    },
    {
      type: "diagram",
      text: "datos -> modelo -> predicción",
    },
    {
      type: "table",
      title: "Comparación",
      items: ["IA | aprende de datos", "Automatización | sigue reglas"],
    },
  ],
  steps: [
    {
      kind: "objective",
      title: "Qué vas a lograr",
      body: "Distinguir IA de automatización.",
    },
    {
      kind: "explanation",
      title: "De dónde viene la idea",
      body: "El término nace en 1956.",
    },
    {
      kind: "guided_practice",
      title: "Clasifica conmigo",
      body: "Recorremos tres casos juntos.",
    },
    {
      kind: "independent_practice",
      title: "Clasifica por tu cuenta",
      body: "Cinco casos, sin ayuda.",
    },
    {
      kind: "debug",
      title: "Encuentra el error",
      body: "Un caso está mal clasificado.",
    },
    {
      kind: "assessment",
      title: "Comprueba tu criterio",
      body: "Responde tres preguntas.",
    },
    {
      kind: "transfer",
      title: "Llévalo a tu entorno",
      body: "Busca un sistema de tu día a día.",
    },
  ],
  resources: [
    {
      order: 1,
      note: "Capítulo introductorio",
      resource: {
        id: "res_1",
        slug: "ia-para-todos",
        title: "IA para todos",
        provider: "Universidad de Helsinki",
        url: "https://example.org/ia-para-todos",
        type: "COURSE",
        language: "es",
        level: null,
        durationMin: 360,
        license: "CC BY-NC-SA",
        embedAllowed: false,
        status: "VERIFIED",
        reviewedAt: null,
      },
    },
  ],
};

const loadLesson = (): Promise<LessonDetail> => Promise.resolve(LESSON);

describe("LessonReader", () => {
  it("anuncia la carga de la lección", () => {
    render(
      <LessonReader
        slug="que-es-la-ia"
        loadLesson={() => new Promise<LessonDetail>(() => undefined)}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando la lección…");
  });

  it("pide la lección por su slug y enlaza la unidad de origen", async () => {
    const loader = vi.fn(loadLesson);

    render(<LessonReader slug="que-es-la-ia" loadLesson={loader} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Qué es la inteligencia artificial",
      }),
    ).toBeInTheDocument();
    expect(loader).toHaveBeenCalledWith("que-es-la-ia", expect.any(AbortSignal));
    expect(
      screen.getByRole("link", { name: /Unidad U0\.1\.1/ }),
    ).toHaveAttribute("href", "/learn/units/U0.1.1");
    expect(
      screen.getByText(
        "La inteligencia artificial es una disciplina de la informática.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("print('hola')")).toBeInTheDocument();
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(
      screen.getByText("Una hoja de cálculo con fórmulas no es IA."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("datos -> modelo -> predicción"),
    ).toBeInTheDocument();
  });

  it("presenta los siete pasos con su nombre en castellano", async () => {
    render(<LessonReader slug="que-es-la-ia" loadLesson={loadLesson} />);

    const steps = await screen.findByRole("region", { name: "Los 7 pasos" });

    expect(steps.querySelectorAll("li")).toHaveLength(7);
    expect(screen.getByText("Práctica autónoma")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Llévalo a tu entorno" }),
    ).toBeInTheDocument();
  });

  it("enlaza los recursos verificados fuera de la aplicación", async () => {
    render(<LessonReader slug="que-es-la-ia" loadLesson={loadLesson} />);

    const link = await screen.findByRole("link", { name: /IA para todos/ });

    expect(link).toHaveAttribute("href", "https://example.org/ia-para-todos");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Universidad de Helsinki")).toBeInTheDocument();
  });

  it("trata el 404 como lección inexistente con vuelta al catálogo", async () => {
    render(
      <LessonReader
        slug="no-existe"
        loadLesson={() =>
          Promise.reject(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: "La lección no existe o no está publicada",
              traceId: "trace-leccion",
            }),
          )
        }
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos esta lección.",
    );
    expect(
      screen.getByRole("link", { name: "Volver al catálogo" }),
    ).toHaveAttribute("href", "/learn");
    expect(screen.getByText("Referencia: trace-leccion")).toBeInTheDocument();
  });

  it("ofrece reintentar cuando la API falla por otra razón", async () => {
    const loader = vi
      .fn<(slug: string, signal?: AbortSignal) => Promise<LessonDetail>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(LESSON);

    render(<LessonReader slug="que-es-la-ia" loadLesson={loader} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar la lección.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Qué es la inteligencia artificial",
        }),
      ).toBeInTheDocument();
    });
  });
});
