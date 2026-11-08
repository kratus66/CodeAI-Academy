import { describe, expect, it } from "vitest";

import {
  COURSE_REGISTRY,
  courseForCode,
  courseForStageId,
  courseListResponseSchema,
  courseSummarySchema,
  isCompetencyOfCourse,
  isKnownStageId,
  moduleCodePrefix,
  stageLabel,
  stageIdOfCode,
  stageNumberInCourse,
  stageSlugMatchesCourse,
  unitCodePrefix,
} from "./course";

describe("courseForStageId", () => {
  it.each([
    [0, "fullstack-ia"],
    [7, "fullstack-ia"],
    [11, "fullstack-ia"],
    [100, "aws-cloud"],
    [102, "aws-cloud"],
    [112, "aws-cloud"],
  ])("ubica el id %i en la ruta %s", (stageId, slug) => {
    expect(courseForStageId(stageId)?.slug).toBe(slug);
  });

  it.each([12, 99, 113, -1, 1.5, Number.NaN])(
    "devuelve null para el id de etapa %s",
    (stageId) => {
      expect(courseForStageId(stageId)).toBeNull();
    },
  );
});

describe("isKnownStageId", () => {
  it.each([
    [7, true],
    [102, true],
    [12, false],
    [Number.NaN, false],
  ])("indica si %s pertenece a alguna ruta como %s", (stageId, expected) => {
    expect(isKnownStageId(stageId)).toBe(expected);
  });
});

describe("stageNumberInCourse", () => {
  it("calcula el número relativo a la ruta", () => {
    expect(stageNumberInCourse(102)).toBe(2);
    expect(stageNumberInCourse(100)).toBe(0);
    expect(stageNumberInCourse(7)).toBe(7);
  });

  it("devuelve null para un id desconocido", () => {
    expect(stageNumberInCourse(12)).toBeNull();
  });
});

describe("stageLabel", () => {
  it("antepone la letra de la ruta al número de etapa", () => {
    expect(stageLabel(2)).toBe("E2");
    expect(stageLabel(102)).toBe("A2");
    expect(stageLabel(100)).toBe("A0");
  });

  it("devuelve null para un id desconocido", () => {
    expect(stageLabel(12)).toBeNull();
  });
});

describe("courseForCode", () => {
  it("asigna los códigos con prefijo AWS- a la ruta aws-cloud", () => {
    expect(courseForCode("AWS-M2.3")?.slug).toBe("aws-cloud");
    expect(courseForCode("AWS-U2.3.1")?.slug).toBe("aws-cloud");
    expect(courseForCode("AWS-C4")?.slug).toBe("aws-cloud");
  });

  it("asigna los códigos sin prefijo a la ruta por defecto", () => {
    expect(courseForCode("M2.3")?.slug).toBe("fullstack-ia");
    expect(courseForCode("U2.3.1")?.slug).toBe("fullstack-ia");
    expect(courseForCode("C4")?.slug).toBe("fullstack-ia");
  });

  it("devuelve null para un código que no empieza por M, U o C", () => {
    expect(courseForCode("X9")).toBeNull();
    expect(courseForCode("M")).toBeNull();
    expect(courseForCode("aws-m2.3")).toBeNull();
    expect(courseForCode("")).toBeNull();
  });
});

describe("stageIdOfCode", () => {
  it.each([
    ["U0.1.1", 0],
    ["U11.2.3", 11],
    ["AWS-U2.3.1", 102],
    ["AWS-U12.3.2", 112],
    ["M2.3", 2],
    ["AWS-M0.1", 100],
  ])("deduce la etapa de %s como %i", (code, expected) => {
    expect(stageIdOfCode(code)).toBe(expected);
  });

  it.each(["U12.1.1", "AWS-U13.1.1", "X2.3.1", "aws-U2.3.1", "U2", ""])(
    "devuelve null para el código %j",
    (code) => {
      expect(stageIdOfCode(code)).toBeNull();
    },
  );
});

describe("moduleCodePrefix", () => {
  it("genera el prefijo de módulo con el número de etapa de la ruta", () => {
    expect(moduleCodePrefix(2)).toBe("M2.");
    expect(moduleCodePrefix(102)).toBe("AWS-M2.");
    expect(moduleCodePrefix(100)).toBe("AWS-M0.");
  });

  it("devuelve null para un id de etapa desconocido", () => {
    expect(moduleCodePrefix(12)).toBeNull();
  });
});

