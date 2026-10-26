import type { z } from "zod";
import { describe, expect, it } from "vitest";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import {
  CURRICULUM_STAGE_COUNT,
  contentSeedSchema,
  contentSeedUnitSchema,
  lessonSlugParamsSchema,
  lessonStepsSchema,
  resourceListQuerySchema,
  stageIdParamsSchema,
  stageListQuerySchema,
  unitCodeParamsSchema,
  unitDetailSchema,
} from "./content";

type SeedInput = z.input<typeof contentSeedSchema>;
type StageInput = SeedInput["stages"][number];

/** Semilla mínima válida: 12 etapas, un módulo y una unidad por etapa. */
function stageFixture(id: number): StageInput {
  return {
    id,
    slug: `e${id}-etapa-${id}`,
    title: `Etapa ${id}`,
    objective: `Objetivo de la etapa ${id}`,
    level: 1,
    estimatedMin: 900,
    order: id + 1,
    isPublished: id < 4,
    modules: [
      {
        code: `M${id}.1`,
        title: `Módulo ${id}.1`,
        order: 1,
        isPublished: id < 4,
        units: [
          {
            code: `U${id}.1.1`,
            title: `Unidad ${id}.1.1`,
            objective: `Objetivo de la unidad ${id}.1.1`,
            order: 1,
            isPublished: id < 4,
          },
        ],
      },
    ],
  };
}

function seedFixture(): SeedInput {
  return {
    stages: Array.from({ length: CURRICULUM_STAGE_COUNT }, (_, id) =>
      stageFixture(id),
    ),
  };
}

function issueMessages(result: { success: false; error: z.ZodError }): string[] {
  return result.error.issues.map((issue) => issue.message);
}

/**
 * Helpers de acceso al fixture. `noUncheckedIndexedAccess` marca cada índice
 * como posiblemente indefinido; aquí se falla con un mensaje claro si el
 * fixture cambia, en vez de silenciar el tipo con una aserción.
 */
function stageOf(seed: SeedInput, index: number): StageInput {
  const stage = seed.stages[index];

  if (!stage) {
    throw new Error(`El fixture de la semilla no tiene la etapa ${index}`);
  }

  return stage;
}

function firstModuleOf(seed: SeedInput, stageIndex: number): StageInput["modules"][number] {
  const module = stageOf(seed, stageIndex).modules[0];

  if (!module) {
    throw new Error(`El fixture de la semilla no tiene módulo en la etapa ${stageIndex}`);
  }

  return module;
}

function firstUnitOf(
  seed: SeedInput,
  stageIndex: number,
): StageInput["modules"][number]["units"][number] {
  const unit = firstModuleOf(seed, stageIndex).units[0];

  if (!unit) {
    throw new Error(`El fixture de la semilla no tiene unidad en la etapa ${stageIndex}`);
  }

  return unit;
}

describe("stageListQuerySchema", () => {
  it("aplica página 1 y el tamaño por defecto cuando no hay parámetros", () => {
    const query = stageListQuerySchema.parse({});

    expect(query).toEqual({ page: 1, pageSize: PAGE_SIZE_DEFAULT });
  });

  it("convierte los query strings en números", () => {
    const query = stageListQuerySchema.parse({ page: "3", pageSize: "10" });

    expect(query.page).toBe(3);
    expect(query.pageSize).toBe(10);
  });

  it("rechaza un tamaño de página por encima del máximo", () => {
    const result = stageListQuerySchema.safeParse({
      pageSize: String(PAGE_SIZE_MAX + 1),
    });

    expect(result.success).toBe(false);
  });

  it("explica el rechazo del tamaño de página en español", () => {
    const result = stageListQuerySchema.safeParse({
      pageSize: String(PAGE_SIZE_MAX + 1),
    });

    expect(result.success ? [] : issueMessages(result)).toContain(
      `El tamaño de página no puede superar ${PAGE_SIZE_MAX}`,
    );
  });

  it("rechaza un nivel fuera del currículo", () => {
    expect(stageListQuerySchema.safeParse({ level: "5" }).success).toBe(false);
  });

  it("rechaza parámetros no documentados", () => {
    expect(stageListQuerySchema.safeParse({ sort: "title" }).success).toBe(
      false,
    );
  });
});

describe("resourceListQuerySchema", () => {
  it("acepta una etapa y un tipo del catálogo", () => {
    const query = resourceListQuerySchema.parse({ stage: "2", type: "VIDEO" });

    expect(query.stage).toBe(2);
    expect(query.type).toBe("VIDEO");
  });

  it("rechaza un tipo de recurso desconocido", () => {
    expect(resourceListQuerySchema.safeParse({ type: "BLOG" }).success).toBe(
      false,
    );
  });
});

describe("parámetros de ruta", () => {
  it("convierte el id de etapa en número", () => {
    expect(stageIdParamsSchema.parse({ id: "3" })).toEqual({ id: 3 });
  });

  it("rechaza un id de etapa no numérico o fuera del currículo", () => {
    const letters = stageIdParamsSchema.safeParse({ id: "abc" });
    const outOfRange = stageIdParamsSchema.safeParse({
      id: String(CURRICULUM_STAGE_COUNT),
    });

    expect(letters.success).toBe(false);
    expect(outOfRange.success).toBe(false);

    if (!letters.success) {
      expect(issueMessages(letters)).toContain(
        "El id de etapa debe ser un número entero",
      );
    }
  });

  it("acepta un código de unidad bien formado y rechaza el resto", () => {
    expect(unitCodeParamsSchema.parse({ code: "U1.1.1" })).toEqual({
      code: "U1.1.1",
    });
    expect(unitCodeParamsSchema.safeParse({ code: "u1.1.1" }).success).toBe(
      false,
    );
    expect(unitCodeParamsSchema.safeParse({ code: "U1.1" }).success).toBe(false);
  });

  it("acepta un slug en kebab-case y rechaza mayúsculas", () => {
    expect(lessonSlugParamsSchema.parse({ slug: "que-es-un-programa" })).toEqual(
      { slug: "que-es-un-programa" },
    );
    expect(lessonSlugParamsSchema.safeParse({ slug: "Que-Es" }).success).toBe(
      false,
    );
  });
});

