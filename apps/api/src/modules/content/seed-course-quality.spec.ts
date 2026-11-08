import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  courseSeedSchema,
  courseUnitFileSchema,
  mergeCourseSeed,
  type CourseUnitFileEntry,
} from "@codeai/shared";
import { describe, expect, it } from "vitest";

/**
 * Guarda de calidad de la semilla de la ruta AWS (esqueleto + archivos de
 * unidad). Si `aws/units` aún no existe, se leen cero archivos y la guarda
 * pasa igual.
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
