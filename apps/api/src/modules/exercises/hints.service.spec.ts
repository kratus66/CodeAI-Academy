import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { ExerciseRow } from "./exercises.repository";
import { InMemoryExercisesRepository } from "./in-memory-exercises.repository";
import { InMemoryHintRequestsRepository } from "./in-memory-hint-requests.repository";
import { HintsService } from "./hints.service";

const USER = "user_1";

function row(overrides: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id: "ex_1",
    unitId: "unit_1",
    unitCode: "U1.1.1",
    slug: "valida-el-status",
    type: "LAB",
    title: "Valida el status antes de parsear",
    statement: "Implementa fetchUser validando el status.",
    config: {},
    solution: { code: "SOLUCION-SECRETA" },
    ladder: "GUIDED",
    difficulty: 2,
    competencies: ["C1"],
    estimatedMin: 25,
    language: "typescript",
    hintLevels: [1, 2, 3],
    tests: [],
    ...overrides,
  };
}

const HINT_TEXTS = [
  { exerciseId: "ex_1", level: 1, text: "Piensa en el estado de la respuesta." },
  { exerciseId: "ex_1", level: 2, text: "Comprueba response.ok antes de parsear." },
  { exerciseId: "ex_1", level: 3, text: "if (!response.ok) throw new Error(...)" },
] as const;

function setup(
  options: {
    exercises?: readonly ExerciseRow[];
    hintTexts?: typeof HINT_TEXTS | readonly (typeof HINT_TEXTS)[number][];
    used?: readonly number[];
  } = {},
) {
  const hintRequests = new InMemoryHintRequestsRepository({
    hintRequests: (options.used ?? []).map((level) => ({
      userId: USER,
      exerciseId: "ex_1",
      level,
    })),
  });
  const exercises = new InMemoryExercisesRepository({
    exercises: options.exercises ?? [row()],
    submissions: [],
    hintTexts: options.hintTexts ?? HINT_TEXTS,
  });

  return { service: new HintsService(exercises, hintRequests), hintRequests };
}

describe("HintsService.requestHint", () => {
  it("sirve el texto exacto del catálogo y anticipa el nivel siguiente", async () => {
    const { service } = setup();

    await expect(service.requestHint(USER, "ex_1", { level: 1 })).resolves.toEqual({
      hint: { level: 1, text: HINT_TEXTS[0].text, nextLevelAvailable: true },
    });
  });

  it("marca que no hay nivel siguiente en la última pista", async () => {
    const { service } = setup({ used: [1, 2] });

    const { hint } = await service.requestHint(USER, "ex_1", { level: 3 });

    expect(hint.nextLevelAvailable).toBe(false);
  });

  it("registra el uso de la pista servida", async () => {
    const { service, hintRequests } = setup();

    await service.requestHint(USER, "ex_1", { level: 1 });

    await expect(hintRequests.findUsedLevels(USER, "ex_1")).resolves.toEqual([1]);
  });

  it("pedir el mismo nivel dos veces devuelve la misma pista sin duplicar el nivel", async () => {
    const { service, hintRequests } = setup();

    const first = await service.requestHint(USER, "ex_1", { level: 1 });
    const second = await service.requestHint(USER, "ex_1", { level: 1 });

    expect(second).toEqual(first);
    await expect(hintRequests.findUsedLevels(USER, "ex_1")).resolves.toEqual([1]);
  });

  it("permite el nivel 2 tras haber usado el 1", async () => {
    const { service } = setup({ used: [1] });

    const { hint } = await service.requestHint(USER, "ex_1", { level: 2 });

    expect(hint.text).toBe(HINT_TEXTS[1].text);
  });

  it("rechaza el nivel 2 sin el 1 con 422 y no registra nada", async () => {
    const { service, hintRequests } = setup();

    await expect(service.requestHint(USER, "ex_1", { level: 2 })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    await expect(hintRequests.findUsedLevels(USER, "ex_1")).resolves.toEqual([]);
  });

  it("exige toda la progresión: el nivel 3 con sólo el 2 usado es 422", async () => {
    const { service } = setup({ used: [2] });

    await expect(service.requestHint(USER, "ex_1", { level: 3 })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it("responde 404 si el ejercicio no existe", async () => {
    const { service } = setup({ exercises: [] });

    await expect(service.requestHint(USER, "ex_1", { level: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("responde 404 si el catálogo no declara ese nivel", async () => {
    const { service } = setup({ exercises: [row({ hintLevels: [1] })], used: [1] });

    await expect(service.requestHint(USER, "ex_1", { level: 2 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("responde 404 y no registra si el nivel está declarado pero no tiene texto", async () => {
    const { service, hintRequests } = setup({ hintTexts: [] });

    await expect(service.requestHint(USER, "ex_1", { level: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(hintRequests.findUsedLevels(USER, "ex_1")).resolves.toEqual([]);
  });

  it("no filtra la solución ni campos ajenos al contrato", async () => {
    const { service } = setup();

    const response = await service.requestHint(USER, "ex_1", { level: 1 });

    expect(Object.keys(response.hint).sort()).toEqual(["level", "nextLevelAvailable", "text"]);
    expect(JSON.stringify(response)).not.toContain("SOLUCION-SECRETA");
  });

  it("cuenta el uso por usuario: la progresión de otro usuario no desbloquea", async () => {
    const { service } = setup({ used: [1] });

    await expect(service.requestHint("user_2", "ex_1", { level: 2 })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
