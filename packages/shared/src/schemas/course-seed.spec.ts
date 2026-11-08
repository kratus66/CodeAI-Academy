import type { z } from "zod";
import { describe, expect, it } from "vitest";

import { contentSeedExerciseSchema, contentSeedLessonSchema } from "./content";
import type { ContentSeedExercise, ContentSeedLesson } from "./content";
import {
  courseSeedSchema,
  courseUnitFileSchema,
  mergeCourseSeed,
} from "./course-seed";
import type { CourseSeed, CourseUnitFile, CourseUnitFileEntry } from "./course-seed";

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

function unitFile(code: string, lessons: readonly ContentSeedLesson[]): CourseUnitFile {
  return courseUnitFileSchema.parse({ code, lessons });
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
});
