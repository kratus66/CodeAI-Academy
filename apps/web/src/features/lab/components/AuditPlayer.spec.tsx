import type { AuditAnswerResult, ExerciseDetail } from "@codeai/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditPlayer } from "./AuditPlayer";

const ARTIFACT = [
  "export async function loadUser(id: string) {",
  "  const response = await fetch(`/api/users/${id}`);",
  "  const data = await response.json();",
  "  return data.user;",
  "}",
].join("\n");

const CHECK_LABEL = "No comprueba la respuesta antes de leerla";
const SHAPE_LABEL = "El campo user puede no venir";

const EXERCISE: ExerciseDetail = {
  id: "aud-1",
  unitId: "unit-1",
  unitCode: "U5.1.2",
  type: "AUDIT",
  title: "El contrato de la API",
  ladder: "SEMI",
  difficulty: 3,
  estimatedMin: 12,
  language: "typescript",
  competencies: ["C2"],
  statement: "Audita esta función que consume la API de usuarios.",
  config: {
    artifact: { language: "typescript", content: ARTIFACT },
    candidates: [
      { id: "f1", lines: [2, 3], label: CHECK_LABEL },
      { id: "f2", lines: [4, 4], label: SHAPE_LABEL },
    ],
  },
  publicTests: [],
  hintsAvailable: 0,
  starterCode: null,
};

const DEFECT_EXPLANATION = "No comprueba response.ok: un 404 se parsea como si fuera un usuario.";
const SHAPE_EXPLANATION = "El campo user siempre llega: el endpoint lo devuelve directo.";

/** Corrección con un falso positivo: el estudiante marcó un hallazgo que no era defecto. */
const RESULT = {
  score: 85,
  outcome: "PARTIAL",
  detectedDefects: 1,
  totalDefects: 1,
  falsePositives: 1,
  decisionCorrect: true,
  verdict: "fix",
  findings: [
    {
      id: "f1",
      isDefect: true,
      severity: "high",
      marked: true,
      chosenSeverity: "high",
      severityCorrect: true,
      explanation: DEFECT_EXPLANATION,
    },
    {
      id: "f2",
      isDefect: false,
      severity: null,
      marked: true,
      chosenSeverity: "low",
      severityCorrect: null,
      explanation: SHAPE_EXPLANATION,
    },
  ],
} satisfies AuditAnswerResult;

function checkboxFor(label: string): HTMLElement {
  return screen.getByRole("checkbox", { name: `Es un defecto: ${label}` });
}

