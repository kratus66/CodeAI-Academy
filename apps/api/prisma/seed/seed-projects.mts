/**
 * Semilla de proyectos (Sprint 09, S9-T4).
 *
 * Lee `projects.seed.json`, lo valida con Zod y aplica `upsert` por `slug`, de
 * modo que ejecutarla dos veces deja los mismos cuatro proyectos publicados
 * (uno por etapa 0–3) sin duplicar filas ni tocar las entregas existentes.
 *
 * La rúbrica no se repite en el JSON: si un proyecto no declara la suya se usa
 * `DEFAULT_PROJECT_RUBRIC` (30/20/20/15/15), la misma que valida la API.
 *
 * Se ejecuta con el *type stripping* nativo de Node
 * (`node prisma/seed/seed-projects.mts`), sin `ts-node` ni `tsx`. El typecheck
 * del seed corre antes en `npm run db:seed:projects`.
 */
import { readFile } from "node:fs/promises";

import {
  CURRICULUM_STAGE_COUNT,
  DEFAULT_PROJECT_RUBRIC,
  competencyCodeSchema,
  projectRubricSchema,
  projectSlugSchema,
} from "@codeai/shared";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

/** Mismo valor por defecto que `apps/api/src/config/env.ts`. */
const DATABASE_URL_FALLBACK =
  "postgresql://codeai:codeai@localhost:5433/codeai?schema=public";

/** Rutas candidatas de `.env`: el proceso puede arrancar desde la raíz o desde `apps/api`. */
const ENV_FILES = [".env", "apps/api/.env"] as const;

const SEED_FILE = new URL("./projects.seed.json", import.meta.url);

const projectSeedSchema = z
  .object({
    slug: projectSlugSchema,
    stageId: z
      .number({ invalid_type_error: "La etapa debe ser un número entero" })
      .int("La etapa debe ser un número entero")
      .min(0, "La etapa debe estar entre 0 y 11")
      .max(CURRICULUM_STAGE_COUNT - 1, "La etapa debe estar entre 0 y 11"),
    title: z.string().trim().min(3, "El título es demasiado corto").max(120),
    brief: z.string().trim().min(20, "El enunciado es demasiado corto").max(2_000),
    requirements: z
      .array(z.string().trim().min(3).max(200))
      .min(1, "El proyecto necesita al menos un requisito")
      .max(8, "El proyecto no puede declarar más de 8 requisitos"),
    competencies: z
      .array(competencyCodeSchema)
      .min(1, "El proyecto debe declarar al menos una competencia"),
    rubric: projectRubricSchema.optional(),
    isPublished: z.boolean().default(true),
  })
  .strict();

const seedSchema = z
  .object({ projects: z.array(projectSeedSchema).min(1) })
  .strict();

function loadEnvFile(): void {
  for (const path of ENV_FILES) {
    try {
      process.loadEnvFile(path);
      return;
    } catch {
      // Siguiente candidato: la ausencia de `.env` no es un error.
    }
  }
}

function describeIssues(
  issues: readonly { path: (string | number)[]; message: string }[],
): string {
  return issues
    .map((issue) => `  · ${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
    .join("\n");
}

async function readSeed() {
  const raw: unknown = JSON.parse(await readFile(SEED_FILE, "utf8"));
  const result = seedSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      `Semilla inválida: ${result.error.issues.length} problema(s) en projects.seed.json\n${describeIssues(result.error.issues)}`,
    );
  }

  return result.data;
}

/**
 * La semilla de contenido declara las etapas; sin ellas la FK fallaría con un
 * mensaje de Prisma poco accionable. Mejor decirlo antes de escribir.
 */
async function assertStagesExist(
  prisma: PrismaClient,
  stageIds: readonly number[],
): Promise<void> {
  const unique = [...new Set(stageIds)];
  const stages = await prisma.stage.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  const known = new Set(stages.map((stage) => stage.id));
  const missing = unique.filter((id) => !known.has(id));

  if (missing.length > 0) {
    throw new Error(
      `Faltan etapas en la base: ${missing.join(", ")}. Ejecuta antes \`npm run db:seed\`.`,
    );
  }
}

async function main(): Promise<void> {
  loadEnvFile();
  process.env.DATABASE_URL ??= DATABASE_URL_FALLBACK;

  const seed = await readSeed();
  const prisma = new PrismaClient();

  try {
    await assertStagesExist(
      prisma,
      seed.projects.map((project) => project.stageId),
    );

    for (const project of seed.projects) {
      const projectFields = {
        stageId: project.stageId,
        title: project.title,
        brief: project.brief,
        requirements: project.requirements,
        rubric: project.rubric ?? DEFAULT_PROJECT_RUBRIC,
        competencies: project.competencies,
        isPublished: project.isPublished,
      };

      // `slug` es la clave natural: la segunda ejecución actualiza, no duplica.
      await prisma.project.upsert({
        where: { slug: project.slug },
        create: { slug: project.slug, ...projectFields },
        update: projectFields,
      });
    }

    const [projects, published, publishedByStage] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { isPublished: true } }),
      prisma.project.groupBy({
        by: ["stageId"],
        where: { isPublished: true },
        _count: { _all: true },
        orderBy: { stageId: "asc" },
      }),
    ]);

    const weights = DEFAULT_PROJECT_RUBRIC.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    );

    console.log(
      `Semilla aplicada: ${projects} proyectos (${published} publicados), rúbrica base ${weights}/100.`,
    );
    console.log(
      `Declarado en projects.seed.json: ${seed.projects.length} proyectos.`,
    );
    console.log(
      `Publicados por etapa: ${publishedByStage
        .map((row) => `E${row.stageId}=${row._count._all}`)
        .join(", ")}`,
    );

    if (projects !== seed.projects.length) {
      console.warn(
        "Aviso: la base tiene proyectos que no están declarados en la semilla (no se borran a propósito).",
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
