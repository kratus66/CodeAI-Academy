import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useContentLoader } from "./use-content-loader";

interface HarnessProps {
  readonly load: (signal: AbortSignal) => Promise<string>;
}

/** Componente mínimo: el hook es el que se prueba, no el marcado. */
function Harness({ load }: HarnessProps) {
  const { state, reload } = useContentLoader(load);

  return (
    <div>
      <p data-testid="status">{state.status}</p>
      {state.status === "ready" ? <p>{state.data}</p> : null}
      {state.status === "error" ? <p>Sin conexión</p> : null}
      <button type="button" onClick={reload}>
        Reintentar
      </button>
    </div>
  );
}

describe("useContentLoader", () => {
  it("publica el contenido cuando el loader resuelve", async () => {
    const load = vi.fn(async () => "etapas");

    render(<Harness load={load} />);

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(await screen.findByText("etapas")).toBeInTheDocument();
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
  });

  it("publica el error y vuelve a intentarlo cuando el loader falla", async () => {
    const load = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce("etapas");

    render(<Harness load={load} />);

    expect(await screen.findByText("Sin conexión")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByText("etapas")).toBeInTheDocument();
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("aborta la carga pendiente al desmontar", () => {
    let captured: AbortSignal | undefined;
    const load = vi.fn((signal: AbortSignal) => {
      captured = signal;

      return new Promise<string>(() => undefined);
    });

    const { unmount } = render(<Harness load={load} />);
    unmount();

    expect(captured?.aborted).toBe(true);
  });

  it("repite la petición cuando cambia el loader", async () => {
    const first = vi.fn(async () => "primera");
    const second = vi.fn(async () => "segunda");

    const { rerender } = render(<Harness load={first} />);
    expect(await screen.findByText("primera")).toBeInTheDocument();

    rerender(<Harness load={second} />);

    expect(await screen.findByText("segunda")).toBeInTheDocument();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