function severityFor(label: string): HTMLElement {
  return screen.getByLabelText(`Severidad: ${label}`);
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("AuditPlayer", () => {
  it("sólo habilita el envío con una decisión y severidad en cada hallazgo marcado", () => {
    render(<AuditPlayer exercise={EXERCISE} submitAudit={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "Enviar auditoría" });

    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Corregir" }));
    expect(submit).toBeEnabled();
    expect(screen.queryByLabelText(`Severidad: ${CHECK_LABEL}`)).not.toBeInTheDocument();

    fireEvent.click(checkboxFor(CHECK_LABEL));
    expect(submit).toBeDisabled();

    fireEvent.change(severityFor(CHECK_LABEL), { target: { value: "high" } });
    expect(submit).toBeEnabled();

    fireEvent.click(checkboxFor(CHECK_LABEL));
    expect(submit).toBeEnabled();
    expect(screen.queryByLabelText(`Severidad: ${CHECK_LABEL}`)).not.toBeInTheDocument();
  });

  it("envía sólo los hallazgos marcados con su severidad y la decisión", async () => {
    const submitAudit = vi.fn().mockResolvedValue(RESULT);
    render(<AuditPlayer exercise={EXERCISE} submitAudit={submitAudit} />);

    fireEvent.click(checkboxFor(SHAPE_LABEL));
    fireEvent.change(severityFor(SHAPE_LABEL), { target: { value: "low" } });
    fireEvent.click(screen.getByRole("radio", { name: "Aceptar" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar auditoría" }));

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(submitAudit).toHaveBeenCalledWith("aud-1", {
      marks: [{ findingId: "f2", severity: "low" }],
      decision: "accept",
    });
  });

  it("muestra la nota y los falsos positivos de la corrección", async () => {
    render(<AuditPlayer exercise={EXERCISE} submitAudit={vi.fn().mockResolvedValue(RESULT)} />);

    fireEvent.click(checkboxFor(CHECK_LABEL));
    fireEvent.change(severityFor(CHECK_LABEL), { target: { value: "high" } });
    fireEvent.click(checkboxFor(SHAPE_LABEL));
    fireEvent.change(severityFor(SHAPE_LABEL), { target: { value: "low" } });
    fireEvent.click(screen.getByRole("radio", { name: "Corregir" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar auditoría" }));

    const status = await screen.findByRole("status");

    expect(status).toHaveTextContent("85 / 100");
    expect(status).toHaveTextContent("Parcial");
    expect(status).toHaveTextContent("Defectos encontrados: 1 de 1");
    expect(status).toHaveTextContent("Falsos positivos: 1");
    expect(status).toHaveTextContent("Cada falso positivo resta nota");
    expect(status).toHaveTextContent("Acertaste la decisión: «Corregir».");
  });

  it("no adelanta explicaciones y las enseña todas después de enviar", async () => {
    render(<AuditPlayer exercise={EXERCISE} submitAudit={vi.fn().mockResolvedValue(RESULT)} />);

    expect(screen.queryByText(DEFECT_EXPLANATION)).not.toBeInTheDocument();
    expect(screen.queryByText(SHAPE_EXPLANATION)).not.toBeInTheDocument();
    expect(screen.queryByText(/severidad Alta/)).not.toBeInTheDocument();

    fireEvent.click(checkboxFor(CHECK_LABEL));
    fireEvent.change(severityFor(CHECK_LABEL), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("radio", { name: "Corregir" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar auditoría" }));

    const status = await screen.findByRole("status");

    expect(within(status).getByText(DEFECT_EXPLANATION)).toBeInTheDocument();
    expect(within(status).getByText(SHAPE_EXPLANATION)).toBeInTheDocument();
    expect(status).toHaveTextContent("Era un defecto real · severidad Alta");
    expect(status).toHaveTextContent("No era un defecto");
    expect(status).toHaveTextContent(SHAPE_LABEL);
  });

  it("avisa cuando la configuración no trae artefacto", () => {
    render(<AuditPlayer exercise={{ ...EXERCISE, config: {} }} submitAudit={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta auditoría no tiene artefacto disponible.",
    );
    expect(screen.queryByRole("button", { name: "Enviar auditoría" })).not.toBeInTheDocument();
  });

  it("pinta el artefacto con números de línea y lo copia entero", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<AuditPlayer exercise={EXERCISE} submitAudit={vi.fn()} />);

    const artifact = screen.getByRole("region", { name: "Artefacto a auditar" });

    expect(artifact).toHaveTextContent("export async function loadUser(id: string) {");
    expect(within(artifact).getByText("5")).toBeInTheDocument();
    expect(screen.getByText("líneas 2–3")).toBeInTheDocument();
    expect(screen.getByText("línea 4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));

    expect(writeText).toHaveBeenCalledWith(ARTIFACT);
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });

  it("reinicia la auditoría al intentarlo de nuevo", async () => {
    render(<AuditPlayer exercise={EXERCISE} submitAudit={vi.fn().mockResolvedValue(RESULT)} />);

    fireEvent.click(checkboxFor(CHECK_LABEL));
    fireEvent.change(severityFor(CHECK_LABEL), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("radio", { name: "Corregir" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar auditoría" }));
    fireEvent.click(await screen.findByRole("button", { name: "Intentar de nuevo" }));

    expect(screen.getByRole("button", { name: "Enviar auditoría" })).toBeDisabled();
    expect(checkboxFor(CHECK_LABEL)).not.toBeChecked();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
