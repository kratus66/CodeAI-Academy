import type {
  CreateSubmissionInput,
  ExerciseDetailResponse,
  ExerciseListQuery,
  ExerciseListResponse,
  PaginationMeta,
  SandboxRunRequest,
  SandboxRunResponse,
  SandboxTestResult,
  SubmissionListResponse,
  SubmissionResponse,
} from "@codeai/shared";
import { sandboxLanguageSchema } from "@codeai/shared";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import type { Page, PageWindow } from "../content/content.repository";
import type { SandboxService } from "../sandbox/sandbox.service";
import { SANDBOX_SERVICE } from "../sandbox/sandbox.service";
import { gradeSubmission } from "./grading";
import {
  toExerciseDetail,
  toExerciseListItem,
  toSubmissionSummary,
} from "./exercises.mapper";
import type {
  CreateSubmissionInput as CreateSubmissionRow,
  ExercisesRepository,
  ExerciseRow,
  SubmissionResultRow,
} from "./exercises.repository";
import { EXERCISES_REPOSITORY } from "./exercises.repository";
import type { HintRequestRepository } from "./hint-requests.repository";
import { HINT_REQUESTS_REPOSITORY } from "./hint-requests.repository";
import { ATTEMPTS_EXHAUSTED, checkAttemptLimit } from "./submit-limits";

const EXERCISE_NOT_FOUND = "El ejercicio solicitado no existe o no está publicado";
const UNIT_NOT_FOUND = "La unidad solicitada no existe o no está publicada";
const EXERCISE_WITHOUT_SANDBOX =
  "Este ejercicio no se ejecuta en el laboratorio todavía";
const SANDBOX_UNAVAILABLE =
  "El laboratorio no está disponible en este momento. Inténtalo de nuevo en unos segundos.";

/**
 * Límites que viajan en cada ejecución. Son los valores por defecto del
 * contrato (`sandboxRunRequestSchema`); el adaptador real los aplica al
 * contenedor y el mock sólo los ignora.
 */
const RUN_LIMITS = { timeoutMs: 5_000, memoryMb: 256 } as const;

/** El sandbox no elige el nombre del archivo: lo fija el lenguaje del ejercicio. */
const FILE_NAME_BY_LANGUAGE: Record<SandboxRunRequest["language"], string> = {
  typescript: "index.ts",
  javascript: "index.js",
  sql: "query.sql",
};

type ExerciseTestRow = ExerciseRow["tests"][number];

/**
 * Reglas del laboratorio (`contratos-api.md` §4.3 y §4.6): ventana de paginación,
 * `404` para unidades y ejercicios no publicados y una única llamada al puerto
 * del sandbox por envío. No conoce Prisma ni HTTP.
 *
 * S6 corrige con **todas** las pruebas (visibles y ocultas) y calcula el nivel y
 * `hintsUsed` en el servidor; sólo las visibles se persisten. El `409` por tope
 * de intentos se decide aquí (T9), antes de tocar el sandbox.
 */
@Injectable()
export class ExercisesService {
  constructor(
    @Inject(EXERCISES_REPOSITORY) private readonly repository: ExercisesRepository,
    @Inject(SANDBOX_SERVICE) private readonly sandbox: SandboxService,
    @Inject(HINT_REQUESTS_REPOSITORY)
    private readonly hintRequests: HintRequestRepository,
  ) {}

  async listByUnit(
    unitCode: string,
    query: ExerciseListQuery,
  ): Promise<ExerciseListResponse> {
    if (!(await this.repository.unitExists(unitCode))) {
      throw new NotFoundException(UNIT_NOT_FOUND);
    }

    const page = await this.repository.listByUnit(unitCode, toWindow(query));

    return toPaginated(page, query, toExerciseListItem);
  }

  async getDetail(id: string): Promise<ExerciseDetailResponse> {
    const exercise = await this.requireExercise(id);

    return { exercise: toExerciseDetail(exercise) };
  }

  /** Historial del propio usuario: el `userId` sale del token, nunca del cliente. */
  async listSubmissions(
    userId: string,
    exerciseId: string,
    query: ExerciseListQuery,
  ): Promise<SubmissionListResponse> {
    await this.requireExercise(exerciseId);

    const page = await this.repository.listSubmissions(
      userId,
      exerciseId,
      toWindow(query),
    );

    // Envoltorio explícito: `Array.map` pasaría el índice como `feedback`.
    return toPaginated(page, query, (row) => toSubmissionSummary(row));
  }

