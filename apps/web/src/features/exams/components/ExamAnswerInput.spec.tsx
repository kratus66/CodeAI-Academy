import type { QuizSubmissionInput } from "@codeai/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ExamAnswerInput } from "./ExamAnswerInput";

const STATEMENT = "¿Qué servicio almacena objetos de forma duradera?";

const SINGLE_CONFIG = {
  options: [
    { id: "a", text: "Amazon EC2" },
    { id: "b", text: "Amazon S3" },
    { id: "c", text: "Amazon RDS" },
  ],
};

const MULTIPLE_CONFIG = {
  kind: "multiple",
  selectCount: 2,
  options: [
    { id: "a", text: "Amazon EC2" },
    { id: "b", text: "AWS Lambda" },
    { id: "c", text: "Amazon S3" },
    { id: "d", text: "Amazon RDS" },
    { id: "e", text: "Amazon SQS" },
  ],
};

const ORDERING_CONFIG = {
  kind: "ordering",
  items: [
    { id: "a", text: "Crear el bucket" },
    { id: "b", text: "Subir el objeto" },
    { id: "c", text: "Aplicar la política" },
  ],
};

const MATCHING_CONFIG = {
  kind: "matching",
  left: [
    { id: "a", text: "Amazon S3" },
    { id: "b", text: "Amazon RDS" },
    { id: "c", text: "Amazon SQS" },
  ],
  right: [
    { id: "1", text: "Objetos" },
    { id: "2", text: "Bases de datos relacionales" },
    { id: "3", text: "Colas de mensajes" },
  ],
};

function renderInput(
  config: Record<string, unknown>,
  value: QuizSubmissionInput | null = null,
) {
  const onChange = vi.fn();

  render(
    <ExamAnswerInput
      config={config}
      statement={STATEMENT}
      value={value}
      onChange={onChange}
    />,
  );

  return onChange;
}

interface StatefulInputProps {
  readonly config: Record<string, unknown>;
  readonly onChange: (next: QuizSubmissionInput | null) => void;
  readonly initialValue?: QuizSubmissionInput | null;
}

