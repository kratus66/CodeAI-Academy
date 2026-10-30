import type {
  AiTutorResponse,
  AiUsageResponse,
  CreateSubmissionInput,
  ExerciseDetail,
  HintLevel,
  HintResponse,
  SandboxRunRequest,
  SandboxRunResponse,
  SubmissionSummary,
} from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AskTutor, LoadUsage } from "@/features/ai/components/TutorPanel";
import { ApiError } from "@/lib/api-client";

import type { LoadHistory } from "./AttemptHistory";
import { ExerciseLab } from "./ExerciseLab";
import type { ExerciseLabContent } from "./ExerciseLab";
import type { RequestHint } from "./HintPanel";

const STARTER = "export function sumar(a: number, b: number) {\n  return a + b;\n}";

const EXERCISE: ExerciseDetail = {
  id: "ex_1",
  unitId: "unit_1",
  unitCode: "U0.1.1",
  type: "LAB",
  title: "Suma segura",
  ladder: "GUIDED",
  difficulty: 2,
  estimatedMin: 30,
  language: "typescript",
  competencies: [],
  statement: "Implementa una suma que valide sus entradas.",
  config: {},
  publicTests: [
    { testId: "t1", name: "suma dos positivos" },
    { testId: "t2", name: "rechaza texto" },
  ],
  hintsAvailable: 2,
  starterCode: STARTER,
};

const CONTENT: ExerciseLabContent = {
  exercise: EXERCISE,
  lessonId: "les_1",
  unitTitle: "Fundamentos de la IA",
};

const TUTOR_REPLY: AiTutorResponse = {
  reply: "¿Qué devuelve tu función cuando a es texto?",
  suggestedHints: ["tipos"],
  tokensUsed: 120,
  budgetRemainingUsd: 4.9,
  source: "provider",
  filtered: false,
};

const AI_USAGE: AiUsageResponse = {
  month: "2026-10",
  spentUsd: 0.1,
  budgetUsd: 5,
  remainingUsd: 4.9,
  percentUsed: 2,
  level: "normal",
  interactions: 2,
};

const RUN: SandboxRunResponse = {
  outcome: "PASSED",
  score: 100,
  results: [],
  stdout: "12\n",
  durationMs: 12,
};

const HINT: HintResponse = {
  level: 1,
  text: "Valida el tipo antes de sumar.",
  nextLevelAvailable: false,
};

const SUBMISSION: SubmissionSummary = {
  id: "sub_1",
  outcome: "PARTIAL",
  score: 50,
  achievedLevel: 2,
  hintsUsed: 3,
  results: [
    { testId: "t1", name: "suma dos positivos", passed: true },
    { testId: "t2", name: "rechaza texto", passed: false },
  ],
  feedback: "1 de 2 pruebas visibles superadas.",
  createdAt: "2026-10-27T14:30:00.000Z",
};

function renderLab({
  content = CONTENT,
  runCode = vi.fn(async () => RUN),
  submitSolution = vi.fn(async () => SUBMISSION),
  requestHint = vi.fn(async (_exerciseId: string, level: HintLevel) => ({
    ...HINT,
    level,
  })),
  loadHistory = vi.fn(async (): Promise<SubmissionSummary[]> => []),
  askTutor = vi.fn(async (): Promise<AiTutorResponse> => TUTOR_REPLY),
  loadUsage = vi.fn(async (): Promise<AiUsageResponse> => AI_USAGE),
}: {
  content?: ExerciseLabContent;
  runCode?: (input: SandboxRunRequest) => Promise<SandboxRunResponse>;
  submitSolution?: (
    id: string,
    input: CreateSubmissionInput,
  ) => Promise<SubmissionSummary>;
  requestHint?: RequestHint;
  loadHistory?: LoadHistory;
  askTutor?: AskTutor;
  loadUsage?: LoadUsage;
} = {}) {
  render(
    <ExerciseLab
      askTutor={askTutor}
      editorSurface={null}
      loadHistory={loadHistory}
      loadLab={async () => content}
      loadUsage={loadUsage}
      requestHint={requestHint}
      runCode={runCode}
      slug="suma-segura"
      submitSolution={submitSolution}
      unitCode="U0.1.1"
    />,
  );

  return {
    runCode,
    submitSolution,
    requestHint,
    loadHistory,
    askTutor,
    loadUsage,
  };
}

