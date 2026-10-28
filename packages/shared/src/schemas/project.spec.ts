import { describe, expect, it } from "vitest";

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "../constants/pagination";
import {
  DEFAULT_PROJECT_RUBRIC,
  PROJECT_CRITERIA,
  PROJECT_CRITERION_LABELS,
  PROJECT_EVIDENCE_MIN_SCORE,
  PROJECT_RUBRIC_ANCHOR_MAX_LENGTH,
  PROJECT_RUBRIC_WEIGHT_TOTAL,
  PROJECT_URL_MAX_LENGTH,
  createProjectSubmissionSchema,
  portfolioResponseSchema,
  projectDetailSchema,
  projectListQuerySchema,
  projectListResponseSchema,
  projectRubricSchema,
  projectRubricScoresSchema,
  projectSlugParamsSchema,
  projectSubmissionSchema,
  projectSummarySchema,
  reviewProjectSubmissionSchema,
  type ProjectRubric,
  type ProjectRubricCriterion,
} from "./project";

const SUMMARY = {
  id: "prj_1",
  slug: "api-de-tareas",
  stageId: 2,
  title: "API de tareas",
  brief: "Construye una API REST con autenticación y pruebas.",
  requirements: ["CRUD de tareas", "Pruebas de integración"],
  isPublished: true,
  submitted: false,
} as const;

const SCORES = {
  correctitud: 3,
  calidad: 3,
  pruebas: 3,
  seguridad: 3,
  justificacion: 3,
} as const;

const SUBMISSION = {
  id: "sub_1",
  projectId: "prj_1",
  projectSlug: "api-de-tareas",
  projectTitle: "API de tareas",
  stageId: 2,
  userId: "usr_1",
  status: "SUBMITTED",
  repoUrl: "https://github.com/ana/api-tareas",
  deployUrl: null,
  notes: "Separé el dominio de la infraestructura.",
  score: null,
  rubricScores: null,
  feedback: null,
  reviewedAt: null,
  isPublic: false,
  publishedAt: null,
  createdAt: "2026-10-28T09:00:00.000Z",
} as const;

function cloneRubric(): ProjectRubric {
  return {
    criteria: DEFAULT_PROJECT_RUBRIC.criteria.map((criterion) => ({
      ...criterion,
      levels: criterion.levels.map((level) => ({ ...level })),
    })),
    correctitudGate: true,
  };
}

function criterionAt(
  rubric: ProjectRubric,
  index: number,
): ProjectRubricCriterion {
  const criterion = rubric.criteria[index];

  if (!criterion) {
    throw new Error(`La rúbrica base no declara el criterio ${index}`);
  }

  return criterion;
}

