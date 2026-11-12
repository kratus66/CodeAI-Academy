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
  type ContentSeedLesson,
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

/**
 * Guarda de completitud del paquete de una unidad AWS de A0 y A1 (sprint 17,
 * decisiones a, b y c). Se aplica a las unidades de las etapas 100 y 101 cuyo
 * archivo ya tiene al menos un QUIZ, es decir, cuyo paquete ya se empezó.
 */

const PACKAGE_STAGE_IDS: readonly number[] = [100, 101];
const A1_STAGE_ID = 101;
const A1_CERTIFICATION = "CLF-C02";

const MIN_QUIZZES = 8;
const MIN_FLASHCARDS = 6;
const MIN_DIAGNOSTIC_QUIZZES = 12;
const MIN_PREPARATION_DOMAINS = 3;
const MIN_COMMON_ERRORS = 2;

/** Práctica que exige la unidad: arnés, excepción (b), diagnóstico o preparación. */
type PracticeKind = "arnés" | "excepción" | "diagnóstico" | "preparación";

interface PackageRule {
  readonly practice: PracticeKind;
  readonly memory: boolean;
}

/** Copia de las columnas «Práctica» y «MEMORY» de la tabla de unidades del sprint 17. */
const PACKAGE_RULES: Readonly<Record<string, PackageRule>> = {
  "AWS-U0.1.1": { practice: "excepción", memory: true },
  "AWS-U0.1.2": { practice: "excepción", memory: false },
  "AWS-U0.1.3": { practice: "excepción", memory: false },
  "AWS-U0.1.4": { practice: "excepción", memory: false },
  "AWS-U0.1.5": { practice: "diagnóstico", memory: false },
  "AWS-U0.2.1": { practice: "excepción", memory: false },
  "AWS-U0.2.2": { practice: "excepción", memory: false },
  "AWS-U0.2.3": { practice: "excepción", memory: false },
  "AWS-U0.2.4": { practice: "excepción", memory: false },
  "AWS-U0.2.5": { practice: "excepción", memory: true },
  "AWS-U0.3.1": { practice: "arnés", memory: false },
  "AWS-U0.3.2": { practice: "excepción", memory: true },
  "AWS-U0.3.3": { practice: "excepción", memory: false },
  "AWS-U0.3.4": { practice: "excepción", memory: false },
  "AWS-U0.3.5": { practice: "arnés", memory: false },
  "AWS-U1.1.1": { practice: "excepción", memory: false },
  "AWS-U1.1.2": { practice: "excepción", memory: true },
  "AWS-U1.1.3": { practice: "excepción", memory: false },
  "AWS-U1.1.4": { practice: "excepción", memory: false },
  "AWS-U1.1.5": { practice: "excepción", memory: false },
  "AWS-U1.2.1": { practice: "excepción", memory: false },
  "AWS-U1.2.2": { practice: "arnés", memory: false },
  "AWS-U1.2.3": { practice: "excepción", memory: true },
  "AWS-U1.2.4": { practice: "arnés", memory: false },
  "AWS-U1.2.5": { practice: "excepción", memory: false },
  "AWS-U1.3.1": { practice: "arnés", memory: true },
  "AWS-U1.3.2": { practice: "excepción", memory: true },
  "AWS-U1.3.3": { practice: "arnés", memory: true },
  "AWS-U1.3.4": { practice: "arnés", memory: true },
  "AWS-U1.3.5": { practice: "arnés", memory: true },
  "AWS-U1.3.6": { practice: "arnés", memory: true },
  "AWS-U1.4.1": { practice: "arnés", memory: true },
  "AWS-U1.4.2": { practice: "excepción", memory: false },
  "AWS-U1.4.3": { practice: "excepción", memory: false },
  "AWS-U1.5.1": { practice: "preparación", memory: false },
};

type PackageLesson = Pick<ContentSeedLesson, "slug" | "content" | "steps">;

/** Una unidad con sus lecciones y sus ejercicios, tal como la fusiona la semilla. */
interface PackageUnit {
  readonly code: string;
  readonly lessons: readonly PackageLesson[];
  readonly exercises: readonly CourseSeedExercise[];
}

function countOf(unit: PackageUnit, type: CourseSeedExercise["type"]): number {
  return unit.exercises.filter((exercise) => exercise.type === type).length;
}

