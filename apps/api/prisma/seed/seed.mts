/**
 * Semilla del currículo (Sprint 02, S2-T4/T5).
 *
 * Lee `content.seed.json`, lo valida completo con `contentSeedSchema` y aplica
 * `upsert` por clave natural (`Stage.id`, `Module.code`, `Unit.code`), de modo
 * que ejecutarla dos veces seguidas no duplica filas ni pierde progreso futuro.
 *
 * Se ejecuta con el *type stripping* nativo de Node (`node prisma/seed/seed.mts`),
 * sin `ts-node` ni `tsx`. El typecheck del seed corre antes en `npm run db:seed`.
 */
import { readFile } from "node:fs/promises";

import { PrismaClient } from "@prisma/client";
import { contentSeedSchema } from "@codeai/shared";

import {
  countCourse,
  describeIssues,
  prepareDatabaseEnv,
  previousUnitCodes,
  upsertResources,
  upsertStageTree,
} from "./seed-lib.mts";

const SEED_FILE = new URL("./content.seed.json", import.meta.url);

async function readSeed() {
  const raw: unknown = JSON.parse(await readFile(SEED_FILE, "utf8"));
  const result = contentSeedSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `Semilla inválida: ${result.error.issues.length} problema(s) en content.seed.json\n${describeIssues(result.error.issues)}`,
    );
  }

  return result.data;
}

async function main(): Promise<void> {
  prepareDatabaseEnv();

  const seed = await readSeed();
  const prisma = new PrismaClient();

  try {
    const resourceIdsBySlug = await upsertResources(prisma, seed.resources);
    const previousUnitCode = previousUnitCodes(seed.stages);

    for (const stage of seed.stages) {
      await upsertStageTree(prisma, stage, {
        courseSlug: "fullstack-ia",
        resourceIdsBySlug,
        previousUnitCode,
      });
    }

    const { stages, publishedStages, modules, units, exercises } = await countCourse(
      prisma,
      "fullstack-ia",
    );

    const expected = {
      stages: seed.stages.length,
      modules: seed.stages.reduce((total, stage) => total + stage.modules.length, 0),
      units: seed.stages.reduce(
        (total, stage) =>
          total + stage.modules.reduce((count, module) => count + module.units.length, 0),
        0,
      ),
    };

    console.log(
      `Semilla aplicada: ${stages} etapas (${publishedStages} publicadas), ${modules} módulos, ${units} unidades, ${exercises} ejercicios.`,
    );
    console.log(
      `Declarado en content.seed.json: ${expected.stages} etapas, ${expected.modules} módulos, ${expected.units} unidades.`,
    );

    if (
      stages !== expected.stages ||
      modules !== expected.modules ||
      units !== expected.units
    ) {
      console.warn(
        "Aviso: la base de datos tiene filas que no están declaradas en la semilla (no se borran a propósito).",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
