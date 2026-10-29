import type {
  ExerciseSummary,
  LessonDetail,
  ResourceSummary,
  StageDetail,
  UnitDetail,
  UnitSummary,
} from "@codeai/shared";
import { LESSON_STEP_KINDS } from "@codeai/shared";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContentCache } from "./content-cache";
import { ContentService } from "./content.service";
import type { ContentDataset } from "./in-memory-content.repository";
import { InMemoryContentRepository } from "./in-memory-content.repository";

const steps = LESSON_STEP_KINDS.map((kind) => ({
  kind,
  title: `Paso ${kind}`,
  body: `Cuerpo del paso ${kind}`,
}));

function lesson(slug: string, unitCode: string, order: number): LessonDetail {
  return {
    id: `lesson-${slug}`,
    slug,
    title: `Lección ${slug}`,
    estimatedMin: 25,
    order,
    unitCode,
    content: [{ type: "paragraph", text: "Contenido estructurado de la lección" }],
    steps,
    resources: [],
  };
}

const exercise: ExerciseSummary = {
  id: "exercise-1",
  slug: "primer-programa",
  type: "LAB",
  title: "Tu primer programa",
  statement: "Imprime un saludo por consola",
  ladder: "GUIDED",
  difficulty: 1,
  concepts: ["variables"],
  competencies: ["resolucion-de-problemas"],
  estimatedMin: 20,
  order: 1,
};

const resource: ResourceSummary = {
  id: "resource-1",
  slug: "mdn-javascript",
  title: "JavaScript en MDN",
  provider: "Mozilla",
  url: "https://developer.mozilla.org/es/docs/Web/JavaScript",
  type: "DOCUMENTATION",
  language: "es",
  level: "principiante",
  durationMin: null,
  license: "CC-BY-SA",
  embedAllowed: false,
  status: "VERIFIED",
  reviewedAt: "2026-01-05T00:00:00.000Z",
};

const videoResource: ResourceSummary = {
  ...resource,
  id: "resource-2",
  slug: "video-que-es-la-ia",
  title: "¿Qué es la IA?",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  type: "VIDEO",
  durationMin: 12,
};

function unitSummary(code: string, stageId: number, moduleCode: string): UnitSummary {
  return {
    id: `unit-${code}`,
    code,
    title: `Unidad ${code}`,
    objective: `Objetivo de la unidad ${code}`,
    estimatedMin: 90,
    order: 1,
    stageId,
    moduleCode,
    prerequisiteIds: [],
  };
}

function stage(id: number, level: number, code: string, units: UnitSummary[]): StageDetail {
  return {
    id,
    slug: `e${id}-etapa-${id}`,
    title: `Etapa ${id}`,
    objective: `Objetivo de la etapa ${id}`,
    level,
    estimatedMin: 600,
    order: id + 1,
    moduleCount: 1,
    modules: [
      {
        id: `module-${id}`,
        code,
        title: `Módulo ${code}`,
        order: 1,
        unitCount: units.length,
        units,
      },
    ],
  };
}


function dataset(): ContentDataset {
  const units: UnitDetail[] = [
    {
      id: "unit-0-1-1",
      code: "U0.1.1",
      title: "Qué es la inteligencia artificial",
      objective: "Distinguir IA de automatización clásica",
      estimatedMin: 90,
      order: 1,
      stageId: 0,
      moduleCode: "M0.1",
      prerequisiteIds: [],
      lessons: [
        {
          id: "lesson-hola-mundo",
          slug: "hola-mundo",
          title: "Hola mundo",
          estimatedMin: 25,
          order: 1,
        },
      ],
      exercises: [exercise],
    },
  ];

  const publishedUnits = [unitSummary("U0.1.1", 0, "M0.1")];

  return {
    stages: [
      stage(0, 1, "M0.1", publishedUnits),
      stage(1, 2, "M1.1", []),
      stage(2, 2, "M2.1", []),
    ],
    units,
    lessons: [lesson("hola-mundo", "U0.1.1", 1)],
    resources: [
      { stageId: 0, resource },
      { stageId: 1, resource: videoResource },
    ],
  };
}

function createService(): ContentService {
  return new ContentService(
    new InMemoryContentRepository(dataset()),
    new ContentCache(),
  );
}

