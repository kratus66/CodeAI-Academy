/**
 * Semilla de entrevistas (Sprint 10, S10-T3).
 *
 * Lee `interviews.seed.json`, lo valida con el contrato compartido y aplica
 * `upsert` por `slug`: ejecutarla dos veces deja los mismos nueve escenarios
 * (3 roles × 3 niveles) sin duplicar filas ni tocar las sesiones existentes.
 *
 * La rúbrica no se repite en el JSON: si un escenario no declara la suya se usa
 * `DEFAULT_INTERVIEW_RUBRIC` (30/25/20/15/10), la misma que valida la API.
 *
 * Se ejecuta con el *type stripping* nativo de Node
 * (`node prisma/seed/seed-interviews.mts`), sin `ts-node` ni `tsx`. El typecheck
 * del seed corre antes en `npm run db:seed:interviews`.
 */
import { readFile } from "node:fs/promises";

import {
  DEFAULT_INTERVIEW_RUBRIC,
  INTERVIEW_MAX_TURNS,
  interviewRubricSchema,
  interviewScenarioPhaseSchema,
  interviewScenarioSummarySchema,
} from "@codeai/shared";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

/** Mismo valor por defecto que `apps/api/src/config/env.ts`. */
const DATABASE_URL_FALLBACK =
  "postgresql://codeai:codeai@localhost:5433/codeai?schema=public";

/** Rutas candidatas de `.env`: el proceso puede arrancar desde la raíz o desde `apps/api`. */
const ENV_FILES = [".env", "apps/api/.env"] as const;

const SEED_FILE = new URL("./interviews.seed.json", import.meta.url);

/**
 * El JSON no repite `attempts` (es un dato de sesiones, no del catálogo) y
 * exige la solución de referencia, que el contrato público nunca incluye.
 */
const scenarioSeedSchema = interviewScenarioSummarySchema
  .omit({ attempts: true })
  .extend({
    phases: z
      .array(interviewScenarioPhaseSchema)
      .min(1)
      .max(6, "Un escenario no puede declarar más de 6 fases"),
    rubric: interviewRubricSchema.optional(),
    referenceSolution: z
      .string()
      .trim()
      .min(20, "La solución de referencia es demasiado corta para filtrar fugas")
      .max(4_000),
    isPublished: z.boolean().default(true),
  })
  .strict()
  .superRefine((scenario, ctx) => {
    if (scenario.phases.length !== scenario.phaseCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phaseCount"],
        message: "phaseCount debe coincidir con el número de fases",
      });
    }

    const totalTurns = scenario.phases.reduce(
      (total, phase) => total + phase.maxTurns,
      0,
    );

    if (totalTurns > INTERVIEW_MAX_TURNS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phases"],
        message: `El guion no puede superar ${INTERVIEW_MAX_TURNS} turnos (declara ${totalTurns})`,
      });
    }

    const unique = new Set(scenario.phases.map((phase) => phase.phase));

    if (unique.size !== scenario.phases.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phases"],
        message: "Cada fase del guion debe aparecer una sola vez",
      });
    }
  });

const seedSchema = z
  .object({ scenarios: z.array(scenarioSeedSchema).min(1) })
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
      `Semilla inválida: ${result.error.issues.length} problema(s) en interviews.seed.json\n${describeIssues(result.error.issues)}`,
    );
  }

  const slugs = new Set(result.data.scenarios.map((scenario) => scenario.slug));

  if (slugs.size !== result.data.scenarios.length) {
    throw new Error(
      "Semilla inválida: hay slugs repetidos en interviews.seed.json",
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
    for (const scenario of seed.scenarios) {
      const fields = {
        title: scenario.title,
        role: scenario.role,
        level: scenario.level,
        language: scenario.language,
        competencies: scenario.competencies,
        phases: scenario.phases,
        rubric: scenario.rubric ?? DEFAULT_INTERVIEW_RUBRIC,
        referenceSolution: scenario.referenceSolution,
        estimatedMinutes: scenario.estimatedMinutes,
        isPublished: scenario.isPublished,
      };

      // `slug` es la clave natural: la segunda ejecución actualiza, no duplica.
      await prisma.interviewScenario.upsert({
        where: { slug: scenario.slug },
        create: { slug: scenario.slug, ...fields },
        update: fields,
      });
    }

    const [total, published, byRole] = await Promise.all([
      prisma.interviewScenario.count(),
      prisma.interviewScenario.count({ where: { isPublished: true } }),
      prisma.interviewScenario.groupBy({
        by: ["role"],
        where: { isPublished: true },
        _count: { _all: true },
        orderBy: { role: "asc" },
      }),
    ]);

    console.log(
      `Semilla aplicada: ${total} escenarios (${published} publicados).`,
    );
    console.log(
      `Declarados en interviews.seed.json: ${seed.scenarios.length}.`,
    );
    console.log(
      `Publicados por rol: ${byRole
        .map((row) => `${row.role}=${row._count._all}`)
        .join(", ")}`,
    );

    if (total !== seed.scenarios.length) {
      console.warn(
        "Aviso: la base tiene escenarios que no están declarados en la semilla (no se borran a propósito).",
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