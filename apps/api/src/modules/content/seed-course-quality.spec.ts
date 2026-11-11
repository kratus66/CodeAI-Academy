import assert from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { resolve } from "node:path";

import { aws } from "@codeai/aws-harness";
import {
  certificationForStageId,
  courseSeedSchema,
  courseUnitFileSchema,
  examTaskBelongsToDomain,
  isExamDomainOf,
  mergeCourseSeed,
  type ContentSeedQuiz,
  type CourseSeedExam,
  type CourseSeedExercise,
  type CourseUnitFileEntry,
  type QuizKind,
} from "@codeai/shared";
import { describe, expect, it } from "vitest";

/**
 * Guarda de calidad de la semilla de la ruta AWS (esqueleto + archivos de
 * unidad). Si `aws/units` aún no existe, se leen cero archivos y la guarda
 * pasa igual. Al final, las reglas 1–7 de las preguntas tipo examen
 * (`metodo-aws.md` §5 y §6) se prueban con ejemplos sintéticos y se aplican al
 * contenido real.
 */

const AWS_DIR = resolve(__dirname, "../../../prisma/seed/aws");
const UNITS_DIR = resolve(AWS_DIR, "units");

const EXPECTED_STAGE_IDS = Array.from({ length: 13 }, (_, index) => 100 + index);
const EXPECTED_MODULES_PER_STAGE = [3, 5, 10, 8, 7, 7, 7, 4, 6, 7, 5, 5, 3];
const EXPECTED_UNIT_COUNT = 262;

const OBJECTIVE_PATTERN = /^[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:ar|er|ir)\b/;
const ALLOWED_SOURCE_DOMAINS = ["docs.aws.amazon.com", "aws.amazon.com", "skillbuilder.aws"];

const skeleton = courseSeedSchema.parse(
  JSON.parse(readFileSync(resolve(AWS_DIR, "course.seed.json"), "utf8")),
);

const unitFileNames = existsSync(UNITS_DIR)
  ? readdirSync(UNITS_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort()
  : [];

const unitFiles: CourseUnitFileEntry[] = unitFileNames.map((fileName) => ({
  fileName,
  unit: courseUnitFileSchema.parse(
    JSON.parse(readFileSync(resolve(UNITS_DIR, fileName), "utf8")),
  ),
}));

const merged = mergeCourseSeed(skeleton, unitFiles);

const units = merged.seed.stages.flatMap((stage) =>
  stage.modules.flatMap((module) => module.units),
);
const exercises = units.flatMap((unit) =>
  unit.exercises.map((exercise) => ({ unitCode: unit.code, exercise })),
);

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

/** Una prueba de laboratorio lista para ejecutar en el proceso. */
interface LabTest {
  readonly name: string;
  readonly isHidden: boolean;
  readonly code: string;
}

interface LabTestResult {
  readonly name: string;
  readonly isHidden: boolean;
  readonly passed: boolean;
}

/**
 * Quita los `export` de nivel superior: dentro de una `AsyncFunction` no son
 * válidos, y el sandbox los admite porque ejecuta el código como módulo ESM.
 */
function stripTopLevelExports(code: string): string {
  return code
    .replace(/^export\s*\{[^}]*\};?[ \t]*$/gm, "")
    .replace(/^export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\b)/gm, "");
}

/** Código TypeScript o JavaScript listo para una `AsyncFunction`. */
function toRunnableSource(code: string): string {
  return stripTopLevelExports(stripTypeScriptTypes(code));
}

/**
 * Ejecuta en el proceso el código y cada prueba con `assert` (y `aws`, si el
 * laboratorio usa el arnés) a la vista, como la guarda de `fullstack-ia`.
 */
async function runLabInProcess(
  code: string,
  tests: readonly LabTest[],
  options: { readonly harness: typeof aws | null },
): Promise<LabTestResult[]> {
  const results: LabTestResult[] = [];

  for (const test of tests) {
    let passed: boolean;

    try {
      const source = `${toRunnableSource(code)}\n${toRunnableSource(test.code)}`;
      await new AsyncFunction("assert", "aws", source)(assert, options.harness ?? undefined);
      passed = true;
    } catch {
      passed = false;
    }

    results.push({ name: test.name, isHidden: test.isHidden, passed });
  }

  return results;
}

