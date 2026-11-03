import type { AiTutorRequest, AiTutorResponse, AiUsageResponse } from "@codeai/shared";
import { AI_MESSAGE_MAX } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type Mock, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { TutorPanel } from "./TutorPanel";
import type { TutorContext } from "./TutorPanel";

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

const CONTEXT: TutorContext = {
  title: "Suma segura",
  statement: "Implementa una suma que valide sus entradas.",
  code: "const suma = (a: number, b: number) => a + b;",
  language: "typescript",
};

function setup(
  overrides: {
    askTutor?: Mock<(input: AiTutorRequest) => Promise<AiTutorResponse>>;
    context?: TutorContext;
  } = {},
) {
  const askTutor =
    overrides.askTutor ??
    vi.fn<(input: AiTutorRequest) => Promise<AiTutorResponse>>().mockResolvedValue(RESPONSE);
  const loadUsage = vi.fn().mockResolvedValue(USAGE);

  render(
    <TutorPanel
      askTutor={askTutor}
      context={overrides.context}
      lessonId="les_1"
      loadUsage={loadUsage}
    />,
  );

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
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));
    await screen.findByText(RESPONSE.reply);

    fireEvent.change(box, { target: { value: "segunda" } });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("límite de mensajes");
    expect(alert.textContent).toContain("10 min");
  });

  it("un fallo genérico muestra un error legible, no el cuerpo crudo", async () => {
    const askTutor = vi.fn().mockRejectedValue(new Error("boom interno"));
    setup({ askTutor });

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No pudimos contactar al tutor");
    expect(alert.textContent).not.toContain("boom");
  });

  it("explica que la respuesta es una degradación cuando el origen es fallback", async () => {
    const askTutor = vi.fn().mockResolvedValue({ ...RESPONSE, source: "fallback", suggestedHints: [] });
    setup({ askTutor });

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    expect(await screen.findByText(/no está disponible ahora mismo/)).toBeTruthy();
  });

  it("no envía un mensaje vacío", () => {
    const { askTutor } = setup();

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "   " } });

    expect((screen.getByRole("button", { name: "Preguntar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(askTutor).not.toHaveBeenCalled();
  });

  it("adjunta el enunciado y el código del intento al mensaje", async () => {
    const { askTutor } = setup({ context: CONTEXT });

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), {
      target: { value: "No sé por qué falla" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    await waitFor(() => expect(askTutor).toHaveBeenCalledTimes(1));

    const sent = askTutor.mock.calls[0]?.[0]?.message ?? "";

    // El contrato no cambia: sigue siendo un único `message` de texto.
    expect(sent.startsWith("No sé por qué falla")).toBe(true);
    expect(sent).toContain("Contexto del intento: Suma segura");
    expect(sent).toContain("Enunciado: Implementa una suma que valide sus entradas.");
    expect(sent).toContain("```typescript");
    expect(sent).toContain(CONTEXT.code);
    expect(sent.length).toBeLessThanOrEqual(AI_MESSAGE_MAX);
  });

  it("recorta el contexto para no superar el tope del contrato", async () => {
    const { askTutor } = setup({ context: { ...CONTEXT, code: "const valor = 1;\n".repeat(600) } });

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    await waitFor(() => expect(askTutor).toHaveBeenCalledTimes(1));

    const sent = askTutor.mock.calls[0]?.[0]?.message ?? "";

    expect(sent.length).toBeLessThanOrEqual(AI_MESSAGE_MAX);
    expect(sent.startsWith("hola")).toBe(true);
  });

  it("el estudiante puede dejar el contexto fuera de la pregunta", async () => {
    const { askTutor } = setup({ context: CONTEXT });

    fireEvent.click(screen.getByRole("checkbox", { name: /Adjuntar el enunciado/ }));
    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    await waitFor(() => expect(askTutor).toHaveBeenCalledTimes(1));
    expect(askTutor.mock.calls[0]?.[0]?.message).toBe("hola");
  });

  it("no ofrece adjuntar contexto cuando no recibe código", () => {
    setup();

    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("TutorPanel con streaming", () => {
  it("pinta el texto a medida que llega y lo cierra con pistas y saldo", async () => {
    let finish: (response: AiTutorResponse) => void = () => undefined;
    let progress: (text: string) => void = () => undefined;
    const streamTutor = vi.fn(
      (_input: AiTutorRequest, onProgress: (text: string) => void) => {
        progress = onProgress;

        return new Promise<AiTutorResponse>((done) => {
          finish = done;
        });
      },
    );

    render(<TutorPanel lessonId="les_1" loadUsage={vi.fn().mockResolvedValue(USAGE)} streamTutor={streamTutor} />);

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "No entiendo el await" } });
    fireEvent.keyDown(screen.getByLabelText("Pregúntale al tutor"), { key: "Enter" });

    await waitFor(() => expect(streamTutor).toHaveBeenCalledTimes(1));

    progress("¿Qué devuelve ");
    expect(await screen.findByText("¿Qué devuelve")).toBeTruthy();
    expect(screen.queryByText("El tutor está pensando…")).toBeNull();

    progress("¿Qué devuelve fetch?");
    finish(RESPONSE);

    expect(await screen.findByText(RESPONSE.reply)).toBeTruthy();
    expect(screen.getByText("promesas")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Saldo de IA del mes: 4.98/)).toBeTruthy());
  });

  it("retira la respuesta a medias y avisa si el flujo se corta", async () => {
    const streamTutor = vi.fn(
      async (_input: AiTutorRequest, onProgress: (text: string) => void): Promise<AiTutorResponse> => {
        onProgress("Respuesta a medi");
        throw new Error("corte");
      },
    );

    render(<TutorPanel lessonId="les_1" loadUsage={vi.fn().mockResolvedValue(USAGE)} streamTutor={streamTutor} />);

    fireEvent.change(screen.getByLabelText("Pregúntale al tutor"), { target: { value: "hola" } });
    fireEvent.keyDown(screen.getByLabelText("Pregúntale al tutor"), { key: "Enter" });

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/Respuesta a medi/)).toBeNull();
  });
});
