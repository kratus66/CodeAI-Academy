import {
  DOMAIN_BLOCK_MIN,
  DOMAIN_BLOCK_SIZE,
  EXAM_EXTRA_TIME_MIN,
  EXAM_GRACE_SECONDS,
  allocateByLargestRemainder,
  type CertificationDefinition,
  type ExamMode,
} from "@codeai/shared";

/**
 * Reglas puras del simulacro (S15-T4a): armado del intento y plazo.
 *
 * No conocen Prisma ni HTTP, y tampoco el reloj ni el azar: las fechas y el
 * aleatorio entran como argumentos para que el servicio y las pruebas usen
 * exactamente el mismo cálculo.
 */

export interface PoolQuestion {
  readonly exerciseId: string;
  readonly domain: number;
}

export type Assembly =
  | { readonly status: "ok"; readonly items: readonly PoolQuestion[] }
  | {
      readonly status: "insufficient";
      readonly domain: number | null;
      readonly needed: number;
      readonly available: number;
    };

/** Baraja con Fisher–Yates y devuelve una copia: la entrada nunca se muta. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const other = shuffled[target];

    if (current === undefined || other === undefined) {
      continue;
    }

    shuffled[index] = other;
    shuffled[target] = current;
  }

  return shuffled;
}

/**
 * Elige `needed` preguntas: primero las no vistas en los últimos intentos y,
 * solo si no alcanzan, las vistas. `null` cuando el dominio no tiene bastantes.
 */
function pickQuestions(
  candidates: readonly PoolQuestion[],
  needed: number,
  recentExerciseIds: ReadonlySet<string>,
  random: () => number,
): PoolQuestion[] | null {
  if (candidates.length < needed) {
    return null;
  }

  const fresh = candidates.filter((question) => !recentExerciseIds.has(question.exerciseId));
  const seen = candidates.filter((question) => recentExerciseIds.has(question.exerciseId));

  return [...shuffle(fresh, random), ...shuffle(seen, random)].slice(0, needed);
}

/**
 * Tanda aleatoria: reparte `questionCount` por dominio con el mayor resto, elige
 * en cada dominio sin repetir lo visto y baraja el total para el orden del
 * examen.
 */
export function assembleRandom(input: {
  definition: CertificationDefinition;
  pool: readonly PoolQuestion[];
  recentExerciseIds: ReadonlySet<string>;
  random: () => number;
}): Assembly {
  const allocation = allocateByLargestRemainder(
    input.definition.questionCount,
    input.definition.domains,
  );
  const selected: PoolQuestion[] = [];

  for (const domain of input.definition.domains) {
    const needed = allocation.get(domain.id) ?? 0;
    const candidates = input.pool.filter((question) => question.domain === domain.id);
    const picked = pickQuestions(candidates, needed, input.recentExerciseIds, input.random);

    if (picked === null) {
      return {
        status: "insufficient",
        domain: domain.id,
        needed,
        available: candidates.length,
      };
    }

    selected.push(...picked);
  }

  return { status: "ok", items: shuffle(selected, input.random) };
}

/**
 * Bloque por dominio: `DOMAIN_BLOCK_SIZE` preguntas del dominio, todas si el
 * banco tiene entre `DOMAIN_BLOCK_MIN` y `DOMAIN_BLOCK_SIZE` - 1, y
 * `insufficient` por debajo del mínimo.
 */
export function assembleDomainBlock(input: {
  domain: number;
  pool: readonly PoolQuestion[];
  recentExerciseIds: ReadonlySet<string>;
  random: () => number;
}): Assembly {
  const candidates = input.pool.filter((question) => question.domain === input.domain);
  const available = candidates.length;

  if (available < DOMAIN_BLOCK_MIN) {
    return { status: "insufficient", domain: input.domain, needed: DOMAIN_BLOCK_MIN, available };
  }

  const needed = Math.min(DOMAIN_BLOCK_SIZE, available);
  const picked = pickQuestions(candidates, needed, input.recentExerciseIds, input.random);

  if (picked === null) {
    return { status: "insufficient", domain: input.domain, needed, available };
  }

  return { status: "ok", items: shuffle(picked, input.random) };
}

/**
 * Minutos del intento. El examen completo dura `durationMin` y el bloque por
 * dominio su parte proporcional al número de preguntas; `extraTime` añade
 * `EXAM_EXTRA_TIME_MIN` al completo y su parte proporcional al bloque.
 */
export function attemptDurationMinutes(input: {
  definition: CertificationDefinition;
  mode: ExamMode;
  itemCount: number;
  extraTime: boolean;
}): number {
  const { definition, mode, itemCount, extraTime } = input;

  if (mode !== "domain") {
    return definition.durationMin + (extraTime ? EXAM_EXTRA_TIME_MIN : 0);
  }

  const minutes = Math.ceil((itemCount * definition.durationMin) / definition.questionCount);

  return extraTime
    ? minutes + Math.ceil((itemCount * EXAM_EXTRA_TIME_MIN) / definition.questionCount)
    : minutes;
}

/** Segundos que le quedan al intento; nunca negativos. */
export function remainingSeconds(deadlineAt: Date, now: Date): number {
  return Math.max(0, Math.floor((deadlineAt.getTime() - now.getTime()) / 1000));
}

/** `true` cuando el plazo venció una vez superado el margen de latencia. */
export function isPastDeadline(deadlineAt: Date, now: Date): boolean {
  return now.getTime() > deadlineAt.getTime() + EXAM_GRACE_SECONDS * 1000;
}
