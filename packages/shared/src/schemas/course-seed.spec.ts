import type { z } from "zod";
import { describe, expect, it } from "vitest";

import { contentSeedExerciseSchema, contentSeedLessonSchema } from "./content";
import type { ContentSeedExercise, ContentSeedLesson } from "./content";
import {
  courseSeedExerciseSchema,
  courseSeedSchema,
  courseUnitFileSchema,
  examBankFileSchema,
  mergeCourseSeed,
  mergeExamBankFiles,
} from "./course-seed";
import type {
  CourseSeed,
  CourseSeedExercise,
  CourseUnitFile,
  CourseUnitFileEntry,
} from "./course-seed";

type SeedInput = z.input<typeof courseSeedSchema>;
type StageInput = SeedInput["stages"][number];
type ModuleInput = StageInput["modules"][number];
type UnitInput = ModuleInput["units"][number];
type LessonInput = z.input<typeof contentSeedLessonSchema>;

/** Semilla mínima válida de aws-cloud: una etapa 100, un módulo y una unidad. */
function validSeed(): SeedInput {
  return {
    course: {
      slug: "aws-cloud",
      title: "Ruta AWS Cloud",
      objective: "Preparar las certificaciones de AWS.",
      notice: "Ruta independiente de preparación.",
      order: 1,
      isPublished: false,
    },
    stages: [
      {
        id: 100,
        slug: "aws0-fundamentos",
        title: "Fundamentos de AWS",
        objective: "Situar los servicios básicos de AWS.",
        level: 1,
        estimatedMin: 900,
        order: 1,
        isPublished: false,
        modules: [
          {
            code: "AWS-M0.1",
            title: "Módulo 0.1",
            order: 1,
            isPublished: false,
            units: [
              {
                code: "AWS-U0.1.1",
                title: "Unidad 0.1.1",
                objective: "Describir un servicio de AWS.",
                order: 1,
                isPublished: false,
              },
            ],
          },
        ],
      },
    ],
  };
}

function stageOf(seed: SeedInput): StageInput {
  const stage = seed.stages[0];

  if (!stage) {
    throw new Error("El fixture no declara ninguna etapa");
  }

  return stage;
}

function moduleOf(seed: SeedInput): ModuleInput {
  const module = stageOf(seed).modules[0];

  if (!module) {
    throw new Error("El fixture no declara ningún módulo");
  }

  return module;
}

function unitOf(seed: SeedInput): UnitInput {
  const unit = moduleOf(seed).units[0];

  if (!unit) {
    throw new Error("El fixture no declara ninguna unidad");
  }

  return unit;
}

/** Siete pasos de instrucción que cumplen el mínimo de la lección. */
const STEPS: LessonInput["steps"] = [
  { kind: "objective", title: "Objetivo", body: "Comprender el concepto." },
  { kind: "explanation", title: "Explicación", body: "Se explica el concepto." },
  { kind: "guided_practice", title: "Práctica guiada", body: "Se practica con ayuda." },
  { kind: "independent_practice", title: "Práctica autónoma", body: "Se practica sin ayuda." },
  { kind: "debug", title: "Depuración", body: "Se corrige un error." },
  { kind: "assessment", title: "Evaluación", body: "Se comprueba lo aprendido." },
  { kind: "transfer", title: "Transferencia", body: "Se aplica a otro caso." },
];

function lessonFixture(
  slug: string,
  overrides: Record<string, unknown> = {},
): ContentSeedLesson {
  return contentSeedLessonSchema.parse({
    slug,
    title: `Lección ${slug}`,
    order: 1,
    isPublished: false,
    content: [{ type: "paragraph", text: "Contenido de la lección." }],
    steps: STEPS,
    ...overrides,
  });
}

