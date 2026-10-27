import type { ProgressCounts, UnitState } from "@codeai/shared";

/**
 * Reglas puras del progreso (`prerequisitos-y-progreso.md` §1 y §4). No conocen
 * Prisma, HTTP ni el reloj: reciben datos y devuelven estado, de modo que el
 * servicio y las pruebas comparten exactamente el mismo cálculo.
 */

/**
 * Estados que cuentan como prerrequisito cumplido. `NEEDS_REVIEW` **no**
 * cumple: la unidad está aprobada pero con repaso pendiente, y desbloquear con
 * ella contradiría la regla de recuperación acumulativa.
 */
const COMPLETED_STATES: ReadonlySet<UnitState> = new Set<UnitState>(["MASTERED"]);

/**
 * Estados guardados que representan actividad real. `LOCKED` nunca se persiste
 * como verdad: se deriva al leer y, si aparece en una fila antigua, se trata
 * como «sin actividad».
 */
const ACTIVITY_STATES: ReadonlySet<UnitState> = new Set<UnitState>([
  "IN_PROGRESS",
  "NEEDS_REVIEW",
  "MASTERED",
]);

/** Prerrequisitos declarados por una unidad, por código (`Unit.prerequisiteIds`). */
export interface UnlockInput {
  prerequisiteCodes: readonly string[];
  /** Estado actual del estudiante en cada unidad prerrequisito, por código. */
  prerequisiteStates: Readonly<Record<string, UnitState | undefined>>;
}

export interface ResolveStateInput extends UnlockInput {
  /** Estado ya guardado para la unidad, si el estudiante tiene fila. */
  currentState?: UnitState | null;
}

/**
 * Un prerrequisito está cumplido solo si existe **y** está `MASTERED`. Un
 * código desconocido (unidad borrada, no publicada o nunca cursada) no
 * desbloquea: el fallo seguro es `LOCKED`.
 */
export function isPrerequisiteSatisfied(state: UnitState | undefined): boolean {
  return state !== undefined && COMPLETED_STATES.has(state);
}

/** `true` cuando **todos** los prerrequisitos están cumplidos (o no hay). */
export function isUnitUnlocked(input: UnlockInput): boolean {
  return input.prerequisiteCodes.every((code) =>
    isPrerequisiteSatisfied(input.prerequisiteStates[code]),
  );
}

/**
 * Estado que se sirve al estudiante. `LOCKED` y `AVAILABLE` se derivan aquí y
 * no se leen de la fila: si el estudiante cumple los prerrequisitos, una fila
 * con `LOCKED` obsoleto se sirve como `AVAILABLE`.
 */
export function resolveUnitState(input: ResolveStateInput): UnitState {
  if (!isUnitUnlocked(input)) {
    return "LOCKED";
  }

  const current = input.currentState ?? null;

  return current !== null && ACTIVITY_STATES.has(current) ? current : "AVAILABLE";
}

/**
 * Porcentaje de una unidad en S4: lecciones vistas sobre lecciones publicadas.
 * Con cero lecciones publicadas devuelve 0 % (la unidad sigue `AVAILABLE`).
 * Los pesos de evaluación de §4.1 llegarán con S6; esta es la única función
 * que hay que sustituir para activarlos.
 */
export function unitProgressPct(lessonsDone: number, lessonsTotal: number): number {
  if (!Number.isFinite(lessonsDone) || !Number.isFinite(lessonsTotal) || lessonsTotal <= 0) {
    return 0;
  }

  const done = Math.min(Math.max(lessonsDone, 0), lessonsTotal);

  return roundPct((done / lessonsTotal) * 100);
}

/**
 * Estado tras marcar una lección vista. Incrementa el avance pero **nunca**
 * acredita `MASTERED` (solo lo hace S6 con envíos) y no degrada una unidad ya
 * aprobada o en repaso.
 */
export function stateAfterLessonSeen(state: UnitState, progressPct: number): UnitState {
  if (state === "MASTERED" || state === "NEEDS_REVIEW") {
    return state;
  }

  return progressPct > 0 ? "IN_PROGRESS" : "AVAILABLE";
}

/**
 * Contadores de `GET /api/progress/overview`. El contrato publica cuatro
 * campos, así que `AVAILABLE` se pliega en `inProgress` (unidad desbloqueada
 * sin dominar) para que la suma de los contadores sea el total de unidades.
 */
export function countUnitsByState(units: readonly { state: UnitState }[]): ProgressCounts {
  const counts: ProgressCounts = { mastered: 0, inProgress: 0, needsReview: 0, locked: 0 };

  for (const unit of units) {
    switch (unit.state) {
      case "MASTERED":
        counts.mastered += 1;
        break;
      case "NEEDS_REVIEW":
        counts.needsReview += 1;
        break;
      case "LOCKED":
        counts.locked += 1;
        break;
      case "AVAILABLE":
      case "IN_PROGRESS":
        counts.inProgress += 1;
        break;
    }
  }

  return counts;
}

/** Media del avance de las unidades, 0 % cuando todavía no hay ninguna. */
export function overallProgressPct(units: readonly { progressPct: number }[]): number {
  if (units.length === 0) {
    return 0;
  }

  const total = units.reduce((sum, unit) => sum + clampPct(unit.progressPct), 0);

  return roundPct(total / units.length);
}

/** Un decimal basta para mostrar el avance y evita el ruido de coma flotante. */
function roundPct(value: number): number {
  return Math.round(clampPct(value) * 10) / 10;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}
