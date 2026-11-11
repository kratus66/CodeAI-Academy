import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { courseUnitFileSchema } from "@codeai/shared";
import type { SandboxRunRequest } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { DockerSandboxService } from "./docker-sandbox.service";

/**
 * Los tres pilotos con arnés (`harness: "aws"`) contra un daemon de Docker real.
 * Se activan con `SANDBOX_DOCKER_TESTS=1`; sin esa variable el CI no necesita Docker.
 */
const enabled = process.env.SANDBOX_DOCKER_TESTS === "1";

const UNITS_DIR = resolve(__dirname, "../../../prisma/seed/aws/units");
const PILOT_FILES = ["AWS-U0.3.1.json", "AWS-U2.1.1.json", "AWS-U2.2.3.json"] as const;
const LIMITS = { timeoutMs: 5_000, memoryMb: 256 } as const;

interface Pilot {
  readonly slug: string;
  readonly starterCode: string;
  readonly solutionCode: string;
  readonly tests: SandboxRunRequest["tests"];
}

function loadPilots(): Pilot[] {
  return PILOT_FILES.flatMap((fileName) => {
    const unit = courseUnitFileSchema.parse(
      JSON.parse(readFileSync(resolve(UNITS_DIR, fileName), "utf8")),
    );

    return unit.exercises.flatMap((exercise) => {
      if (
        (exercise.type !== "LAB" && exercise.type !== "DEBUG") ||
        exercise.harness !== "aws" ||
        exercise.language !== "typescript"
      ) {
        return [];
      }

      return [
        {
          slug: exercise.slug,
          starterCode: exercise.starterCode ?? "",
          solutionCode: exercise.solution?.code ?? "",
          tests: exercise.tests.map((test, index) => ({
            id: `t${index + 1}`,
            code: JSON.stringify(test.spec ?? null),
            weight: test.weight ?? 1,
          })),
        },
      ];
    });
  });
}

function request(pilot: Pilot, content: string): SandboxRunRequest {
  return {
    language: "typescript",
    files: [{ path: "index.ts", content }],
    tests: [...pilot.tests],
    limits: { ...LIMITS },
    harness: "aws",
  };
}

describe.skipIf(!enabled)("pilotos AWS con DockerSandboxService", () => {
  const sandbox = new DockerSandboxService();
  const pilots = loadPilots();

  it("encuentra los tres pilotos", () => {
    expect(pilots).toHaveLength(3);
  });

  for (const pilot of pilots) {
    it(`${pilot.slug}: la solución da PASSED`, async () => {
      const run = await sandbox.run(request(pilot, pilot.solutionCode));

      expect(run.outcome, JSON.stringify(run)).toBe("PASSED");
    }, 120_000);

    it(`${pilot.slug}: el código inicial da FAILED o PARTIAL`, async () => {
      const run = await sandbox.run(request(pilot, pilot.starterCode));

      expect(["FAILED", "PARTIAL"], JSON.stringify(run)).toContain(run.outcome);
    }, 120_000);
  }
});