/** Problemas de un laboratorio: la solución falla algo, o el inicial no falla nada visible. */
async function labProblems(
  label: string,
  starterCode: string,
  solutionCode: string,
  tests: readonly LabTest[],
  options: { readonly harness: typeof aws | null },
): Promise<string[]> {
  const problems: string[] = [];
  const solved = await runLabInProcess(solutionCode, tests, options);

  for (const result of solved.filter((candidate) => !candidate.passed)) {
    problems.push(`${label}: la solución falla «${result.name}»`);
  }

  const started = await runLabInProcess(starterCode, tests, options);

  if (!started.some((result) => !result.isHidden && !result.passed)) {
    problems.push(`${label}: el código inicial no falla ninguna prueba visible`);
  }

  return problems;
}

/** Una unidad fusionada con la etapa que la contiene: las reglas 5–7 lo necesitan. */
interface UnitContent {
  readonly code: string;
  readonly stageId: number;
  readonly isPublished: boolean;
  readonly exercises: readonly CourseSeedExercise[];
}

const unitContents: UnitContent[] = merged.seed.stages.flatMap((stage) =>
  stage.modules.flatMap((module) =>
    module.units.map((unit) => ({
      code: unit.code,
      stageId: stage.id,
      isPublished: unit.isPublished,
      exercises: unit.exercises,
    })),
  ),
);

/** Un dominio permitido o uno de sus subdominios; una URL mal formada no pertenece. */
function isAllowedSourceUrl(rawUrl: string): boolean {
  let hostname: string;

  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }

  return ALLOWED_SOURCE_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

/** Unidades que son su propio prerrequisito. */
function selfPrerequisites(graph: ReadonlyMap<string, readonly string[]>): string[] {
  return [...graph]
    .filter(([code, prerequisites]) => prerequisites.includes(code))
    .map(([code]) => code);
}

/** Primer ciclo de longitud mayor que 1 encontrado (códigos en orden), o null. */
function findPrerequisiteCycle(graph: ReadonlyMap<string, readonly string[]>): string[] | null {
  const done = new Set<string>();
  const path: string[] = [];
  const onPath = new Set<string>();

  const visit = (code: string): string[] | null => {
    if (onPath.has(code)) {
      return [...path.slice(path.indexOf(code)), code];
    }
    if (done.has(code)) {
      return null;
    }

    onPath.add(code);
    path.push(code);

    for (const prerequisite of graph.get(code) ?? []) {
      if (prerequisite === code) {
        continue;
      }
      const cycle = visit(prerequisite);

      if (cycle) {
        return cycle;
      }
    }

    path.pop();
    onPath.delete(code);
    done.add(code);

    return null;
  };

  for (const code of graph.keys()) {
    const cycle = visit(code);

    if (cycle) {
      return cycle;
    }
  }

  return null;
}

const prerequisiteGraph = new Map<string, readonly string[]>(
  units.map((unit) => [unit.code, unit.prerequisiteIds]),
);

