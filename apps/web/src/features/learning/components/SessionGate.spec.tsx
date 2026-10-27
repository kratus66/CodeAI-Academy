import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionGate } from "./SessionGate";

const session = vi.hoisted(() => ({
  status: "loading" as "loading" | "authenticated" | "anonymous",
}));

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/features/auth/context/SessionProvider", () => ({
  useSession: () => ({
    user:
      session.status === "authenticated"
        ? {
            id: "usr_1",
            email: "ana@example.com",
            name: "Ana",
            role: "STUDENT",
            createdAt: "2026-10-26T14:30:00.000Z",
          }
        : null,
    status: session.status,
    setUser: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
}));

beforeEach(() => {
  session.status = "loading";
});

afterEach(() => {
  navigation.replace.mockReset();
});

function renderGate(): void {
  render(
    <SessionGate>
      <p>Contenido privado</p>
    </SessionGate>,
  );
}

describe("SessionGate", () => {
  it("anuncia la restauración y no pinta el contenido privado", () => {
    renderGate();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Restaurando tu sesión…",
    );
    expect(screen.queryByText("Contenido privado")).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("redirige a /login cuando no hay sesión, sin dejar la pantalla vacía", async () => {
    session.status = "anonymous";

    renderGate();

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/login");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Necesitas iniciar sesión",
    );
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/login");
    expect(screen.queryByText("Contenido privado")).toBeNull();
  });

  it("pinta el contenido con la sesión restaurada", () => {
    session.status = "authenticated";

    renderGate();

    expect(screen.getByText("Contenido privado")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