/** Falta de cantidad mínima de ejercicios de un tipo, o nada. */
function minimumProblem(
  unit: PackageUnit,
  type: CourseSeedExercise["type"],
  minimum: number,
): string[] {
  const found = countOf(unit, type);

  return found >= minimum
    ? []
    : [`${unit.code}: faltan ejercicios ${type} (hay ${found}, mínimo ${minimum})`];
}

function harnessLabProblems(unit: PackageUnit): string[] {
  const hasLab = (ladder: CourseSeedExercise["ladder"]): boolean =>
    unit.exercises.some(
      (exercise) =>
        exercise.type === "LAB" && exercise.ladder === ladder && exercise.harness === "aws",
    );

  return [
    ...(hasLab("GUIDED") ? [] : [`${unit.code}: falta el LAB guiado con arnés aws`]),
    ...(hasLab("AUTONOMOUS") ? [] : [`${unit.code}: falta el LAB autónomo con arnés aws`]),
  ];
}

function preparationDomainProblems(unit: PackageUnit): string[] {
  const domains = new Set(
    unit.exercises.flatMap((exercise) =>
      exercise.type === "QUIZ" && exercise.exam !== null ? [exercise.exam.domain] : [],
    ),
  );

  return domains.size >= MIN_PREPARATION_DOMAINS
    ? []
    : [
        `${unit.code}: los QUIZ de preparación cubren ${domains.size} dominios con exam (mínimo ${MIN_PREPARATION_DOMAINS})`,
      ];
}

function memoryProblems(unit: PackageUnit): string[] {
  const hasMatch = unit.exercises.some(
    (exercise) => exercise.type === "MEMORY" && exercise.memory?.mode === "match",
  );

  return hasMatch ? [] : [`${unit.code}: falta el MEMORY en modo match`];
}

/** Ejercicios que exige cada práctica, además del paquete común. */
function practiceProblems(unit: PackageUnit, practice: PracticeKind): string[] {
  switch (practice) {
    case "arnés":
      return [
        ...minimumProblem(unit, "QUIZ", MIN_QUIZZES),
        ...minimumProblem(unit, "FLASHCARD", MIN_FLASHCARDS),
        ...minimumProblem(unit, "REFLECT", 1),
        ...minimumProblem(unit, "DEBUG", 1),
        ...harnessLabProblems(unit),
      ];
    case "excepción":
      return [
        ...minimumProblem(unit, "QUIZ", MIN_QUIZZES),
        ...minimumProblem(unit, "FLASHCARD", MIN_FLASHCARDS),
        ...minimumProblem(unit, "REFLECT", 1),
        ...minimumProblem(unit, "DEBUG", 2),
        ...minimumProblem(unit, "AUDIT", 1),
      ];
    case "diagnóstico":
      return [
        ...minimumProblem(unit, "QUIZ", MIN_DIAGNOSTIC_QUIZZES),
        ...minimumProblem(unit, "FLASHCARD", MIN_FLASHCARDS),
        ...minimumProblem(unit, "REFLECT", 1),
      ];
    case "preparación":
      return [
        ...minimumProblem(unit, "QUIZ", MIN_QUIZZES),
        ...preparationDomainProblems(unit),
        ...minimumProblem(unit, "REFLECT", 1),
      ];
  }
}

function blockText(block: PackageLesson["content"][number]): string {
  return [block.title ?? "", block.text ?? "", ...(block.items ?? [])].join("\n");
}

/** Reglas de lección AWS: diagrama mermaid, errores comunes y objetivo con la certificación. */
function lessonPackageProblems(
  unit: PackageUnit,
  lesson: PackageLesson,
  stageId: number,
): string[] {
  const label = `${unit.code} / ${lesson.slug}`;
  const problems: string[] = [];

  if (!lesson.content.some((block) => block.type === "mermaid")) {
    problems.push(`${label}: la lección no tiene ningún bloque mermaid`);
  }

  const commonErrors = lesson.content
    .map(blockText)
    .filter((text) => /Error com[uú]n/i.test(text));
  const incomplete = commonErrors.filter(
    (text) => !/causa/i.test(text) || !/soluci[oó]n/i.test(text),
  );

  if (commonErrors.length < MIN_COMMON_ERRORS) {
    problems.push(
      `${label}: la lección tiene ${commonErrors.length} «Error común» (mínimo ${MIN_COMMON_ERRORS})`,
    );
  }
  if (incomplete.length > 0) {
    problems.push(`${label}: hay un «Error común» sin causa o sin solución`);
  }

  if (stageId === A1_STAGE_ID) {
    const objective = lesson.steps.find((step) => step.kind === "objective")?.body ?? "";

    if (!objective.includes(A1_CERTIFICATION)) {
      problems.push(`${label}: el paso objective no cita ${A1_CERTIFICATION}`);
    }
  }

  return problems;
}