describe("guarda de calidad de la semilla AWS", () => {
  it("la fusión no tiene problemas y courseSeedSchema la valida", () => {
    expect(merged.problems, merged.problems.join("\n")).toEqual([]);

    const result = courseSeedSchema.safeParse(merged.seed);
    const issues = result.success
      ? []
      : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);

    expect(issues, issues.join("\n")).toEqual([]);
  });

  it("tiene 13 etapas (100-112), los módulos esperados por etapa y 262 unidades", () => {
    expect(merged.seed.stages.map((stage) => stage.id)).toEqual(EXPECTED_STAGE_IDS);
    expect(merged.seed.stages.map((stage) => stage.modules.length)).toEqual(
      EXPECTED_MODULES_PER_STAGE,
    );
    expect(units).toHaveLength(EXPECTED_UNIT_COUNT);
  });

  it("todo objetivo de unidad empieza por un verbo en infinitivo", () => {
    const offenders = units
      .filter((unit) => !OBJECTIVE_PATTERN.test(unit.objective))
      .map((unit) => `${unit.code}: «${unit.objective}»`);

    expect(offenders, `Objetivos sin verbo en infinitivo:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("toda fuente de un ejercicio pertenece a un dominio oficial de AWS", () => {
    const offenders = exercises.flatMap(({ unitCode, exercise }) =>
      exercise.sources
        .filter((url) => !isAllowedSourceUrl(url))
        .map((url) => `${unitCode} / ${exercise.slug}: ${url}`),
    );

    expect(offenders, `Fuentes fuera de dominio permitido:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("la comprobación de dominios acepta URLs oficiales y rechaza las demás", () => {
    expect(isAllowedSourceUrl("https://docs.aws.amazon.com/lambda/latest/dg/welcome.html")).toBe(
      true,
    );
    expect(isAllowedSourceUrl("https://aws.amazon.com/certification/")).toBe(true);
    expect(isAllowedSourceUrl("https://skillbuilder.aws/learn")).toBe(true);
    expect(isAllowedSourceUrl("https://explore.skillbuilder.aws/learn")).toBe(true);

    expect(isAllowedSourceUrl("https://example.com/docs.aws.amazon.com")).toBe(false);
    expect(isAllowedSourceUrl("https://aws.amazon.com.evil.com/")).toBe(false);
    expect(isAllowedSourceUrl("https://evilaws.amazon.com.example.org/")).toBe(false);
    expect(isAllowedSourceUrl("https://notskillbuilder.aws/")).toBe(false);
    expect(isAllowedSourceUrl("no es una url")).toBe(false);
  });

  it("ningún ejercicio de la ruta AWS está publicado", () => {
    const offenders = exercises
      .filter(({ exercise }) => exercise.isPublished)
      .map(({ unitCode, exercise }) => `${unitCode} / ${exercise.slug}`);

    expect(offenders, `Ejercicios publicados:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("ninguna unidad es su propio prerrequisito", () => {
    const offenders = selfPrerequisites(prerequisiteGraph);

    expect(offenders, `Unidades que se tienen a sí mismas de prerrequisito: ${offenders.join(", ")}`)
      .toEqual([]);
  });

  it("el grafo de prerrequisitos no tiene ciclos", () => {
    const cycle = findPrerequisiteCycle(prerequisiteGraph);

    expect(cycle, `Ciclo de prerrequisitos: ${cycle?.join(" -> ") ?? ""}`).toBeNull();
  });

  it("la comprobación de prerrequisitos detecta autorreferencias y ciclos", () => {
    const acyclic = new Map<string, readonly string[]>([
      ["A", []],
      ["B", ["A"]],
      ["C", ["A", "B"]],
    ]);
    const cyclic = new Map<string, readonly string[]>([
      ["A", ["C"]],
      ["B", ["A"]],
      ["C", ["B"]],
    ]);
    const selfReferencing = new Map<string, readonly string[]>([
      ["A", []],
      ["B", ["B"]],
    ]);

    expect(findPrerequisiteCycle(acyclic)).toBeNull();
    expect(selfPrerequisites(acyclic)).toEqual([]);
    expect(findPrerequisiteCycle(cyclic)).toEqual(["A", "C", "B", "A"]);
    expect(selfPrerequisites(selfReferencing)).toEqual(["B"]);
  });
});

// ─────────────── Preguntas tipo examen AWS (`metodo-aws.md` §5 y §6) ───────────────
//
// Cada regla es una función pura: se prueba con un ejemplo que la dispara y otro
// que no, y después se aplica a los QUIZ con metadatos de examen de la ruta. Lo
// que no es comprobable por máquina (distractores plausibles, una sola respuesta
// defendible, originalidad, servicios vigentes, datos volátiles) queda para la
// revisión humana y aquí no se simula con heurísticas.

/** Calificadores de §5.1: `\b` no funciona con tildes (MÁS, MÍNIMO, ÚNICAMENTE). */
const QUALIFIER_WORDS = [
  "MENOR",
  "MENOS",
  "MÁS",
  "MAYOR",
  "MEJOR",
  "MÍNIMO",
  "MÁXIMO",
  "PRIMERO",
  "ÚNICAMENTE",
  "DOS",
  "TRES",
] as const;

const MIN_EXPLANATION_LENGTH = 25;
const MAX_OPTION_LENGTH_RATIO = 2;
const MIN_SINGLE_QUIZZES_PER_UNIT = 6;
const MIN_EXAM_QUIZZES_PER_UNIT = 8;
const MIN_MULTIPLE_QUIZZES_PER_UNIT = 2;
const A2_STAGE_ID = 102;

const TRUE_FALSE_TEXT = /^(verdadero|falso)\.?$/i;
const NONE_OF_ABOVE_TEXT = /(todas|ninguna) (de )?las anteriores/i;

/** Regla 1 (§5.1): el enunciado lleva un calificador en mayúsculas. */
function qualifierProblems(statement: string, kind: QuizKind): string[] {
  if (kind === "ordering" || kind === "matching") return [];

  const hasQualifier = QUALIFIER_WORDS.some((word) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "u").test(statement),
  );

  return hasQualifier ? [] : ["el enunciado no lleva un calificador en mayúsculas"];
}

function explanationsOf(quiz: ContentSeedQuiz): readonly string[] {
  if (quiz.kind === "single" || quiz.kind === "multiple") {
    return quiz.options.map((option) => option.explanation);
  }
  if (quiz.kind === "ordering") {
    return quiz.items.map((item) => item.explanation);
  }

  return quiz.left.map((item) => item.explanation);
}

/** Regla 2 (§5.3): cada explicación nombra la restricción que descarta la opción. */
function explanationProblems(quiz: ContentSeedQuiz): string[] {
  const short = explanationsOf(quiz).filter(
    (explanation) => explanation.trim().length < MIN_EXPLANATION_LENGTH,
  );

  return short.length === 0 ? [] : [`${short.length} explicaciones de menos de 25 caracteres`];
}

function textsOf(quiz: ContentSeedQuiz): readonly string[] {
  if (quiz.kind === "single" || quiz.kind === "multiple") {
    return quiz.options.map((option) => option.text);
  }
  if (quiz.kind === "ordering") {
    return quiz.items.map((item) => item.text);
  }

  return [...quiz.left.map((item) => item.text), ...quiz.right.map((item) => item.text)];
}

/** Regla 4 (§5.2): ni verdadero/falso ni «todas/ninguna de las anteriores». */
function forbiddenWordingProblems(quiz: ContentSeedQuiz): string[] {
  const texts = textsOf(quiz).map((text) => text.trim());
  const problems: string[] = [];

  if (texts.some((text) => TRUE_FALSE_TEXT.test(text))) {
    problems.push("prohibido verdadero/falso");
  }
  if (texts.some((text) => NONE_OF_ABOVE_TEXT.test(text))) {
    problems.push("prohibido «todas/ninguna de las anteriores»");
  }

  return problems;
}

function isOverlong(correctLength: number, distractorLengths: readonly number[]): boolean {
  if (distractorLengths.length === 0) return false;

  const mean =
    distractorLengths.reduce((sum, length) => sum + length, 0) / distractorLengths.length;
  const longest = Math.max(...distractorLengths);

  return (
    correctLength / mean > MAX_OPTION_LENGTH_RATIO ||
    correctLength / longest > MAX_OPTION_LENGTH_RATIO
  );
}

/** Regla 3 (§5.5): la longitud no delata la correcta (`single` y `multiple`). */
function optionLengthProblems(quiz: ContentSeedQuiz): string[] {
  if (quiz.kind === "single") {
    const correct = quiz.options.find((option) => option.id === quiz.correctOptionId);
    if (correct === undefined) return [];

    const distractors = quiz.options.filter((option) => option.id !== quiz.correctOptionId);

    return isOverlong(
      correct.text.length,
      distractors.map((option) => option.text.length),
    )
      ? [`la opción correcta «${correct.id}» es el doble de larga que las incorrectas`]
      : [];
  }

  if (quiz.kind === "multiple") {
    const incorrectLengths = quiz.options
      .filter((option) => !quiz.correctOptionIds.includes(option.id))
      .map((option) => option.text.length);

    return quiz.options
      .filter((option) => quiz.correctOptionIds.includes(option.id))
      .filter((option) => isOverlong(option.text.length, incorrectLengths))
      .map((option) => `la opción correcta «${option.id}» es el doble de larga que las incorrectas`);
  }

  return [];
}

/** Regla 5 (§5.7): certificación de la etapa, dominio existente y tarea del dominio. */
function examMetadataProblems(exam: CourseSeedExam, stageId: number): string[] {
  const problems: string[] = [];
  const certification = certificationForStageId(stageId);

  if (certification === null || certification.code !== exam.certification) {
    problems.push(`la certificación ${exam.certification} no corresponde a la etapa ${stageId}`);
  }
  if (!isExamDomainOf(exam.certification, exam.domain)) {
    problems.push(`el dominio ${exam.domain} no existe en ${exam.certification}`);
  }
  if (exam.task !== null && !examTaskBelongsToDomain(exam.task, exam.domain)) {
    problems.push(`la tarea ${exam.task} no pertenece al dominio ${exam.domain}`);
  }

  return problems;
}

/** Regla 6 (§5.5): con seis o más de respuesta única, ninguna letra es más de la mitad. */
function correctLetterProblems(correctLetters: readonly string[]): string[] {
  if (correctLetters.length < MIN_SINGLE_QUIZZES_PER_UNIT) return [];

  const counts = new Map<string, number>();
  for (const letter of correctLetters) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }

  const skewed = [...counts].find(([, count]) => count > correctLetters.length / 2);

  return skewed === undefined
    ? []
    : [
        `la letra «${skewed[0]}» es la correcta en ${skewed[1]} de ${correctLetters.length} preguntas`,
      ];
}

/** Regla 7 (§6): reparto mínimo de tipos de una unidad publicada. */
function typeSpreadProblems(
  stageId: number,
  isPublished: boolean,
  examQuizKinds: readonly QuizKind[],
): string[] {
  if (!isPublished) return [];

  const problems: string[] = [];

  if (examQuizKinds.length < MIN_EXAM_QUIZZES_PER_UNIT) {
    problems.push(`la unidad tiene ${examQuizKinds.length} QUIZ de examen; el mínimo es 8`);
  }

  if (stageId >= A2_STAGE_ID) {
    const multiple = examQuizKinds.filter((kind) => kind === "multiple").length;

    if (multiple < MIN_MULTIPLE_QUIZZES_PER_UNIT) {
      problems.push(`la unidad de A2 en adelante tiene ${multiple} preguntas de respuesta múltiple`);
    }
  }

  return problems;
}

function isExamQuiz(exercise: CourseSeedExercise): boolean {
  return exercise.type === "QUIZ" && exercise.exam !== null && exercise.quiz !== null;
}

/** Reglas 1–5 sobre un QUIZ con metadatos de examen; el resto queda exento. */
function quizProblems(stageId: number, exercise: CourseSeedExercise): string[] {
  const quiz = exercise.quiz;
  if (exercise.exam === null || quiz === null) return [];

  return [
    ...qualifierProblems(exercise.statement, quiz.kind),
    ...explanationProblems(quiz),
    ...optionLengthProblems(quiz),
    ...forbiddenWordingProblems(quiz),
    ...examMetadataProblems(exercise.exam, stageId),
  ].map((problem) => `${exercise.slug}: ${problem}`);
}

function singleLettersOf(unit: UnitContent): string[] {
  return unit.exercises.flatMap((exercise) =>
    exercise.quiz?.kind === "single" ? [exercise.quiz.correctOptionId] : [],
  );
}

function examQuizKindsOf(unit: UnitContent): QuizKind[] {
  return unit.exercises.flatMap((exercise) => {
    if (!isExamQuiz(exercise) || exercise.quiz === null) return [];

    return [exercise.quiz.kind];
  });
}

/** Reglas 6 y 7, que se juzgan por unidad y no por ejercicio. */
function unitRuleProblems(unit: UnitContent): string[] {
  return [
    ...correctLetterProblems(singleLettersOf(unit)),
    ...typeSpreadProblems(unit.stageId, unit.isPublished, examQuizKindsOf(unit)),
  ].map((problem) => `${unit.code}: ${problem}`);
}

const EXPLANATION = "Descarta la opción porque incumple la restricción del enunciado";

function singleQuiz(
  [a, b, c, d]: readonly [string, string, string, string],
  correctOptionId: string,
): ContentSeedQuiz {
  return {
    kind: "single",
    options: [
      { id: "a", text: a, explanation: EXPLANATION },
      { id: "b", text: b, explanation: EXPLANATION },
      { id: "c", text: c, explanation: EXPLANATION },
      { id: "d", text: d, explanation: EXPLANATION },
    ],
    correctOptionId,
  };
}

function multipleQuiz(
  [a, b, c, d, e]: readonly [string, string, string, string, string],
): ContentSeedQuiz {
  return {
    kind: "multiple",
    options: [
      { id: "a", text: a, explanation: EXPLANATION },
      { id: "b", text: b, explanation: EXPLANATION },
      { id: "c", text: c, explanation: EXPLANATION },
      { id: "d", text: d, explanation: EXPLANATION },
      { id: "e", text: e, explanation: EXPLANATION },
    ],
    selectCount: 2,
    correctOptionIds: ["a", "b"],
  };
}

function orderingQuiz([a, b, c]: readonly [string, string, string]): ContentSeedQuiz {
  return {
    kind: "ordering",
    items: [
      { id: "a", text: a, explanation: EXPLANATION },
      { id: "b", text: b, explanation: EXPLANATION },
      { id: "c", text: c, explanation: EXPLANATION },
    ],
    correctOrder: ["c", "b", "a"],
  };
}

function matchingQuiz([a, b, c]: readonly [string, string, string]): ContentSeedQuiz {
  return {
    kind: "matching",
    left: [
      { id: "a", text: a, explanation: EXPLANATION },
      { id: "b", text: b, explanation: EXPLANATION },
      { id: "c", text: c, explanation: EXPLANATION },
    ],
    right: [
      { id: "1", text: "Grupo de seguridad" },
      { id: "2", text: "Lista de control de acceso" },
      { id: "3", text: "Tabla de rutas" },
    ],
    correctPairs: { a: "1", b: "2", c: "3" },
  };
}

describe("guarda de calidad de las preguntas tipo examen AWS", () => {
  it("regla 1: exige un calificador en mayúsculas y no confunde las siglas", () => {
    expect(qualifierProblems("Elige la opción con la MENOR sobrecarga operativa.", "single")).toEqual(
      [],
    );
    expect(qualifierProblems("Selecciona DOS respuestas correctas.", "multiple")).toEqual([]);
    expect(qualifierProblems("Elige la opción MÁS rápida en AWS.", "single")).toEqual([]);

    expect(qualifierProblems("Elige la opción más barata.", "single")).toHaveLength(1);
    expect(qualifierProblems("Usa IAM y VPC en una sola cuenta.", "single")).toHaveLength(1);
    expect(qualifierProblems("Elige la opción MÁSfácil de operar.", "single")).toHaveLength(1);

    expect(qualifierProblems("Ordena los pasos de un despliegue.", "ordering")).toEqual([]);
    expect(qualifierProblems("Une cada servicio con su función.", "matching")).toEqual([]);
  });

  it("regla 2: cada explicación llega a 25 caracteres en cualquier variante", () => {
    expect(explanationProblems(singleQuiz(["NAT Gateway", "Instancia NAT", "IP pública", "Endpoint"], "a")))
      .toEqual([]);
    expect(explanationProblems(multipleQuiz(["NAT", "IGW", "Endpoint", "ALB", "NAP"]))).toEqual([]);
    expect(explanationProblems(orderingQuiz(["Crear la VPC", "Crear subredes", "Añadir rutas"])))
      .toEqual([]);
    expect(explanationProblems(matchingQuiz(["Subred privada", "Internet Gateway", "Tabla de rutas"])))
      .toEqual([]);

    const short: ContentSeedQuiz = {
      kind: "single",
      options: [
        { id: "a", text: "NAT Gateway", explanation: EXPLANATION },
        { id: "b", text: "Instancia NAT", explanation: "Es incorrecta" },
        { id: "c", text: "IP pública", explanation: EXPLANATION },
      ],
      correctOptionId: "a",
    };

    expect(explanationProblems(short)).toHaveLength(1);
  });

  it("regla 3: la correcta no duplica la longitud de las incorrectas", () => {
    expect(
      optionLengthProblems(
        singleQuiz(
          ["NAT Gateway en cada zona", "Instancia NAT propia", "IP pública en la instancia", "Endpoint de pasarela"],
          "a",
        ),
      ),
    ).toEqual([]);

    expect(
      optionLengthProblems(
        singleQuiz(
          [
            "Crear un NAT Gateway en una subred pública de cada zona y enrutar la salida hacia él",
            "Instancia NAT",
            "IP pública",
            "Endpoint",
          ],
          "a",
        ),
      ),
    ).toHaveLength(1);

    expect(
      optionLengthProblems(multipleQuiz(["NAT Gateway", "Instancia NAT", "IP pública", "Endpoint", "Balanceador"])),
    ).toEqual([]);

    expect(
      optionLengthProblems(
        multipleQuiz(
          [
            "Crear un NAT Gateway en una subred pública de cada zona con su tabla de rutas",
            "Instancia NAT",
            "IP pública",
            "Endpoint",
            "Balanceador",
          ],
        ),
      ),
    ).toHaveLength(1);

    expect(optionLengthProblems(orderingQuiz(["Crear la VPC", "Crear subredes", "Añadir rutas"]))).toEqual(
      [],
    );
  });

  it("regla 4: rechaza verdadero/falso y «todas/ninguna de las anteriores»", () => {
    expect(forbiddenWordingProblems(singleQuiz(["NAT Gateway", "Instancia NAT", "IP pública", "Endpoint"], "a")))
      .toEqual([]);
    expect(forbiddenWordingProblems(orderingQuiz(["Crear la VPC", "Crear subredes", "Añadir rutas"])))
      .toEqual([]);
    expect(forbiddenWordingProblems(matchingQuiz(["Subred privada", "Internet Gateway", "Tabla de rutas"])))
      .toEqual([]);

    expect(forbiddenWordingProblems(singleQuiz(["Verdadero", "Falso", "NAT Gateway", "Endpoint"], "a")))
      .toHaveLength(1);
    expect(
      forbiddenWordingProblems(orderingQuiz(["Todas las anteriores", "Crear subredes", "Añadir rutas"])),
    ).toHaveLength(1);
    expect(
      forbiddenWordingProblems(matchingQuiz(["Ninguna de las anteriores", "Internet Gateway", "Tabla de rutas"])),
    ).toHaveLength(1);
  });

  it("regla 5: los metadatos de examen cuadran con la etapa", () => {
    const exam: CourseSeedExam = { certification: "SAA-C03", domain: 1, task: "1.2", pool: "unit" };

    expect(examMetadataProblems(exam, 102)).toEqual([]);
    expect(examMetadataProblems({ ...exam, certification: "CLF-C02" }, 101)).toEqual([]);
    expect(examMetadataProblems({ ...exam, certification: "CLF-C02" }, 102)).toHaveLength(1);
    expect(examMetadataProblems({ ...exam, domain: 9, task: null }, 102)).toHaveLength(1);
    expect(examMetadataProblems({ ...exam, domain: 9 }, 102)).toHaveLength(2);
    expect(examMetadataProblems({ ...exam, task: "2.1" }, 102)).toHaveLength(1);
    expect(examMetadataProblems({ ...exam, task: null }, 102)).toEqual([]);
  });

  it("regla 6: con seis o más de respuesta única, ninguna letra domina la unidad", () => {
    expect(correctLetterProblems(["a", "b", "c", "d", "a", "b"])).toEqual([]);
    expect(correctLetterProblems(["a", "a", "a", "b", "c", "d"])).toEqual([]);
    expect(correctLetterProblems(["a", "a", "a", "a", "b", "c"])).toHaveLength(1);
    expect(correctLetterProblems(["a", "a", "a", "b", "c"])).toEqual([]);
  });

  it("regla 7: la unidad publicada declara el mínimo de QUIZ y de respuesta múltiple", () => {
    const singles: readonly QuizKind[] = ["single", "single", "single", "single", "single", "single", "single", "single"];
    const mixed: readonly QuizKind[] = ["single", "single", "single", "single", "single", "single", "multiple", "multiple"];

    expect(typeSpreadProblems(101, true, mixed)).toEqual([]);
    expect(typeSpreadProblems(102, true, mixed)).toEqual([]);
    expect(typeSpreadProblems(101, true, singles)).toEqual([]);
    expect(typeSpreadProblems(102, true, singles)).toHaveLength(1);
    expect(typeSpreadProblems(102, true, ["single", "single", "single"])).toHaveLength(2);
    expect(typeSpreadProblems(102, false, ["single", "single", "single"])).toEqual([]);
  });

  it("los QUIZ con metadatos de examen de la ruta AWS cumplen las reglas 1–5", () => {
    const offenders = unitContents.flatMap((unit) =>
      unit.exercises.flatMap((exercise) => quizProblems(unit.stageId, exercise)),
    );

    expect(offenders, `Preguntas fuera de norma:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("las unidades de la ruta AWS cumplen el reparto de letras y de tipos (reglas 6 y 7)", () => {
    const offenders = unitContents.flatMap((unit) => unitRuleProblems(unit));

    expect(offenders, `Unidades fuera de norma:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("los laboratorios LAB y DEBUG en TypeScript o JavaScript: la solución pasa y el código inicial falla", async () => {
    const labs = exercises.filter(
      ({ exercise }) =>
        (exercise.type === "LAB" || exercise.type === "DEBUG") &&
        (exercise.language === "typescript" || exercise.language === "javascript"),
    );
    const offenders: string[] = [];

    for (const { unitCode, exercise } of labs) {
      const tests = exercise.tests.map((test) => ({
        name: test.name,
        isHidden: test.isHidden,
        code: test.spec.code,
      }));

      offenders.push(
        ...(await labProblems(
          `${unitCode} / ${exercise.slug}`,
          exercise.starterCode ?? "",
          exercise.solution?.code ?? "",
          tests,
          { harness: exercise.harness === "aws" ? aws : null },
        )),
      );
    }

    expect(offenders, `Laboratorios fuera de norma:\n${offenders.join("\n")}`).toEqual([]);
  });

  describe("runLabInProcess y la guarda de laboratorios, con ejemplos sintéticos", () => {
    const tests: readonly LabTest[] = [
      {
        name: "el rango contiene su subred",
        isHidden: false,
        code: 'assert.strictEqual(contains("10.0.0.0/16", "10.0.1.0/24"), true);',
      },
      {
        name: "el rango no contiene otro",
        isHidden: true,
        code: 'assert.strictEqual(contains("10.0.0.0/16", "192.168.0.0/24"), false);',
      },
    ];
    const solution = `export const contains = (outer: string, inner: string): boolean =>
  aws.cidr.contains(outer, inner);`;
    const starter = `export const contains = (outer: string, inner: string): boolean => false;`;
    const options = { harness: aws };

    it("un ejemplo correcto con aws.cidr pasa la guarda", async () => {
      expect(await labProblems("ok", starter, solution, tests, options)).toEqual([]);
    });

    it("quita los tipos y los export de nivel superior antes de ejecutar", async () => {
      const results = await runLabInProcess(solution, tests, options);

      expect(results.map((result) => result.passed)).toEqual([true, true]);
    });

    it("una solución que falla dispara la guarda", async () => {
      const broken = "export const contains = (outer: string, inner: string): boolean => true;";
      const problems = await labProblems("malo", starter, broken, tests, options);

      expect(problems).toEqual(["malo: la solución falla «el rango no contiene otro»"]);
    });

    it("un código inicial que pasa todo dispara la guarda", async () => {
      const problems = await labProblems("malo", solution, solution, tests, options);

      expect(problems).toEqual(["malo: el código inicial no falla ninguna prueba visible"]);
    });

    it("un código inicial que solo falla una prueba oculta también dispara la guarda", async () => {
      const onlyHiddenFails = "export const contains = (outer: string, inner: string): boolean => outer === outer;";
      const problems = await labProblems("malo", onlyHiddenFails, solution, tests, options);

      expect(problems).toEqual(["malo: el código inicial no falla ninguna prueba visible"]);
    });

    it("sin arnés, aws no está a la vista", async () => {
      const results = await runLabInProcess(
        "const x = aws.cidr;",
        [{ name: "t", isHidden: false, code: "assert.ok(true);" }],
        { harness: null },
      );

      expect(results.map((result) => result.passed)).toEqual([false]);
    });
  });
});