function messagesOf(
  result:
    | { success: true }
    | { success: false; error: { issues: { message: string }[] } },
): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("projectRubricSchema", () => {
  it("acepta la rúbrica base con pesos 30/20/20/15/15", () => {
    const parsed = projectRubricSchema.parse(DEFAULT_PROJECT_RUBRIC);

    expect(parsed.criteria.map((criterion) => criterion.criterion)).toEqual([
      ...PROJECT_CRITERIA,
    ]);
    expect(parsed.criteria.map((criterion) => criterion.weight)).toEqual([
      30, 20, 20, 15, 15,
    ]);
    expect(
      parsed.criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    ).toBe(PROJECT_RUBRIC_WEIGHT_TOTAL);
    expect(parsed.correctitudGate).toBe(true);
  });

  it("describe los cuatro niveles de cada criterio en orden 1–4", () => {
    for (const criterion of DEFAULT_PROJECT_RUBRIC.criteria) {
      expect(criterion.levels.map((level) => level.level)).toEqual([
        1, 2, 3, 4,
      ]);
      expect(criterion.levels.every((level) => level.anchor.trim() !== "")).toBe(
        true,
      );
      expect(
        criterion.levels.every(
          (level) => level.anchor.length <= PROJECT_RUBRIC_ANCHOR_MAX_LENGTH,
        ),
      ).toBe(true);
    }
  });

  it("publica una etiqueta legible por criterio", () => {
    expect(Object.keys(PROJECT_CRITERION_LABELS)).toEqual([...PROJECT_CRITERIA]);

    for (const criterion of PROJECT_CRITERIA) {
      expect(PROJECT_CRITERION_LABELS[criterion].length).toBeGreaterThan(0);
    }
  });

  it("rechaza pesos que no suman 100", () => {
    const rubric = cloneRubric();
    criterionAt(rubric, 0).weight = 29;

    const messages = messagesOf(projectRubricSchema.safeParse(rubric));

    expect(messages).toContain(
      "Los pesos de la rúbrica deben sumar 100 (suman 99)",
    );
  });

  it("rechaza un criterio repetido", () => {
    const rubric = cloneRubric();
    const correctitud = criterionAt(rubric, 0);
    const repeated = criterionAt(rubric, 4);
    repeated.criterion = correctitud.criterion;
    repeated.weight = correctitud.weight;

    const messages = messagesOf(projectRubricSchema.safeParse(rubric));

    expect(messages.some((message) => message.includes("repetido"))).toBe(true);
  });

  it("rechaza una rúbrica con criterios faltantes", () => {
    const rubric = cloneRubric();
    rubric.criteria = rubric.criteria.slice(0, 4);

    const messages = messagesOf(projectRubricSchema.safeParse(rubric));

    expect(messages).toContain(
      "La rúbrica debe declarar exactamente 5 criterios",
    );
  });

  it("rechaza un nivel fuera de 1–4", () => {
    const rubric = cloneRubric();
    criterionAt(rubric, 0).levels[0] = { level: 0, anchor: "Anclaje" };

    const result = projectRubricSchema.safeParse(rubric);

    expect(result.success).toBe(false);
    expect(messagesOf(result).join(" ")).toContain("entre 1 y 4");
  });

  it("rechaza niveles desordenados", () => {
    const rubric = cloneRubric();
    criterionAt(rubric, 0).levels.reverse();

    expect(messagesOf(projectRubricSchema.safeParse(rubric)).join(" ")).toContain(
      "en orden 1..4",
    );
  });

  it("rechaza correctitudGate distinto de true", () => {
    const result = projectRubricSchema.safeParse({
      ...DEFAULT_PROJECT_RUBRIC,
      correctitudGate: false,
    });

    expect(messagesOf(result)).toContain(
      "La rúbrica debe declarar correctitudGate: true",
    );
  });

  it("rechaza anclajes vacíos o demasiado largos", () => {
    const emptyAnchor = cloneRubric();
    criterionAt(emptyAnchor, 0).levels[0] = { level: 1, anchor: "   " };

    expect(projectRubricSchema.safeParse(emptyAnchor).success).toBe(false);

    const longAnchor = cloneRubric();
    criterionAt(longAnchor, 0).levels[0] = {
      level: 1,
      anchor: "x".repeat(PROJECT_RUBRIC_ANCHOR_MAX_LENGTH + 1),
    };

    expect(projectRubricSchema.safeParse(longAnchor).success).toBe(false);
  });

  it("rechaza un peso no entero o fuera de rango", () => {
    const fractional = cloneRubric();
    criterionAt(fractional, 0).weight = 30.5;

    expect(projectRubricSchema.safeParse(fractional).success).toBe(false);

    const zero = cloneRubric();
    criterionAt(zero, 0).weight = 0;

    expect(projectRubricSchema.safeParse(zero).success).toBe(false);
  });

  it("rechaza claves fuera del contrato", () => {
    expect(
      projectRubricSchema.safeParse({ ...DEFAULT_PROJECT_RUBRIC, extra: true })
        .success,
    ).toBe(false);
  });
});

describe("projectRubricScoresSchema", () => {
  it("acepta los cinco criterios con nivel 0–4", () => {
    expect(projectRubricScoresSchema.parse(SCORES)).toEqual(SCORES);
    expect(
      projectRubricScoresSchema.parse({
        correctitud: 0,
        calidad: 0,
        pruebas: 0,
        seguridad: 0,
        justificacion: 0,
      }).correctitud,
    ).toBe(0);
  });

  it("rechaza una revisión sin todos los criterios", () => {
    const incomplete = {
      correctitud: 3,
      calidad: 3,
      pruebas: 3,
      seguridad: 3,
    };

    expect(projectRubricScoresSchema.safeParse(incomplete).success).toBe(false);
  });

  it("rechaza niveles fuera de 0–4 o no enteros", () => {
    for (const invalid of [5, -1, 2.5]) {
      expect(
        projectRubricScoresSchema.safeParse({ ...SCORES, calidad: invalid })
          .success,
      ).toBe(false);
    }
  });

  it("rechaza criterios que no existen en la rúbrica", () => {
    expect(
      projectRubricScoresSchema.safeParse({ ...SCORES, originalidad: 4 })
        .success,
    ).toBe(false);
  });
});