/**
 * Piezas que faltan al paquete de una unidad de A0 o A1. `exceptions` es la
 * tabla de reglas por unidad (`PACKAGE_RULES`). Los mensajes nombran la unidad
 * y la pieza que falta.
 */
function unitPackageProblems(
  unit: PackageUnit,
  stageId: number,
  exceptions: Readonly<Record<string, PackageRule>>,
): string[] {
  const rule = exceptions[unit.code];

  if (rule === undefined) {
    return [`${unit.code}: la unidad no figura en la tabla de reglas del paquete`];
  }

  return [
    ...(unit.lessons.length === 0 ? [`${unit.code}: falta la lección`] : []),
    ...unit.lessons.flatMap((lesson) => lessonPackageProblems(unit, lesson, stageId)),
    ...practiceProblems(unit, rule.practice),
    ...(rule.memory ? memoryProblems(unit) : []),
  ];
}

const packageUnits: { readonly unit: PackageUnit; readonly stageId: number }[] =
  merged.seed.stages.flatMap((stage) =>
    PACKAGE_STAGE_IDS.includes(stage.id)
      ? stage.modules.flatMap((module) =>
          module.units
            .filter((unit) => unit.exercises.some((exercise) => exercise.type === "QUIZ"))
            .map((unit) => ({ unit, stageId: stage.id })),
        )
      : [],
  );

function syntheticExercise(
  type: CourseSeedExercise["type"],
  index: number,
  overrides: Partial<CourseSeedExercise> = {},
): CourseSeedExercise {
  return {
    slug: `sintetico-${type.toLowerCase()}-${index}`,
    type,
    title: `Ejercicio ${type} ${index}`,
    statement: "Enunciado sintético",
    ladder: "SEMI",
    difficulty: 2,
    concepts: ["concepto"],
    competencies: ["AWS-C1"],
    estimatedMin: null,
    language: null,
    starterCode: null,
    solution: null,
    harness: null,
    quiz: null,
    flashcard: null,
    memory: null,
    audit: null,
    cloudLab: null,
    sources: ["https://docs.aws.amazon.com/"],
    maxAttempts: null,
    isPublished: false,
    order: index,
    hints: [],
    tests: [],
    exam: null,
    ...overrides,
  };
}

function repeated(type: CourseSeedExercise["type"], count: number): CourseSeedExercise[] {
  return Array.from({ length: count }, (_, index) => syntheticExercise(type, index + 1));
}

function syntheticMemory(mode: "flip" | "match"): CourseSeedExercise {
  return syntheticExercise("MEMORY", 1, {
    memory: {
      mode,
      pairs: Array.from({ length: 6 }, (_, index) => ({
        id: `par-${index + 1}`,
        term: `Término ${index + 1}`,
        definition: `Definición ${index + 1}`,
      })),
      intro: null,
    },
  });
}

function syntheticLab(
  ladder: CourseSeedExercise["ladder"],
  harness: CourseSeedExercise["harness"],
): CourseSeedExercise {
  return syntheticExercise("LAB", ladder === "GUIDED" ? 1 : 2, { ladder, harness });
}

function syntheticLesson(
  options: { mermaid?: boolean; commonErrors?: number; objective?: string } = {},
): PackageLesson {
  const { mermaid = true, commonErrors = 2, objective = "Explicar el tema según CLF-C02." } =
    options;

  return {
    slug: "leccion-sintetica",
    content: [
      { type: "paragraph", title: "Idea central", text: "Texto de la idea central." },
      ...(mermaid ? [{ type: "mermaid" as const, title: "Diagrama", code: "graph TD; A-->B" }] : []),
      ...Array.from({ length: commonErrors }, (_, index) => ({
        type: "callout" as const,
        title: `Error común ${index + 1}: confusión`,
        text: "Causa: se confunden dos conceptos. Solución: contrastarlos con la documentación.",
      })),
    ],
    steps: [
      { kind: "objective", title: "Objetivo medible", body: objective },
      { kind: "explanation", title: "Explicación", body: "Texto." },
      { kind: "guided_practice", title: "Práctica guiada", body: "Texto." },
      { kind: "independent_practice", title: "Práctica independiente", body: "Texto." },
      { kind: "debug", title: "Depuración", body: "Texto." },
      { kind: "assessment", title: "Evaluación", body: "Texto." },
      { kind: "transfer", title: "Transferencia", body: "Texto." },
    ],
  };
}

