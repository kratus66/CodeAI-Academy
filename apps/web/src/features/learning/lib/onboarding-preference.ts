import { useSyncExternalStore } from "react";

/** Clave propia: no comparte espacio con el tema ni con la pausa del fondo. */
export const ONBOARDING_STORAGE_KEY = "codeai:onboarding";

export const ONBOARDING_GOALS = ["career-change", "upskill", "self-taught"] as const;
export const ONBOARDING_LEVELS = ["beginner", "some-experience", "experienced"] as const;
export const ONBOARDING_PACES = ["light", "steady", "intense"] as const;

export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number];
export type OnboardingLevel = (typeof ONBOARDING_LEVELS)[number];
export type OnboardingPace = (typeof ONBOARDING_PACES)[number];

export interface OnboardingAnswers {
  readonly goal: OnboardingGoal;
  readonly level: OnboardingLevel;
  readonly pace: OnboardingPace;
}

/**
 * Elección del primer uso. «Saltar» también se guarda: si se olvidara, la
 * tarjeta volvería en cada visita y el estudiante tendría que esquivarla.
 */
export type OnboardingChoice =
  | { readonly status: "completed"; readonly answers: OnboardingAnswers }
  | { readonly status: "skipped" };

const listeners = new Set<() => void>();

/**
 * `useSyncExternalStore` compara el resultado por identidad, así que la lectura
 * se cachea por el texto crudo guardado: dos llamadas sin escritura devuelven
 * el mismo objeto y no hay bucle de render.
 */
let cachedRaw: string | null | undefined;
let cachedChoice: OnboardingChoice | null = null;

function includes<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isOnboardingGoal(value: unknown): value is OnboardingGoal {
  return includes(ONBOARDING_GOALS, value);
}

export function isOnboardingLevel(value: unknown): value is OnboardingLevel {
  return includes(ONBOARDING_LEVELS, value);
}

export function isOnboardingPace(value: unknown): value is OnboardingPace {
  return includes(ONBOARDING_PACES, value);
}

/** Descarta lo que no tenga la forma esperada: nunca se rompe por un valor viejo. */
function parse(raw: string | null): OnboardingChoice | null {
  if (raw === null) return null;

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null) return null;

  const record = data as Record<string, unknown>;

  if (record.status === "skipped") return { status: "skipped" };
  if (record.status !== "completed") return null;

  const answers = record.answers;
  if (typeof answers !== "object" || answers === null) return null;

  const fields = answers as Record<string, unknown>;

  if (
    !isOnboardingGoal(fields.goal) ||
    !isOnboardingLevel(fields.level) ||
    !isOnboardingPace(fields.pace)
  ) {
    return null;
  }

  return {
    status: "completed",
    answers: { goal: fields.goal, level: fields.level, pace: fields.pace },
  };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readOnboardingChoice(): OnboardingChoice | null {
  const raw = readRaw();

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedChoice = parse(raw);
  }

  return cachedChoice;
}

export function saveOnboardingChoice(choice: OnboardingChoice): void {
  let stored = false;

  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(choice));
    stored = true;
  } catch {
    // Sin almacenamiento: la respuesta vale para esta sesión, nunca bloquea.
  }

  cachedRaw = stored ? readRaw() : null;
  cachedChoice = choice;
  listeners.forEach((listener) => listener());
}

/** También escucha a las otras pestañas para que el panel no diverja. */
export function subscribeOnboarding(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === ONBOARDING_STORAGE_KEY || event.key === null) listener();
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * `null` mientras no haya elección guardada. En servidor devuelve `null` para
 * que el primer render coincida con la hidratación; la tarjeta aparece después.
 */
export function useOnboardingChoice(): OnboardingChoice | null {
  return useSyncExternalStore(subscribeOnboarding, readOnboardingChoice, () => null);
}
