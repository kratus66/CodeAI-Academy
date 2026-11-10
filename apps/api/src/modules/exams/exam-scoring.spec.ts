import { CERTIFICATION_REGISTRY, type QuizSubmissionInput } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { readQuizContent, type QuizContent } from "../exercises/quiz-grading";
import { correctAnswerOf, scoreAttempt, type AttemptScoring, type ScoringItem } from "./exam-scoring";

const CLF_C02 = CERTIFICATION_REGISTRY["CLF-C02"];

const SINGLE = {
  config: {
    options: [
      { id: "a", text: "Una lista enlazada" },
      { id: "b", text: "Un array" },
      { id: "c", text: "Un mapa" },
    ],
  },
  solution: {
    correctOptionId: "b",
    explanations: {
      a: "No: la lista enlazada no indexa por posición.",
      b: "Sí: el array guarda los elementos en orden.",
      c: "No: el mapa guarda pares clave-valor.",
    },
  },
};

const MULTIPLE = {
  config: {
    kind: "multiple",
    selectCount: 2,
    options: [
      { id: "a", text: "Idempotente" },
      { id: "b", text: "Seguro ante reintentos" },
      { id: "c", text: "Sin estado" },
      { id: "d", text: "Síncrono" },
    ],
  },
  solution: {
    kind: "multiple",
    correctOptionIds: ["a", "b"],
    explanations: {
      a: "Sí: repetir la petición no cambia el resultado.",
      b: "Sí: un reintento no duplica el efecto.",
      c: "No: el estado no es un requisito.",
      d: "No: la sincronía no tiene que ver.",
    },
  },
};

const ORDERING = {
  config: {
    kind: "ordering",
    items: [
      { id: "a", text: "Validar el cuerpo" },
      { id: "b", text: "Guardar en la base" },
      { id: "c", text: "Recibir la petición" },
    ],
  },
  solution: {
    kind: "ordering",
    correctOrder: ["c", "a", "b"],
    explanations: {
      a: "Antes hay que recibir la petición.",
      b: "Guardar es el último paso.",
      c: "Recibir la petición va primero.",
    },
  },
};

const MATCHING = {
  config: {
    kind: "matching",
    left: [
      { id: "a", text: "Capa de transporte" },
      { id: "b", text: "Capa de aplicación" },
      { id: "c", text: "Resolución de nombres" },
    ],
    right: [
      { id: "1", text: "HTTP" },
      { id: "2", text: "TCP" },
      { id: "3", text: "DNS" },
    ],
  },
  solution: {
    kind: "matching",
    correctPairs: { a: "2", b: "1", c: "3" },
    explanations: {
      a: "TCP es de la capa de transporte.",
      b: "HTTP es de aplicación.",
      c: "DNS resuelve nombres.",
    },
  },
};

const SINGLE_OK: QuizSubmissionInput = { optionId: "b" };
const SINGLE_KO: QuizSubmissionInput = { optionId: "a" };
const MULTIPLE_OK: QuizSubmissionInput = { optionIds: ["a", "b"] };
const MULTIPLE_PARTIAL: QuizSubmissionInput = { optionIds: ["a"] };
const MULTIPLE_MIXED: QuizSubmissionInput = { optionIds: ["a", "c"] };
const ORDERING_OK: QuizSubmissionInput = { order: ["c", "a", "b"] };
const ORDERING_KO: QuizSubmissionInput = { order: ["a", "c", "b"] };
const MATCHING_OK: QuizSubmissionInput = { pairs: { a: "2", b: "1", c: "3" } };
const MATCHING_KO: QuizSubmissionInput = { pairs: { a: "3", b: "1", c: "2" } };

function item(
  position: number,
  domain: number,
  exercise: { readonly config: unknown; readonly solution: unknown },
  answer: QuizSubmissionInput | null,
): ScoringItem {
  return { position, domain, exercise, answer };
}

function scored(result: AttemptScoring): Extract<AttemptScoring, { status: "scored" }> {
  if (result.status !== "scored") {
    throw new Error(`Se esperaba una puntuación y llegó «${result.status}»`);
  }

  return result;
}

function contentOf(exercise: { readonly config: unknown; readonly solution: unknown }): QuizContent {
  const quiz = readQuizContent(exercise.config, exercise.solution);

  if (quiz === null) {
    throw new Error("La prueba esperaba un contenido legible");
  }

  return quiz;
}

function domainName(id: number): string {
  return CLF_C02.domains.find((domain) => domain.id === id)?.name ?? "";
}