function readingExercise(competencies: string[]): ContentSeedExercise {
  return contentSeedExerciseSchema.parse({
    slug: "leer-servicios-aws",
    type: "READING",
    title: "Leer sobre servicios AWS",
    statement: "Enunciado con ejemplo.",
    ladder: "GUIDED",
    difficulty: 2,
    concepts: ["cloud"],
    competencies,
    sources: ["https://docs.aws.amazon.com/"],
    isPublished: false,
    order: 1,
  });
}

function quizWithoutOptions(): ContentSeedExercise {
  return contentSeedExerciseSchema.parse({
    slug: "quiz-servicios-aws",
    type: "QUIZ",
    title: "Quiz de servicios AWS",
    statement: "Enunciado con ejemplo.",
    ladder: "SEMI",
    difficulty: 1,
    concepts: ["cloud"],
    competencies: ["AWS-C1"],
    sources: ["https://docs.aws.amazon.com/"],
    isPublished: false,
    order: 1,
  });
}

/** Semilla mínima válida con la etapa 102 (SAA-C03) en lugar de la 100. */
function examSeed(): SeedInput {
  const seed = validSeed();
  const stage = stageOf(seed);
  stage.id = 102;
  stage.slug = "aws2-arquitecto";
  stage.title = "Arquitecto de soluciones";
  moduleOf(seed).code = "AWS-M2.1";
  unitOf(seed).code = "AWS-U2.1.1";

  return seed;
}

/** Metadatos de examen válidos para la etapa 102: SAA-C03, dominio 1, tarea 1.2. */
function examFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { certification: "SAA-C03", domain: 1, task: "1.2", pool: "unit", ...overrides };
}

/** QUIZ válido de la etapa 102; declara `exam` solo si el caso lo pide. */
function quizExercise(overrides: Record<string, unknown> = {}): CourseSeedExercise {
  return courseSeedExerciseSchema.parse({
    slug: "quiz-diseno-seguro",
    type: "QUIZ",
    title: "Quiz de diseño seguro",
    statement: "¿Qué servicio aplica el principio de menor privilegio?",
    ladder: "SEMI",
    difficulty: 1,
    concepts: ["iam"],
    competencies: ["AWS-C1"],
    sources: ["https://docs.aws.amazon.com/"],
    quiz: {
      options: [
        {
          id: "a",
          text: "AWS Identity and Access Management",
          explanation: "Gestiona identidades y permisos.",
        },
        {
          id: "b",
          text: "Amazon CloudFront",
          explanation: "Distribuye contenido desde el borde.",
        },
        { id: "c", text: "Amazon S3", explanation: "Almacena objetos en cubos." },
      ],
      correctOptionId: "a",
    },
    isPublished: false,
    order: 1,
    ...overrides,
  });
}

function unitFile(code: string, lessons: readonly ContentSeedLesson[]): CourseUnitFile {
  return courseUnitFileSchema.parse({ code, lessons });
}

function unitFileWithExercises(
  code: string,
  lessons: readonly ContentSeedLesson[],
  exercises: readonly CourseSeedExercise[],
): CourseUnitFile {
  return courseUnitFileSchema.parse({ code, lessons, exercises });
}

function entry(fileName: string, unit: CourseUnitFile): CourseUnitFileEntry {
  return { fileName, unit };
}

function messagesOf(result: { error: z.ZodError }): string[] {
  return result.error.issues.map((issue) => issue.message);
}

function pathsOf(result: { error: z.ZodError }): (string | number)[][] {
  return result.error.issues.map((issue) => issue.path);
}

interface ParseFailure {
  readonly error: z.ZodError;
}

/** Aplica una mutación al fixture y exige que la validación falle. */
function invalidSeed(mutate: (seed: SeedInput) => void): ParseFailure {
  const seed = validSeed();
  mutate(seed);

  const result = courseSeedSchema.safeParse(seed);

  if (result.success) {
    throw new Error("Se esperaba que la semilla fuese inválida");
  }

  return result;
}

