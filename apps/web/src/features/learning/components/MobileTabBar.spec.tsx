import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileTabBar } from "./MobileTabBar";

const pathname = vi.hoisted(() => ({ value: "/learn" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

function bar(): HTMLElement {
  return screen.getByRole("navigation", { name: "Secciones de aprendizaje" });
}

function moreButton(): HTMLElement {
  return screen.getByRole("button", { name: "Más" });
}

describe("MobileTabBar", () => {
  beforeEach(() => {
    pathname.value = "/learn";
  });

  it("marca la sección actual con aria-current y deja el resto sin marcar", () => {
    pathname.value = "/learn/lab";
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "Laboratorio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Aprender" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("asigna a Aprender las rutas de lecciones y etapas", () => {
    pathname.value = "/learn/lessons/intro";
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "Aprender" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("esconde las secciones secundarias hasta abrir el panel «Más»", () => {
    render(<MobileTabBar />);

    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Entrevistas" }),
    ).not.toBeInTheDocument();

    fireEvent.click(moreButton());

    const panelId = moreButton().getAttribute("aria-controls");
    expect(moreButton()).toHaveAttribute("aria-expanded", "true");
    for (const label of ["Métricas", "Entrevistas", "Mi portafolio"]) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute("href")).toContain("/learn");
    }
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId as string)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a la portada" }),
    ).toBeInTheDocument();
  });

  it("lleva el foco al panel al abrirlo y lo devuelve al botón con Escape", () => {
    render(<MobileTabBar />);

    fireEvent.click(moreButton());

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Métricas" }),
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(moreButton());
  });

  it("cierra el panel al tocar fuera de la barra", () => {
    render(<MobileTabBar />);
    fireEvent.click(moreButton());

    fireEvent.pointerDown(document.body);

    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("marca «Más» cuando la ruta activa vive en el panel", () => {
    pathname.value = "/learn/interviews/sessions/1";
    render(<MobileTabBar />);

    expect(moreButton()).toHaveAttribute("aria-current", "page");

    fireEvent.click(moreButton());

    expect(screen.getByRole("link", { name: "Entrevistas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("cierra el panel al navegar a otra sección", () => {
    const view = render(<MobileTabBar />);
    fireEvent.click(moreButton());

    pathname.value = "/learn/review";
    view.rerender(<MobileTabBar />);

    expect(moreButton()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Mi portafolio" }),
    ).not.toBeInTheDocument();
  });

  it("solo se muestra en móvil y reserva la franja segura inferior", () => {
    render(<MobileTabBar />);

    expect(bar()).toHaveClass("fixed", "bottom-0", "md:hidden");
    expect(bar().className).toContain("env(safe-area-inset-bottom)");
    expect(bar()).toHaveAttribute("data-mobile-tab-bar");
  });
});