describe("ContentService", () => {
  let service: ContentService;

  beforeEach(() => {
    service = createService();
  });

  describe("caché", () => {
    it("no repite la consulta y la invalidación la fuerza de nuevo", async () => {
      const repository = new InMemoryContentRepository(dataset());
      const listStages = vi.spyOn(repository, "listStages");
      const cached = new ContentService(repository, new ContentCache());

      await cached.listStages({ page: 1, pageSize: 10 });
      await cached.listStages({ page: 1, pageSize: 10 });

      expect(listStages).toHaveBeenCalledTimes(1);

      cached.invalidateCache();
      await cached.listStages({ page: 1, pageSize: 10 });

      expect(listStages).toHaveBeenCalledTimes(2);
    });

    it("no cachea un 404", async () => {
      const cached = createService();

      await expect(cached.getUnit("U9.1.1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(cached.getUnit("U9.1.1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
  describe("listStages", () => {

    it("pagina y devuelve metadatos coherentes", async () => {
      const response = await service.listStages({ page: 2, pageSize: 2 });

      expect(response.data).toHaveLength(1);
      expect(response.data[0]?.id).toBe(2);
      expect(response.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    });

    it("devuelve una página vacía cuando se pasa del total", async () => {
      const response = await service.listStages({ page: 5, pageSize: 2 });

      expect(response.data).toEqual([]);
      expect(response.meta.total).toBe(3);
      expect(response.meta.totalPages).toBe(2);
    });

    it("filtra por nivel", async () => {
      const response = await service.listStages({ page: 1, pageSize: 20, level: 2 });

      expect(response.data.map((item) => item.id)).toEqual([1, 2]);
      expect(response.meta.total).toBe(2);
    });
  });

  describe("getStage", () => {
    it("devuelve el detalle con sus módulos", async () => {
      const { stage: found } = await service.getStage(0);

      expect(found.modules).toHaveLength(1);
      expect(found.modules[0]?.code).toBe("M0.1");
      expect(found.moduleCount).toBe(1);
    });

    it("incluye las unidades publicadas de cada módulo", async () => {
      const { stage: found } = await service.getStage(0);

      expect(found.modules[0]?.units.map((item) => item.code)).toEqual(["U0.1.1"]);
      expect(found.modules[0]?.unitCount).toBe(1);

      const { stage: withoutUnits } = await service.getStage(1);

      expect(withoutUnits.modules[0]?.units).toEqual([]);
      expect(withoutUnits.modules[0]?.unitCount).toBe(0);
    });

    it("responde 404 cuando la etapa no existe o no está publicada", async () => {
      await expect(service.getStage(7)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("getUnit", () => {
    it("devuelve la unidad con lecciones y ejercicios", async () => {
      const { unit } = await service.getUnit("U0.1.1");

      expect(unit.lessons.map((item) => item.slug)).toEqual(["hola-mundo"]);
      expect(unit.exercises.map((item) => item.slug)).toEqual(["primer-programa"]);
    });

    it("expone la etapa a la que pertenece la unidad", async () => {
      const { unit } = await service.getUnit("U0.1.1");

      expect(unit.stageId).toBe(0);
      expect(unit.moduleCode).toBe("M0.1");
    });

    it("nunca expone la solución del ejercicio", async () => {
      const { unit } = await service.getUnit("U0.1.1");

      expect(unit.exercises[0]).not.toHaveProperty("solution");
      expect(unit.exercises[0]).not.toHaveProperty("sources");
    });

    it("responde 404 cuando la unidad no está publicada", async () => {
      await expect(service.getUnit("U9.1.1")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("getLesson", () => {
    it("devuelve la lección con sus 7 pasos", async () => {
      const { lesson: found } = await service.getLesson("hola-mundo");

      expect(found.steps).toHaveLength(7);
      expect(found.unitCode).toBe("U0.1.1");
      expect(found.content).toHaveLength(1);
    });

    it("responde 404 cuando la lección no existe o no está publicada", async () => {
      await expect(service.getLesson("leccion-inexistente")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("listResources", () => {
    it("filtra por etapa", async () => {
      const response = await service.listResources({ page: 1, pageSize: 20, stage: 1 });

      expect(response.data.map((item) => item.slug)).toEqual(["video-que-es-la-ia"]);
      expect(response.meta.total).toBe(1);
    });

    it("filtra por tipo", async () => {
      const response = await service.listResources({
        page: 1,
        pageSize: 20,
        type: "DOCUMENTATION",
      });

      expect(response.data.map((item) => item.slug)).toEqual(["mdn-javascript"]);
    });

    it("devuelve una página vacía con metadatos cuando no hay coincidencias", async () => {
      const response = await service.listResources({
        page: 1,
        pageSize: 20,
        type: "ANIMATION",
      });

      expect(response.data).toEqual([]);
      expect(response.meta).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
    });
  });
});