/** Exige que la validación de la semilla indicada falle y devuelve el error. */
function invalidSeedOf(seed: SeedInput): ParseFailure {
  const result = courseSeedSchema.safeParse(seed);

  if (result.success) {
    throw new Error("Se esperaba que la semilla fuese inválida");
  }

  return result;
}

describe("courseSeedSchema", () => {
  it("acepta una semilla mínima válida de aws-cloud", () => {
    expect(courseSeedSchema.safeParse(validSeed()).success).toBe(true);
  });

  it("rechaza la ruta por defecto", () => {
    const result = invalidSeed((seed) => {
      seed.course.slug = "fullstack-ia";
    });

    expect(messagesOf(result)).toContain(
      "La ruta por defecto se siembra con content.seed.json",
    );
    expect(pathsOf(result)).toContainEqual(["course", "slug"]);
  });

  it("rechaza una etapa cuyo id pertenece a otra ruta", () => {
    const result = invalidSeed((seed) => {
      const stage = stageOf(seed);
      stage.id = 0;
      stage.slug = "e0-fundamentos";
      moduleOf(seed).code = "M0.1";
      unitOf(seed).code = "U0.1.1";
    });

    expect(messagesOf(result)).toContain("La etapa 0 no pertenece a la ruta aws-cloud");
    expect(pathsOf(result)).toContainEqual(["stages", 0, "id"]);
  });

  it("rechaza un slug de etapa que no corresponde a su ruta", () => {
    const result = invalidSeed((seed) => {
      stageOf(seed).slug = "e0-fundamentos";
    });

    expect(messagesOf(result)).toContain(
      "El slug e0-fundamentos no corresponde a la etapa 100",
    );
    expect(pathsOf(result)).toContainEqual(["stages", 0, "slug"]);
  });

  it("rechaza una unidad con código duplicado", () => {
    const result = invalidSeed((seed) => {
      moduleOf(seed).units.push({
        code: "AWS-U0.1.1",
        title: "Otra unidad",
        objective: "Objetivo duplicado.",
        order: 2,
        isPublished: false,
      });
    });

    expect(messagesOf(result)).toContain("Unidad duplicada: AWS-U0.1.1");
    expect(pathsOf(result)).toContainEqual(["stages", 0, "modules", 0, "units", 1, "code"]);
  });

  it("rechaza un orden repetido entre unidades hermanas", () => {
    const result = invalidSeed((seed) => {
      moduleOf(seed).units.push({
        code: "AWS-U0.1.2",
        title: "Segunda unidad",
        objective: "Objetivo de la segunda unidad.",
        order: 1,
        isPublished: false,
      });
    });

    expect(messagesOf(result)).toContain("Orden de unidad repetido en AWS-M0.1: 1");
    expect(pathsOf(result)).toContainEqual(["stages", 0, "modules", 0, "units", 1, "order"]);
  });

  it("acepta el mismo orden de lección y de ejercicio en unidades hermanas", () => {
    const seed = validSeed();
    unitOf(seed).lessons = [lessonFixture("leccion-uno")];
    unitOf(seed).exercises = [readingExercise(["AWS-C1"])];
    moduleOf(seed).units.push({
      code: "AWS-U0.1.2",
      title: "Segunda unidad",
      objective: "Objetivo de la segunda unidad.",
      order: 2,
      isPublished: false,
      lessons: [lessonFixture("leccion-dos")],
      exercises: [{ ...readingExercise(["AWS-C1"]), slug: "leer-servicios-aws-dos" }],
    });

    expect(courseSeedSchema.safeParse(seed).success).toBe(true);
  });

  it("rechaza un orden de lección repetido dentro de la misma unidad", () => {
    const result = invalidSeed((seed) => {
      unitOf(seed).lessons = [lessonFixture("leccion-uno"), lessonFixture("leccion-dos")];
    });

    expect(messagesOf(result)).toContain("Orden de lección repetido en AWS-U0.1.1: 1");
    expect(pathsOf(result)).toContainEqual([
      "stages",
      0,
      "modules",
      0,
      "units",
      0,
      "lessons",
      1,
      "order",
    ]);
  });

  it("rechaza un módulo cuyo código no pertenece a su etapa", () => {
    const result = invalidSeed((seed) => {
      moduleOf(seed).code = "AWS-M1.1";
      unitOf(seed).code = "AWS-U1.1.1";
    });

    expect(messagesOf(result)).toContain("El módulo AWS-M1.1 no pertenece a la etapa 100");
    expect(pathsOf(result)).toContainEqual(["stages", 0, "modules", 0, "code"]);
  });

  it("rechaza una unidad cuyo código no pertenece a su módulo", () => {
    const result = invalidSeed((seed) => {
      unitOf(seed).code = "AWS-U0.2.1";
    });

    expect(messagesOf(result)).toContain(
      "La unidad AWS-U0.2.1 no pertenece al módulo AWS-M0.1",
    );
    expect(pathsOf(result)).toContainEqual(["stages", 0, "modules", 0, "units", 0, "code"]);
  });

  it("rechaza un prerrequisito que no existe en la semilla", () => {
    const result = invalidSeed((seed) => {
      unitOf(seed).prerequisiteIds = ["AWS-U9.9.9"];
    });

    expect(messagesOf(result)).toContain("Prerrequisito inexistente: AWS-U9.9.9");
    expect(pathsOf(result)).toContainEqual([
      "stages",
      0,
      "modules",
      0,
      "units",
      0,
      "prerequisiteIds",
      0,
    ]);
  });

  it("rechaza una lección que enlaza un recurso inexistente", () => {
    const result = invalidSeed((seed) => {
      unitOf(seed).lessons = [
        lessonFixture("leccion-uno", {
          resources: [{ resourceSlug: "recurso-inexistente", order: 1 }],
        }),
      ];
    });

    expect(messagesOf(result)).toContain(
      "La lección leccion-uno enlaza un recurso inexistente: recurso-inexistente",
    );
    expect(pathsOf(result)).toContainEqual([
      "stages",
      0,
      "modules",
      0,
      "units",
      0,
      "lessons",
      0,
      "resources",
      0,
      "resourceSlug",
    ]);
  });

  it("rechaza un ejercicio con una competencia de otra ruta", () => {
    const result = invalidSeed((seed) => {
      unitOf(seed).exercises = [readingExercise(["C1"])];
    });

    expect(messagesOf(result)).toContain("La competencia C1 no pertenece a la ruta aws-cloud");
    expect(pathsOf(result)).toContainEqual([
      "stages",
      0,
      "modules",
      0,
      "units",
      0,
      "exercises",
      0,
      "competencies",
      0,
    ]);
  });

  it("rechaza un ejercicio que incumple las reglas duras", () => {
    const result = invalidSeed((seed) => {
      unitOf(seed).exercises = [quizWithoutOptions()];
    });

    expect(messagesOf(result)).toContain(
      "Ejercicio quiz-servicios-aws: un QUIZ requiere quiz (opciones y respuesta)",
    );
    expect(pathsOf(result)).toContainEqual([
      "stages",
      0,
      "modules",
      0,
      "units",
      0,
      "exercises",
      0,
    ]);
  });
});

