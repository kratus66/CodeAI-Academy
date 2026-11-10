import type {
  CertificationCode,
  ExamAttempt,
  ExamHistoryItem,
  StartExamAttemptInput,
} from "@codeai/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { ExamHome } from "./ExamHome";
import type { ExamHomeApi } from "./ExamHome";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
}));

const IN_PROGRESS_MESSAGE = "Ya tienes un simulacro en curso de esta certificación";

const BETA_MESSAGE =
  "Esta certificación está en beta: el simulacro llegará con la guía definitiva";

const EXTRA_TIME_LABEL = "+30 minutos (adaptación por idioma)";

const DOMAIN_REQUIRED_MESSAGE = "Elige un dominio para el bloque por dominio.";

const ROOM_PATH = "/learn/exams/attempts/att_nuevo";

const HISTORY: ExamHistoryItem[] = [
  {
    attemptId: "att_3",
    mode: "form-c",
    domain: null,
    status: "in-progress",
    orientative: false,
    startedAt: "2026-11-09T10:00:00.000Z",
    submittedAt: null,
    scorePct: null,
    questionCount: 65,
  },
  {
    attemptId: "att_2",
    mode: "domain",
    domain: 2,
    status: "submitted",
    orientative: true,
    startedAt: "2026-11-01T10:00:00.000Z",
    submittedAt: "2026-11-01T11:00:00.000Z",
    scorePct: 80,
    questionCount: 20,
  },
  {
    attemptId: "att_1",
    mode: "form-a",
    domain: null,
    status: "expired",
    orientative: false,
    startedAt: "2026-10-20T10:00:00.000Z",
    submittedAt: "2026-10-20T11:30:00.000Z",
    scorePct: 42,
    questionCount: 65,
  },
];

type StartHandler = (
  certification: string,
  input: StartExamAttemptInput,
) => Promise<ExamAttempt>;

type HistoryHandler = (certification: string) => Promise<ExamHistoryItem[]>;

function attempt(): ExamAttempt {
  return {
    id: "att_nuevo",
    certification: "SAA-C03",
    mode: "form-a",
    domain: null,
    extraTime: false,
    status: "in-progress",
    orientative: false,
    startedAt: "2026-11-09T10:00:00.000Z",
    deadlineAt: "2026-11-09T12:10:00.000Z",
    submittedAt: null,
    remainingSeconds: 7800,
    questionCount: 65,
    answeredCount: 0,
    items: [],
  };
}

function createApi(options: {
  readonly start?: StartHandler;
  readonly history?: HistoryHandler;
} = {}) {
  const start = vi.fn(options.start ?? ((): Promise<ExamAttempt> => Promise.resolve(attempt())));
  const history = vi.fn(
    options.history ?? ((): Promise<ExamHistoryItem[]> => Promise.resolve(HISTORY)),
  );
  const api: ExamHomeApi = { start, history };

  return { api, start, history };
}

/** Pinta la página y espera a que el historial termine de cargar. */
async function renderHome(
  options: {
    readonly certification?: CertificationCode;
    readonly start?: StartHandler;
    readonly history?: HistoryHandler;
  } = {},
) {
  const created = createApi(options);

  render(
    <ExamHome
      certification={options.certification ?? "SAA-C03"}
      api={created.api}
    />,
  );

  await screen.findByRole("heading", { name: "Tu historial" });
  await waitFor(() => {
    expect(created.history).toHaveBeenCalledWith(options.certification ?? "SAA-C03");
  });

  return created;
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
});

