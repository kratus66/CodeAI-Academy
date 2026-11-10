import type {
  CertificationCode,
  ExamReadiness,
  ReadinessCriterion,
  RealExamResult,
  RegisterRealResultInput,
} from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { ReadinessPanel } from "./ReadinessPanel";
import type { ReadinessPanelApi } from "./ReadinessPanel";

const FUTURE_DATE_MESSAGE = "La fecha del examen no puede ser futura";

const SCORE_LABEL = "Puntuación (100–1000, opcional)";

const DATE_LABEL = "Fecha del examen";

const CRITERIA: ReadinessCriterion[] = [
  {
    id: "mastery",
    status: "met",
    summary: "Todas las unidades de la etapa están dominadas",
    missing: [],
  },
  {
    id: "mock-exams",
    status: "missing",
    summary: "Aprueba dos formas distintas con ≥ 80 %",
    missing: [
      "Te falta la forma C con ≥ 80 %",
      "Tu último simulacro válido tiene más de 14 días",
    ],
  },
  {
    id: "review",
    status: "met",
    summary: "No hay repaso atrasado",
    missing: [],
  },
  {
    id: "evidence",
    status: "unavailable",
    summary: "La defensa técnica de AWS llega en S26",
    missing: [],
  },
];

function readiness(overrides: Partial<ExamReadiness> = {}): ExamReadiness {
  return {
    certification: "SAA-C03",
    stageId: 102,
    ready: false,
    criteria: CRITERIA,
    evaluatedAt: "2026-11-09T10:00:00.000Z",
    lastRealResult: null,
    ...overrides,
  };
}

function realResult(overrides: Partial<RealExamResult> = {}): RealExamResult {
  return {
    id: "real_1",
    certification: "SAA-C03",
    passed: true,
    scaledScore: 850,
    takenOn: "2026-10-01",
    readyAtRegistration: false,
    createdAt: "2026-10-02T10:00:00.000Z",
    ...overrides,
  };
}

type ReadinessHandler = (certification: string) => Promise<ExamReadiness>;

type RegisterHandler = (
  certification: string,
  body: RegisterRealResultInput,
) => Promise<RealExamResult>;

function createApi(
  options: {
    readonly readiness?: ReadinessHandler;
    readonly register?: RegisterHandler;
  } = {},
) {
  const loadReadiness = vi.fn(
    options.readiness ?? ((): Promise<ExamReadiness> => Promise.resolve(readiness())),
  );
  const register = vi.fn(
    options.register ?? ((): Promise<RealExamResult> => Promise.resolve(realResult())),
  );
  const api: ReadinessPanelApi = {
    readiness: loadReadiness,
    registerRealResult: register,
  };

  return { api, loadReadiness, register };
}

/** Pinta el panel con un cliente propio y espera a que la carga termine. */
async function renderPanel(
  options: {
    readonly certification?: CertificationCode;
    readonly readiness?: ReadinessHandler;
    readonly register?: RegisterHandler;
  } = {},
) {
  const handlers = createApi({
    readiness: options.readiness,
    register: options.register,
  });

  render(
    <ReadinessPanel
      certification={options.certification ?? "SAA-C03"}
      api={handlers.api}
    />,
  );

  await screen.findByRole("heading", { name: /^(Listo para presentar|Todavía no)$/ });

  return handlers;
}

function fillForm(options: {
  readonly passedLabel: string;
  readonly takenOn: string;
  readonly score?: string;
}): void {
  fireEvent.click(screen.getByRole("radio", { name: options.passedLabel }));

  if (options.score !== undefined) {
    fireEvent.change(screen.getByLabelText(SCORE_LABEL), {
      target: { value: options.score },
    });
  }

  fireEvent.change(screen.getByLabelText(DATE_LABEL), {
    target: { value: options.takenOn },
  });
}

function submit(): void {
  fireEvent.click(screen.getByRole("button", { name: "Registrar resultado" }));
}