function parsedSeed(): CourseSeed {
  return courseSeedSchema.parse(validSeed());
}

function parsedSeedWithTwoUnits(): CourseSeed {
  const seed = validSeed();
  moduleOf(seed).units.push({
    code: "AWS-U0.1.2",
    title: "Segunda unidad",
    objective: "Objetivo de la segunda unidad.",
    order: 2,
    isPublished: false,
  });

  return courseSeedSchema.parse(seed);
}

function parsedSeedWithLesson(): CourseSeed {
  const seed = validSeed();
  unitOf(seed).lessons = [lessonFixture("leccion-propia")];

  return courseSeedSchema.parse(seed);
}

function parsedExamSeed(): CourseSeed {
  return courseSeedSchema.parse(examSeed());
}

describe("exam de los ejercicios", () => {
  it("acepta un QUIZ de la etapa 102 que declara exam", () => {
    const seed = examSeed();
    unitOf(seed).exercises = [quizExercise({ exam: examFixture() })];

    const result = courseSeedSchema.safeParse(seed);

    expect(result.success).toBe(true);
    expect(result.success ? result.data.stages[0]?.modules[0]?.units[0]?.exercises[0]?.exam : null)
      .toEqual({ certification: "SAA-C03", domain: 1, task: "1.2", pool: "unit" });
  });

  it("exige exam a un QUIZ de una etapa con certificación", () => {
    const seed = examSeed();
    unitOf(seed).exercises = [quizExercise()];

    const result = invalidSeedOf(seed);

    expect(messagesOf(result)).toContain(
      "Ejercicio quiz-diseno-seguro: un QUIZ de la etapa 102 requiere exam",
    );
    expect(pathsOf(result)).toContainEqual([
      "stages",
      0,
      "modules",
      0,
      "units",
      0,
      "exercises",
      0,
    ]);
  });

  it("rechaza una certificación que no corresponde a la etapa", () => {
    const seed = examSeed();
    unitOf(seed).exercises = [quizExercise({ exam: examFixture({ certification: "CLF-C02" }) })];

    const result = invalidSeedOf(seed);

    expect(messagesOf(result)).toContain(
      "Ejercicio quiz-diseno-seguro: la certificación CLF-C02 no corresponde a la etapa 102",
    );
  });

  it("rechaza un dominio que no existe en la certificación", () => {
    const seed = examSeed();
    unitOf(seed).exercises = [quizExercise({ exam: examFixture({ domain: 5, task: null }) })];

    const result = invalidSeedOf(seed);

    expect(messagesOf(result)).toContain(
      "Ejercicio quiz-diseno-seguro: el dominio 5 no existe en SAA-C03",
    );
  });

  it("rechaza una tarea que no pertenece al dominio", () => {
    const seed = examSeed();
    unitOf(seed).exercises = [quizExercise({ exam: examFixture({ task: "2.3" }) })];

    const result = invalidSeedOf(seed);

    expect(messagesOf(result)).toContain(
      "Ejercicio quiz-diseno-seguro: la tarea 2.3 no pertenece al dominio 1",
    );
  });

  it("solo un QUIZ declara exam", () => {
    const seed = examSeed();
    const reading = courseSeedExerciseSchema.parse({
      ...readingExercise(["AWS-C1"]),
      exam: examFixture(),
    });

    unitOf(seed).exercises = [reading];

    const result = invalidSeedOf(seed);

    expect(messagesOf(result)).toContain("Ejercicio leer-servicios-aws: solo un QUIZ declara exam");
  });

  it("deja pool en unit y task en null cuando el examen no los declara", () => {
    const seed = examSeed();
    unitOf(seed).exercises = [quizExercise({ exam: { certification: "SAA-C03", domain: 2 } })];

    const parsed = courseSeedSchema.parse(seed);

    expect(parsed.stages[0]?.modules[0]?.units[0]?.exercises[0]?.exam).toEqual({
      certification: "SAA-C03",
      domain: 2,
      task: null,
      pool: "unit",
    });
  });

  it("acepta un QUIZ de la etapa 100 sin exam", () => {
    const seed = validSeed();
    unitOf(seed).exercises = [quizExercise()];

    expect(courseSeedSchema.safeParse(seed).success).toBe(true);
  });

  it("rechaza exam en un QUIZ de la etapa 100", () => {
    const seed = validSeed();
    unitOf(seed).exercises = [quizExercise({ exam: examFixture() })];

    const result = invalidSeedOf(seed);

    expect(messagesOf(result)).toContain(
      "Ejercicio quiz-diseno-seguro: la certificación SAA-C03 no corresponde a la etapa 100",
    );
  });
});

