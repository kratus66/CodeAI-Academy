import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

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
  id: "usr_1",
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

function fillForm(email: string, password: string): void {
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: password },
  });
}

describe("LoginForm", () => {
  it("muestra los mensajes de los esquemas compartidos sin llamar a la API", async () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("El correo es obligatorio"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("La contraseña es obligatoria"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("inicia sesión y publica el usuario en el estado de sesión", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: USER }));

    render(<LoginForm />);
    fillForm("ana@example.com", "S3gura!pass");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(mocks.setUser).toHaveBeenCalledWith(USER);
    });
    expect(mocks.push).toHaveBeenCalledWith("/");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("mantiene el mensaje único ante credenciales incorrectas", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Correo o contraseña incorrectos",
            traceId: "trace-401",
          },
        },
        { status: 401 },
      ),
    );

    render(<LoginForm />);
    fillForm("ana@example.com", "S3gura!pass");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El correo o la contraseña no son correctos.",
    );
    expect(mocks.setUser).not.toHaveBeenCalled();
  });

  it("pinta los detalles de validación de la API junto al campo", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Datos de entrada inválidos",
            details: [{ field: "email", message: "Debe ser un correo válido" }],
            traceId: "trace-400",
          },
        },
        { status: 400 },
      ),
    );

    render(<LoginForm />);
    fillForm("ana@example.com", "S3gura!pass");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Debe ser un correo válido")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
