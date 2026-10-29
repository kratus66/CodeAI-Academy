import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InterviewCatalogPage } from "@/lib/api-client";

import { ScenarioCatalog } from "./ScenarioCatalog";

const SCENARIOS = [
  {
    slug: "backend-junior",
    title: "Backend junior: API de tareas",
    role: "backend",
    level: "junior",
    language: "ts",
    competencies: ["C4", "C10"],
    phaseCount: 6,
    estimatedMinutes: 45,
    attempts: 2,
  },
  {
    slug: "data-senior",
    title: "Datos senior: calidad y linaje",
    role: "data",
    level: "senior",
    language: "py",
    competencies: ["C8", "C10"],
    phaseCount: 6,
    estimatedMinutes: 75,
    attempts: 0,
  },
] as const;

function page(scenarios: readonly unknown[]): InterviewCatalogPage {
  return {
    scenarios: scenarios as unknown as InterviewCatalogPage["scenarios"],
    meta: { page: 1, pageSize: 50, total: scenarios.length, totalPages: 1 },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ScenarioCatalog", () => {
  it("anuncia la carga mientras llegan los escenarios", () => {
    const loadScenarios = vi.fn(
      () => new Promise<InterviewCatalogPage>(() => undefined),
    );

    render(<ScenarioCatalog loadScenarios={loadScenarios} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando las entrevistas…",
    );
  });

  it("lista rol, nivel, fases, duración e intentos", async () => {
    const loadScenarios = vi.fn(async () => page(SCENARIOS));

    render(<ScenarioCatalog loadScenarios={loadScenarios} />);

    const first = await screen.findByRole("link", {
      name: /Backend junior: API de tareas/,
    });

    expect(first).toHaveAttribute("href", "/learn/interviews/backend-junior");
    expect(first).toHaveTextContent("Backend · Junior");
    expect(first).toHaveTextContent("6 fases · 45 min · TypeScript");
    expect(first).toHaveTextContent("2 intentos");
    expect(first).toHaveTextContent("C4 · C10");

    const second = screen.getByRole("link", {
      name: /Datos senior: calidad y linaje/,
    });

    expect(second).toHaveTextContent("Datos · Senior");
    expect(second).toHaveTextContent("Sin intentos");
  });

  it("declara el vacío cuando no hay escenarios publicados", async () => {
    const loadScenarios = vi.fn(async () => page([]));

    render(<ScenarioCatalog loadScenarios={loadScenarios} />);

    expect(
      await screen.findByText("Todavía no hay entrevistas publicadas."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("muestra el error con reintento cuando la API no responde", async () => {
    const loadScenarios = vi
      .fn<(signal: AbortSignal) => Promise<InterviewCatalogPage>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(page(SCENARIOS));

    render(<ScenarioCatalog loadScenarios={loadScenarios} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar las entrevistas.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Backend junior: API de tareas/ }),
      ).toBeInTheDocument();
    });
    expect(loadScenarios).toHaveBeenCalledTimes(2);
  });
});

describe("ScenarioCatalog — desbloqueo por nivel", () => {
  it("marca como bloqueado el escenario cuyo nivel aún no se alcanza", async () => {
    const scenario = {
      slug: "backend-senior",
      title: "Backend senior",
      role: "backend",
      level: "senior",
      language: "ts",
      competencies: ["C10"],
      phaseCount: 5,
      estimatedMinutes: 60,
      attempts: 0,
      unlock: { unlocked: false, reason: "Completa las etapas 0 a 10 para abrir las entrevistas de nivel senior." },
    };

    render(
      <ScenarioCatalog
        loadScenarios={async () =>
          ({
            scenarios: [scenario],
            meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
          }) as unknown as InterviewCatalogPage
        }
      />,
    );

    expect(await screen.findByText("Bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/etapas 0 a 10/)).toBeInTheDocument();
  });
});
