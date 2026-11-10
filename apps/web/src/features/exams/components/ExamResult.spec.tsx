import type { ExamResult as ExamResultData, ExamResultItem } from "@codeai/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExamResult } from "./ExamResult";
import type { ExamResultApi } from "./ExamResult";

const SINGLE_OPTIONS = [
  { id: "a", text: "Amazon EC2" },
  { id: "b", text: "Amazon S3" },
  { id: "c", text: "Amazon RDS" },
];

const MULTIPLE_OPTIONS = [
  { id: "a", text: "Cifrado en reposo" },
  { id: "b", text: "Rotación de claves" },
  { id: "c", text: "Listas de control de acceso" },
];

const ORDERING_OPTIONS = [
  { id: "a", text: "Recolectar requisitos" },
  { id: "b", text: "Diseñar la arquitectura" },
  { id: "c", text: "Validar con pruebas" },
];

const MATCHING_LEFT = [
  { id: "a", text: "EC2" },
  { id: "b", text: "S3" },
];

const MATCHING_RIGHT = [
  { id: "1", text: "Cómputo" },
  { id: "2", text: "Almacenamiento" },
];

function resultItem(
  position: number,
  overrides: Partial<Omit<ExamResultItem, "position">> = {},
): ExamResultItem {
  return {
    position,
    domain: 1,
    statement: `Enunciado de la pregunta ${position}`,
    config: { options: SINGLE_OPTIONS },
    answer: null,
    flagged: false,
    correct: false,
    correctAnswer: { optionId: "a" },
    explanations: {},
    unitCode: "almacenamiento",
    ...overrides,
  };
}

/** Cuatro variantes de `config`, una acertada y una fallada por dominio. */
const ITEMS: ExamResultItem[] = [
  resultItem(1, {
    config: { options: SINGLE_OPTIONS },
    answer: { optionId: "b" },
    correct: true,
    correctAnswer: { optionId: "b" },
    unitCode: "almacenamiento",
  }),
  resultItem(2, {
    domain: 2,
    config: { kind: "multiple", selectCount: 2, options: MULTIPLE_OPTIONS },
    answer: { optionIds: ["a", "b"] },
    flagged: true,
    correctAnswer: { optionIds: ["a", "c"] },
    explanations: {
      a: "El cifrado en reposo protege los datos almacenados.",
      b: "La rotación de claves reduce el impacto de una filtración.",
      c: "Las listas de control de acceso filtran el tráfico.",
    },
    unitCode: "seguridad",
  }),
  resultItem(3, {
    domain: 3,
    config: { kind: "ordering", items: ORDERING_OPTIONS },
    answer: { order: ["c", "a", "b"] },
    correct: true,
    correctAnswer: { order: ["c", "a", "b"] },
    unitCode: "diseno",
  }),
  resultItem(4, {
    domain: 2,
    config: { kind: "matching", left: MATCHING_LEFT, right: MATCHING_RIGHT },
    answer: { pairs: { a: "1", b: "2" } },
    correctAnswer: { pairs: { a: "2", b: "1" } },
    explanations: {
      a: "EC2 ofrece servidores virtuales.",
      1: "El cómputo ejecuta el trabajo.",
      b: "S3 guarda objetos.",
      2: "El almacenamiento conserva los datos.",
    },
    unitCode: "servicios",
  }),
];

const RESULT: ExamResultData = {
  attemptId: "att_1",
  certification: "SAA-C03",
  mode: "form-a",
  domain: null,
  status: "submitted",
  orientative: false,
  startedAt: "2026-11-09T10:00:00.000Z",
  submittedAt: "2026-11-09T11:30:00.000Z",
  correctCount: 2,
  questionCount: 4,
  scorePct: 50,
  domains: [
    { domain: 1, name: "Conceptos de la nube", correct: 1, total: 1, pct: 100 },
    { domain: 2, name: "Seguridad y cumplimiento", correct: 0, total: 2, pct: 0 },
    { domain: 3, name: "Diseño de arquitecturas", correct: 1, total: 1, pct: 100 },
  ],
  items: ITEMS,
};

const SCORE_NOTE =
  "Porcentaje de aciertos. AWS usa una puntuación escalada que no publica; aquí no se imita.";

const ORIENTATIVE_MESSAGE =
  "Resultado orientativo: alguna pregunta aún no tiene revisión humana y no cuenta para «listo para presentar».";

function createApi(overrides: Partial<ExamResultData> = {}) {
  const data: ExamResultData = { ...RESULT, ...overrides };
  const result = vi.fn(
    (_attemptId: string): Promise<ExamResultData> => Promise.resolve(data),
  );

  const api: ExamResultApi = { result };

  return { api, result };
}