describe("projectListQuerySchema", () => {
  it("aplica página y tamaño por defecto", () => {
    expect(projectListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: PAGE_SIZE_DEFAULT,
    });
  });

  it("convierte los query strings y acepta una etapa", () => {
    expect(projectListQuerySchema.parse({ stage: "3", page: "2" })).toEqual({
      stage: 3,
      page: 2,
      pageSize: PAGE_SIZE_DEFAULT,
    });
  });

  it("rechaza una etapa fuera del currículo", () => {
    expect(projectListQuerySchema.safeParse({ stage: "12" }).success).toBe(
      false,
    );
  });

  it("rechaza un tamaño de página por encima del máximo", () => {
    expect(
      projectListQuerySchema.safeParse({ pageSize: String(PAGE_SIZE_MAX + 1) })
        .success,
    ).toBe(false);
  });

  it("rechaza filtros no declarados", () => {
    expect(
      projectListQuerySchema.safeParse({ competency: "C3" }).success,
    ).toBe(false);
  });
});

describe("projectSummarySchema", () => {
  it("acepta la ficha del catálogo", () => {
    expect(projectSummarySchema.parse(SUMMARY)).toEqual(SUMMARY);
  });

  it("exige al menos un requisito", () => {
    expect(
      projectSummarySchema.safeParse({ ...SUMMARY, requirements: [] }).success,
    ).toBe(false);
  });

  it("rechaza una etapa fuera de rango y un slug inválido", () => {
    expect(
      projectSummarySchema.safeParse({ ...SUMMARY, stageId: 12 }).success,
    ).toBe(false);
    expect(
      projectSummarySchema.safeParse({ ...SUMMARY, slug: "API_de_Tareas" })
        .success,
    ).toBe(false);
  });
});

describe("createProjectSubmissionSchema", () => {
  it("acepta una entrega mínima y recorta la URL", () => {
    expect(
      createProjectSubmissionSchema.parse({
        repoUrl: "  https://github.com/ana/api-tareas  ",
      }),
    ).toEqual({ repoUrl: "https://github.com/ana/api-tareas" });
  });

  it("acepta despliegue y explicación nulos o vacíos", () => {
    expect(
      createProjectSubmissionSchema.parse({
        repoUrl: "https://github.com/ana/api-tareas",
        deployUrl: null,
        notes: "   ",
      }),
    ).toEqual({
      repoUrl: "https://github.com/ana/api-tareas",
      deployUrl: null,
      notes: "",
    });
  });

  it("exige el repositorio", () => {
    const result = createProjectSubmissionSchema.safeParse({});

    expect(messagesOf(result)).toContain("El repositorio es obligatorio");
  });

  it("rechaza URLs que no son http(s)", () => {
    for (const repoUrl of [
      "ftp://example.com/repo",
      "javascript:alert(1)",
      "github.com/ana/api-tareas",
    ]) {
      expect(
        createProjectSubmissionSchema.safeParse({ repoUrl }).success,
      ).toBe(false);
    }
  });

  it("rechaza una URL o una explicación demasiado largas", () => {
    const longUrl = `https://example.com/${"a".repeat(PROJECT_URL_MAX_LENGTH)}`;

    expect(
      createProjectSubmissionSchema.safeParse({ repoUrl: longUrl }).success,
    ).toBe(false);
    expect(
      createProjectSubmissionSchema.safeParse({
        repoUrl: "https://github.com/ana/api-tareas",
        notes: "x".repeat(2_001),
      }).success,
    ).toBe(false);
  });

  it("rechaza claves fuera del contrato", () => {
    expect(
      createProjectSubmissionSchema.safeParse({
        repoUrl: "https://github.com/ana/api-tareas",
        score: 100,
      }).success,
    ).toBe(false);
  });
});

describe("reviewProjectSubmissionSchema", () => {
  it("acepta una revisión completa sin retroalimentación", () => {
    expect(
      reviewProjectSubmissionSchema.parse({ rubricScores: SCORES }),
    ).toEqual({ rubricScores: SCORES });
  });

  it("recorta la retroalimentación", () => {
    expect(
      reviewProjectSubmissionSchema.parse({
        rubricScores: SCORES,
        feedback: "  Buen trabajo  ",
      }).feedback,
    ).toBe("Buen trabajo");
  });

  it("rechaza una revisión incompleta", () => {
    expect(
      reviewProjectSubmissionSchema.safeParse({
        rubricScores: { correctitud: 4 },
      }).success,
    ).toBe(false);
  });

  it("rechaza un nivel fuera de 0–4 y una retroalimentación larga", () => {
    expect(
      reviewProjectSubmissionSchema.safeParse({
        rubricScores: { ...SCORES, correctitud: 5 },
      }).success,
    ).toBe(false);
    expect(
      reviewProjectSubmissionSchema.safeParse({
        rubricScores: SCORES,
        feedback: "x".repeat(2_001),
      }).success,
    ).toBe(false);
  });
});