describe("ExamHome", () => {
  it("muestra el nombre, el código y el formato oficial de la certificación", async () => {
    await renderHome();

    expect(
      screen.getByRole("heading", {
        name: "AWS Certified Solutions Architect - Associate",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Simulacro · SAA-C03")).toBeInTheDocument();
    expect(screen.getByText("65 preguntas · 130 minutos")).toBeInTheDocument();
  });

  it("inicia la forma B con el tiempo extra y navega a la sala", async () => {
    const { start } = await renderHome();

    fireEvent.click(screen.getByRole("radio", { name: "Forma B" }));
    fireEvent.click(screen.getByRole("checkbox", { name: EXTRA_TIME_LABEL }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar el simulacro" }));

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith("SAA-C03", {
        mode: "form-b",
        extraTime: true,
      });
    });
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(ROOM_PATH);
    });
  });

  it("el bloque por dominio exige elegir un dominio antes de iniciar", async () => {
    const { start } = await renderHome();

    fireEvent.click(screen.getByRole("radio", { name: "Bloque por dominio" }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar el simulacro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      DOMAIN_REQUIRED_MESSAGE,
    );
    expect(start).not.toHaveBeenCalled();

    const select = screen.getByLabelText("Dominio del bloque");

    expect(
      within(select).getByRole("option", {
        name: "Design Resilient Architectures (26 %)",
      }),
    ).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar el simulacro" }));

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith("SAA-C03", {
        mode: "domain",
        domain: 2,
        extraTime: false,
      });
    });
  });

  it("un 409 de intento en curso ofrece continuar el que ya está abierto", async () => {
    const start: StartHandler = () =>
      Promise.reject(
        new ApiError({
          status: 409,
          code: "CONFLICT",
          message: IN_PROGRESS_MESSAGE,
        }),
      );

    await renderHome({ start });

    fireEvent.click(screen.getByRole("button", { name: "Iniciar el simulacro" }));

    const link = await screen.findByRole("link", {
      name: "Continuar el simulacro en curso",
    });

    expect(link).toHaveAttribute("href", "/learn/exams/attempts/att_3");
    expect(screen.getByText(IN_PROGRESS_MESSAGE)).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("muestra tal cual los demás 409", async () => {
    const message = "La forma form-a todavía no existe";
    const start: StartHandler = () =>
      Promise.reject(new ApiError({ status: 409, code: "CONFLICT", message }));

    await renderHome({ start });

    fireEvent.click(screen.getByRole("button", { name: "Iniciar el simulacro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(
      screen.queryByRole("link", { name: "Continuar el simulacro en curso" }),
    ).toBeNull();
  });

  it("deshabilita los modos cuando la certificación está en beta", async () => {
    await renderHome({ certification: "MLA-C02" });

    expect(screen.getByText(BETA_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Forma A" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Aleatorio" })).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: "Bloque por dominio" }),
    ).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: EXTRA_TIME_LABEL })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Iniciar el simulacro" }),
    ).toBeDisabled();
  });

  it("muestra el historial con enlaces a la sala o al resultado", async () => {
    await renderHome();

    const table = screen.getByRole("table", { name: "Historial de simulacros" });

    for (const header of ["Fecha", "Modo", "Estado", "%"]) {
      expect(
        within(table).getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }

    expect(
      within(table).getByRole("link", { name: "Entrar en la sala" }),
    ).toHaveAttribute("href", "/learn/exams/attempts/att_3");
    expect(
      within(table)
        .getAllByRole("link", { name: "Ver el resultado" })
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/learn/exams/attempts/att_2/result",
      "/learn/exams/attempts/att_1/result",
    ]);

    expect(within(table).getByText("80 %")).toBeInTheDocument();
    expect(within(table).getByText("42 %")).toBeInTheDocument();
    expect(within(table).getByText("—")).toBeInTheDocument();
    expect(within(table).getByText("orientativo")).toBeInTheDocument();
    expect(
      within(table).getByText(
        "Bloque por dominio · Design Resilient Architectures",
      ),
    ).toBeInTheDocument();
  });

  it("avisa cuando todavía no hay simulacros", async () => {
    await renderHome({ history: () => Promise.resolve([]) });

    expect(
      screen.getByText(
        "Todavía no hiciste ningún simulacro de esta certificación.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("reintenta la carga del historial cuando falla", async () => {
    let calls = 0;
    const history: HistoryHandler = () => {
      calls += 1;

      return calls === 1
        ? Promise.reject(
            new ApiError({
              status: 500,
              code: "INTERNAL_ERROR",
              message: "Fallo interno",
            }),
          )
        : Promise.resolve(HISTORY);
    };

    await renderHome({ history });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar tu historial.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("table", { name: "Historial de simulacros" }),
    ).toBeInTheDocument();
  });
});