describe("unitCodePrefix", () => {
  it("transforma un código de módulo válido en su prefijo de unidad", () => {
    expect(unitCodePrefix("M2.3")).toBe("U2.3.");
    expect(unitCodePrefix("AWS-M2.3")).toBe("AWS-U2.3.");
    expect(unitCodePrefix("M12.34")).toBe("U12.34.");
  });

  it("devuelve null para un código de módulo inválido", () => {
    expect(unitCodePrefix("M2")).toBeNull();
    expect(unitCodePrefix("X2.3")).toBeNull();
    expect(unitCodePrefix("")).toBeNull();
  });
});

describe("stageSlugMatchesCourse", () => {
  it("acepta el slug que empieza por el prefijo y número de la ruta", () => {
    expect(stageSlugMatchesCourse("aws2-arquitectura", 102)).toBe(true);
    expect(stageSlugMatchesCourse("aws0-fundamentos", 100)).toBe(true);
    expect(stageSlugMatchesCourse("e2-js", 2)).toBe(true);
  });

  it("rechaza un slug de otra ruta o de un id desconocido", () => {
    expect(stageSlugMatchesCourse("e2-js", 102)).toBe(false);
    expect(stageSlugMatchesCourse("e2-js", 12)).toBe(false);
  });
});

describe("isCompetencyOfCourse", () => {
  it("acepta una competencia del prefijo y rango de la ruta", () => {
    expect(isCompetencyOfCourse("C4", "fullstack-ia")).toBe(true);
    expect(isCompetencyOfCourse("C14", "fullstack-ia")).toBe(true);
    expect(isCompetencyOfCourse("AWS-C15", "aws-cloud")).toBe(true);
  });

  it("rechaza una competencia de otra ruta o fuera de formato", () => {
    expect(isCompetencyOfCourse("AWS-C4", "fullstack-ia")).toBe(false);
    expect(isCompetencyOfCourse("C4", "aws-cloud")).toBe(false);
    expect(isCompetencyOfCourse("C16", "fullstack-ia")).toBe(false);
    expect(isCompetencyOfCourse("X1", "fullstack-ia")).toBe(false);
  });
});

describe("courseSummarySchema", () => {
  const SUMMARY = {
    slug: "aws-cloud",
    title: "Ruta AWS Cloud",
    objective: "Preparar las certificaciones de AWS.",
    stageLabelPrefix: "A",
    order: 1,
    stageCount: 13,
    notice: "Ruta independiente de preparación.",
  } as const;

  it("acepta una ruta publicada válida", () => {
    expect(courseSummarySchema.parse(SUMMARY)).toEqual(SUMMARY);
  });

  it("acepta un aviso nulo", () => {
    expect(courseSummarySchema.safeParse({ ...SUMMARY, notice: null }).success).toBe(true);
  });

  it("rechaza un slug desconocido", () => {
    expect(
      courseSummarySchema.safeParse({ ...SUMMARY, slug: "azure" }).success,
    ).toBe(false);
  });

  it("rechaza un stageCount negativo", () => {
    expect(
      courseSummarySchema.safeParse({ ...SUMMARY, stageCount: -1 }).success,
    ).toBe(false);
  });
});

describe("courseListResponseSchema", () => {
  const SUMMARY = {
    slug: "fullstack-ia",
    title: "Ruta Full Stack con IA",
    objective: "Formación de desarrollo de software asistido por IA.",
    stageLabelPrefix: "E",
    order: 0,
    stageCount: 12,
    notice: null,
  } as const;

  it("valida un listado paginado de rutas", () => {
    const parsed = courseListResponseSchema.parse({
      data: [SUMMARY],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]?.slug).toBe("fullstack-ia");
  });

  it("rechaza metadatos de paginación inválidos", () => {
    expect(
      courseListResponseSchema.safeParse({
        data: [],
        meta: { page: 0, pageSize: 20, total: 0, totalPages: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("COURSE_REGISTRY", () => {
  it("no tiene rangos de etapa solapados entre los ids 0 y 200", () => {
    for (let id = 0; id <= 200; id += 1) {
      const matches = Object.values(COURSE_REGISTRY).filter(
        (course) => id >= course.stageIdMin && id <= course.stageIdMax,
      );
      expect(matches.length).toBeLessThanOrEqual(1);
    }
  });
});