describe("lessonStepsSchema", () => {
  const step = {
    kind: "objective",
    title: "Objetivo",
    body: "Al terminar sabrás explicar el concepto.",
  } as const;

  it("acepta los siete pasos de la microestructura", () => {
    const steps = [
      "objective",
      "explanation",
      "guided_practice",
      "independent_practice",
      "debug",
      "assessment",
      "transfer",
    ].map((kind) => ({ ...step, kind }));

    expect(lessonStepsSchema.safeParse(steps).success).toBe(true);
  });

  it("rechaza una lección con seis pasos", () => {
    const steps = Array.from({ length: 6 }, () => ({ ...step }));
    const result = lessonStepsSchema.safeParse(steps);

    expect(result.success).toBe(false);
    expect(result.success ? [] : issueMessages(result)).toContain(
      "Una lección publicada debe declarar exactamente 7 pasos",
    );
  });
});

describe("unitDetailSchema", () => {
  it("acepta un ejercicio sin solución ni pruebas ocultas", () => {
    const unit = unitDetailSchema.parse({
      id: "unit_1",
      code: "U1.1.1",
      title: "Qué es la IA",
      objective: "Distinguir IA de automatización clásica.",
      estimatedMin: null,
      order: 1,
      moduleCode: "M1.1",
      prerequisiteIds: [],
      lessons: [
        {
          id: "lesson_1",
          slug: "que-es-la-ia",
          title: "Qué es la IA",
          estimatedMin: 45,
          order: 1,
        },
      ],
      exercises: [
        {
          id: "exercise_1",
          slug: "clasificar-casos-ia",
          type: "QUIZ",
          title: "Clasifica los casos",
          statement: "Marca los casos que requieren aprendizaje.",
          ladder: "GUIDED",
          difficulty: 1,
          concepts: ["definicion-ia"],
          competencies: ["C1"],
          estimatedMin: 10,
          order: 1,
        },
      ],
    });

    expect(unit.exercises[0]).not.toHaveProperty("solution");
    expect(unit.exercises[0]).not.toHaveProperty("tests");
  });
});

describe("contentSeedUnitSchema", () => {
  it("rellena los prerrequisitos con una lista vacía", () => {
    const unit = contentSeedUnitSchema.parse({
      code: "U0.1.1",
      title: "Qué es la IA",
      objective: "Distinguir IA de automatización clásica.",
      order: 1,
      isPublished: true,
    });

    expect(unit.prerequisiteIds).toEqual([]);
    expect(unit.estimatedMin).toBeNull();
  });

  it("rechaza un código con formato inválido", () => {
    const result = contentSeedUnitSchema.safeParse({
      code: "U-0-1",
      title: "Qué es la IA",
      objective: "Distinguir IA de automatización clásica.",
      order: 1,
      isPublished: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("contentSeedSchema", () => {
  it("acepta una semilla con las doce etapas del currículo", () => {
    expect(contentSeedSchema.safeParse(seedFixture()).success).toBe(true);
  });

  it("rechaza una semilla con menos etapas que el currículo", () => {
    const seed = seedFixture();
    seed.stages.pop();
    const result = contentSeedSchema.safeParse(seed);

    expect(result.success).toBe(false);
    expect(result.success ? [] : issueMessages(result)).toContain(
      `La semilla debe declarar exactamente ${CURRICULUM_STAGE_COUNT} etapas`,
    );
  });

  it("rechaza códigos de módulo duplicados", () => {
    const seed = seedFixture();
    const stage = stageOf(seed, 0);
    stage.modules.push({ ...firstModuleOf(seed, 0), order: 2 });
    const result = contentSeedSchema.safeParse(seed);

    expect(result.success).toBe(false);
    expect(result.success ? [] : issueMessages(result)).toContain(
      "Módulo duplicado: M0.1",
    );
  });

  it("rechaza una unidad cuyo código no pertenece a su etapa", () => {
    const seed = seedFixture();
    firstUnitOf(seed, 1).code = "U7.1.1";
    const result = contentSeedSchema.safeParse(seed);

    expect(result.success).toBe(false);
    expect(result.success ? [] : issueMessages(result)).toContain(
      "La unidad U7.1.1 no pertenece a la etapa 1",
    );
  });

  it("rechaza un prerrequisito que no existe en la semilla", () => {
    const seed = seedFixture();
    firstUnitOf(seed, 2).prerequisiteIds = ["U9.9.9"];
    const result = contentSeedSchema.safeParse(seed);

    expect(result.success).toBe(false);
    expect(result.success ? [] : issueMessages(result)).toContain(
      "Prerrequisito inexistente: U9.9.9",
    );
  });

  it("rechaza una unidad que se declara prerrequisito de sí misma", () => {
    const seed = seedFixture();
    firstUnitOf(seed, 0).prerequisiteIds = ["U0.1.1"];
    const result = contentSeedSchema.safeParse(seed);

    expect(result.success).toBe(false);
    expect(result.success ? [] : issueMessages(result)).toContain(
      "La unidad U0.1.1 no puede ser su propio prerrequisito",
    );
  });
});
