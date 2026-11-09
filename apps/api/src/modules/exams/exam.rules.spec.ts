import { CERTIFICATION_REGISTRY, type CertificationDefinition } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import {
  assembleDomainBlock,
  assembleRandom,
  attemptDurationMinutes,
  isPastDeadline,
  remainingSeconds,
  shuffle,
  type PoolQuestion,
} from "./exam.rules";

const CLF_C02 = CERTIFICATION_REGISTRY["CLF-C02"];
const SAA_C03 = CERTIFICATION_REGISTRY["SAA-C03"];

/** Aleatorio reproducible (LCG) para que las pruebas no dependan del azar real. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 0x1_0000_0000;
  };
}

/** Banco con `perDomain` preguntas en cada dominio de la certificación. */
function buildPool(definition: CertificationDefinition, perDomain: number): PoolQuestion[] {
  return definition.domains.flatMap((domain) =>
    Array.from({ length: perDomain }, (_, index) => ({
      exerciseId: `d${domain.id}-q${index + 1}`,
      domain: domain.id,
    })),
  );
}

/** Marca como recientes las `perDomain` primeras preguntas de cada dominio. */
function recentHead(pool: readonly PoolQuestion[], perDomain: number): ReadonlySet<string> {
  const recent = new Set<string>();

  for (const question of pool) {
    const position = Number(question.exerciseId.slice(question.exerciseId.indexOf("-q") + 2));

    if (position <= perDomain) {
      recent.add(question.exerciseId);
    }
  }

  return recent;
}

function countByDomain(items: readonly PoolQuestion[]): Record<number, number> {
  const counts: Record<number, number> = {};

  for (const item of items) {
    counts[item.domain] = (counts[item.domain] ?? 0) + 1;
  }

  return counts;
}

function domainsOf(items: readonly PoolQuestion[]): number[] {
  return items.map((item) => item.domain);
}

describe("shuffle", () => {
  it("es determinista con el mismo aleatorio", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];

    expect(shuffle(items, seededRandom(2024))).toEqual(shuffle(items, seededRandom(2024)));
  });

  it("no muta la entrada", () => {
    const items = Object.freeze([1, 2, 3, 4, 5]);
    const result = shuffle(items, seededRandom(11));

    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5]);
  });

  it("con un aleatorio fijo devuelve siempre la misma permutación", () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
    expect(shuffle([], () => 0)).toEqual([]);
  });
});

describe("attemptDurationMinutes", () => {
  it("el examen completo dura lo que declara la certificación", () => {
    expect(
      attemptDurationMinutes({
        definition: SAA_C03,
        mode: "form-a",
        itemCount: SAA_C03.questionCount,
        extraTime: false,
      }),
    ).toBe(130);
    expect(
      attemptDurationMinutes({
        definition: SAA_C03,
        mode: "random",
        itemCount: SAA_C03.questionCount,
        extraTime: true,
      }),
    ).toBe(160);
  });

  it("el bloque por dominio prorratea los minutos del examen", () => {
    expect(
      attemptDurationMinutes({
        definition: SAA_C03,
        mode: "domain",
        itemCount: 20,
        extraTime: false,
      }),
    ).toBe(40);
    expect(
      attemptDurationMinutes({
        definition: SAA_C03,
        mode: "domain",
        itemCount: 20,
        extraTime: true,
      }),
    ).toBe(50);
    expect(
      attemptDurationMinutes({ definition: SAA_C03, mode: "domain", itemCount: 17, extraTime: false }),
    ).toBe(34);
  });
});

