import type {
  CreateSubmissionInput,
  ExerciseDetail,
  SandboxRunRequest,
  SandboxRunResponse,
  SubmissionSummary,
} from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { ExerciseLab } from "./ExerciseLab";
import type { ExerciseLabContent } from "./ExerciseLab";

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
  unitTitle: "Fundamentos de la IA",
};

const RUN: SandboxRunResponse = {
  outcome: "PASSED",
  score: 100,
  results: [],
  stdout: "12\n",
  durationMs: 12,
};

const SUBMISSION: SubmissionSummary = {
  id: "sub_1",
  outcome: "PARTIAL",
  score: 50,
  achievedLevel: null,
  hintsUsed: 0,
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
}: {
  content?: ExerciseLabContent;
  runCode?: (input: SandboxRunRequest) => Promise<SandboxRunResponse>;
  submitSolution?: (
    id: string,
    input: CreateSubmissionInput,
  ) => Promise<SubmissionSummary>;
} = {}) {
  render(
    <ExerciseLab
      editorSurface={null}
      loadLab={async () => content}
      runCode={runCode}
      slug="suma-segura"
      submitSolution={submitSolution}
      unitCode="U0.1.1"
    />,
  );

  return { runCode, submitSolution };
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
      content: { exercise: { ...EXERCISE, starterCode: "" }, unitTitle: "U" },
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
});

