import type { CourseSlug, StageDetail } from "@codeai/shared";
import { COURSE_NOTICES } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import type { ContentDataset, InMemoryCourse } from "./in-memory-content.repository";
import { InMemoryContentRepository } from "./in-memory-content.repository";

const FULLSTACK_IDS = Array.from({ length: 12 }, (_, index) => index);
const AWS_IDS = Array.from({ length: 13 }, (_, index) => 100 + index);
const FULL_WINDOW = { skip: 0, take: 50 };

function stage(id: number, slug: string): StageDetail {
  return {
    id,
    slug,
    title: `Etapa ${id}`,
    objective: `Objetivo de la etapa ${id}`,
    level: 1,
    estimatedMin: 600,
    order: id,
    moduleCount: 0,
    modules: [],
  };
}

const FULLSTACK_STAGES = FULLSTACK_IDS.map((id) => stage(id, `e${id}-etapa-${id}`));
const AWS_STAGES = AWS_IDS.map((id) => stage(id, `aws${id - 100}-etapa-${id}`));

function course(slug: CourseSlug, order: number): InMemoryCourse {
  return {
    slug,
    title: `Ruta ${slug}`,
    objective: `Objetivo de la ruta ${slug}`,
    notice: slug === "aws-cloud" ? COURSE_NOTICES["aws-cloud"] : null,
    order,
  };
}

function dataset(): ContentDataset {
  return {
    stages: [...FULLSTACK_STAGES, ...AWS_STAGES],
    units: [],
    lessons: [],
    resources: [],
    courses: [course("aws-cloud", 1), course("fullstack-ia", 0)],
  };
}

describe("InMemoryContentRepository", () => {
  describe("listStages por ruta", () => {
    it("sin ruta devuelve solo las etapas de la ruta por defecto", async () => {
      const repository = new InMemoryContentRepository(dataset());

      const page = await repository.listStages(FULL_WINDOW);

      expect(page.items.map((item) => item.id)).toEqual(FULLSTACK_IDS);
      expect(page.total).toBe(FULLSTACK_IDS.length);
    });

    it("con fullstack-ia devuelve solo las etapas 0–11", async () => {
      const repository = new InMemoryContentRepository(dataset());

      const page = await repository.listStages({ ...FULL_WINDOW, course: "fullstack-ia" });

      expect(page.items.map((item) => item.id)).toEqual(FULLSTACK_IDS);
      expect(page.total).toBe(FULLSTACK_IDS.length);
    });

    it("con aws-cloud devuelve solo las etapas 100–112", async () => {
      const repository = new InMemoryContentRepository(dataset());

      const page = await repository.listStages({ ...FULL_WINDOW, course: "aws-cloud" });

      expect(page.items.map((item) => item.id)).toEqual(AWS_IDS);
      expect(page.total).toBe(AWS_IDS.length);
    });
  });

  describe("listCourses", () => {
    it("ordena por order y no por el orden de declaración del conjunto", async () => {
      const repository = new InMemoryContentRepository(dataset());

      const page = await repository.listCourses(FULL_WINDOW);

      expect(page.items.map((item) => item.slug)).toEqual(["fullstack-ia", "aws-cloud"]);
      expect(page.total).toBe(2);
    });

    it("desempata por slug cuando dos rutas comparten order", async () => {
      const repository = new InMemoryContentRepository({
        ...dataset(),
        courses: [course("fullstack-ia", 0), course("aws-cloud", 0)],
      });

      const page = await repository.listCourses(FULL_WINDOW);

      expect(page.items.map((item) => item.slug)).toEqual(["aws-cloud", "fullstack-ia"]);
    });

    it("pagina el catálogo y conserva el total", async () => {
      const repository = new InMemoryContentRepository(dataset());

      const first = await repository.listCourses({ skip: 0, take: 1 });
      const second = await repository.listCourses({ skip: 1, take: 1 });

      expect(first.items.map((item) => item.slug)).toEqual(["fullstack-ia"]);
      expect(first.total).toBe(2);
      expect(second.items.map((item) => item.slug)).toEqual(["aws-cloud"]);
      expect(second.total).toBe(2);
    });

    it("cuenta solo las etapas de cada ruta", async () => {
      const repository = new InMemoryContentRepository(dataset());

      const page = await repository.listCourses(FULL_WINDOW);
      const bySlug = new Map(page.items.map((item) => [item.slug, item]));

      expect(bySlug.get("fullstack-ia")).toMatchObject({ stageCount: 12 });
      expect(bySlug.get("aws-cloud")).toMatchObject({ stageCount: 13 });
    });

    it("deriva la etiqueta de etapa del registro de rutas y copia el aviso", async () => {
      const repository = new InMemoryContentRepository(dataset());

      const page = await repository.listCourses(FULL_WINDOW);
      const bySlug = new Map(page.items.map((item) => [item.slug, item]));

      expect(bySlug.get("fullstack-ia")).toMatchObject({ stageLabelPrefix: "E", notice: null });
      expect(bySlug.get("aws-cloud")).toMatchObject({
        stageLabelPrefix: "A",
        notice: COURSE_NOTICES["aws-cloud"],
      });
    });

    it("sin rutas en el conjunto devuelve una página vacía", async () => {
      const repository = new InMemoryContentRepository();

      const page = await repository.listCourses(FULL_WINDOW);

      expect(page.items).toEqual([]);
      expect(page.total).toBe(0);
    });
  });
});
