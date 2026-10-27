import type { ExerciseType, Ladder, SubmissionOutcome } from "@codeai/shared";

import type { Page, PageWindow } from "../content/content.repository";

/**
 * Puerto de lectura y escritura del laboratorio. Se reutilizan `Page` y
 * `PageWindow` del módulo de contenido: son la misma semántica de paginación y
 * duplicarlas permitiría que una lista y otra divergieran.
 */
export const EXERCISES_REPOSITORY = Symbol("EXERCISES_REPOSITORY");

/**
 * Fila completa de un ejercicio, con `solution` y con las pruebas ocultas. Sólo
 * el servicio la ve: el mapper es el único punto que decide qué sale al cliente.
 */
export interface ExerciseRow {
  id: string;
  unitId: string;
  unitCode: string;
  slug: string;
  type: ExerciseType;
  title: string;
  statement: string;
  config: unknown;
  /** Nunca se sirve al estudiante; existe para que S6 pueda evaluar. */
  solution: unknown;
  ladder: Ladder;
  difficulty: number;
  competencies: readonly string[];
  estimatedMin: number | null;
  language: string | null;
  /** Niveles de pista disponibles; el texto llega con S6. */
  hintLevels: readonly number[];
  tests: readonly {
    id: string;
    name: string;
    isHidden: boolean;
    /**
     * Peso relativo de la prueba en la nota (`ExerciseTest.weight`, 1 por
     * defecto). Opcional para que un dataset de prueba no tenga que declararlo.
     */
    weight?: number;
    /**
     * Aserción que el sandbox ejecuta. Nunca se sirve al cliente: sólo viaja
     * dentro de la petición al puerto (`sandbox-ejecucion.md` §5).
     */
    spec?: unknown;
  }[];
}

export interface SubmissionResultRow {
  testId: string;
  name: string;
  passed: boolean;
  durationMs: number | null;
}

/** Fila de `Submission` con los nombres de prueba ya resueltos. */
export interface SubmissionRow {
  id: string;
  outcome: SubmissionOutcome;
  score: number;
  achievedLevel: number | null;
  hintsUsed: number;
  createdAt: Date;
  results: readonly SubmissionResultRow[];
}

/** Lo que persiste el adaptador: el estado y la nota ya los calculó el servicio. */
export interface CreateSubmissionInput {
  userId: string;
  exerciseId: string;
  code: string;
  selfExplanation?: string;
  outcome: SubmissionOutcome;
  score: number;
  hintsUsed: number;
  durationMs: number;
  results: readonly SubmissionResultRow[];
}

export interface ExercisesRepository {
  /** Ejercicios publicados de una unidad publicada, por orden curricular. */
  listByUnit(unitCode: string, window: PageWindow): Promise<Page<ExerciseRow>>;
  /**
   * ¿La unidad existe y está publicada? El listado responde `404` si no: una
   * unidad inexistente y una unidad sin ejercicios no son el mismo caso
   * (`contratos-api.md` §4.3).
   */
  unitExists(unitCode: string): Promise<boolean>;
  findPublished(id: string): Promise<ExerciseRow | null>;
  /** Historial del propio usuario; el `userId` nunca viene del cliente. */
  listSubmissions(
    userId: string,
    exerciseId: string,
    window: PageWindow,
  ): Promise<Page<SubmissionRow>>;
  createSubmission(input: CreateSubmissionInput): Promise<SubmissionRow>;
}