describe("mergeCourseSeed", () => {
  it("fusiona las unidades y conserva el orden del esqueleto", () => {
    const skeleton = parsedSeedWithTwoUnits();
    const files = [
      entry("AWS-U0.1.2.json", unitFile("AWS-U0.1.2", [lessonFixture("leccion-dos")])),
      entry("AWS-U0.1.1.json", unitFile("AWS-U0.1.1", [lessonFixture("leccion-uno")])),
    ];

    const { seed, problems } = mergeCourseSeed(skeleton, files);
    const units = seed.stages[0]?.modules[0]?.units ?? [];

    expect(problems).toEqual([]);
    expect(units.map((unit) => unit.code)).toEqual(["AWS-U0.1.1", "AWS-U0.1.2"]);
    expect(units[0]?.lessons.map((lesson) => lesson.slug)).toEqual(["leccion-uno"]);
    expect(units[1]?.lessons.map((lesson) => lesson.slug)).toEqual(["leccion-dos"]);
  });

  it("ignora un archivo cuyo nombre no coincide con su unidad", () => {
    const files = [
      entry("otro.json", unitFile("AWS-U0.1.1", [lessonFixture("leccion-uno")])),
    ];

    const { seed, problems } = mergeCourseSeed(parsedSeed(), files);

    expect(problems).toEqual([
      "El archivo otro.json no corresponde a la unidad AWS-U0.1.1; se esperaba AWS-U0.1.1.json",
    ]);
    expect(seed.stages[0]?.modules[0]?.units[0]?.lessons).toEqual([]);
  });

  it("ignora un archivo cuya unidad no existe en el esqueleto", () => {
    const files = [
      entry("AWS-U9.9.9.json", unitFile("AWS-U9.9.9", [lessonFixture("leccion-uno")])),
    ];

    const { problems } = mergeCourseSeed(parsedSeed(), files);

    expect(problems).toEqual([
      "La unidad AWS-U9.9.9 del archivo AWS-U9.9.9.json no existe en el esqueleto",
    ]);
  });

  it("ignora un segundo archivo que declara la misma unidad", () => {
    const files = [
      entry("AWS-U0.1.1.json", unitFile("AWS-U0.1.1", [lessonFixture("leccion-uno")])),
      entry("AWS-U0.1.1.json", unitFile("AWS-U0.1.1", [lessonFixture("leccion-dos")])),
    ];

    const { seed, problems } = mergeCourseSeed(parsedSeed(), files);

    expect(problems).toEqual([
      "La unidad AWS-U0.1.1 está declarada en más de un archivo",
    ]);
    expect(seed.stages[0]?.modules[0]?.units[0]?.lessons.map((lesson) => lesson.slug)).toEqual([
      "leccion-uno",
    ]);
  });

  it("ignora un archivo si la unidad del esqueleto ya trae contenido", () => {
    const files = [
      entry("AWS-U0.1.1.json", unitFile("AWS-U0.1.1", [lessonFixture("leccion-uno")])),
    ];

    const { seed, problems } = mergeCourseSeed(parsedSeedWithLesson(), files);

    expect(problems).toEqual([
      "La unidad AWS-U0.1.1 del esqueleto ya trae lecciones o ejercicios; una sola fuente por unidad",
    ]);
    expect(seed.stages[0]?.modules[0]?.units[0]?.lessons.map((lesson) => lesson.slug)).toEqual([
      "leccion-propia",
    ]);
  });

  it("conserva exam al fusionar un archivo de unidad", () => {
    const files = [
      entry(
        "AWS-U2.1.1.json",
        unitFileWithExercises("AWS-U2.1.1", [lessonFixture("leccion-uno")], [
          quizExercise({ exam: examFixture() }),
        ]),
      ),
    ];

    const { seed, problems } = mergeCourseSeed(parsedExamSeed(), files);
    const exercises = seed.stages[0]?.modules[0]?.units[0]?.exercises ?? [];

    expect(problems).toEqual([]);
    expect(exercises[0]?.exam).toEqual({
      certification: "SAA-C03",
      domain: 1,
      task: "1.2",
      pool: "unit",
    });
    expect(courseSeedSchema.safeParse(seed).success).toBe(true);
  });
});