function syntheticUnit(
  code: string,
  exercises: readonly CourseSeedExercise[],
  lesson: PackageLesson = syntheticLesson(),
): PackageUnit {
  return { code, lessons: [lesson], exercises };
}

function examQuizzes(count: number, domains: readonly number[]): CourseSeedExercise[] {
  return Array.from({ length: count }, (_, index) =>
    syntheticExercise("QUIZ", index + 1, {
      exam: {
        certification: "CLF-C02",
        domain: domains[index % domains.length] ?? 1,
        task: null,
        pool: "unit",
      },
    }),
  );
}

const SYNTHETIC_RULES: Readonly<Record<string, PackageRule>> = {
  "AWS-U0.9.1": { practice: "arnés", memory: true },
  "AWS-U0.9.2": { practice: "excepción", memory: true },
  "AWS-U0.9.3": { practice: "diagnóstico", memory: false },
  "AWS-U1.9.1": { practice: "preparación", memory: false },
};

const harnessExercises = (): CourseSeedExercise[] => [
  ...repeated("QUIZ", 8),
  ...repeated("FLASHCARD", 6),
  ...repeated("REFLECT", 1),
  ...repeated("DEBUG", 1),
  syntheticLab("GUIDED", "aws"),
  syntheticLab("AUTONOMOUS", "aws"),
  syntheticMemory("match"),
];

const exceptionExercises = (): CourseSeedExercise[] => [
  ...repeated("QUIZ", 8),
  ...repeated("FLASHCARD", 6),
  ...repeated("REFLECT", 1),
  ...repeated("DEBUG", 2),
  ...repeated("AUDIT", 1),
  syntheticMemory("match"),
];

const diagnosticExercises = (): CourseSeedExercise[] => [
  ...repeated("QUIZ", 12),
  ...repeated("FLASHCARD", 6),
  ...repeated("REFLECT", 1),
];

const preparationExercises = (): CourseSeedExercise[] => [
  ...examQuizzes(8, [1, 2, 3, 4]),
  ...repeated("REFLECT", 1),
];

const without = (
  exercises: readonly CourseSeedExercise[],
  predicate: (exercise: CourseSeedExercise) => boolean,
): CourseSeedExercise[] => exercises.filter((exercise) => !predicate(exercise));

