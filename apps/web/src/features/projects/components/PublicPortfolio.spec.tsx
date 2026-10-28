import type { PortfolioResponse } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicPortfolio } from "./PublicPortfolio";

const PUBLISHED = {
  id: "psub_1",
  projectId: "prj_1",
  projectSlug: "entorno-reproducible",
  projectTitle: "Entorno reproducible",
  stageId: 0,
  userId: "usr_1",
  status: "REVIEWED",
  repoUrl: "https://github.com/ana/entorno",
  deployUrl: "https://entorno.vercel.app",
  notes: "Explicación",
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
  isPublic: true,
  publishedAt: "2026-10-28T12:00:00.000Z",
  createdAt: "2026-10-27T10:00:00.000Z",
} as const;

function portfolio(overrides: Partial<PortfolioResponse> = {}): PortfolioResponse {
  return {
    user: { id: "usr_1", name: "Ana", avatarUrl: null },
    entries: [PUBLISHED],
    publicCount: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PublicPortfolio", () => {
  it("anuncia la carga mientras llega el portafolio", () => {
    render(
      <PublicPortfolio
        userId="usr_1"
        loadPortfolio={() => new Promise<PortfolioResponse>(() => undefined)}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando el portafolio…",
    );
  });

  it("muestra el portafolio público con nota, retroalimentación y enlaces", async () => {
    render(
      <PublicPortfolio
        userId="usr_1"
        loadPortfolio={vi.fn(async () => portfolio())}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Ana · Portafolio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Portafolio público")).toBeInTheDocument();
    expect(screen.getByText("Entorno reproducible")).toBeInTheDocument();
    expect(screen.getByText(/85\.00 \/ 100/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Retroalimentación: Falta explicar las decisiones del README.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repositorio" })).toHaveAttribute(
      "href",
      "https://github.com/ana/entorno",
    );
    expect(screen.getByRole("link", { name: "Despliegue" })).toHaveAttribute(
      "href",
      "https://entorno.vercel.app",
    );
    expect(
      screen.getByText("Entregas públicas incluidas: 1"),
    ).toBeInTheDocument();
  });

  it("en modo propio incluye las privadas y las marca como tales", async () => {
    const loadPortfolio = vi.fn(async () =>
      portfolio({
        entries: [
          PUBLISHED,
          { ...PUBLISHED, id: "psub_2", isPublic: false, publishedAt: null },
        ],
        publicCount: 1,
      }),
    );

    render(<PublicPortfolio loadPortfolio={loadPortfolio} />);

    expect(
      await screen.findByRole("heading", { name: "Mi portafolio" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Privada: no aparece en tu enlace público."),
    ).toHaveLength(1);
    expect(
      screen.getByText("Entregas públicas incluidas: 1"),
    ).toBeInTheDocument();
  });

  it("declara el vacío del portafolio público", async () => {
    render(
      <PublicPortfolio
        userId="usr_1"
        loadPortfolio={vi.fn(async () =>
          portfolio({ entries: [], publicCount: 0 }),
        )}
      />,
    );

    expect(
      await screen.findByText("Este portafolio aún no tiene entregas públicas."),
    ).toBeInTheDocument();
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadPortfolio = vi
      .fn<(signal: AbortSignal) => Promise<PortfolioResponse>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(portfolio());

    render(<PublicPortfolio userId="usr_1" loadPortfolio={loadPortfolio} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar el portafolio.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Ana · Portafolio" }),
      ).toBeInTheDocument();
    });
    expect(loadPortfolio).toHaveBeenCalledTimes(2);
  });
});