/** Semilla de la etapa 101 (CLF-C02) con dos unidades. */
function bankSeed(): CourseSeed {
  const seed = validSeed();
  const stage = stageOf(seed);
  stage.id = 101;
  stage.slug = "aws1-fundamentos-nube";
  moduleOf(seed).code = "AWS-M1.1";
  const unit = unitOf(seed);
  unit.code = "AWS-U1.1.1";
  moduleOf(seed).units.push({
    code: "AWS-U1.1.2",
    title: "Segunda unidad",
    objective: "Objetivo de la segunda unidad.",
    order: 2,
    isPublished: false,
  });

  return courseSeedSchema.parse(seed);
}

function bankQuestion(
  slug: string,
  order: number,
  examOverrides: Record<string, unknown> = {},
  unitCode = "AWS-U1.1.1",
): { unitCode: string; exercise: CourseSeedExercise } {
  return {
    unitCode,
    exercise: quizExercise({
      slug,
      order,
      exam: { certification: "CLF-C02", domain: 1, task: null, pool: "reserved", ...examOverrides },
    }),
  };
}

function bankFile(
  questions: readonly { unitCode: string; exercise: CourseSeedExercise }[],
  overrides: Record<string, unknown> = {},
): unknown {
  return { certification: "CLF-C02", domain: 1, questions, ...overrides };
}

