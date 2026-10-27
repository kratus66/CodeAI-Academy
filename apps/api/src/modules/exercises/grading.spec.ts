import { describe, expect, it } from "vitest";

import type { GradingTestInput } from "./grading";
import { gradeSubmission } from "./grading";

function test(passed: boolean, overrides: Partial<GradingTestInput> = {}): GradingTestInput {
  return {
    testId: overrides.testId ?? "t1",
    name: overrides.name ?? "caso",
    weight: overrides.weight ?? 1,
    isHidden: overrides.isHidden ?? false,
    passed,
  };
}

const AUTONOMOUS = "AUTONOMOUS" as const;

describe("gradeSubmission — puntuación", () => {
  it("reparte la puntuación a partes iguales cuando todas las pruebas pesan lo mismo", () => {
    const result = gradeSubmission({ tests: [test(true), test(false)], ladder: AUTONOMOUS });

    expect(result.score).toBe(50);
    expect(result.outcome).toBe("PARTIAL");
  });

  it("respeta el peso de cada prueba", () => {
    const result = gradeSubmission({
      tests: [test(true, { weight: 2 }), test(false, { weight: 1 })],
      ladder: AUTONOMOUS,
    });

    expect(result.score).toBe(67);
    expect(result.outcome).toBe("PARTIAL");
  });

  it("redondea a entero la proporción", () => {
    const result = gradeSubmission({
      tests: [test(true), test(false), test(false)],
      ladder: AUTONOMOUS,
    });

    expect(result.score).toBe(33);
  });

  it("devuelve PASSED con 100 cuando se superan todas las pruebas", () => {
    const result = gradeSubmission({ tests: [test(true), test(true)], ladder: AUTONOMOUS });

    expect(result.outcome).toBe("PASSED");
    expect(result.score).toBe(100);
  });

  it("devuelve FAILED con 0 cuando no se supera ninguna prueba", () => {
    const result = gradeSubmission({ tests: [test(false), test(false)], ladder: AUTONOMOUS });

    expect(result.outcome).toBe("FAILED");
    expect(result.score).toBe(0);
  });

  it("cuenta sólo las pruebas visibles en el recuento del resultado", () => {
    const result = gradeSubmission({
      tests: [test(true), test(false), test(true, { isHidden: true })],
      ladder: AUTONOMOUS,
    });

    expect(result.visibleTotal).toBe(2);
    expect(result.visiblePassed).toBe(1);
    expect(result.score).toBe(67);
  });

  it("trata un ejercicio sin pruebas como no evaluable", () => {
    const result = gradeSubmission({ tests: [], ladder: AUTONOMOUS });

    expect(result.outcome).toBe("FAILED");
    expect(result.score).toBe(0);
    expect(result.achievedLevel).toBeNull();
    expect(result.feedback).toContain("no tiene pruebas");
  });

  it("no divide por cero cuando todas las pruebas pesan cero", () => {
    const result = gradeSubmission({
      tests: [test(true, { weight: 0 }), test(false, { weight: 0 })],
      ladder: AUTONOMOUS,
    });

    expect(result.outcome).toBe("FAILED");
    expect(result.score).toBe(0);
    expect(result.achievedLevel).toBeNull();
  });
});

describe("gradeSubmission — desenlace", () => {
  it("calcula el desenlace a partir de las pruebas aunque el sandbox diga PASSED", () => {
    const result = gradeSubmission({
      tests: [test(true), test(false)],
      ladder: AUTONOMOUS,
      sandboxOutcome: "PASSED",
    });

    expect(result.outcome).toBe("PARTIAL");
  });

  it("conserva ERROR del sandbox con puntuación cero y sin nivel", () => {
    const result = gradeSubmission({
      tests: [test(true), test(false)],
      ladder: AUTONOMOUS,
      sandboxOutcome: "ERROR",
    });

    expect(result.outcome).toBe("ERROR");
    expect(result.score).toBe(0);
    expect(result.achievedLevel).toBeNull();
    expect(result.levelCap).toBeNull();
    expect(result.feedback).toContain("compil");
  });

  it("conserva TIMEOUT del sandbox con puntuación cero y sin nivel", () => {
    const result = gradeSubmission({
      tests: [test(true)],
      ladder: AUTONOMOUS,
      sandboxOutcome: "TIMEOUT",
    });

    expect(result.outcome).toBe("TIMEOUT");
    expect(result.score).toBe(0);
    expect(result.achievedLevel).toBeNull();
    expect(result.feedback).toContain("5 s");
  });
});