describe("assembleRandom", () => {
  it("reparte el examen completo con el mayor resto", () => {
    const result = assembleRandom({
      definition: CLF_C02,
      pool: buildPool(CLF_C02, 40),
      recentExerciseIds: new Set<string>(),
      random: seededRandom(1),
    });

    expect(result.status).toBe("ok");

    if (result.status !== "ok") {
      return;
    }

    expect(result.items).toHaveLength(CLF_C02.questionCount);
    expect(countByDomain(result.items)).toEqual({ 1: 16, 2: 19, 3: 22, 4: 8 });
    expect(new Set(result.items.map((item) => item.exerciseId)).size).toBe(CLF_C02.questionCount);
  });

  it("no repite preguntas vistas cuando el banco alcanza", () => {
    const pool = buildPool(CLF_C02, 40);
    const recentExerciseIds = recentHead(pool, 15);
    const result = assembleRandom({
      definition: CLF_C02,
      pool,
      recentExerciseIds,
      random: seededRandom(2),
    });

    expect(result.status).toBe("ok");

    if (result.status !== "ok") {
      return;
    }

    expect(countByDomain(result.items)).toEqual({ 1: 16, 2: 19, 3: 22, 4: 8 });
    expect(result.items.filter((item) => recentExerciseIds.has(item.exerciseId))).toEqual([]);
  });

  it("completa con vistas cuando las no vistas no alcanzan", () => {
    const pool = buildPool(CLF_C02, 25);
    const recentExerciseIds = recentHead(pool, 15);
    const result = assembleRandom({
      definition: CLF_C02,
      pool,
      recentExerciseIds,
      random: seededRandom(3),
    });

    expect(result.status).toBe("ok");

    if (result.status !== "ok") {
      return;
    }

    expect(countByDomain(result.items)).toEqual({ 1: 16, 2: 19, 3: 22, 4: 8 });

    // En los dominios cortos entra todo lo no visto; el resto se completa con vistas.
    const chosen = new Set(result.items.map((item) => item.exerciseId));
    const fresh = pool.filter(
      (question) => question.domain !== 4 && !recentExerciseIds.has(question.exerciseId),
    );

    expect(fresh.every((question) => chosen.has(question.exerciseId))).toBe(true);
    expect(result.items.some((item) => recentExerciseIds.has(item.exerciseId))).toBe(true);
  });

  it("devuelve insufficient cuando un dominio no tiene preguntas suficientes", () => {
    const result = assembleRandom({
      definition: CLF_C02,
      pool: buildPool(CLF_C02, 21),
      recentExerciseIds: new Set<string>(),
      random: seededRandom(4),
    });

    expect(result).toEqual({ status: "insufficient", domain: 3, needed: 22, available: 21 });
  });
});

describe("assembleDomainBlock", () => {
  it("toma DOMAIN_BLOCK_SIZE preguntas del dominio", () => {
    const result = assembleDomainBlock({
      domain: 2,
      pool: buildPool(CLF_C02, 25),
      recentExerciseIds: new Set<string>(),
      random: seededRandom(5),
    });

    expect(result.status).toBe("ok");

    if (result.status !== "ok") {
      return;
    }

    expect(result.items).toHaveLength(20);
    expect(domainsOf(result.items).every((domain) => domain === 2)).toBe(true);
    expect(new Set(result.items.map((item) => item.exerciseId)).size).toBe(20);
  });

  it("con el banco entre el mínimo y el bloque usa todas las preguntas", () => {
    const result = assembleDomainBlock({
      domain: 1,
      pool: buildPool(CLF_C02, 17),
      recentExerciseIds: new Set<string>(),
      random: seededRandom(6),
    });

    expect(result.status).toBe("ok");

    if (result.status !== "ok") {
      return;
    }

    expect(result.items).toHaveLength(17);
  });

  it("bajo el mínimo devuelve insufficient", () => {
    const result = assembleDomainBlock({
      domain: 4,
      pool: buildPool(CLF_C02, 14),
      recentExerciseIds: new Set<string>(),
      random: seededRandom(7),
    });

    expect(result).toEqual({ status: "insufficient", domain: 4, needed: 15, available: 14 });
  });

  it("prefiere las preguntas no vistas al armar el bloque", () => {
    const pool = buildPool(CLF_C02, 30);
    const recentExerciseIds = recentHead(pool, 10);
    const result = assembleDomainBlock({
      domain: 3,
      pool,
      recentExerciseIds,
      random: seededRandom(8),
    });

    expect(result.status).toBe("ok");

    if (result.status !== "ok") {
      return;
    }

    expect(result.items).toHaveLength(20);
    expect(result.items.filter((item) => recentExerciseIds.has(item.exerciseId))).toEqual([]);
  });
});

describe("remainingSeconds", () => {
  it("redondea hacia abajo y no baja de cero", () => {
    const deadline = new Date("2026-01-01T10:00:00.000Z");

    expect(remainingSeconds(deadline, new Date("2026-01-01T09:59:00.000Z"))).toBe(60);
    expect(remainingSeconds(deadline, new Date("2026-01-01T09:59:58.500Z"))).toBe(1);
    expect(remainingSeconds(deadline, deadline)).toBe(0);
    expect(remainingSeconds(deadline, new Date("2026-01-01T10:05:00.000Z"))).toBe(0);
  });
});

describe("isPastDeadline", () => {
  it("tolera el margen de latencia y caduca al superarlo", () => {
    const deadline = new Date("2026-01-01T10:00:00.000Z");

    expect(isPastDeadline(deadline, new Date("2026-01-01T10:00:05.000Z"))).toBe(false);
    expect(isPastDeadline(deadline, new Date("2026-01-01T10:00:06.000Z"))).toBe(true);
    expect(isPastDeadline(deadline, new Date("2026-01-01T09:59:59.000Z"))).toBe(false);
  });
});