  async submit(
    userId: string,
    exerciseId: string,
    body: CreateSubmissionInput,
  ): Promise<SubmissionResponse> {
    const exercise = await this.requireExercise(exerciseId);

    // El tope se comprueba antes de ejecutar nada: un envío rechazado no gasta sandbox.
    const attemptsUsed = await this.repository.countSubmissions(userId, exerciseId);
    const limit = checkAttemptLimit({
      attemptsUsed,
      maxAttempts: exercise.maxAttempts ?? null,
    });

    if (!limit.allowed) {
      throw new ConflictException(ATTEMPTS_EXHAUSTED);
    }

    const language = sandboxLanguageSchema.safeParse(exercise.language);

    if (!language.success) {
      throw new BadRequestException(EXERCISE_WITHOUT_SANDBOX);
    }

    // Sin envío previo cuentan todas las pistas del ejercicio; el número lo
    // calcula el servidor, nunca el cliente.
    const previous = await this.repository.listSubmissions(userId, exerciseId, {
      skip: 0,
      take: 1,
    });
    const previousAt = previous.items[0]?.createdAt ?? null;
    const hintsUsed = (
      await this.hintRequests.findLevelsRequestedSince(userId, exerciseId, previousAt)
    ).length;

    const visibleTests = exercise.tests.filter((test) => !test.isHidden);
    const run = await this.execute({
      language: language.data,
      files: [
        { path: FILE_NAME_BY_LANGUAGE[language.data], content: body.code },
      ],
      tests: exercise.tests.map(toSandboxTest),
      limits: { ...RUN_LIMITS },
    });
    const grade = gradeSubmission({
      tests: exercise.tests.map((test) => ({
        testId: test.id,
        name: test.name,
        weight: weightOf(test),
        isHidden: test.isHidden,
        passed: run.results.some(
          (result) => result.testId === test.id && result.passed,
        ),
      })),
      ladder: exercise.ladder,
      hintsUsed,
      selfExplanation: body.selfExplanation ?? null,
      sandboxOutcome: run.outcome,
    });

    const row = await this.repository.createSubmission({
      userId,
      exerciseId,
      code: body.code,
      ...(body.selfExplanation === undefined
        ? {}
        : { selfExplanation: body.selfExplanation }),
      outcome: grade.outcome,
      score: grade.score,
      achievedLevel: grade.achievedLevel,
      hintsUsed,
      durationMs: run.durationMs,
      // Sólo las visibles: el historial no debe filtrar nombres de pruebas ocultas.
      results: toTestResults(run, visibleTests),
    } satisfies CreateSubmissionRow);

    return { submission: toSubmissionSummary(row, grade.feedback) };
  }

  private async requireExercise(id: string): Promise<ExerciseRow> {
    const exercise = await this.repository.findPublished(id);

    if (!exercise) {
      throw new NotFoundException(EXERCISE_NOT_FOUND);
    }

    return exercise;
  }

  /**
   * Un adaptador caído se traduce a `503` con el mensaje del catálogo: el
   * estudiante nunca ve rutas del host ni el error del contenedor.
   */
  private async execute(request: SandboxRunRequest): Promise<SandboxRunResponse> {
    try {
      return await this.sandbox.run(request);
    } catch {
      throw new ServiceUnavailableException(SANDBOX_UNAVAILABLE);
    }
  }
}

/** `page` es 1-based: la primera página empieza en la fila 0. */
function toWindow(query: ExerciseListQuery): PageWindow {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

function toPaginated<TItem, TMapped>(
  page: Page<TItem>,
  query: ExerciseListQuery,
  map: (item: TItem) => TMapped,
): { data: TMapped[]; meta: PaginationMeta } {
  return {
    data: page.items.map(map),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: page.total,
      totalPages: Math.ceil(page.total / query.pageSize),
    },
  };
}

/** El código de la prueba es su `spec` serializado; el mock lo ignora. */
function toSandboxTest(
  test: ExerciseTestRow,
): SandboxRunRequest["tests"][number] {
  return {
    id: test.id,
    code: JSON.stringify(test.spec ?? null),
    weight: weightOf(test),
  };
}

function weightOf(test: ExerciseTestRow): number {
  const weight = test.weight ?? 1;

  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

/**
 * Traduce la ejecución a resultados persistibles: sólo las pruebas **visibles**
 * del catálogo, con su nombre. Un test que el sandbox no devuelve cuenta como
 * fallido, y `ERROR`/`TIMEOUT` los anula todos (la nota ya la fijó el evaluador).
 */
function toTestResults(
  run: SandboxRunResponse,
  tests: readonly ExerciseTestRow[],
): SubmissionResultRow[] {
  const outcomes = new Map<string, SandboxTestResult>(
    run.results.map((result) => [result.testId, result]),
  );
  const aborted = run.outcome === "ERROR" || run.outcome === "TIMEOUT";

  return tests.map((test) => {
    const result = outcomes.get(test.id);

    return {
      testId: test.id,
      name: test.name,
      passed: !aborted && result?.passed === true,
      durationMs: result?.durationMs ?? null,
    };
  });
}