/** Pinta el informe y espera a que la carga termine. */
async function renderResult(overrides: Partial<ExamResultData> = {}) {
  const created = createApi(overrides);

  render(<ExamResult attemptId="att_1" api={created.api} />);

  await screen.findByRole("heading", { name: "Resultado del simulacro" });

  return created;
}

describe("ExamResult", () => {
  it("muestra el porcentaje global, el recuento de aciertos y la nota de puntuación", async () => {
    const { result } = await renderResult();

    expect(screen.getByText("50 %")).toBeInTheDocument();
    expect(screen.getByText("2 de 4 correctas")).toBeInTheDocument();
    expect(screen.getByText(SCORE_NOTE)).toBeInTheDocument();
    expect(result).toHaveBeenCalledWith("att_1");
  });

  it("avisa cuando el resultado es orientativo", async () => {
    await renderResult({ orientative: true });

    expect(screen.getByText(ORIENTATIVE_MESSAGE)).toBeInTheDocument();
  });

  it("avisa de la entrega automática al terminar el tiempo", async () => {
    await renderResult({ status: "expired" });

    expect(
      screen.getByText("Entregado automáticamente al terminar el tiempo"),
    ).toBeInTheDocument();
    expect(screen.queryByText(ORIENTATIVE_MESSAGE)).toBeNull();
  });

  it("marca en la tabla los dominios por debajo del 70 %", async () => {
    await renderResult();

    const table = screen.getByRole("table", { name: "Aciertos por dominio" });

    expect(within(table).getByRole("columnheader", { name: "%" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Aciertos" })).toBeInTheDocument();

    const below = within(table).getByRole("row", { name: /Seguridad y cumplimiento/ });

    expect(within(below).getByText("0 %")).toBeInTheDocument();
    expect(within(below).getByText("Por debajo del 70 %")).toBeInTheDocument();

    const above = within(table).getByRole("row", { name: /Conceptos de la nube/ });

    expect(within(above).queryByText("Por debajo del 70 %")).toBeNull();
  });

  it("avisa de que las preguntas falladas entraron al repaso", async () => {
    await renderResult();

    expect(
      screen.getByText(
        "Las preguntas falladas se añadieron a tu repaso con prioridad alta.",
      ),
    ).toBeInTheDocument();
  });

  it("el filtro «falladas» oculta las acertadas y «marcadas» deja solo las marcadas", async () => {
    await renderResult();

    expect(screen.getAllByRole("article")).toHaveLength(4);

    fireEvent.click(screen.getByRole("radio", { name: "Falladas" }));

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByRole("article", { name: "Pregunta 1" })).toBeNull();
    expect(screen.getByRole("article", { name: "Pregunta 2" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Pregunta 4" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Marcadas" }));

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("article", { name: "Pregunta 2" })).toBeInTheDocument();
  });

  it("enlaza cada pregunta con su unidad", async () => {
    await renderResult();

    const links = screen.getAllByRole("link", { name: "Repasar la unidad" });

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/learn/units/almacenamiento",
      "/learn/units/seguridad",
      "/learn/units/diseno",
      "/learn/units/servicios",
    ]);
  });

  it("muestra tu respuesta y la correcta con los textos de cada variante, nunca con los ids", async () => {
    await renderResult();

    const single = screen.getByRole("article", { name: "Pregunta 1" });

    expect(within(single).getAllByText("Amazon S3")).toHaveLength(2);
    expect(within(single).queryByText("Explicación de cada opción o elemento")).toBeNull();

    const multiple = screen.getByRole("article", { name: "Pregunta 2" });

    expect(
      within(multiple).getByText("Cifrado en reposo · Rotación de claves"),
    ).toBeInTheDocument();
    expect(
      within(multiple).getByText("Cifrado en reposo · Listas de control de acceso"),
    ).toBeInTheDocument();
    expect(
      within(multiple).getByText("La rotación de claves reduce el impacto de una filtración."),
    ).toBeInTheDocument();
    expect(within(multiple).queryByText(/^[a-f]$/)).toBeNull();

    const ordering = screen.getByRole("article", { name: "Pregunta 3" });

    expect(
      within(ordering).getAllByText(
        "Validar con pruebas · Recolectar requisitos · Diseñar la arquitectura",
      ),
    ).toHaveLength(2);

    const matching = screen.getByRole("article", { name: "Pregunta 4" });

    expect(
      within(matching).getByText("EC2 → Cómputo · S3 → Almacenamiento"),
    ).toBeInTheDocument();
    expect(
      within(matching).getByText("EC2 → Almacenamiento · S3 → Cómputo"),
    ).toBeInTheDocument();
    expect(within(matching).queryByText("2")).toBeNull();
  });
});