describe("scoreAttempt — acierto, fallo y pregunta en blanco", () => {
  it("corrige las tres situaciones en cada una de las cuatro variantes", () => {
    const result = scored(
      scoreAttempt(
        [
          item(1, 1, SINGLE, SINGLE_OK),
          item(2, 1, SINGLE, SINGLE_KO),
          item(3, 1, SINGLE, null),
          item(4, 2, MULTIPLE, MULTIPLE_OK),
          item(5, 2, MULTIPLE, MULTIPLE_MIXED),
          item(6, 2, MULTIPLE, null),
          item(7, 3, ORDERING, ORDERING_OK),
          item(8, 3, ORDERING, ORDERING_KO),
          item(9, 3, ORDERING, null),
          item(10, 3, MATCHING, MATCHING_OK),
          item(11, 3, MATCHING, MATCHING_KO),
          item(12, 3, MATCHING, null),
        ],
        CLF_C02.domains,
      ),
    );

    expect(result.items.map((entry) => entry.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(result.items.map((entry) => entry.correct)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(result.correctCount).toBe(4);
    expect(result.scorePct).toBe(33);
  });

  it("revela la respuesta correcta y las explicaciones de cada pregunta", () => {
    const result = scored(
      scoreAttempt(
        [item(1, 1, SINGLE, null), item(2, 1, ORDERING, null), item(3, 1, MATCHING, null)],
        CLF_C02.domains,
      ),
    );

    expect(result.items.map((entry) => entry.correctAnswer)).toEqual([
      { optionId: "b" },
      { order: ["c", "a", "b"] },
      { pairs: { a: "2", b: "1", c: "3" } },
    ]);
    expect(result.items.map((entry) => entry.explanations)).toEqual([
      SINGLE.solution.explanations,
      ORDERING.solution.explanations,
      MATCHING.solution.explanations,
    ]);
  });
});

describe("scoreAttempt — respuesta múltiple", () => {
  it("una sola de las dos correctas cuenta como fallo", () => {
    const result = scored(
      scoreAttempt(
        [item(1, 1, MULTIPLE, MULTIPLE_PARTIAL), item(2, 1, MULTIPLE, MULTIPLE_MIXED)],
        CLF_C02.domains,
      ),
    );

    expect(result.items.map((entry) => entry.correct)).toEqual([false, false]);
    expect(result.correctCount).toBe(0);
    expect(result.scorePct).toBe(0);
  });
});

describe("scoreAttempt — desglose por dominio", () => {
  it("da los porcentajes por dominio y el global de un intento de tres dominios", () => {
    const result = scored(
      scoreAttempt(
        [
          item(1, 1, SINGLE, SINGLE_OK),
          item(2, 2, ORDERING, ORDERING_OK),
          item(3, 3, SINGLE, SINGLE_KO),
        ],
        CLF_C02.domains,
      ),
    );

    expect(result.correctCount).toBe(2);
    expect(result.scorePct).toBe(67);
    expect(result.domains).toEqual([
      { domain: 1, name: domainName(1), correct: 1, total: 1, pct: 100 },
      { domain: 2, name: domainName(2), correct: 1, total: 1, pct: 100 },
      { domain: 3, name: domainName(3), correct: 0, total: 1, pct: 0 },
    ]);
  });

  it("solo incluye los dominios con preguntas y los ordena por id", () => {
    const result = scored(
      scoreAttempt(
        [
          item(1, 3, SINGLE, SINGLE_KO),
          item(2, 1, SINGLE, SINGLE_OK),
          item(3, 3, ORDERING, ORDERING_OK),
        ],
        CLF_C02.domains,
      ),
    );

    expect(result.domains.map((entry) => entry.domain)).toEqual([1, 3]);
    expect(result.domains.map((entry) => entry.total)).toEqual([1, 2]);
    expect(result.domains.map((entry) => entry.pct)).toEqual([100, 50]);
  });

  it("un intento sin preguntas no divide por cero", () => {
    expect(scoreAttempt([], CLF_C02.domains)).toEqual({
      status: "scored",
      correctCount: 0,
      scorePct: 0,
      domains: [],
      items: [],
    });
  });
});

describe("scoreAttempt — contenido roto", () => {
  it("devuelve la posición de la primera pregunta con la solución rota", () => {
    const result = scoreAttempt(
      [
        item(1, 1, SINGLE, SINGLE_OK),
        item(2, 2, { config: SINGLE.config, solution: { correctOptionId: "d" } }, SINGLE_OK),
        item(3, 3, SINGLE, SINGLE_KO),
      ],
      CLF_C02.domains,
    );

    expect(result).toEqual({ status: "broken-content", position: 2 });
  });
});

describe("correctAnswerOf", () => {
  it("devuelve la forma de cuerpo de cada variante", () => {
    expect(correctAnswerOf(contentOf(SINGLE))).toEqual({ optionId: "b" });
    expect(correctAnswerOf(contentOf(MULTIPLE))).toEqual({ optionIds: ["a", "b"] });
    expect(correctAnswerOf(contentOf(ORDERING))).toEqual({ order: ["c", "a", "b"] });
    expect(correctAnswerOf(contentOf(MATCHING))).toEqual({ pairs: { a: "2", b: "1", c: "3" } });
  });
});
