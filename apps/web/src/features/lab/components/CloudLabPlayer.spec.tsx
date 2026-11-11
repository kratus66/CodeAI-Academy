import type { CloudEvidenceResult, ExerciseDetail } from "@codeai/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { CloudLabPlayer } from "./CloudLabPlayer";

const BUILD_COMMAND = "aws budgets describe-budgets --account-id 123456789012";
const CLEANUP_COMMAND = "aws budgets describe-budget --account-id 123456789012";

const CLOUD_EXERCISE: ExerciseDetail = {
  id: "cl-1",
  unitId: "unit-1",
  unitCode: "AWS-1.1",
  type: "CLOUD_LAB",
  title: "Presupuesto de práctica",
  ladder: "SEMI",
  difficulty: 2,
  estimatedMin: 20,
  language: null,
  competencies: ["AWS-C1"],
  statement: "Crea un presupuesto en tu cuenta de práctica.",
  config: {
    region: "us-east-1",
    tag: "codeai-lab=presupuesto",
    cost: {
      expectedUsd: 0,
      freeTier: "Dos presupuestos gratuitos por cuenta",
      source: "https://aws.amazon.com/aws-cost-management/pricing/",
      checkedOn: "2026-11-10",
    },
    prerequisites: ["Una cuenta de práctica con MFA"],
    steps: [{ title: "Crea el presupuesto", instructions: "Abre la consola de Budgets." }],
    checks: [
      { id: "c1", label: "El presupuesto existe", phase: "build", command: BUILD_COMMAND },
      { id: "c2", label: "El presupuesto ya no existe", phase: "cleanup", command: CLEANUP_COMMAND },
    ],
  },
  publicTests: [],
  hintsAvailable: 0,
  starterCode: null,
};

const RESULT = {
  outcome: "PARTIAL",
  checks: [
    { checkId: "c1", label: "El presupuesto existe", passed: true, problems: [] },
    {
      checkId: "c2",
      label: "El presupuesto ya no existe",
      passed: false,
      problems: ["El presupuesto sigue apareciendo en la salida."],
    },
  ],
  cleanupConfirmed: true,
  maskedSummary: "Cuenta ************ revisada",
} satisfies CloudEvidenceResult;

function buildField(): HTMLElement {
  return screen.getByRole("textbox", { name: /Pega la salida JSON de «El presupuesto existe»/ });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("CloudLabPlayer: avisos y contenido", () => {
  it("muestra los avisos fijos y el costo con cantidad, capa gratuita, fuente y fecha", () => {
    render(<CloudLabPlayer exercise={CLOUD_EXERCISE} submitEvidence={vi.fn()} />);

    expect(
      screen.getByText("Nunca pegues claves ni secretos. Usa una cuenta de práctica con MFA y presupuesto"),
    ).toBeInTheDocument();
    expect(screen.getByText("Esta práctica no certifica nivel 3")).toBeInTheDocument();
    expect(screen.getByText(/Costo esperado: 0 USD/)).toBeInTheDocument();
    expect(screen.getByText(/Dos presupuestos gratuitos por cuenta/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /aws\.amazon\.com/ })).toHaveAttribute(
      "href",
      "https://aws.amazon.com/aws-cost-management/pricing/",
    );
    expect(screen.getByText(/2026-11-10/)).toBeInTheDocument();
  });

  it("muestra prerrequisitos, pasos, comandos y la casilla de limpieza", () => {
    render(<CloudLabPlayer exercise={CLOUD_EXERCISE} submitEvidence={vi.fn()} />);

    expect(screen.getByText("Una cuenta de práctica con MFA")).toBeInTheDocument();
    expect(screen.getByText(/Crea el presupuesto/)).toBeInTheDocument();
    expect(screen.getByText(BUILD_COMMAND)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Limpieza" })).getByText(CLEANUP_COMMAND)).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: "He eliminado los recursos del laboratorio" })).toBeInTheDocument();
  });

  it("avisa cuando la configuración está incompleta", () => {
    render(<CloudLabPlayer exercise={{ ...CLOUD_EXERCISE, config: {} }} submitEvidence={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Este laboratorio no tiene configuración disponible.");
  });
});

describe("CloudLabPlayer: copiar comando", () => {
  it("copia el comando al portapapeles", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CloudLabPlayer exercise={CLOUD_EXERCISE} submitEvidence={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Copiar comando" })[0] as HTMLElement);

    expect(await screen.findByText("Comando copiado")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(BUILD_COMMAND);
  });

  it("ofrece una alternativa si el portapapeles no está disponible", async () => {
    render(<CloudLabPlayer exercise={CLOUD_EXERCISE} submitEvidence={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Copiar comando" })[0] as HTMLElement);

    expect(await screen.findByText(/selecciona el comando y cópialo a mano/)).toBeInTheDocument();
  });
});

describe("CloudLabPlayer: envío y resultado", () => {
  it("no habilita el envío sin evidencia", () => {
    render(<CloudLabPlayer exercise={CLOUD_EXERCISE} submitEvidence={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "Enviar evidencia" });

    expect(submit).toBeDisabled();
    fireEvent.change(buildField(), { target: { value: "{}" } });
    expect(submit).toBeEnabled();
  });

  it("envía solo la evidencia pegada y la confirmación de limpieza", async () => {
    const submitEvidence = vi.fn().mockResolvedValue(RESULT);
    render(<CloudLabPlayer exercise={CLOUD_EXERCISE} submitEvidence={submitEvidence} />);

    fireEvent.change(buildField(), { target: { value: '{"Budgets":[]}' } });
    fireEvent.click(screen.getByRole("checkbox", { name: "He eliminado los recursos del laboratorio" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar evidencia" }));

    await screen.findByRole("status");

    expect(submitEvidence).toHaveBeenCalledWith("cl-1", {
      evidence: [{ checkId: "c1", output: '{"Budgets":[]}' }],
      cleanupConfirmed: true,
    });
  });

  it("muestra el resultado por comprobación con sus problemas y el resumen enmascarado", async () => {
    render(<CloudLabPlayer exercise={CLOUD_EXERCISE} submitEvidence={vi.fn().mockResolvedValue(RESULT)} />);

    fireEvent.change(buildField(), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar evidencia" }));

    const status = await screen.findByRole("status");

    expect(status).toHaveTextContent("Parcial");
    expect(status).toHaveTextContent("Cumple");
    expect(status).toHaveTextContent("No cumple");
    expect(status).toHaveTextContent("El presupuesto sigue apareciendo en la salida.");
    expect(status).toHaveTextContent("Cuenta ************ revisada");
  });

  it("muestra los errores de la API en un aviso y permite reintentar", async () => {
    const submitEvidence = vi.fn().mockRejectedValue(
      new ApiError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "La evidencia parece contener credenciales.",
      }),
    );
    render(<CloudLabPlayer exercise={CLOUD_EXERCISE} submitEvidence={submitEvidence} />);

    fireEvent.change(buildField(), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar evidencia" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La evidencia parece contener credenciales.");
    expect(screen.getByRole("button", { name: "Enviar evidencia" })).toBeEnabled();
  });
});
