import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { ProgressDataset, UnitProgressSeed } from "./in-memory-progress.repository";
import { InMemoryProgressRepository } from "./in-memory-progress.repository";
import type { LessonLookup, ProgressUnitRow } from "./progress.repository";
import { ProgressService } from "./progress.service";

const units: ProgressUnitRow[] = [
  {
    id: "unit-a",
    code: "U1.1.1",
    stageId: 1,
    moduleCode: "M1.1",
    order: 1,
    prerequisiteCodes: [],
    lessonsTotal: 2,
  },
  {
    id: "unit-b",
    code: "U1.1.2",
    stageId: 1,
    moduleCode: "M1.1",
    order: 2,
    prerequisiteCodes: ["U1.1.1"],
    lessonsTotal: 2,
  },
  {
    id: "unit-c",
    code: "U2.1.1",
    stageId: 2,
    moduleCode: "M2.1",
    order: 1,
    prerequisiteCodes: ["U1.1.1"],
    lessonsTotal: 1,
  },
];

const lessons: LessonLookup[] = [
  { id: "lesson-a1", unitId: "unit-a" },
  { id: "lesson-a2", unitId: "unit-a" },
  { id: "lesson-b1", unitId: "unit-b" },
  { id: "lesson-b2", unitId: "unit-b" },
  { id: "lesson-c1", unitId: "unit-c" },
];

function progress(
  userId: string,
  unitId: string,
  overrides: Partial<UnitProgressSeed> = {},
): UnitProgressSeed {
  return {
    userId,
    unitId,
    state: "IN_PROGRESS",
    progressPct: 0,
    lessonsDone: 0,
    exercisesDone: 0,
    bestScore: null,
    completedLessonIds: [],
    lastActivityAt: null,
    completedAt: null,
    ...overrides,
  };
}

const masteredA = progress("user-1", "unit-a", {
  state: "MASTERED",
  progressPct: 100,
  lessonsDone: 2,
  completedLessonIds: ["lesson-a1", "lesson-a2"],
});

function createService(
  overrides: Partial<ProgressDataset> = {},
  dueReviews = 0,
): ProgressService {
  return new ProgressService(
    new InMemoryProgressRepository({
      users: [
        { id: "user-1", name: "Ana" },
        { id: "user-2", name: "Beto" },
      ],
      units,
      lessons,
      unitProgress: [],
      competencyProgress: [],
      ...overrides,
    }),
    { countDue: () => Promise.resolve(dueReviews) },
  );
}

