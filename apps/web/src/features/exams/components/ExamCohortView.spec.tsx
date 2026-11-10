import type { ExamCohort } from "@codeai/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExamCohortView } from "./ExamCohortView";
import type { ExamCohortViewApi } from "./ExamCohortView";

const PRIVACY_NOTICE = "Hacen falta al menos 5 personas para mostrar dominios";

const DOMAINS_TABLE = "Media de aciertos por dominio";

function cohort(overrides: Partial<ExamCohort> = {}): ExamCohort {
  return {
    certification: "CLF-C02",
    from: "2026-10-10T00:00:00.000Z",
    to: "2026-11-09T00:00:00.000Z",
    attempts: 12,
    learners: 6,
    domains: [
      { domain: 3, name: "Cloud Technology and Services", avgPct: 58, attempts: 12 },
      { domain: 2, name: "Security and Compliance", avgPct: 71, attempts: 12 },
    ],
    readinessVsReal: {
      readyPassed: 4,
      readyFailed: 1,
      notReadyPassed: 2,
      notReadyFailed: 3,
    },
    ...overrides,
  };
}

function createApi(handler: (certification: string) => Promise<ExamCohort>) {
  const load = vi.fn(handler);
  const api: ExamCohortViewApi = { cohort: load };

  return { api, load };
}

function cellTexts(row: HTMLElement): (string | null)[] {
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

describe("ExamCohortView", () => {
  it("lista los dominios en el orden recibido, con su media", async () => {
    const { api, load } = createApi(() => Promise.resolve(cohort()));

    render(<ExamCohortView api={api} />);

    const table = await screen.findByRole("table", { name: DOMAINS_TABLE });
    const rows = within(table).getAllByRole("row");

    expect(load).toHaveBeenCalledWith("CLF-C02");
    expect(rows).toHaveLength(3);
    expect(
      within(rows[1] as HTMLElement).getByText("3. Cloud Technology and Services"),
    ).toBeInTheDocument();
    expect(cellTexts(rows[1] as HTMLElement)).toEqual(["58 %", "12"]);
    expect(
      within(rows[2] as HTMLElement).getByText("2. Security and Compliance"),
    ).toBeInTheDocument();
    expect(cellTexts(rows[2] as HTMLElement)).toEqual(["71 %", "12"]);
    expect(screen.queryByText(PRIVACY_NOTICE)).toBeNull();
  });

  it("avisa de la privacidad cuando no hay dominios", async () => {
    const { api } = createApi(() =>
      Promise.resolve(cohort({ learners: 3, domains: [] })),
    );

    render(<ExamCohortView api={api} />);

    expect(await screen.findByText(PRIVACY_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: DOMAINS_TABLE })).toBeNull();
  });

  it("muestra la tabla 2x2 con la nota de datos voluntarios", async () => {
    const { api } = createApi(() => Promise.resolve(cohort()));

    render(<ExamCohortView api={api} />);

    const table = await screen.findByRole("table", {
      name: "Listo para presentar frente a aprobó el examen real",
    });
    const ready = within(table).getByRole("row", { name: /^Listo para presentar/ });
    const notReady = within(table).getByRole("row", { name: /^No estaba listo/ });

    expect(
      within(table).getByRole("columnheader", { name: "Aprobó" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "No aprobó" }),
    ).toBeInTheDocument();
    expect(cellTexts(ready)).toEqual(["4", "1"]);
    expect(cellTexts(notReady)).toEqual(["2", "3"]);
    expect(screen.getByText(/Los resultados reales son voluntarios/)).toBeInTheDocument();
  });

  it("pide la cohorte de la certificación elegida", async () => {
    const { api, load } = createApi(() => Promise.resolve(cohort()));

    render(<ExamCohortView api={api} />);
    await screen.findByRole("table", { name: DOMAINS_TABLE });

    fireEvent.change(screen.getByLabelText("Certificación"), {
      target: { value: "SAA-C03" },
    });

    await waitFor(() => {
      expect(load).toHaveBeenLastCalledWith("SAA-C03");
    });
  });

  it("ofrece reintentar cuando la carga falla", async () => {
    const { api, load } = createApi(() => Promise.reject(new Error("caída")));

    render(<ExamCohortView api={api} />);

    expect(
      await screen.findByText("No pudimos cargar los simulacros de la cohorte."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
  });
});