function bankMessages(input: unknown): string[] {
  const result = examBankFileSchema.safeParse(input);

  if (result.success) {
    throw new Error("Se esperaba que el banco fuese inválido");
  }

  return messagesOf(result);
}

describe("examBankFileSchema", () => {
  it("acepta un banco con QUIZ reservados de su certificación y dominio", () => {
    const result = examBankFileSchema.safeParse(
      bankFile([bankQuestion("clf-c02-r-uno", 1), bankQuestion("clf-c02-r-dos", 2)]),
    );

    expect(result.success).toBe(true);
  });

  it("rechaza una pregunta con pool unit", () => {
    expect(bankMessages(bankFile([bankQuestion("clf-c02-r-uno", 1, { pool: "unit" })]))).toEqual([
      "Ejercicio clf-c02-r-uno: el banco reservado exige exam.pool «reserved», no «unit»",
    ]);
  });

  it("rechaza una pregunta de otro dominio", () => {
    expect(bankMessages(bankFile([bankQuestion("clf-c02-r-uno", 1, { domain: 2 })]))).toEqual([
      "Ejercicio clf-c02-r-uno: el dominio 2 no es el del archivo (1)",
    ]);
  });

  it("rechaza una pregunta de otra certificación", () => {
    expect(
      bankMessages(bankFile([bankQuestion("clf-c02-r-uno", 1, { certification: "SAA-C03" })])),
    ).toEqual([
      "Ejercicio clf-c02-r-uno: la certificación SAA-C03 no es la del archivo (CLF-C02)",
    ]);
  });

  it("rechaza una pregunta sin exam", () => {
    const question = { unitCode: "AWS-U1.1.1", exercise: quizExercise({ slug: "clf-c02-r-uno" }) };

    expect(bankMessages(bankFile([question]))).toEqual([
      "Ejercicio clf-c02-r-uno: el banco reservado exige exam",
    ]);
  });

  it("rechaza un ejercicio que no es QUIZ", () => {
    const question = {
      unitCode: "AWS-U1.1.1",
      exercise: courseSeedExerciseSchema.parse({
        ...readingExercise(["AWS-C1"]),
        slug: "clf-c02-r-lectura",
        exam: { certification: "CLF-C02", domain: 1, pool: "reserved" },
      }),
    };

    expect(bankMessages(bankFile([question]))).toContain(
      "Ejercicio clf-c02-r-lectura: el banco reservado solo admite QUIZ",
    );
  });

  it("rechaza un banco vacío y claves desconocidas", () => {
    expect(examBankFileSchema.safeParse(bankFile([])).success).toBe(false);
    expect(
      examBankFileSchema.safeParse(bankFile([bankQuestion("clf-c02-r-uno", 1)], { extra: 1 }))
        .success,
    ).toBe(false);
  });
});

