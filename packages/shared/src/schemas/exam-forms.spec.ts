import { describe, expect, it } from "vitest";
import type { ZodError } from "zod";

import {
  CERTIFICATION_CODES,
  CERTIFICATION_REGISTRY,
  type CertificationDefinition,
} from "./certification";
import {
  EXAM_FORM_CODES,
  allocateByLargestRemainder,
  examFormViolations,
  examFormsFileSchema,
  type FormExerciseFacts,
} from "./exam-forms";

const CLF: CertificationDefinition = CERTIFICATION_REGISTRY["CLF-C02"];
const BETA: CertificationDefinition = CERTIFICATION_REGISTRY["MLA-C02"];

function facts(overrides: Partial<FormExerciseFacts> = {}): FormExerciseFacts {
  return {
    type: "QUIZ",
    examPool: "reserved",
    certification: CLF.code,
    domain: 1,
    quizKind: "single",
    ...overrides,
  };
}

/** Forma sintética completa: reparte `questionCount` slugs como manda el mayor resto. */
function buildForm(
  definition: CertificationDefinition,
  exercises: Map<string, FormExerciseFacts>,
): string[] {
  const allocation = allocateByLargestRemainder(definition.questionCount, definition.domains);
  const slugs: string[] = [];

  for (const domain of definition.domains) {
    const count = allocation.get(domain.id) ?? 0;

    for (let index = 1; index <= count; index += 1) {
      const slug = `${definition.code.toLowerCase()}-d${domain.id}-q${index}`;

      exercises.set(slug, facts({ certification: definition.code, domain: domain.id }));
      slugs.push(slug);
    }
  }

  return slugs;
}

/** Forma válida de CLF-C02 con su primera pregunta cambiada por `overrides`. */
function formWithOverride(overrides: Partial<FormExerciseFacts>): {
  slug: string;
  violations: string[];
} {
  const exercises = new Map<string, FormExerciseFacts>();
  const slugs = buildForm(CLF, exercises);
  const slug = slugs[0] ?? "";

  exercises.set(slug, { ...facts(), ...overrides });

  return {
    slug,
    violations: examFormViolations({ definition: CLF, code: "A", slugs, exercises }),
  };
}

function messagesOf(result: { success: true } | { success: false; error: ZodError }): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function asRecord(allocation: Map<number, number>): Record<string, number> {
  return Object.fromEntries(allocation);
}

describe("constantes de las formas", () => {
  it("declara las tres formas del contrato", () => {
    expect(EXAM_FORM_CODES).toEqual(["A", "B", "C"]);
  });
});

describe("allocateByLargestRemainder", () => {
  it("reparte las 65 preguntas de CLF-C02 con el mayor resto", () => {
    const allocation = allocateByLargestRemainder(65, CLF.domains);

    expect(asRecord(allocation)).toEqual({ "1": 16, "2": 19, "3": 22, "4": 8 });
  });

  it("suma exactamente el total en los diez exámenes GA", () => {
    const gaDefinitions = CERTIFICATION_CODES.map(
      (code) => CERTIFICATION_REGISTRY[code],
    ).filter((definition) => definition.status === "ga");

    expect(gaDefinitions).toHaveLength(10);

    for (const definition of gaDefinitions) {
      const allocation = allocateByLargestRemainder(definition.questionCount, definition.domains);
      const sum = [...allocation.values()].reduce((total, value) => total + value, 0);

      expect(allocation.size).toBe(definition.domains.length);
      expect(sum).toBe(definition.questionCount);

      for (const domain of definition.domains) {
        const exact = (definition.questionCount * domain.weightPct) / 100;

        expect(Math.abs((allocation.get(domain.id) ?? 0) - exact)).toBeLessThan(1);
      }
    }
  });

  it("rompe los empates por el dominio de id menor", () => {
    const allocation = allocateByLargestRemainder(10, [
      { id: 1, weightPct: 25 },
      { id: 2, weightPct: 25 },
      { id: 3, weightPct: 25 },
      { id: 4, weightPct: 25 },
    ]);

    expect(asRecord(allocation)).toEqual({ "1": 3, "2": 3, "3": 2, "4": 2 });
  });
});

describe("examFormsFileSchema", () => {
  it("acepta un archivo con las tres formas", () => {
    const parsed = examFormsFileSchema.parse({
      certification: "CLF-C02",
      forms: { A: ["clf-a-1"], B: ["clf-b-1"], C: ["clf-c-1"] },
    });

    expect(Object.keys(parsed.forms)).toEqual(["A", "B", "C"]);
    expect(parsed.forms.A).toEqual(["clf-a-1"]);
  });

  it("acepta declarar una sola forma", () => {
    const parsed = examFormsFileSchema.parse({
      certification: "SAA-C03",
      forms: { B: ["saa-b-1"] },
    });

    expect(parsed.forms).toEqual({ B: ["saa-b-1"] });
  });

  it("exige al menos una forma", () => {
    const result = examFormsFileSchema.safeParse({ certification: "CLF-C02", forms: {} });

    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain("Declara al menos una forma");
  });

  it("rechaza formas desconocidas, listas vacías y claves de más", () => {
    expect(
      examFormsFileSchema.safeParse({
        certification: "CLF-C02",
        forms: { D: ["clf-d-1"] },
      }).success,
    ).toBe(false);
    expect(
      examFormsFileSchema.safeParse({ certification: "CLF-C02", forms: { A: [] } }).success,
    ).toBe(false);
    expect(
      examFormsFileSchema.safeParse({
        certification: "CLF-C02",
        forms: { A: ["clf-a-1"] },
        notes: "borrador",
      }).success,
    ).toBe(false);
  });
});

