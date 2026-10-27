import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { HintPanel } from "./HintPanel";

describe("HintPanel", () => {
  it("pide el nivel 1 y luego ofrece el siguiente", async () => {
    const requestHint = vi
      .fn()
      .mockResolvedValueOnce({
        level: 1,
        text: "Piensa en el caso vacío.",
        nextLevelAvailable: true,
      })
      .mockResolvedValueOnce({
        level: 2,
        text: "Usa reduce.",
        nextLevelAvailable: false,
      });

    render(
      <HintPanel exerciseId="ex-1" hintsAvailable={2} requestHint={requestHint} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pedir pista 1" }));

    expect(await screen.findByText("Piensa en el caso vacío.")).toBeInTheDocument();
    expect(requestHint).toHaveBeenLastCalledWith("ex-1", 1);

    fireEvent.click(screen.getByRole("button", { name: "Pedir pista 2" }));

    expect(await screen.findByText("Usa reduce.")).toBeInTheDocument();
    expect(requestHint).toHaveBeenLastCalledWith("ex-1", 2);
    expect(screen.getByRole("button", { name: "Pista 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pista 2" })).toBeDisabled();
    expect(
      screen.getByText("No hay más pistas en este ejercicio."),
    ).toBeInTheDocument();
  });

  it("no ofrece pedir pistas si el ejercicio no tiene", () => {
    render(<HintPanel exerciseId="ex-1" hintsAvailable={0} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Este ejercicio no ofrece pistas.")).toBeInTheDocument();
  });

  it("bloquea los niveles posteriores hasta pedir el anterior", async () => {
    const requestHint = vi.fn().mockResolvedValue({
      level: 1,
      text: "Primera pista.",
      nextLevelAvailable: true,
    });

    render(
      <HintPanel exerciseId="ex-1" hintsAvailable={3} requestHint={requestHint} />,
    );

    expect(screen.getByRole("button", { name: "Pedir pista 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pedir pista 2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pedir pista 3" })).toBeDisabled();
    expect(screen.getByText("Pide antes la pista 1.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pedir pista 1" }));

    expect(await screen.findByText("Primera pista.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir pista 2" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pedir pista 3" })).toBeDisabled();
    expect(screen.queryByText("Pide antes la pista 1.")).not.toBeInTheDocument();
    expect(screen.getByText("Pide antes la pista 2.")).toBeInTheDocument();
  });

  it("deshabilita los niveles restantes cuando no hay siguiente", async () => {
    const requestHint = vi.fn().mockResolvedValue({
      level: 1,
      text: "Única pista útil.",
      nextLevelAvailable: false,
    });

    render(
      <HintPanel exerciseId="ex-1" hintsAvailable={3} requestHint={requestHint} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pedir pista 1" }));

    expect(await screen.findByText("Única pista útil.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir pista 2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pedir pista 3" })).toBeDisabled();
    expect(
      screen.getByText("No hay más pistas en este ejercicio."),
    ).toBeInTheDocument();
  });

  it("marca la sección como ocupada mientras la pista está en vuelo", async () => {
    let resolve: (value: {
      level: 1;
      text: string;
      nextLevelAvailable: boolean;
    }) => void = () => undefined;
    const pending = new Promise<{
      level: 1;
      text: string;
      nextLevelAvailable: boolean;
    }>((r) => {
      resolve = r;
    });
    const requestHint = vi.fn().mockReturnValue(pending);

    render(
      <HintPanel exerciseId="ex-1" hintsAvailable={1} requestHint={requestHint} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pedir pista 1" }));

    const busyButton = await screen.findByRole("button", {
      name: "Pidiendo pista 1…",
    });

    expect(busyButton).toBeDisabled();
    expect(screen.getByRole("region", { name: "Pistas" })).toHaveAttribute(
      "aria-busy",
      "true",
    );

    resolve({ level: 1, text: "Ya llegó.", nextLevelAvailable: false });

    expect(await screen.findByText("Ya llegó.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pidiendo pista 1…" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Pistas" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("muestra el tiempo de espera cuando la cuota se agota y permite reintentar", async () => {
    const requestHint = vi.fn().mockRejectedValue(
      new ApiError({
        status: 429,
        code: "RATE_LIMITED",
        message: "Demasiadas peticiones",
        retryAfterSeconds: 12,
      }),
    );

    render(
      <HintPanel exerciseId="ex-1" hintsAvailable={2} requestHint={requestHint} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pedir pista 1" }));

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("20 pistas");
    expect(alert).toHaveTextContent("12 s");
    expect(screen.getByRole("button", { name: "Pedir pista 1" })).toBeEnabled();
  });

  it("explica el orden ante un 422 sin usar el mensaje de la API", async () => {
    const requestHint = vi.fn().mockRejectedValue(
      new ApiError({
        status: 422,
        code: "RULE_VIOLATION",
        message: "Debes pedir antes la pista anterior.",
      }),
    );

    render(
      <HintPanel exerciseId="ex-1" hintsAvailable={3} requestHint={requestHint} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pedir pista 1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Las pistas van en orden: pide primero la de nivel 1.",
    );
  });
});