describe("mergeExamBankFiles", () => {
  const bank = (questions: Parameters<typeof bankFile>[0]) =>
    examBankFileSchema.parse(bankFile(questions));

  it("añade cada pregunta a los ejercicios de su unidad", () => {
    const files = [
      {
        fileName: "CLF-C02-D1-a.json",
        bank: bank([
          bankQuestion("clf-c02-r-uno", 1),
          bankQuestion("clf-c02-r-dos", 2, {}, "AWS-U1.1.2"),
        ]),
      },
    ];

    const { seed, problems } = mergeExamBankFiles(bankSeed(), files);
    const units = seed.stages[0]?.modules[0]?.units ?? [];

    expect(problems).toEqual([]);
    expect(units[0]?.exercises.map((exercise) => exercise.slug)).toEqual(["clf-c02-r-uno"]);
    expect(units[1]?.exercises.map((exercise) => exercise.slug)).toEqual(["clf-c02-r-dos"]);
    expect(courseSeedSchema.safeParse(seed).success).toBe(true);
  });

  it("conserva los ejercicios que la unidad ya tenía", () => {
    const withUnitExercise = mergeCourseSeed(bankSeed(), [
      entry(
        "AWS-U1.1.1.json",
        unitFileWithExercises("AWS-U1.1.1", [lessonFixture("leccion-uno")], [
          quizExercise({
            slug: "aws-u1-1-1-q1",
            order: 1,
            exam: examFixture({ certification: "CLF-C02", task: null }),
          }),
        ]),
      ),
    ]).seed;

    const { seed, problems } = mergeExamBankFiles(withUnitExercise, [
      { fileName: "CLF-C02-D1-a.json", bank: bank([bankQuestion("clf-c02-r-uno", 2)]) },
    ]);

    expect(problems).toEqual([]);
    expect(seed.stages[0]?.modules[0]?.units[0]?.exercises.map((exercise) => exercise.slug)).toEqual(
      ["aws-u1-1-1-q1", "clf-c02-r-uno"],
    );
    expect(courseSeedSchema.safeParse(seed).success).toBe(true);
  });

  it("ignora una pregunta cuya unidad no existe en el esqueleto", () => {
    const files = [
      {
        fileName: "CLF-C02-D1-a.json",
        bank: bank([bankQuestion("clf-c02-r-uno", 1, {}, "AWS-U1.9.9")]),
      },
    ];

    const { seed, problems } = mergeExamBankFiles(bankSeed(), files);

    expect(problems).toEqual([
      "La unidad AWS-U1.9.9 de la pregunta clf-c02-r-uno del archivo CLF-C02-D1-a.json no existe en el esqueleto",
    ]);
    expect(seed.stages[0]?.modules[0]?.units.flatMap((unit) => unit.exercises)).toEqual([]);
  });

  it("sin archivos devuelve la semilla igual y sin problemas", () => {
    const skeleton = bankSeed();

    expect(mergeExamBankFiles(skeleton, [])).toEqual({ seed: skeleton, problems: [] });
  });
});
