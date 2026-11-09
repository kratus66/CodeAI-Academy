import { z } from "zod";

import { certificationCodeSchema, type CertificationDefinition } from "./certification";

/**
 * Formas fijas del simulacro (S15). Una forma es una lista ordenada de slugs del
 * banco reservado: el archivo de la semilla las declara (T3b) y estas funciones
 * las validan contra el registro de certificaciones antes de escribir nada.
 */

export const EXAM_FORM_CODES = ["A", "B", "C"] as const;

export type ExamFormCode = (typeof EXAM_FORM_CODES)[number];

/** Preguntas de una forma: al menos una, todas con slug. */
const slugListSchema = z.array(z.string().min(1)).min(1);

/**
 * Archivo `prisma/seed/aws/exam-forms/<certificación>.json`: declara una o más
 * formas A, B y C y ninguna otra clave.
 */
export const examFormsFileSchema = z
  .object({
    certification: certificationCodeSchema,
    forms: z
      .object({ A: slugListSchema, B: slugListSchema, C: slugListSchema })
      .partial()
      .strict()
      .refine((forms) => Object.keys(forms).length > 0, "Declara al menos una forma"),
  })
  .strict();

export type ExamFormsFile = z.infer<typeof examFormsFileSchema>;

/**
 * Reparte `total` preguntas entre los dominios por peso, con el método del mayor
 * resto: piso de `total · peso / 100` y los huecos que quedan para las mayores
 * partes fraccionarias; los empates los gana el dominio de id menor. La suma es
 * exactamente `total`.
 */
export function allocateByLargestRemainder(
  total: number,
  domains: readonly { id: number; weightPct: number }[],
): Map<number, number> {
  const allocation = new Map<number, number>();

  if (domains.length === 0) {
    return allocation;
  }

  const quotas = domains.map((domain) => {
    const exact = (total * domain.weightPct) / 100;
    const whole = Math.floor(exact);

    return { id: domain.id, whole, remainder: exact - whole };
  });

  let assigned = 0;

  for (const quota of quotas) {
    allocation.set(quota.id, quota.whole);
    assigned += quota.whole;
  }

  const byRemainder = [...quotas].sort(
    (left, right) => right.remainder - left.remainder || left.id - right.id,
  );

  let pending = total - assigned;

  for (let cursor = 0; pending > 0; cursor += 1) {
    const quota = byRemainder[cursor % byRemainder.length];

    if (quota === undefined) {
      break;
    }

    allocation.set(quota.id, (allocation.get(quota.id) ?? 0) + 1);
    pending -= 1;
  }

  return allocation;
}

/** Lo que la validación necesita saber de cada ejercicio del banco. */
export interface FormExerciseFacts {
  readonly type: string;
  readonly examPool: "unit" | "reserved";
  readonly certification: string | null;
  readonly domain: number | null;
  readonly quizKind: string | null;
}

/**
 * Devuelve los problemas de una forma; `[]` si es válida. Cada mensaje lleva el
 * prefijo `Forma <código> de <certificación>: ` para que la semilla (T3b) los
 * pueda imprimir tal cual.
 */
export function examFormViolations(input: {
  definition: CertificationDefinition;
  code: ExamFormCode;
  slugs: readonly string[];
  exercises: ReadonlyMap<string, FormExerciseFacts>;
}): string[] {
  const { definition, code, slugs, exercises } = input;
  const prefix = `Forma ${code} de ${definition.code}: `;
  const violations: string[] = [];

  if (definition.status === "beta") {
    return [`${prefix}la certificación está en beta: no hay formas hasta la guía definitiva`];
  }

  if (slugs.length !== definition.questionCount) {
    violations.push(
      `${prefix}tiene ${slugs.length} preguntas y el examen tiene ${definition.questionCount}`,
    );
  }

  const seen = new Set<string>();
  const countByDomain = new Map<number, number>();

  for (const slug of slugs) {
    if (seen.has(slug)) {
      violations.push(`${prefix}repite ${slug}`);
      continue;
    }

    seen.add(slug);

    const facts = exercises.get(slug);

    if (facts === undefined) {
      violations.push(`${prefix}${slug} no existe`);
      continue;
    }

    if (facts.type !== "QUIZ" || facts.examPool !== "reserved") {
      violations.push(`${prefix}${slug} no es un QUIZ del banco reservado`);
      continue;
    }

    if (facts.certification !== null && facts.certification !== definition.code) {
      violations.push(`${prefix}${slug} es de otra certificación (${facts.certification})`);
      continue;
    }

    if (facts.quizKind !== null && !supportsItemType(definition, facts.quizKind)) {
      violations.push(
        `${prefix}${slug} usa un tipo de pregunta que el examen no tiene (${facts.quizKind})`,
      );
      continue;
    }

    if (facts.domain !== null) {
      countByDomain.set(facts.domain, (countByDomain.get(facts.domain) ?? 0) + 1);
    }
  }

  const allocation = allocateByLargestRemainder(definition.questionCount, definition.domains);

  for (const domain of definition.domains) {
    const count = countByDomain.get(domain.id) ?? 0;
    const target = allocation.get(domain.id) ?? 0;

    if (Math.abs(count - target) > 1) {
      violations.push(
        `${prefix}el dominio ${domain.id} tiene ${count} preguntas y le tocan ${target} (±1)`,
      );
    }
  }

  return violations;
}

/**
 * Solo cuentan los `itemTypes` confirmados del registro: lo que la guía da por
 * no confirmado (AIP-C01) no autoriza un tipo de pregunta.
 */
function supportsItemType(definition: CertificationDefinition, quizKind: string): boolean {
  return definition.itemTypes.some((itemType) => itemType === quizKind);
}