describe("examFormViolations", () => {
  it("acepta una forma sintética correcta de 65 preguntas", () => {
    const exercises = new Map<string, FormExerciseFacts>();
    const slugs = buildForm(CLF, exercises);

    expect(slugs).toHaveLength(CLF.questionCount);
    expect(examFormViolations({ definition: CLF, code: "A", slugs, exercises })).toEqual([]);
  });

  it("rechaza cualquier forma de una certificación beta", () => {
    const violations = examFormViolations({
      definition: BETA,
      code: "B",
      slugs: [],
      exercises: new Map(),
    });

    expect(violations).toEqual([
      "Forma B de MLA-C02: la certificación está en beta: no hay formas hasta la guía definitiva",
    ]);
  });

  it("cuenta las preguntas de la forma", () => {
    const exercises = new Map<string, FormExerciseFacts>();
    const slugs = buildForm(CLF, exercises);
    const violations = examFormViolations({
      definition: CLF,
      code: "A",
      slugs: slugs.slice(0, 64),
      exercises,
    });

    expect(violations).toContain("Forma A de CLF-C02: tiene 64 preguntas y el examen tiene 65");
  });

  it("rechaza un slug repetido", () => {
    const exercises = new Map<string, FormExerciseFacts>();
    const slugs = buildForm(CLF, exercises);
    const repeated = slugs[0] ?? "";
    const violations = examFormViolations({
      definition: CLF,
      code: "A",
      slugs: [...slugs.slice(0, 64), repeated],
      exercises,
    });

    expect(violations).toEqual([`Forma A de CLF-C02: repite ${repeated}`]);
  });

  it("rechaza un slug que no existe", () => {
    const exercises = new Map<string, FormExerciseFacts>();
    const slugs = buildForm(CLF, exercises);
    const first = slugs[0] ?? "";
    const missing = "clf-d1-q-desconocida";
    const violations = examFormViolations({
      definition: CLF,
      code: "A",
      slugs: slugs.map((slug) => (slug === first ? missing : slug)),
      exercises,
    });

    expect(violations).toEqual([`Forma A de CLF-C02: ${missing} no existe`]);
  });

  it("rechaza un ejercicio que no es un QUIZ del banco reservado", () => {
    const notQuiz = formWithOverride({ type: "LAB" });

    expect(notQuiz.violations).toEqual([
      `Forma A de CLF-C02: ${notQuiz.slug} no es un QUIZ del banco reservado`,
    ]);

    const unitPool = formWithOverride({ examPool: "unit" });

    expect(unitPool.violations).toEqual([
      `Forma A de CLF-C02: ${unitPool.slug} no es un QUIZ del banco reservado`,
    ]);
  });

  it("rechaza una pregunta de otra certificación", () => {
    const { slug, violations } = formWithOverride({ certification: "SAA-C03" });

    expect(violations).toEqual([`Forma A de CLF-C02: ${slug} es de otra certificación (SAA-C03)`]);
  });

  it("rechaza un tipo de pregunta que el examen no tiene", () => {
    const { slug, violations } = formWithOverride({ quizKind: "ordering" });

    expect(violations).toEqual([
      `Forma A de CLF-C02: ${slug} usa un tipo de pregunta que el examen no tiene (ordering)`,
    ]);
  });

  it("no admite los tipos de pregunta sin confirmar", () => {
    const definition = CERTIFICATION_REGISTRY["AIP-C01"];
    const exercises = new Map<string, FormExerciseFacts>();
    const slugs = buildForm(definition, exercises);
    const slug = slugs[0] ?? "";

    expect(definition.itemTypes).toEqual(["single", "multiple"]);
    expect(definition.unconfirmedItemTypes).toEqual(["ordering", "matching"]);

    for (const kind of definition.unconfirmedItemTypes) {
      exercises.set(slug, facts({ certification: definition.code, domain: 1, quizKind: kind }));

      expect(examFormViolations({ definition, code: "C", slugs, exercises })).toEqual([
        `Forma C de AIP-C01: ${slug} usa un tipo de pregunta que el examen no tiene (${kind})`,
      ]);
    }
  });

  it("acepta los tipos de pregunta confirmados", () => {
    const definition = CERTIFICATION_REGISTRY["SCS-C03"];
    const exercises = new Map<string, FormExerciseFacts>();
    const slugs = buildForm(definition, exercises);
    const slug = slugs[0] ?? "";

    exercises.set(slug, facts({ certification: definition.code, domain: 1, quizKind: "matching" }));

    expect(examFormViolations({ definition, code: "A", slugs, exercises })).toEqual([]);
  });

  it("rechaza un reparto por dominio que se aleja del mayor resto", () => {
    const exercises = new Map<string, FormExerciseFacts>();
    const slugs = buildForm(CLF, exercises);
    const moved = slugs.filter((slug) => exercises.get(slug)?.domain === 4).slice(0, 3);

    for (const slug of moved) {
      exercises.set(slug, facts());
    }

    const violations = examFormViolations({ definition: CLF, code: "A", slugs, exercises });

    expect(violations).toEqual([
      "Forma A de CLF-C02: el dominio 1 tiene 19 preguntas y le tocan 16 (±1)",
      "Forma A de CLF-C02: el dominio 4 tiene 5 preguntas y le tocan 8 (±1)",
    ]);
  });
});
