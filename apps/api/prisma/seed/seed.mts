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

/** Mismo valor por defecto que `apps/api/src/config/env.ts`. */
const DATABASE_URL_FALLBACK =
  "postgresql://codeai:codeai@localhost:5433/codeai?schema=public";

/**
 * Rutas candidatas de `.env`: el proceso puede arrancar desde la raíz del
 * monorepo o desde `apps/api` (caso de `npm run db:seed`).
 */
const ENV_FILES = [".env", "apps/api/.env"] as const;

const SEED_FILE = new URL("./content.seed.json", import.meta.url);

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

function describeIssues(issues: readonly { path: (string | number)[]; message: string }[]): string {
  return issues
    .map((issue) => `  · ${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
    .join("\n");
}

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
  loadEnvFile();
  process.env.DATABASE_URL ??= DATABASE_URL_FALLBACK;

  const seed = await readSeed();
  const prisma = new PrismaClient();

  try {
    const resourceIdBySlug = new Map<string, string>();

    for (const resource of seed.resources) {
      const resourceFields = {
        title: resource.title,
        provider: resource.provider,
        url: resource.url,
        type: resource.type,
        language: resource.language,
        level: resource.level,
        durationMin: resource.durationMin,
        license: resource.license,
        embedAllowed: resource.embedAllowed,
        status: resource.status,
        notes: resource.notes,
      };

      const storedResource = await prisma.resource.upsert({
        where: { slug: resource.slug },
        create: { slug: resource.slug, ...resourceFields },
        update: resourceFields,
      });

      resourceIdBySlug.set(resource.slug, storedResource.id);
    }

    for (const stage of seed.stages) {
      const stageFields = {
        slug: stage.slug,
        title: stage.title,
        objective: stage.objective,
        level: stage.level,
        estimatedMin: stage.estimatedMin,
        order: stage.order,
        isPublished: stage.isPublished,
      };

      await prisma.stage.upsert({
        where: { id: stage.id },
        create: { id: stage.id, ...stageFields },
        update: stageFields,
      });

      for (const module of stage.modules) {
        const moduleFields = {
          title: module.title,
          order: module.order,
          isPublished: module.isPublished,
          stageId: stage.id,
        };

        const storedModule = await prisma.module.upsert({
          where: { code: module.code },
          create: { code: module.code, ...moduleFields },
          update: moduleFields,
        });

        for (const unit of module.units) {
          const unitFields = {
            title: unit.title,
            objective: unit.objective,
            estimatedMin: unit.estimatedMin,
            order: unit.order,
            isPublished: unit.isPublished,
            prerequisiteIds: unit.prerequisiteIds,
            moduleId: storedModule.id,
          };

          const storedUnit = await prisma.unit.upsert({
            where: { code: unit.code },
            create: { code: unit.code, ...unitFields },
            update: unitFields,
          });

          for (const lesson of unit.lessons) {
            const lessonFields = {
              title: lesson.title,
              estimatedMin: lesson.estimatedMin,
              order: lesson.order,
              isPublished: lesson.isPublished,
              content: lesson.content,
              steps: lesson.steps,
              unitId: storedUnit.id,
            };

            const storedLesson = await prisma.lesson.upsert({
              where: { slug: lesson.slug },
              create: { slug: lesson.slug, ...lessonFields },
              update: lessonFields,
            });

            const linkedResourceIds = lesson.resources.map((link) => {
              const resourceId = resourceIdBySlug.get(link.resourceSlug);

              if (resourceId === undefined) {
                throw new Error(
                  `Recurso sin resolver: ${link.resourceSlug} (lección ${lesson.slug})`,
                );
              }

              return resourceId;
            });

            // Reemplaza todos los enlaces de la lección por los declarados en la
            // semilla: evita que un recurso retirado del JSON quede huérfano en BD.
            await prisma.lessonResource.deleteMany({
              where: { lessonId: storedLesson.id, resourceId: { notIn: linkedResourceIds } },
            });

            for (const [index, link] of lesson.resources.entries()) {
              const resourceId = linkedResourceIds[index]!;
              const linkFields = { order: link.order, note: link.note };

              await prisma.lessonResource.upsert({
                where: { lessonId_resourceId: { lessonId: storedLesson.id, resourceId } },
                create: { lessonId: storedLesson.id, resourceId, ...linkFields },
                update: linkFields,
              });
            }
          }
        }
      }
    }

    // Los conteos se leen de la base de datos: es la prueba de idempotencia
    // que se repite en S2-T9 al ejecutar la semilla dos veces seguidas.
    const [stages, modules, units, publishedStages] = await Promise.all([
      prisma.stage.count(),
      prisma.module.count(),
      prisma.unit.count(),
      prisma.stage.count({ where: { isPublished: true } }),
    ]);

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
      `Semilla aplicada: ${stages} etapas (${publishedStages} publicadas), ${modules} módulos, ${units} unidades.`,
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
