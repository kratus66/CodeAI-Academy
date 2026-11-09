import type { QuizGradeResult, QuizSubmissionInput } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import type { QuizGrading } from "./quiz-grading";
import {
  gradeQuizAnswer,
  INCOMPLETE_ORDER,
  INCOMPLETE_PAIRS,
  incompleteSelection,
  UNKNOWN_ITEM,
  UNKNOWN_OPTION,
  WRONG_ANSWER_SHAPE,
} from "./quiz-grading";

/** Las tres variantes nuevas declaran `kind` en `config` y en `solution`; el `single`, no. */
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

const ORDERING_FOUR = {
  config: {
    kind: "ordering",
    items: [
      { id: "a", text: "Uno" },
      { id: "b", text: "Dos" },
      { id: "c", text: "Tres" },
      { id: "d", text: "Cuatro" },
    ],
  },
  solution: {
    kind: "ordering",
    correctOrder: ["d", "c", "b", "a"],
    explanations: { a: "Va cuarto.", b: "Va tercero.", c: "Va segundo.", d: "Va primero." },
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

function graded(grading: QuizGrading): {
  readonly result: QuizGradeResult;
  readonly submissionCode: string;
} {
  if (grading.status !== "graded") {
    throw new Error(`Se esperaba una corrección y llegó «${grading.status}»`);
  }

  return { result: grading.result, submissionCode: grading.submissionCode };
}

function invalidMessage(grading: QuizGrading): string {
  if (grading.status !== "invalid-answer") {
    throw new Error(`Se esperaba una respuesta inválida y llegó «${grading.status}»`);
  }

  return grading.message;
}

describe("mensajes del contrato", () => {
  it("fija los textos literales de S14-T7a", () => {
    expect(UNKNOWN_OPTION).toBe("La opción no existe en este quiz");
    expect(WRONG_ANSWER_SHAPE).toBe("La respuesta no corresponde al tipo de pregunta");
    expect(UNKNOWN_ITEM).toBe("El elemento no existe en esta pregunta");
    expect(incompleteSelection(2)).toBe("Selecciona exactamente 2 opciones");
    expect(INCOMPLETE_ORDER).toBe("Ordena todos los elementos, sin repetir ninguno");
    expect(INCOMPLETE_PAIRS).toBe("Empareja cada elemento con una opción distinta");
  });
});

describe("gradeQuizAnswer — single", () => {
  it("un config sin kind se corrige como siempre, con kind en el resultado", () => {
    const { result, submissionCode } = graded(gradeQuizAnswer(SINGLE, { optionId: "b" }));

    expect(submissionCode).toBe("b");
    expect(result).toEqual({
      kind: "single",
      correct: true,
      correctOptionId: "b",
      explanation: "Sí: el array guarda los elementos en orden.",
      correctExplanation: "Sí: el array guarda los elementos en orden.",
    });
  });

  it("fallar devuelve la explicación de la elegida y la de la correcta", () => {
    const { result, submissionCode } = graded(gradeQuizAnswer(SINGLE, { optionId: "c" }));

    expect(submissionCode).toBe("c");
    expect(result).toEqual({
      kind: "single",
      correct: false,
      correctOptionId: "b",
      explanation: "No: el mapa guarda pares clave-valor.",
      correctExplanation: "Sí: el array guarda los elementos en orden.",
    });
  });

  it("rechaza una opción que no existe", () => {
    expect(invalidMessage(gradeQuizAnswer(SINGLE, { optionId: "d" }))).toBe(
      "La opción no existe en este quiz",
    );
  });

  it("rechaza la forma de otra variante", () => {
    expect(invalidMessage(gradeQuizAnswer(SINGLE, { optionIds: ["a", "b"] }))).toBe(
      "La respuesta no corresponde al tipo de pregunta",
    );
  });
});

describe("gradeQuizAnswer — multiple", () => {
  it("elegir las dos correctas acierta y guarda los ids ordenados", () => {
    const { result, submissionCode } = graded(
      gradeQuizAnswer(MULTIPLE, { optionIds: ["b", "a"] }),
    );

    expect(submissionCode).toBe("a,b");
    expect(result).toEqual({
      kind: "multiple",
      correct: true,
      correctOptionIds: ["a", "b"],
      selectedOptionIds: ["b", "a"],
      explanations: {
        a: "Sí: repetir la petición no cambia el resultado.",
        b: "Sí: un reintento no duplica el efecto.",
      },
    });
  });

  it("una correcta y una incorrecta falla: el acierto es todo o nada", () => {
    const { result, submissionCode } = graded(
      gradeQuizAnswer(MULTIPLE, { optionIds: ["a", "c"] }),
    );

    expect(submissionCode).toBe("a,c");
    expect(result).toEqual({
      kind: "multiple",
      correct: false,
      correctOptionIds: ["a", "b"],
      selectedOptionIds: ["a", "c"],
      explanations: {
        a: "Sí: repetir la petición no cambia el resultado.",
        b: "Sí: un reintento no duplica el efecto.",
        c: "No: el estado no es un requisito.",
      },
    });
  });

  it("rechaza una selección incompleta con el número exigido", () => {
    expect(invalidMessage(gradeQuizAnswer(MULTIPLE, { optionIds: ["a"] }))).toBe(
      "Selecciona exactamente 2 opciones",
    );
  });

  it("rechaza tres opciones cuando hay que elegir dos", () => {
    expect(invalidMessage(gradeQuizAnswer(MULTIPLE, { optionIds: ["a", "b", "c"] }))).toBe(
      "Selecciona exactamente 2 opciones",
    );
  });

  it("rechaza una opción que no existe en el quiz", () => {
    expect(invalidMessage(gradeQuizAnswer(MULTIPLE, { optionIds: ["a", "f"] }))).toBe(
      "La opción no existe en este quiz",
    );
  });

  it("rechaza la forma de otra variante", () => {
    expect(invalidMessage(gradeQuizAnswer(MULTIPLE, { optionId: "a" }))).toBe(
      "La respuesta no corresponde al tipo de pregunta",
    );
  });
});

describe("gradeQuizAnswer — ordering", () => {
  it("acertar el orden devuelve la secuencia y el código con «>»", () => {
    const { result, submissionCode } = graded(
      gradeQuizAnswer(ORDERING, { order: ["c", "a", "b"] }),
    );

    expect(submissionCode).toBe("c>a>b");
    expect(result).toEqual({
      kind: "ordering",
      correct: true,
      correctOrder: ["c", "a", "b"],
      explanations: {
        a: "Antes hay que recibir la petición.",
        b: "Guardar es el último paso.",
        c: "Recibir la petición va primero.",
      },
    });
  });

  it("un orden distinto falla y conserva el orden correcto", () => {
    const { result, submissionCode } = graded(
      gradeQuizAnswer(ORDERING, { order: ["a", "c", "b"] }),
    );

    expect(submissionCode).toBe("a>c>b");
    expect(result).toEqual({
      kind: "ordering",
      correct: false,
      correctOrder: ["c", "a", "b"],
      explanations: {
        a: "Antes hay que recibir la petición.",
        b: "Guardar es el último paso.",
        c: "Recibir la petición va primero.",
      },
    });
  });

  it("rechaza un orden al que le falta un elemento", () => {
    expect(invalidMessage(gradeQuizAnswer(ORDERING_FOUR, { order: ["d", "c", "b"] }))).toBe(
      "Ordena todos los elementos, sin repetir ninguno",
    );
  });

  it("un id inexistente se informa como elemento desconocido", () => {
    expect(invalidMessage(gradeQuizAnswer(ORDERING, { order: ["a", "b", "e"] }))).toBe(
      "El elemento no existe en esta pregunta",
    );
  });

  it("rechaza la forma de otra variante", () => {
    expect(invalidMessage(gradeQuizAnswer(ORDERING, { pairs: { a: "1" } }))).toBe(
      "La respuesta no corresponde al tipo de pregunta",
    );
  });
});

describe("gradeQuizAnswer — matching", () => {
  it("acertar todas las parejas devuelve el código ordenado por clave", () => {
    const { result, submissionCode } = graded(
      gradeQuizAnswer(MATCHING, { pairs: { c: "3", a: "2", b: "1" } }),
    );

    expect(submissionCode).toBe("a=2,b=1,c=3");
    expect(result).toEqual({
      kind: "matching",
      correct: true,
      correctPairs: { a: "2", b: "1", c: "3" },
      explanations: {
        a: "TCP es de la capa de transporte.",
        b: "HTTP es de aplicación.",
        c: "DNS resuelve nombres.",
      },
    });
  });

  it("una pareja equivocada falla: el acierto es todo o nada", () => {
    const { result } = graded(
      gradeQuizAnswer(MATCHING, { pairs: { a: "1", b: "2", c: "3" } }),
    );

    expect(result).toEqual({
      kind: "matching",
      correct: false,
      correctPairs: { a: "2", b: "1", c: "3" },
      explanations: {
        a: "TCP es de la capa de transporte.",
        b: "HTTP es de aplicación.",
        c: "DNS resuelve nombres.",
      },
    });
  });

  it("rechaza una respuesta a la que le falta una pareja", () => {
    expect(invalidMessage(gradeQuizAnswer(MATCHING, { pairs: { a: "2", b: "1" } }))).toBe(
      "Empareja cada elemento con una opción distinta",
    );
  });

  it("rechaza dos elementos emparejados con la misma opción", () => {
    expect(
      invalidMessage(gradeQuizAnswer(MATCHING, { pairs: { a: "2", b: "2", c: "3" } })),
    ).toBe("Empareja cada elemento con una opción distinta");
  });

  it("rechaza una clave que no es de la izquierda", () => {
    expect(
      invalidMessage(gradeQuizAnswer(MATCHING, { pairs: { a: "2", b: "1", d: "3" } })),
    ).toBe("El elemento no existe en esta pregunta");
  });

  it("rechaza una opción que no es de la derecha", () => {
    expect(
      invalidMessage(gradeQuizAnswer(MATCHING, { pairs: { a: "2", b: "1", c: "4" } })),
    ).toBe("El elemento no existe en esta pregunta");
  });

  it("rechaza la forma de otra variante", () => {
    expect(invalidMessage(gradeQuizAnswer(MATCHING, { order: ["a", "b", "c"] }))).toBe(
      "La respuesta no corresponde al tipo de pregunta",
    );
  });
});

const SINGLE_ANSWER: QuizSubmissionInput = { optionId: "b" };

describe("gradeQuizAnswer — contenido roto", () => {
  it("sin config o sin solution no hay nada que corregir", () => {
    expect(gradeQuizAnswer({ config: null, solution: SINGLE.solution }, SINGLE_ANSWER)).toEqual({
      status: "broken-content",
    });
    expect(gradeQuizAnswer({ config: SINGLE.config, solution: {} }, SINGLE_ANSWER)).toEqual({
      status: "broken-content",
    });
    expect(gradeQuizAnswer({ config: undefined, solution: 42 }, SINGLE_ANSWER)).toEqual({
      status: "broken-content",
    });
  });

  it("un kind que no es de las cuatro variantes", () => {
    expect(
      gradeQuizAnswer(
        { config: { kind: "audit", options: [] }, solution: SINGLE.solution },
        SINGLE_ANSWER,
      ),
    ).toEqual({ status: "broken-content" });
  });

  it("single: la correcta fuera de las opciones o una explicación que falta", () => {
    expect(
      gradeQuizAnswer(
        {
          config: SINGLE.config,
          solution: { correctOptionId: "d", explanations: SINGLE.solution.explanations },
        },
        SINGLE_ANSWER,
      ),
    ).toEqual({ status: "broken-content" });

    expect(
      gradeQuizAnswer(
        {
          config: SINGLE.config,
          solution: { correctOptionId: "b", explanations: { a: "solo la a" } },
        },
        SINGLE_ANSWER,
      ),
    ).toEqual({ status: "broken-content" });
  });

  it("multiple: selectCount distinto de las correctas o una correcta inexistente", () => {
    expect(
      gradeQuizAnswer(
        {
          config: { ...MULTIPLE.config, selectCount: 3 },
          solution: MULTIPLE.solution,
        },
        { optionIds: ["a", "b"] },
      ),
    ).toEqual({ status: "broken-content" });

    expect(
      gradeQuizAnswer(
        {
          config: MULTIPLE.config,
          solution: { ...MULTIPLE.solution, correctOptionIds: ["a", "e"] },
        },
        { optionIds: ["a", "b"] },
      ),
    ).toEqual({ status: "broken-content" });
  });

  it("los dos kind no coinciden", () => {
    expect(
      gradeQuizAnswer({ config: MULTIPLE.config, solution: SINGLE.solution }, SINGLE_ANSWER),
    ).toEqual({ status: "broken-content" });
  });

  it("ordering: correctOrder incompleto o menos de tres elementos", () => {
    expect(
      gradeQuizAnswer(
        { config: ORDERING.config, solution: { ...ORDERING.solution, correctOrder: ["c", "a"] } },
        { order: ["c", "a", "b"] },
      ),
    ).toEqual({ status: "broken-content" });

    expect(
      gradeQuizAnswer(
        {
          config: { kind: "ordering", items: [{ id: "a" }, { id: "b" }] },
          solution: { kind: "ordering", correctOrder: ["b", "a"], explanations: { a: "A", b: "B" } },
        },
        { order: ["b", "a", "a"] },
      ),
    ).toEqual({ status: "broken-content" });
  });

  it("matching: parejas incompletas, repetidas o con una opción inexistente", () => {
    const broken = (correctPairs: Record<string, string>) =>
      gradeQuizAnswer(
        { config: MATCHING.config, solution: { ...MATCHING.solution, correctPairs } },
        { pairs: { a: "2", b: "1", c: "3" } },
      );

    expect(broken({ a: "2", b: "1" })).toEqual({ status: "broken-content" });
    expect(broken({ a: "2", b: "2", c: "1" })).toEqual({ status: "broken-content" });
    expect(broken({ a: "2", b: "1", c: "4" })).toEqual({ status: "broken-content" });
  });
});

describe("gradeQuizAnswer — contrato del corrector", () => {
  it("no lanza con contenido arbitrario", () => {
    expect(() => gradeQuizAnswer({ config: "texto", solution: [1, 2] }, {})).not.toThrow();
    expect(gradeQuizAnswer({ config: "texto", solution: [1, 2] }, {})).toEqual({
      status: "broken-content",
    });
  });

  it("el contenido roto manda sobre la forma de la respuesta", () => {
    expect(
      gradeQuizAnswer({ config: null, solution: null }, { optionIds: ["a", "b"] }),
    ).toEqual({ status: "broken-content" });
  });
});