describe("ExerciseLab", () => {
  it("pinta el enunciado, las pruebas visibles y el código de partida", async () => {
    renderLab();

    expect(
      await screen.findByRole("heading", { name: "Suma segura", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Implementa una suma que valide sus entradas."),
    ).toBeInTheDocument();
    expect(screen.getByText("suma dos positivos")).toBeInTheDocument();
    expect(screen.getByText("rechaza texto")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tu solución" })).toHaveValue(
      STARTER,
    );
    expect(
      screen.getByRole("link", { name: /Fundamentos de la IA/ }),
    ).toHaveAttribute("href", "/learn/units/U0.1.1");
  });

  it("ejecuta el archivo del lenguaje con los límites del contrato", async () => {
    const { runCode } = renderLab();

    await screen.findByRole("heading", { name: "Suma segura", level: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar" }));

    await waitFor(() => expect(runCode).toHaveBeenCalledTimes(1));
    expect(runCode).toHaveBeenCalledWith({
      language: "typescript",
      files: [{ path: "index.ts", content: STARTER }],
      tests: [],
      limits: { timeoutMs: 5_000, memoryMb: 256 },
    });
    expect(await screen.findByText(/Ejecución terminada/)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("no ejecuta sin código y lo explica", async () => {
    const { runCode } = renderLab({
      content: {
        exercise: { ...EXERCISE, starterCode: "" },
        lessonId: "les_1",
        unitTitle: "U",
      },
    });

    await screen.findByRole("heading", { name: "Suma segura", level: 1 });

    expect(screen.getByRole("button", { name: "Ejecutar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(runCode).not.toHaveBeenCalled();
  });

  it("envía el código con la explicación y pinta el resultado", async () => {
    const { submitSolution } = renderLab();

    await screen.findByRole("heading", { name: "Suma segura", level: 1 });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Explica tu solución (opcional)" }),
      { target: { value: "  Sumo con guardas.  " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(submitSolution).toHaveBeenCalledTimes(1));
    expect(submitSolution).toHaveBeenCalledWith("ex_1", {
      code: STARTER,
      selfExplanation: "Sumo con guardas.",
    });
    expect(
      await screen.findByText(/Envío Parcial · 50\/100/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 de 2 pruebas visibles superadas."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nivel alcanzado: 2\/4/)).toBeInTheDocument();
    expect(screen.getByText(/3 pistas usadas/)).toBeInTheDocument();
  });

  it("refresca el historial tras enviar y pinta el intento", async () => {
    const loadHistory = vi
      .fn<() => Promise<SubmissionSummary[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([SUBMISSION]);

    renderLab({ loadHistory });

    await screen.findByRole("heading", { name: "Suma segura", level: 1 });
    expect(
      await screen.findByText("Todavía no has enviado este ejercicio."),
    ).toBeInTheDocument();
    expect(loadHistory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(
      await screen.findByRole("heading", { name: "Historial de intentos" }),
    ).toBeInTheDocument();
    expect(loadHistory).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Intento 1")).toBeInTheDocument();
  });

  it("pide la pista del ejercicio desde el panel del laboratorio", async () => {
    const { requestHint } = renderLab();

    await screen.findByRole("heading", { name: "Suma segura", level: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Pedir pista 1" }));

    expect(
      await screen.findByText("Valida el tipo antes de sumar."),
    ).toBeInTheDocument();
    expect(requestHint).toHaveBeenCalledWith("ex_1", 1);
    expect(
      screen.getByRole("button", { name: "Pedir pista 2" }),
    ).toBeDisabled();
  });

  it("traduce el 429 de la cuota a un aviso con segundos de espera", async () => {
    const runCode = vi.fn(async () => {
      throw new ApiError({
        status: 429,
        code: "RATE_LIMITED",
        message: "Demasiadas ejecuciones.",
        retryAfterSeconds: 47,
      });
    });

    renderLab({ runCode });

    await screen.findByRole("heading", { name: "Suma segura", level: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Vuelve a intentarlo en 47 s.",
    );
  });

  it("trata un slug no publicado como ejercicio inexistente", async () => {
    render(
      <ExerciseLab
        loadLab={async () => {
          throw new ApiError({
            status: 404,
            code: "NOT_FOUND",
            message: "El ejercicio no está publicado en esta unidad.",
          });
        }}
        slug="no-existe"
        unitCode="U0.1.1"
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos este ejercicio.",
    );
    expect(
      screen.getByRole("link", { name: "Volver a la unidad" }),
    ).toHaveAttribute("href", "/learn/units/U0.1.1");
  });

  it("pasa al tutor el enunciado y el código del intento", async () => {
    const { askTutor } = renderLab();
    const CURRENT_CODE = "export const suma = (a: number, b: number) => a + b;";

    await screen.findByRole("heading", { name: "Suma segura", level: 1 });

    fireEvent.change(screen.getByRole("textbox", { name: "Tu solución" }), {
      target: { value: CURRENT_CODE },
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir el tutor" }));
    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), {
      target: { value: "¿Por qué falla mi prueba?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    await waitFor(() => expect(askTutor).toHaveBeenCalledTimes(1));

    const request = vi.mocked(askTutor).mock.calls[0]?.[0];

    expect(request?.lessonId).toBe("les_1");
    expect(request?.message.startsWith("¿Por qué falla mi prueba?")).toBe(true);
    expect(request?.message).toContain(CURRENT_CODE);
    expect(request?.message).toContain(
      "Implementa una suma que valide sus entradas.",
    );
  });

  it("abre y cierra la hoja del tutor en móvil", async () => {
    renderLab();

    await screen.findByRole("heading", { name: "Suma segura", level: 1 });

    const trigger = screen.getByRole("button", { name: "Abrir el tutor" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(
      screen.getByRole("button", { name: "Cerrar el tutor" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(
      screen.getByRole("button", { name: "Abrir el tutor" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