/** La sala guarda lo que anuncia el control; aquí se imita con `useState`. */
function StatefulInput({ config, onChange, initialValue = null }: StatefulInputProps) {
  const [value, setValue] = useState<QuizSubmissionInput | null>(initialValue);

  return (
    <ExamAnswerInput
      config={config}
      statement={STATEMENT}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function renderStateful(
  config: Record<string, unknown>,
  initialValue: QuizSubmissionInput | null = null,
) {
  const onChange = vi.fn();

  render(<StatefulInput config={config} onChange={onChange} initialValue={initialValue} />);

  return onChange;
}

function radioOf(text: string): HTMLElement {
  return screen.getByRole("radio", { name: new RegExp(text) });
}

function checkboxOf(text: string): HTMLElement {
  return screen.getByRole("checkbox", { name: new RegExp(text) });
}

function selectOf(text: string): HTMLSelectElement {
  return screen.getByLabelText(`Pareja de ${text}`);
}

function choose(text: string, value: string): void {
  fireEvent.change(selectOf(text), { target: { value } });
}

function expectNoCorrection(): void {
  expect(screen.queryByRole("button", { name: "Comprobar" })).not.toBeInTheDocument();
  expect(screen.queryByText(/¡Correcto!/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Todavía no/)).not.toBeInTheDocument();
}

describe("ExamAnswerInput — respuesta única", () => {
  it("anuncia la opción elegida sin corregirla", () => {
    const onChange = renderStateful(SINGLE_CONFIG);

    expect(screen.getAllByRole("radio")).toHaveLength(3);

    fireEvent.click(radioOf("Amazon S3"));

    expect(onChange).toHaveBeenCalledWith({ optionId: "b" });
    expect(radioOf("Amazon S3")).toBeChecked();
    expectNoCorrection();
  });

  it("pinta como respuesta única un config sin kind", () => {
    renderInput(SINGLE_CONFIG);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("deshabilita todos los controles cuando la sala lo pide", () => {
    render(
      <ExamAnswerInput
        config={SINGLE_CONFIG}
        statement={STATEMENT}
        value={null}
        onChange={vi.fn()}
        disabled
      />,
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});

describe("ExamAnswerInput — respuesta múltiple", () => {
  it("anuncia null hasta juntar selectCount y luego la respuesta completa", () => {
    const onChange = renderStateful(MULTIPLE_CONFIG);

    expect(screen.getByText("Selecciona DOS")).toBeInTheDocument();

    fireEvent.click(checkboxOf("Amazon EC2"));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(checkboxOf("Amazon EC2")).toBeChecked();

    fireEvent.click(checkboxOf("AWS Lambda"));

    expect(onChange).toHaveBeenLastCalledWith({ optionIds: ["a", "b"] });
    expect(checkboxOf("Amazon EC2")).toBeChecked();
    expect(checkboxOf("AWS Lambda")).toBeChecked();
    expect(checkboxOf("Amazon RDS")).toBeDisabled();
    expectNoCorrection();
  });

  it("vuelve a null al desmarcar una casilla", () => {
    const onChange = renderStateful(MULTIPLE_CONFIG);

    fireEvent.click(checkboxOf("Amazon EC2"));
    fireEvent.click(checkboxOf("AWS Lambda"));
    fireEvent.click(checkboxOf("AWS Lambda"));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(checkboxOf("AWS Lambda")).not.toBeChecked();
    expect(checkboxOf("Amazon RDS")).toBeEnabled();
  });

  it("refleja las casillas de una respuesta guardada", () => {
    renderInput(MULTIPLE_CONFIG, { optionIds: ["b", "e"] });

    expect(checkboxOf("AWS Lambda")).toBeChecked();
    expect(checkboxOf("Amazon SQS")).toBeChecked();
    expect(checkboxOf("Amazon EC2")).not.toBeChecked();
    expect(checkboxOf("Amazon EC2")).toBeDisabled();
  });
});

describe("ExamAnswerInput — ordenar", () => {
  it("mueve con «Subir» y «Bajar» y anuncia el orden nuevo", () => {
    const onChange = renderStateful(ORDERING_CONFIG);

    expect(screen.getByRole("button", { name: "Subir: Crear el bucket" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar: Aplicar la política" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Subir: Subir el objeto" }));

    expect(onChange).toHaveBeenLastCalledWith({ order: ["b", "a", "c"] });
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Subir el objeto");
    expect(screen.getByRole("button", { name: "Bajar: Subir el objeto" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Bajar: Subir el objeto" }));

    expect(onChange).toHaveBeenLastCalledWith({ order: ["a", "b", "c"] });
    expectNoCorrection();
  });

  it("refleja el orden de una respuesta guardada", () => {
    renderInput(ORDERING_CONFIG, { order: ["c", "a", "b"] });

    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Aplicar la política");
    expect(screen.getByRole("button", { name: "Subir: Aplicar la política" })).toBeDisabled();
  });
});

describe("ExamAnswerInput — emparejar", () => {
  it("anuncia null mientras falte una fila y luego las parejas", () => {
    const onChange = renderStateful(MATCHING_CONFIG);

    choose("Amazon S3", "2");

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(selectOf("Amazon S3")).toHaveValue("2");
    expect(
      within(selectOf("Amazon RDS")).getByRole("option", {
        name: "Bases de datos relacionales",
      }),
    ).toBeDisabled();

    choose("Amazon RDS", "1");

    expect(onChange).toHaveBeenLastCalledWith(null);

    choose("Amazon SQS", "3");

    expect(onChange).toHaveBeenLastCalledWith({ pairs: { a: "2", b: "1", c: "3" } });
    expectNoCorrection();
  });

  it("refleja las parejas de una respuesta guardada", () => {
    renderInput(MATCHING_CONFIG, { pairs: { a: "2", b: "1", c: "3" } });

    expect(selectOf("Amazon S3")).toHaveValue("2");
    expect(selectOf("Amazon RDS")).toHaveValue("1");
    expect(selectOf("Amazon SQS")).toHaveValue("3");
  });
});

describe("ExamAnswerInput — config que no se puede pintar", () => {
  it("avisa de un kind que la sala todavía no soporta", () => {
    renderInput({ kind: "hotspot", options: SINGLE_CONFIG.options });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este tipo de pregunta todavía no está disponible.",
    );
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("avisa cuando la variante llega incompleta", () => {
    renderInput({ kind: "matching", left: MATCHING_CONFIG.left, right: [] });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este tipo de pregunta todavía no está disponible.",
    );
  });
});

