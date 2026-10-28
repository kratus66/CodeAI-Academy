import type { AiTutorResponse, AiUsageResponse } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { TutorPanel } from "./TutorPanel";

const RESPONSE: AiTutorResponse = {
  reply: "¿Qué devuelve fetch cuando el estado es 404?",
  suggestedHints: ["promesas", "respuesta-http"],
  tokensUsed: 412,
  budgetRemainingUsd: 4.98,
  source: "provider",
  filtered: false,
};

const USAGE: AiUsageResponse = {
  month: "2026-10",
  spentUsd: 0.02,
  budgetUsd: 5,
  remainingUsd: 4.98,
  percentUsed: 0.4,
  level: "normal",
  interactions: 1,
};

function setup(overrides: { askTutor?: ReturnType<typeof vi.fn> } = {}) {
  const askTutor = overrides.askTutor ?? vi.fn().mockResolvedValue(RESPONSE);
  const loadUsage = vi.fn().mockResolvedValue(USAGE);

  render(<TutorPanel lessonId="les_1" askTutor={askTutor} loadUsage={loadUsage} />);

  return { askTutor, loadUsage };
}

describe("TutorPanel", () => {
  it("muestra el aviso de privacidad y el saldo del mes", async () => {
    setup();

    expect(screen.getByText(/Privacidad:/)).toBeTruthy();
    expect(await screen.findByText(/Saldo de IA del mes: 4\.98 USD/)).toBeTruthy();
  });

  it("envía con Enter con el id de la lección y el texto, y pinta respuesta y pistas", async () => {
    const { askTutor } = setup();
    const box = screen.getByLabelText("Pregúntale al tutor");

    fireEvent.change(box, { target: { value: "No entiendo el await" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(askTutor).toHaveBeenCalledTimes(1));
    expect(askTutor).toHaveBeenCalledWith({ lessonId: "les_1", message: "No entiendo el await", history: [] });

    expect(await screen.findByText(RESPONSE.reply)).toBeTruthy();
    const hints = screen.getByRole("list", { name: "Pistas sugeridas" });
    expect(hints.textContent).toContain("promesas");
    expect(hints.textContent).toContain("respuesta-http");
  });

  it("Shift+Enter no envía", () => {
    const { askTutor } = setup();
    const box = screen.getByLabelText("Pregúntale al tutor");

    fireEvent.change(box, { target: { value: "hola" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });

    expect(askTutor).not.toHaveBeenCalled();
  });

  it("reenvía la conversación previa como historial", async () => {
    const { askTutor } = setup();
    const box = screen.getByLabelText("Pregúntale al tutor");

    fireEvent.change(box, { target: { value: "primera" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText(RESPONSE.reply);

    fireEvent.change(box, { target: { value: "segunda" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(askTutor).toHaveBeenCalledTimes(2));

    expect(askTutor.mock.calls[1]?.[0]).toEqual({
      lessonId: "les_1",
      message: "segunda",
      history: [
        { role: "user", content: "primera" },
        { role: "assistant", content: RESPONSE.reply },
      ],
    });
  });

  it("muestra el estado de carga mientras espera", async () => {
    let resolve: (value: AiTutorResponse) => void = () => undefined;
    const askTutor = vi.fn().mockReturnValue(new Promise<AiTutorResponse>((done) => (resolve = done)));
    setup({ askTutor });

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("status")).toBeTruthy();

    resolve(RESPONSE);
    await screen.findByText(RESPONSE.reply);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("un 429 muestra el aviso de espera con los minutos de Retry-After", async () => {
    const askTutor = vi.fn().mockRejectedValue(
      new ApiError({ status: 429, code: "RATE_LIMITED", message: "límite", retryAfterSeconds: 600 }),
    );
    setup({ askTutor });

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("límite de mensajes");
    expect(alert.textContent).toContain("10 min");
  });

  it("un fallo genérico muestra un error legible, no el cuerpo crudo", async () => {
    const askTutor = vi.fn().mockRejectedValue(new Error("boom interno"));
    setup({ askTutor });

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No pudimos contactar al tutor");
    expect(alert.textContent).not.toContain("boom");
  });

  it("explica que la respuesta es una degradación cuando el origen es fallback", async () => {
    const askTutor = vi.fn().mockResolvedValue({ ...RESPONSE, source: "fallback", suggestedHints: [] });
    setup({ askTutor });

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(/no está disponible ahora mismo/)).toBeTruthy();
  });

  it("no envía un mensaje vacío", () => {
    const { askTutor } = setup();

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "   " } });

    expect((screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(askTutor).not.toHaveBeenCalled();
  });
});
