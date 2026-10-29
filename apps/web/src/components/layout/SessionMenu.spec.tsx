import type { UserPublic } from "@codeai/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionMenu } from "./SessionMenu";

const session = vi.hoisted(() => ({
  user: null as UserPublic | null,
  status: "anonymous" as "loading" | "authenticated" | "anonymous",
  setUser: vi.fn(),
  signOut: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/features/auth/context/SessionProvider", () => ({
  useSession: () => session,
}));

const USER: UserPublic = {
  id: "usr_1",
  email: "ana@example.com",
  name: "Ana",
  role: "STUDENT",
  createdAt: "2026-10-26T14:30:00.000Z",
};

beforeEach(() => {
  session.user = null;
  session.status = "anonymous";
  session.signOut.mockResolvedValue(undefined);
});

afterEach(() => {
  session.signOut.mockReset();
});

describe("SessionMenu", () => {
  it("anuncia la restauración de la sesión", () => {
    session.status = "loading";

    render(<SessionMenu />);

    expect(screen.getByRole("status")).toHaveTextContent("Comprobando sesión…");
  });

  it("ofrece entrar o crear cuenta cuando no hay sesión", () => {
    render(<SessionMenu />);

    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: /crear cuenta/i }),
    ).toHaveAttribute("href", "/register");
  });

  it("muestra el nombre y el rol con la sesión iniciada", () => {
    session.status = "authenticated";
    session.user = { ...USER, role: "INSTRUCTOR" };

    render(<SessionMenu />);

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Instructor")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
    expect(screen.getByRole("link", { name: "Cohorte" })).toHaveAttribute(
      "href",
      "/instructor/cohort",
    );
  });

  it("no ofrece la cohorte a un estudiante", () => {
    session.status = "authenticated";
    session.user = USER;

    render(<SessionMenu />);

    expect(screen.queryByRole("link", { name: "Cohorte" })).toBeNull();
  });

  it("cierra la sesión desde la cabecera", async () => {
    session.status = "authenticated";
    session.user = USER;

    render(<SessionMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => {
      expect(session.signOut).toHaveBeenCalledTimes(1);
    });
  });
});