describe("projectSubmissionSchema", () => {
  it("acepta una entrega sin revisar", () => {
    expect(projectSubmissionSchema.parse(SUBMISSION)).toEqual(SUBMISSION);
  });

  it("acepta una entrega revisada y publicada", () => {
    const reviewed = {
      ...SUBMISSION,
      status: "REVIEWED",
      score: 75,
      rubricScores: SCORES,
      feedback: "Cumple lo pedido; refuerza las pruebas de borde.",
      reviewedAt: "2026-10-28T10:00:00.000Z",
      isPublic: true,
      publishedAt: "2026-10-28T10:05:00.000Z",
    };

    expect(projectSubmissionSchema.parse(reviewed)).toEqual(reviewed);
  });

  it("rechaza un estado fuera del contrato", () => {
    expect(
      projectSubmissionSchema.safeParse({ ...SUBMISSION, status: "DRAFT" })
        .success,
    ).toBe(false);
  });

  it("rechaza una nota fuera de 0–100 y una fecha que no es ISO", () => {
    expect(
      projectSubmissionSchema.safeParse({ ...SUBMISSION, score: 101 }).success,
    ).toBe(false);
    expect(
      projectSubmissionSchema.safeParse({
        ...SUBMISSION,
        reviewedAt: "28/10/2026",
      }).success,
    ).toBe(false);
  });
});

describe("projectDetailSchema", () => {
  it("acepta el detalle con rúbrica, competencias y entregas propias", () => {
    const detail = {
      ...SUMMARY,
      submitted: true,
      rubric: DEFAULT_PROJECT_RUBRIC,
      competencies: ["C3", "C5"],
      bestScore: 75,
      mySubmissions: [SUBMISSION],
    };

    const parsed = projectDetailSchema.parse(detail);

    expect(parsed.rubric.criteria).toHaveLength(5);
    expect(parsed.mySubmissions).toHaveLength(1);
    expect(parsed.bestScore).toBe(75);
  });

  it("exige al menos una competencia y una nota válida", () => {
    const detail = {
      ...SUMMARY,
      rubric: DEFAULT_PROJECT_RUBRIC,
      competencies: ["C3"],
      bestScore: null,
      mySubmissions: [],
    };

    expect(
      projectDetailSchema.safeParse({ ...detail, competencies: [] }).success,
    ).toBe(false);
    expect(
      projectDetailSchema.safeParse({ ...detail, bestScore: 101 }).success,
    ).toBe(false);
  });
});

describe("projectListResponseSchema", () => {
  it("publica el catálogo con su paginación", () => {
    const parsed = projectListResponseSchema.parse({
      data: [SUMMARY],
      meta: { page: 1, pageSize: PAGE_SIZE_DEFAULT, total: 1, totalPages: 1 },
    });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.meta.totalPages).toBe(1);
  });

  it("rechaza una página de tamaño cero en los metadatos", () => {
    expect(
      projectListResponseSchema.safeParse({
        data: [],
        meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("portfolioResponseSchema", () => {
  const PORTFOLIO = {
    user: { id: "usr_1", name: "Ana", avatarUrl: null },
    entries: [SUBMISSION],
    publicCount: 0,
  };

  it("acepta el portafolio sin correo", () => {
    expect(portfolioResponseSchema.parse(PORTFOLIO)).toEqual(PORTFOLIO);
  });

  it("rechaza el correo del usuario", () => {
    expect(
      portfolioResponseSchema.safeParse({
        ...PORTFOLIO,
        user: { ...PORTFOLIO.user, email: "ana@example.com" },
      }).success,
    ).toBe(false);
  });

  it("rechaza un contador negativo", () => {
    expect(
      portfolioResponseSchema.safeParse({ ...PORTFOLIO, publicCount: -1 })
        .success,
    ).toBe(false);
  });
});

describe("projectSlugParamsSchema", () => {
  it("acepta un slug en minúsculas y rechaza otro formato", () => {
    expect(projectSlugParamsSchema.parse({ slug: "api-de-tareas" })).toEqual({
      slug: "api-de-tareas",
    });
    expect(projectSlugParamsSchema.safeParse({ slug: "API" }).success).toBe(
      false,
    );
  });
});

describe("constantes del contrato", () => {
  it("fija la evidencia mínima en 80 y los topes de longitud", () => {
    expect(PROJECT_EVIDENCE_MIN_SCORE).toBe(80);
    expect(PROJECT_URL_MAX_LENGTH).toBe(500);
    expect(PROJECT_RUBRIC_WEIGHT_TOTAL).toBe(100);
  });
});