describe("guarda de completitud del paquete de las unidades AWS", () => {
  it("la tabla PACKAGE_RULES tiene las 35 unidades de A0 y A1 del esqueleto", () => {
    const skeletonCodes = skeleton.stages
      .filter((stage) => PACKAGE_STAGE_IDS.includes(stage.id))
      .flatMap((stage) => stage.modules.flatMap((module) => module.units.map((unit) => unit.code)));

    expect(Object.keys(PACKAGE_RULES)).toHaveLength(35);
    expect([...Object.keys(PACKAGE_RULES)].sort()).toEqual([...skeletonCodes].sort());
  });

  it("la tabla marca 12 unidades con MEMORY y reparte las prácticas como el sprint 17", () => {
    const rules = Object.values(PACKAGE_RULES);
    const count = (practice: PracticeKind): number =>
      rules.filter((rule) => rule.practice === practice).length;

    expect(rules.filter((rule) => rule.memory)).toHaveLength(12);
    expect(count("diagnóstico")).toBe(1);
    expect(count("preparación")).toBe(1);
    expect(count("arnés")).toBe(10);
    expect(count("excepción")).toBe(23);
  });

  it("una unidad de arnés completa no tiene problemas", () => {
    const unit = syntheticUnit("AWS-U0.9.1", harnessExercises());

    expect(unitPackageProblems(unit, 100, SYNTHETIC_RULES)).toEqual([]);
  });

  it("una unidad de excepción completa no tiene problemas", () => {
    const unit = syntheticUnit("AWS-U0.9.2", exceptionExercises());

    expect(unitPackageProblems(unit, 100, SYNTHETIC_RULES)).toEqual([]);
  });

  it("una unidad de diagnóstico completa no tiene problemas, sin DEBUG ni AUDIT", () => {
    const unit = syntheticUnit("AWS-U0.9.3", diagnosticExercises());

    expect(unitPackageProblems(unit, 100, SYNTHETIC_RULES)).toEqual([]);
  });

  it("una unidad de preparación completa no tiene problemas, sin LAB ni AUDIT", () => {
    const unit = syntheticUnit("AWS-U1.9.1", preparationExercises());

    expect(unitPackageProblems(unit, 101, SYNTHETIC_RULES)).toEqual([]);
  });

  it("el CLOUD_LAB opcional no se exige ni estorba", () => {
    const unit = syntheticUnit("AWS-U0.9.2", [...exceptionExercises(), ...repeated("CLOUD_LAB", 1)]);

    expect(unitPackageProblems(unit, 100, SYNTHETIC_RULES)).toEqual([]);
  });

  it("nombra la pieza que falta en una unidad de arnés", () => {
    const check = (exercises: readonly CourseSeedExercise[]): string[] =>
      unitPackageProblems(syntheticUnit("AWS-U0.9.1", exercises), 100, SYNTHETIC_RULES);
    const base = harnessExercises();

    expect(check([...without(base, (e) => e.type === "QUIZ"), ...repeated("QUIZ", 7)])).toEqual([
      "AWS-U0.9.1: faltan ejercicios QUIZ (hay 7, mínimo 8)",
    ]);
    expect(check(without(base, (e) => e.type === "FLASHCARD"))).toEqual([
      "AWS-U0.9.1: faltan ejercicios FLASHCARD (hay 0, mínimo 6)",
    ]);
    expect(check(without(base, (e) => e.type === "REFLECT"))).toEqual([
      "AWS-U0.9.1: faltan ejercicios REFLECT (hay 0, mínimo 1)",
    ]);
    expect(check(without(base, (e) => e.type === "DEBUG"))).toEqual([
      "AWS-U0.9.1: faltan ejercicios DEBUG (hay 0, mínimo 1)",
    ]);
    expect(check(without(base, (e) => e.type === "LAB" && e.ladder === "GUIDED"))).toEqual([
      "AWS-U0.9.1: falta el LAB guiado con arnés aws",
    ]);
    expect(check(without(base, (e) => e.type === "LAB" && e.ladder === "AUTONOMOUS"))).toEqual([
      "AWS-U0.9.1: falta el LAB autónomo con arnés aws",
    ]);
    expect(check(without(base, (e) => e.type === "MEMORY"))).toEqual([
      "AWS-U0.9.1: falta el MEMORY en modo match",
    ]);
  });

  it("un LAB sin arnés o un MEMORY en modo flip no cuentan", () => {
    const noHarness = [
      ...without(harnessExercises(), (e) => e.type === "LAB"),
      syntheticLab("GUIDED", null),
      syntheticLab("AUTONOMOUS", "aws"),
    ];
    const flip = [...without(harnessExercises(), (e) => e.type === "MEMORY"), syntheticMemory("flip")];

    expect(unitPackageProblems(syntheticUnit("AWS-U0.9.1", noHarness), 100, SYNTHETIC_RULES)).toEqual([
      "AWS-U0.9.1: falta el LAB guiado con arnés aws",
    ]);
    expect(unitPackageProblems(syntheticUnit("AWS-U0.9.1", flip), 100, SYNTHETIC_RULES)).toEqual([
      "AWS-U0.9.1: falta el MEMORY en modo match",
    ]);
  });

  it("nombra la pieza que falta en una unidad de excepción", () => {
    const check = (exercises: readonly CourseSeedExercise[]): string[] =>
      unitPackageProblems(syntheticUnit("AWS-U0.9.2", exercises), 100, SYNTHETIC_RULES);
    const base = exceptionExercises();

    expect(check(without(base, (e) => e.type === "AUDIT"))).toEqual([
      "AWS-U0.9.2: faltan ejercicios AUDIT (hay 0, mínimo 1)",
    ]);
    expect(check([...without(base, (e) => e.type === "DEBUG"), ...repeated("DEBUG", 1)])).toEqual([
      "AWS-U0.9.2: faltan ejercicios DEBUG (hay 1, mínimo 2)",
    ]);
    expect(check(without(base, (e) => e.type === "MEMORY"))).toEqual([
      "AWS-U0.9.2: falta el MEMORY en modo match",
    ]);
  });

  it("nombra la pieza que falta en el diagnóstico y en la preparación", () => {
    const diagnostic = (exercises: readonly CourseSeedExercise[]): string[] =>
      unitPackageProblems(syntheticUnit("AWS-U0.9.3", exercises), 100, SYNTHETIC_RULES);
    const preparation = (exercises: readonly CourseSeedExercise[]): string[] =>
      unitPackageProblems(syntheticUnit("AWS-U1.9.1", exercises), 101, SYNTHETIC_RULES);
    const base = diagnosticExercises();

    expect(diagnostic([...without(base, (e) => e.type === "QUIZ"), ...repeated("QUIZ", 11)])).toEqual([
      "AWS-U0.9.3: faltan ejercicios QUIZ (hay 11, mínimo 12)",
    ]);
    expect(diagnostic(without(base, (e) => e.type === "REFLECT"))).toEqual([
      "AWS-U0.9.3: faltan ejercicios REFLECT (hay 0, mínimo 1)",
    ]);
    expect(preparation([...examQuizzes(7, [1, 2, 3]), ...repeated("REFLECT", 1)])).toEqual([
      "AWS-U1.9.1: faltan ejercicios QUIZ (hay 7, mínimo 8)",
    ]);
    expect(preparation([...examQuizzes(8, [1, 2]), ...repeated("REFLECT", 1)])).toEqual([
      "AWS-U1.9.1: los QUIZ de preparación cubren 2 dominios con exam (mínimo 3)",
    ]);
    expect(preparation(examQuizzes(8, [1, 2, 3]))).toEqual([
      "AWS-U1.9.1: faltan ejercicios REFLECT (hay 0, mínimo 1)",
    ]);
  });

  it("nombra la pieza que falta en la lección", () => {
    const check = (lesson: PackageLesson, stageId = 101): string[] =>
      unitPackageProblems(
        syntheticUnit("AWS-U0.9.2", exceptionExercises(), lesson),
        stageId,
        SYNTHETIC_RULES,
      );

    expect(check(syntheticLesson({ mermaid: false }))).toEqual([
      "AWS-U0.9.2 / leccion-sintetica: la lección no tiene ningún bloque mermaid",
    ]);
    expect(check(syntheticLesson({ commonErrors: 1 }))).toEqual([
      "AWS-U0.9.2 / leccion-sintetica: la lección tiene 1 «Error común» (mínimo 2)",
    ]);
    expect(check(syntheticLesson({ objective: "Explicar el tema." }))).toEqual([
      "AWS-U0.9.2 / leccion-sintetica: el paso objective no cita CLF-C02",
    ]);
    expect(check(syntheticLesson({ objective: "Explicar el tema." }), 100)).toEqual([]);
  });

  it("un «Error común» sin causa o sin solución no cuenta como completo", () => {
    const lesson = syntheticLesson();
    const broken: PackageLesson = {
      ...lesson,
      content: [
        ...lesson.content.slice(0, 3),
        { type: "callout", title: "Error común 2: algo", text: "Solo se describe el fallo." },
      ],
    };

    expect(
      unitPackageProblems(syntheticUnit("AWS-U0.9.2", exceptionExercises(), broken), 101, SYNTHETIC_RULES),
    ).toEqual(["AWS-U0.9.2 / leccion-sintetica: hay un «Error común» sin causa o sin solución"]);
  });

  it("una unidad sin lección o fuera de la tabla también se señala", () => {
    const noLesson: PackageUnit = { code: "AWS-U0.9.2", lessons: [], exercises: exceptionExercises() };

    expect(unitPackageProblems(noLesson, 100, SYNTHETIC_RULES)).toEqual([
      "AWS-U0.9.2: falta la lección",
    ]);
    expect(unitPackageProblems(syntheticUnit("AWS-U9.9.9", []), 100, SYNTHETIC_RULES)).toEqual([
      "AWS-U9.9.9: la unidad no figura en la tabla de reglas del paquete",
    ]);
  });

  it("las unidades de A0 y A1 con algún QUIZ tienen el paquete completo", () => {
    const offenders = packageUnits.flatMap(({ unit, stageId }) =>
      unitPackageProblems(unit, stageId, PACKAGE_RULES),
    );

    expect(offenders, `Paquetes incompletos:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("los pilotos actuales, sin QUIZ, no se evalúan todavía", () => {
    const evaluated = packageUnits.map(({ unit }) => unit.code);

    expect(evaluated).not.toContain("AWS-U0.2.2");
    expect(evaluated).not.toContain("AWS-U0.3.1");
  });
});
