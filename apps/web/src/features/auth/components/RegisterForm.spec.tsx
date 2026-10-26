import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterForm } from "./RegisterForm";

const mocks = vi.hoisted(() => ({
  setUser: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/auth/context/SessionProvider", () => ({
  useSession: () => ({
    user: null,
    status: "anonymous",
    setUser: mocks.setUser,
    signOut: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

const USER = {
  id: "usr_2",
  email: "ana@example.com",
  name: "Ana",
  role: "STUDENT",
  createdAt: "2026-10-26T14:30:00.000Z",
} as const;

const fetchMock =
  vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  mocks.setUser.mockReset();
  mocks.push.mockReset();
  mocks.refresh.mockReset();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function fillForm(name: string, email: string, password: string): void {
  fireEvent.change(screen.getByLabelText("Nombre"), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: password },
  });
}

describe("RegisterForm", () => {
  it("valida el alta con el esquema compartido antes de llamar a la API", async () => {
    render(<RegisterForm />);

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Mínimo 2 caracteres"),
    ).toBeInTheDocument();
    expect(screen.getByText("El correo es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("crea la cuenta y deja la sesión iniciada", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: USER }, { status: 201 }));

    render(<RegisterForm />);
    fillForm("Ana", "ana@example.com", "S3gura!pass");
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(mocks.setUser).toHaveBeenCalledWith(USER);
    });
    expect(mocks.push).toHaveBeenCalledWith("/");

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://localhost:3001/api/auth/register");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      name: "Ana",
      email: "ana@example.com",
      password: "S3gura!pass",
    });
  });

  it("explica que el correo ya está registrado", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "CONFLICT",
            message: "Ese correo ya está registrado",
            traceId: "trace-409",
          },
        },
        { status: 409 },
      ),
    );

    render(<RegisterForm />);
    fillForm("Ana", "ana@example.com", "S3gura!pass");
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ese correo ya está registrado. Inicia sesión en su lugar.",
    );
  });

  it("traduce el límite de registros con el tiempo de espera", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Demasiados intentos",
            traceId: "trace-429",
          },
        },
        { status: 429, headers: { "Retry-After": "899" } },
      ),
    );

    render(<RegisterForm />);
    fillForm("Ana", "ana@example.com", "S3gura!pass");
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Vuelve a probar en 15 min.",
    );
  });
});