describe("ReadinessPanel", () => {
  it("dice «Todavía no» y el estado de cada criterio en texto", async () => {
    await renderPanel();

    expect(screen.getByRole("heading", { name: "Todavía no" })).toBeInTheDocument();

    for (const label of ["Dominio", "Simulacros", "Repaso", "Evidencia"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getAllByText("Cumplido")).toHaveLength(2);
    expect(screen.getByText("Falta")).toBeInTheDocument();
    expect(screen.getByText("Aún no disponible")).toBeInTheDocument();

    expect(screen.getByText("Aprueba dos formas distintas con ≥ 80 %")).toBeInTheDocument();
    expect(screen.getByText("Te falta la forma C con ≥ 80 %")).toBeInTheDocument();
    expect(
      screen.getByText("La defensa técnica de AWS llega en S26"),
    ).toBeInTheDocument();
  });

  it("dice «Listo para presentar» cuando los cuatro criterios se cumplen", async () => {
    const met = CRITERIA.map(
      (criterion): ReadinessCriterion => ({ ...criterion, status: "met", missing: [] }),
    );

    await renderPanel({
      readiness: () => Promise.resolve(readiness({ ready: true, criteria: met })),
    });

    expect(
      screen.getByRole("heading", { name: "Listo para presentar" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Falta")).toBeNull();
    expect(screen.queryByText("Aún no disponible")).toBeNull();
    expect(screen.getAllByText("Cumplido")).toHaveLength(4);
  });

  it("registra el resultado real con el cuerpo exacto", async () => {
    const { register } = await renderPanel();

    fillForm({ passedLabel: "Sí", takenOn: "2026-10-01", score: "850" });
    submit();

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("SAA-C03", {
        passed: true,
        scaledScore: 850,
        takenOn: "2026-10-01",
      });
    });

    expect(await screen.findByText("Último resultado registrado")).toBeInTheDocument();
    expect(screen.getByText("01/10/2026 · Aprobado")).toBeInTheDocument();
    expect(screen.getByText("Puntuación 850")).toBeInTheDocument();
  });

  it("omite la puntuación cuando se deja vacía", async () => {
    const { register } = await renderPanel({
      register: () =>
        Promise.resolve(
          realResult({ passed: false, scaledScore: null, takenOn: "2026-11-01" }),
        ),
    });

    fillForm({ passedLabel: "No", takenOn: "2026-11-01" });
    submit();

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("SAA-C03", {
        passed: false,
        takenOn: "2026-11-01",
      });
    });

    expect(
      await screen.findByText("01/11/2026 · No aprobado"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Puntuación \d+$/)).toBeNull();
  });

  it("muestra el 400 de fecha futura sin guardar nada", async () => {
    const { register } = await renderPanel({
      register: () =>
        Promise.reject(
          new ApiError({
            status: 400,
            code: "VALIDATION_ERROR",
            message: FUTURE_DATE_MESSAGE,
          }),
        ),
    });

    fillForm({ passedLabel: "Sí", takenOn: "2027-01-01" });
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(FUTURE_DATE_MESSAGE);
    expect(register).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Último resultado registrado")).toBeNull();
  });

  it("muestra el último resultado ya registrado", async () => {
    await renderPanel({
      readiness: () =>
        Promise.resolve(
          readiness({
            lastRealResult: realResult({
              passed: false,
              scaledScore: null,
              takenOn: "2026-09-15",
            }),
          }),
        ),
    });

    expect(screen.getByText("Último resultado registrado")).toBeInTheDocument();
    expect(screen.getByText("15/09/2026 · No aprobado")).toBeInTheDocument();
  });

  it("pide la aprobación y la fecha antes de llamar a la API", async () => {
    const { register } = await renderPanel();

    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Indica si aprobaste.");

    fireEvent.click(screen.getByRole("radio", { name: "Sí" }));
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Indica la fecha del examen.",
    );
    expect(register).not.toHaveBeenCalled();
  });

  it("no envía una puntuación fuera de rango", async () => {
    const { register } = await renderPanel();

    fillForm({ passedLabel: "Sí", takenOn: "2026-10-01", score: "1500" });
    submit();

    expect(register).not.toHaveBeenCalled();
    expect(screen.queryByText("Último resultado registrado")).toBeNull();
  });

  it("reintenta la carga de la preparación cuando falla", async () => {
    let calls = 0;
    const loadReadiness: ReadinessHandler = () => {
      calls += 1;

      return calls === 1
        ? Promise.reject(
            new ApiError({
              status: 500,
              code: "INTERNAL_ERROR",
              message: "Fallo interno",
            }),
          )
        : Promise.resolve(readiness());
    };

    const handlers = createApi({ readiness: loadReadiness });

    render(<ReadinessPanel certification="SAA-C03" api={handlers.api} />);

    expect(
      await screen.findByText("No pudimos cargar tu preparación."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Reintentar la preparación" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Todavía no" }),
    ).toBeInTheDocument();
  });
});