describe("ProgressService.getOverview", () => {
  it("publica los seis campos del contrato", async () => {
    const overview = await createService().getOverview("user-1");

    expect(overview).toEqual({
      user: { id: "user-1", name: "Ana" },
      currentStage: 1,
      overallPct: 0,
      units: { mastered: 0, inProgress: 1, needsReview: 0, locked: 2 },
      competencies: expect.any(Array),
      dueReviews: 0,
    });
  });

  it("publica la deuda real de repaso del usuario", async () => {
    const overview = await createService({}, 7).getOverview("user-1");

    expect(overview.dueReviews).toBe(7);
  });

  it("publica el mapa completo C1–C14 con nivel 0 sin evidencia", async () => {
    const { competencies } = await createService().getOverview("user-1");

    expect(competencies).toHaveLength(14);
    expect(competencies.map((entry) => entry.code)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
      "C9",
      "C10",
      "C11",
      "C12",
      "C13",
      "C14",
    ]);
    expect(competencies.every((entry) => entry.level === 0)).toBe(true);
  });

  it("avanza la etapa en curso a la primera unidad no dominada", async () => {
    const overview = await createService({ unitProgress: [masteredA] }).getOverview("user-1");

    // Con U1.1.1 dominada, la etapa en curso sigue siendo la 1 porque U1.1.2 no lo está.
    expect(overview.currentStage).toBe(1);
    expect(overview.units).toEqual({ mastered: 1, inProgress: 2, needsReview: 0, locked: 0 });
    expect(overview.overallPct).toBe(33.3);
  });

  it("se queda en la última etapa cuando todo está dominado", async () => {
    const overview = await createService({
      unitProgress: [
        masteredA,
        progress("user-1", "unit-b", {
          state: "MASTERED",
          progressPct: 100,
          lessonsDone: 2,
          completedLessonIds: ["lesson-b1", "lesson-b2"],
        }),
        progress("user-1", "unit-c", {
          state: "MASTERED",
          progressPct: 100,
          lessonsDone: 1,
          completedLessonIds: ["lesson-c1"],
        }),
      ],
    }).getOverview("user-1");

    expect(overview.currentStage).toBe(2);
    expect(overview.units.mastered).toBe(3);
    expect(overview.overallPct).toBe(100);
  });

  it("sin currículo publicado responde etapa 0 y contadores en cero", async () => {
    const overview = await createService({ units: [] }).getOverview("user-1");

    expect(overview.currentStage).toBe(0);
    expect(overview.overallPct).toBe(0);
    expect(overview.units).toEqual({ mastered: 0, inProgress: 0, needsReview: 0, locked: 0 });
  });

  it("un usuario inexistente responde 404", async () => {
    await expect(createService().getOverview("user-404")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("aísla el progreso entre usuarios", async () => {
    const service = createService({
      unitProgress: [
        progress("user-1", "unit-a", {
          progressPct: 50,
          lessonsDone: 1,
          completedLessonIds: ["lesson-a1"],
        }),
        progress("user-2", "unit-a", {
          progressPct: 100,
          lessonsDone: 2,
          completedLessonIds: ["lesson-a1", "lesson-a2"],
        }),
      ],
    });

    const ana = await service.getOverview("user-1");
    const beto = await service.getOverview("user-2");

    expect(ana.overallPct).toBe(16.7);
    expect(beto.overallPct).toBe(33.3);
  });
});

describe("ProgressService.listUnits", () => {
  it("devuelve las unidades en orden de currículo con su estado resuelto", async () => {
    const summaries = await createService({ unitProgress: [masteredA] }).listUnits("user-1");

    expect(summaries.map((entry) => entry.unitCode)).toEqual(["U1.1.1", "U1.1.2", "U2.1.1"]);
    expect(summaries.map((entry) => entry.state)).toEqual([
      "MASTERED",
      "AVAILABLE",
      "AVAILABLE",
    ]);
  });

  it("deriva el avance de las lecciones publicadas", async () => {
    const [first] = await createService({
      unitProgress: [
        progress("user-1", "unit-a", {
          progressPct: 50,
          lessonsDone: 1,
          completedLessonIds: ["lesson-a1"],
        }),
      ],
    }).listUnits("user-1");

    expect(first).toMatchObject({
      unitId: "unit-a",
      unitCode: "U1.1.1",
      state: "IN_PROGRESS",
      progressPct: 50,
      lessonsDone: 1,
    });
  });

  it("mantiene LOCKED la unidad con prerrequisito pendiente", async () => {
    const summaries = await createService().listUnits("user-1");

    expect(summaries[1]).toMatchObject({ unitCode: "U1.1.2", state: "LOCKED", progressPct: 0 });
    expect(summaries[2]).toMatchObject({ unitCode: "U2.1.1", state: "LOCKED", progressPct: 0 });
  });

  it("una unidad sin fila guardada sale AVAILABLE con ceros", async () => {
    const [first] = await createService().listUnits("user-1");

    expect(first).toEqual({
      unitId: "unit-a",
      unitCode: "U1.1.1",
      state: "AVAILABLE",
      progressPct: 0,
      lessonsDone: 0,
      exercisesDone: 0,
      bestScore: null,
      lastActivityAt: null,
      completedAt: null,
    });
  });
});

describe("ProgressService.completeLesson", () => {
  it("es idempotente: repetir la misma lección no infla el avance", async () => {
    const service = createService();

    const first = await service.completeLesson("user-1", "unit-a", "lesson-a1");
    const second = await service.completeLesson("user-1", "unit-a", "lesson-a1");

    expect(first.progressPct).toBe(50);
    expect(second.progressPct).toBe(50);
    expect(second.lessonsDone).toBe(1);
    expect(second.state).toBe("IN_PROGRESS");
    expect(second.lastActivityAt).not.toBeNull();
    expect(second.completedAt).toBeNull();
  });

  it("llega al 100 % con todas las lecciones sin acreditar MASTERED", async () => {
    const service = createService();

    await service.completeLesson("user-1", "unit-a", "lesson-a1");
    const summary = await service.completeLesson("user-1", "unit-a", "lesson-a2");

    expect(summary.progressPct).toBe(100);
    expect(summary.lessonsDone).toBe(2);
    expect(summary.state).toBe("IN_PROGRESS");
  });

  it("responde 404 si la unidad no existe", async () => {
    await expect(
      createService().completeLesson("user-1", "unit-x", "lesson-a1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("responde 404 si la lección no existe o pertenece a otra unidad", async () => {
    const service = createService();

    await expect(
      service.completeLesson("user-1", "unit-a", "lesson-x"),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.completeLesson("user-1", "unit-a", "lesson-b1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("responde 409 si la unidad está bloqueada", async () => {
    await expect(
      createService().completeLesson("user-1", "unit-b", "lesson-b1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("no escribe en el progreso de otro usuario", async () => {
    const service = createService();

    await service.completeLesson("user-1", "unit-a", "lesson-a1");
    const [beto] = await service.listUnits("user-2");

    expect(beto).toMatchObject({ progressPct: 0, lessonsDone: 0, state: "AVAILABLE" });
  });
});

describe("ProgressService.listCompetencies", () => {
  it("publica C1–C14 y rellena con 0 las que no tienen evidencia", async () => {
    const competencies = await createService({
      competencyProgress: [
        { userId: "user-1", competency: "C1", level: 3, evidenceCount: 14 },
        { userId: "user-1", competency: "C4", level: 2, evidenceCount: 6 },
      ],
    }).listCompetencies("user-1");

    expect(competencies).toHaveLength(14);
    expect(competencies[0]).toEqual({ code: "C1", level: 3, evidenceCount: 14 });
    expect(competencies[3]).toEqual({ code: "C4", level: 2, evidenceCount: 6 });
    expect(competencies[1]).toEqual({ code: "C2", level: 0, evidenceCount: 0 });
  });

  it("descarta códigos fuera de rango y no mezcla usuarios", async () => {
    const competencies = await createService({
      competencyProgress: [
        { userId: "user-1", competency: "C99", level: 4, evidenceCount: 1 },
        { userId: "user-2", competency: "C2", level: 4, evidenceCount: 9 },
      ],
    }).listCompetencies("user-1");

    expect(competencies.map((entry) => entry.code)).not.toContain("C99");
    expect(competencies[1]).toEqual({ code: "C2", level: 0, evidenceCount: 0 });
  });
});
