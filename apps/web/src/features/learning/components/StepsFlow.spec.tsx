import { fireEvent, render, screen } from "@testing-library/react";
import type { LessonStep } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { StepsFlow } from "./StepsFlow";

const STEPS = [
  {
    kind: "objective",
    title: "Qué vas a lograr",
    body: "Distinguir IA de automatización.",
  },
  {
    kind: "explanation",
    title: "De dónde viene la idea",
    body: "El término nace en 1956.",
  },
  {
    kind: "guided_practice",
    title: "Clasifica conmigo",
    body: "Recorremos tres casos juntos.",
  },
  {
    kind: "independent_practice",
    title: "Clasifica por tu cuenta",
    body: "Cinco casos, sin ayuda.",
  },
  {
    kind: "debug",
    title: "Encuentra el error",
    body: "Un caso está mal clasificado.",
  },
  {
    kind: "assessment",
    title: "Comprueba tu criterio",
    body: "Responde tres preguntas.",
  },
  {
    kind: "transfer",
    title: "Llévalo a tu entorno",
    body: "Busca un sistema de tu día a día.",
  },
] as const satisfies readonly LessonStep[];

describe("StepsFlow", () => {
  it("muestra un paso a la vez con su posición y su nombre", () => {
    render(<StepsFlow steps={STEPS} />);

    expect(screen.getByText("1 / 7")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Qué vas a lograr" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Objetivo")).toBeInTheDocument();
    expect(screen.queryByText("De dónde viene la idea")).toBeNull();
  });

  it("avanza y retrocede llevando el foco al paso nuevo", () => {
    render(<StepsFlow steps={STEPS} />);

    const anterior = screen.getByRole("button", { name: "Anterior" });
    expect(anterior).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("2 / 7")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "De dónde viene la idea" }),
    ).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));

    expect(screen.getByText("1 / 7")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Qué vas a lograr" }),
    ).toHaveFocus();
  });

  it("marca como vistos los pasos ya recorridos", () => {
    render(<StepsFlow steps={STEPS} />);

    expect(screen.getByText("1 de 7 vistos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("3 de 7 vistos")).toBeInTheDocument();
    expect(screen.getByText("Paso 3: Práctica guiada, visto")).toBeInTheDocument();
    expect(
      screen.getByText("Paso 4: Práctica autónoma, pendiente"),
    ).toBeInTheDocument();
  });

  it("señala el paso actual con aria-current y cierra el recorrido en el último", () => {
    render(<StepsFlow steps={STEPS} />);

    expect(screen.getAllByRole("listitem")[0]).toHaveAttribute(
      "aria-current",
      "step",
    );

    for (let position = 1; position < STEPS.length; position += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    }

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(items[6]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(screen.getByText("7 / 7")).toBeInTheDocument();
    expect(screen.getByText("7 de 7 vistos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
});