describe("gradeSubmission — nivel alcanzado", () => {
  it("asigna Nivel 4 a una puntuación de 90 o más en un ejercicio autónomo", () => {
    const result = gradeSubmission({
      tests: [test(true)],
      ladder: AUTONOMOUS,
      selfExplanation: "Justifico el enfoque.",
    });

    expect(result.achievedLevel).toBe(4);
    expect(result.levelCap).toBeNull();
  });

  it("asigna Nivel 1 por debajo de 70", () => {
    const result = gradeSubmission({
      tests: [test(true), test(false), test(false)],
      ladder: AUTONOMOUS,
    });

    expect(result.achievedLevel).toBe(1);
  });

  it("asigna Nivel 2 entre 70 y 79", () => {
    const result = gradeSubmission({
      tests: [
        test(true, { weight: 3 }),
        test(false, { weight: 1 }),
      ],
      ladder: AUTONOMOUS,
    });

    expect(result.score).toBe(75);
    expect(result.achievedLevel).toBe(2);
  });

  it("asigna Nivel 3 entre 80 y 89", () => {
    const result = gradeSubmission({
      tests: [
        test(true, { weight: 4 }),
        test(false, { weight: 1 }),
      ],
      ladder: AUTONOMOUS,
      selfExplanation: "Justifico el enfoque.",
    });

    expect(result.score).toBe(80);
    expect(result.achievedLevel).toBe(3);
  });

  it("topa a Nivel 2 cuando se usaron pistas de nivel 3", () => {
    const result = gradeSubmission({ tests: [test(true)], ladder: AUTONOMOUS, hintsUsed: 3 });

    expect(result.achievedLevel).toBe(2);
    expect(result.levelCap).toEqual({ reason: "HINTS", maxLevel: 2 });
    expect(result.feedback).toContain("pistas de nivel 3");
  });

  it("no topa nada con pistas de nivel 2", () => {
    const result = gradeSubmission({
      tests: [test(true)],
      ladder: AUTONOMOUS,
      hintsUsed: 2,
      selfExplanation: "Justifico el enfoque.",
    });

    expect(result.achievedLevel).toBe(4);
    expect(result.levelCap).toBeNull();
  });

  it("topa a Nivel 2 cuando la explicación está vacía", () => {
    const result = gradeSubmission({
      tests: [test(true)],
      ladder: AUTONOMOUS,
      selfExplanation: "   ",
    });

    expect(result.achievedLevel).toBe(2);
    expect(result.levelCap).toEqual({ reason: "EXPLANATION", maxLevel: 2 });
    expect(result.feedback).toContain("explicación de tu enfoque");
  });

  it("no topa nada cuando la explicación tiene contenido", () => {
    const result = gradeSubmission({
      tests: [test(true)],
      ladder: AUTONOMOUS,
      selfExplanation: "Valido el estado antes de parsear el cuerpo.",
    });

    expect(result.achievedLevel).toBe(4);
    expect(result.levelCap).toBeNull();
  });

  it("topa a Nivel 2 en un ejercicio guiado", () => {
    const result = gradeSubmission({
      tests: [test(true)],
      ladder: "GUIDED",
      selfExplanation: "Compruebo el estado de la respuesta.",
    });

    expect(result.achievedLevel).toBe(2);
    expect(result.levelCap).toEqual({ reason: "LADDER", maxLevel: 2 });
    expect(result.feedback).toContain("guiado");
  });

  it("topa a Nivel 3 en un ejercicio semi-autónomo", () => {
    const result = gradeSubmission({
      tests: [test(true)],
      ladder: "SEMI",
      selfExplanation: "Compruebo el estado de la respuesta.",
    });

    expect(result.achievedLevel).toBe(3);
    expect(result.levelCap).toEqual({ reason: "LADDER", maxLevel: 3 });
  });

  it("prioriza el tope por pistas cuando varios topes coinciden", () => {
    const result = gradeSubmission({
      tests: [test(true)],
      ladder: "GUIDED",
      hintsUsed: 3,
      selfExplanation: "",
    });

    expect(result.achievedLevel).toBe(2);
    expect(result.levelCap).toEqual({ reason: "HINTS", maxLevel: 2 });
  });

  it("no reporta tope cuando el nivel base ya es inferior al tope", () => {
    const result = gradeSubmission({
      tests: [test(true), test(false), test(false)],
      ladder: AUTONOMOUS,
      hintsUsed: 3,
    });

    expect(result.achievedLevel).toBe(1);
    expect(result.levelCap).toBeNull();
  });
});

describe("gradeSubmission — feedback", () => {
  it("cuenta las pruebas visibles superadas", () => {
    const result = gradeSubmission({
      tests: [test(true), test(false), test(false, { isHidden: true })],
      ladder: AUTONOMOUS,
      selfExplanation: "Justifico el enfoque.",
    });

    expect(result.feedback).toContain("1 de 2 pruebas visibles superadas.");
  });

  it("nunca nombra una prueba oculta", () => {
    const result = gradeSubmission({
      tests: [
        test(true, { testId: "t1", name: "devuelve el usuario" }),
        test(false, { testId: "t2", name: "secreto-oculto-1234", isHidden: true }),
      ],
      ladder: AUTONOMOUS,
      selfExplanation: "Justifico el enfoque.",
    });

    expect(result.feedback).not.toContain("secreto");
    expect(result.feedback).not.toContain("t2");
  });

  it("indica que no hay pruebas visibles cuando todas son ocultas", () => {
    const result = gradeSubmission({
      tests: [test(true, { isHidden: true })],
      ladder: AUTONOMOUS,
      selfExplanation: "Justifico el enfoque.",
    });

    expect(result.visibleTotal).toBe(0);
    expect(result.feedback).toContain("no tiene pruebas visibles");
  });
});

