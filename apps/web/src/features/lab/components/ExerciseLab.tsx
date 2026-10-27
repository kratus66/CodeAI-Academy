"use client";

import type {
  CreateSubmissionInput,
  ExerciseDetail,
  SandboxLanguage,
  SandboxRunRequest,
  SandboxRunResponse,
  SubmissionOutcome,
  SubmissionSummary,
} from "@codeai/shared";
import { sandboxRunRequestSchema } from "@codeai/shared";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { ComponentType, FormEvent } from "react";

import { formatMinutes } from "@/features/learning/lib/format";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import {
  ApiError,
  contentApi,
  exercisesApi,
  sandboxApi,
} from "@/lib/api-client";
import { cn } from "@/lib/cn";

import { CodeEditor } from "./CodeEditor";
import type { CodeSurfaceProps } from "./CodeEditor";
import { HintPanel } from "./HintPanel";
import type { RequestHint } from "./HintPanel";

/**
 * Laboratorio de código (S5-T13): enunciado, editor, «Ejecutar» y «Enviar».
 *
 * El currículo enlaza ejercicios por `slug`, pero la API de ejercicios trabaja
 * con `id`, así que la primera petición resuelve el slug dentro de la unidad.
 * Ejecutar usa `/sandbox/run` (sin pruebas: sólo comprueba que el código corre
 * en el mock) y enviar usa `/exercises/:id/submissions`, que sí evalúa las
 * pruebas visibles y persiste el envío. Además pide pistas graduadas contra
 * `POST /api/exercises/:id/hints` desde el panel de pistas.
 */

/** Nombre del archivo que se manda al sandbox; el mock lo cita en `stderr`. */
const FILE_NAME: Record<SandboxLanguage, string> = {
  typescript: "index.ts",
  javascript: "index.js",
  sql: "query.sql",
};

const OUTCOME_LABEL: Record<SubmissionOutcome, string> = {
  PASSED: "Superado",
  PARTIAL: "Parcial",
  FAILED: "Fallido",
  ERROR: "Error de ejecución",
  TIMEOUT: "Tiempo agotado",
};

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-line disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:border-line/70 disabled:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const LINK_CLASSES =
  "font-medium text-accent underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const PANEL_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-300";

export interface ExerciseLabContent {
  readonly exercise: ExerciseDetail;
  readonly unitTitle: string;
}

export type LoadExerciseLab = (
  unitCode: string,
  slug: string,
  signal?: AbortSignal,
) => Promise<ExerciseLabContent>;

/**
 * Resuelve `slug` → `id` con el detalle de la unidad y luego pide el ejercicio.
 * Un slug que ya no está publicado se sirve como `404` para que la vista lo
 * trate igual que un ejercicio inexistente.
 */
export async function loadExerciseLab(
  unitCode: string,
  slug: string,
  signal?: AbortSignal,
): Promise<ExerciseLabContent> {
  const unit = await contentApi.getUnit(unitCode, signal);
  const summary = unit.exercises.find((item) => item.slug === slug);

  if (!summary) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "El ejercicio no está publicado en esta unidad.",
    });
  }

  const exercise = await exercisesApi.getDetail(summary.id, signal);

  return { exercise, unitTitle: unit.title };
}


function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") {
      return error.retryAfterSeconds
        ? `Has agotado las 20 ejecuciones del minuto. Vuelve a intentarlo en ${error.retryAfterSeconds} s.`
        : "Has agotado las 20 ejecuciones del minuto. Espera unos segundos y reinténtalo.";
    }

    if (error.code === "SERVICE_UNAVAILABLE") {
      return "El sandbox no está disponible ahora mismo. Tu código sigue aquí.";
    }

    if (error.code === "UNAUTHENTICATED") {
      return "Tu sesión caducó. Vuelve a iniciar sesión para seguir practicando.";
    }

    return error.message;
  }

  return "No pudimos completar la operación. Inténtalo de nuevo.";
}

function ErrorNotice({ message }: { readonly message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      {message}
    </p>
  );
}

function TestResultList({
  results,
}: {
  readonly results: readonly {
    readonly testId: string;
    readonly passed: boolean;
    /** El sandbox no conoce los nombres; el envío sí los resuelve. */
    readonly name?: string;
  }[];
}) {
  return (
    <ul className="mt-3 space-y-1">
      {results.map((result) => (
        <li key={result.testId} className="flex items-start gap-2 text-xs">
          <span
            aria-hidden
            className={result.passed ? "text-mint" : "text-rose-300"}
          >
            {result.passed ? "✓" : "✗"}
          </span>
          <span className={result.passed ? "text-slate-300" : "text-rose-200"}>
            {result.name ?? result.testId}
          </span>
          <span className="sr-only">
            {result.passed ? "superada" : "no superada"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Panel de la última ejecución suelta. No muestra puntuación: en `/sandbox/run`
 * no viajan las pruebas del ejercicio, así que un `100` sólo significaría «el
 * código corrió». La nota llega al enviar.
 */
function RunPanel({ run }: { readonly run: SandboxRunResponse }) {
  return (
    <div aria-live="polite" className={PANEL_CLASSES}>
      <p className="text-sm font-medium text-slate-100">
        Ejecución terminada · {OUTCOME_LABEL[run.outcome]} · {run.durationMs} ms
      </p>
      {run.results.length > 0 ? <TestResultList results={run.results} /> : null}
      {run.stdout ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-ink px-3 py-2 font-mono text-xs text-slate-200">
          {run.stdout}
        </pre>
      ) : null}
      {run.stderr ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-ink px-3 py-2 font-mono text-xs text-rose-200">
          {run.stderr}
        </pre>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        Las pruebas visibles se evalúan al enviar.
      </p>
    </div>
  );
}

function SubmissionPanel({
  submission,
}: {
  readonly submission: SubmissionSummary;
}) {
  return (
    <div aria-live="polite" className={PANEL_CLASSES}>
      <p className="text-sm font-medium text-slate-100">
        Envío {OUTCOME_LABEL[submission.outcome]} · {submission.score}/100
      </p>
      <p className="mt-1 text-xs text-slate-400">{submission.feedback}</p>
      {submission.results.length > 0 ? (
        <TestResultList results={submission.results} />
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Este ejercicio no declara pruebas visibles.
        </p>
      )}
      <p className="mt-3 text-xs text-slate-400">
        {submission.achievedLevel === null
          ? "Nivel alcanzado: sin nivel"
          : `Nivel alcanzado: ${submission.achievedLevel}/4`}
        {" · "}
        {submission.hintsUsed === 1
          ? "1 pista usada"
          : `${submission.hintsUsed} pistas usadas`}
      </p>
    </div>
  );
}


interface LabWorkspaceProps {
  readonly unitCode: string;
  readonly unitTitle: string;
  readonly exercise: ExerciseDetail;
  readonly editorSurface?: ComponentType<CodeSurfaceProps> | null;
  readonly runCode: (input: SandboxRunRequest) => Promise<SandboxRunResponse>;
  readonly submitSolution: (
    exerciseId: string,
    input: CreateSubmissionInput,
  ) => Promise<SubmissionSummary>;
  readonly requestHint?: RequestHint;
}

/** Estado del laboratorio una vez el ejercicio está cargado. */
function LabWorkspace({
  unitCode,
  unitTitle,
  exercise,
  editorSurface,
  runCode,
  submitSolution,
  requestHint,
}: LabWorkspaceProps) {
  const [code, setCode] = useState(() => exercise.starterCode ?? "");
  const [selfExplanation, setSelfExplanation] = useState("");
  const [run, setRun] = useState<SandboxRunResponse | null>(null);
  const [runError, setRunError] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [submission, setSubmission] = useState<SubmissionSummary | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const language = exercise.language;
  const busy = running || submitting;
  const hasCode = code.trim().length > 0;
  const canRun = language !== null && hasCode && !busy;
  const canSubmit = hasCode && !busy;

  async function handleRun() {
    if (language === null || !canRun) {
      return;
    }

    setRunning(true);
    setRunError(null);
    setRun(null);

    try {
      const result = await runCode(
        // Los topes de `limits` son los del contrato: se aplican con el propio
        // esquema para no repetir 5 000 ms ni 256 MB en la web.
        sandboxRunRequestSchema.parse({
          language,
          files: [{ path: FILE_NAME[language], content: code }],
          tests: [],
        }),
      );

      setRun(result);
    } catch (error) {
      setRunError(error);
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmission(null);

    const explanation = selfExplanation.trim();

    try {
      const result = await submitSolution(
        exercise.id,
        explanation.length > 0
          ? { code, selfExplanation: explanation }
          : { code },
      );

      setSubmission(result);
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div className="space-y-8">
      <nav aria-label="Ruta del ejercicio" className="text-xs">
        <Link href={`/learn/units/${unitCode}`} className={LINK_CLASSES}>
          <span aria-hidden>←</span> {unitTitle}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="enunciado" className="space-y-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            {unitCode} · {exercise.type} · dificultad {exercise.difficulty}/4
          </p>
          <h1
            id="enunciado"
            className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
          >
            {exercise.title}
          </h1>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {exercise.statement}
          </p>

          <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-line/70 bg-ink-card/40 px-4 py-3 text-xs">
            <div>
              <dt className="text-slate-500">Lenguaje</dt>
              <dd className="mt-1 font-mono text-slate-200">
                {language ?? "sin sandbox"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Tiempo estimado</dt>
              <dd className="mt-1 text-slate-200">
                {formatMinutes(exercise.estimatedMin) ?? "sin estimar"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Pruebas visibles</dt>
              <dd className="mt-1 text-slate-200">
                {exercise.publicTests.length}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Pistas</dt>
              <dd className="mt-1 text-slate-200">
                {exercise.hintsAvailable}
              </dd>
            </div>
          </dl>

          {exercise.publicTests.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-white">
                Pruebas visibles
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {exercise.publicTests.map((test) => (
                  <li key={test.testId}>{test.name}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <HintPanel
            exerciseId={exercise.id}
            hintsAvailable={exercise.hintsAvailable}
            requestHint={requestHint}
          />
        </section>

        <section aria-labelledby="laboratorio" className="space-y-4">
          <h2
            id="laboratorio"
            className="text-lg font-semibold tracking-tight text-white"
          >
            Laboratorio
          </h2>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <CodeEditor
              id="solucion"
              description={
                language === null
                  ? "Este ejercicio no declara lenguaje ejecutable."
                  : undefined
              }
              label="Tu solución"
              language={language ?? "typescript"}
              surface={editorSurface}
              value={code}
              onChange={setCode}
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={SECONDARY_BUTTON}
                disabled={!canRun}
                onClick={handleRun}
              >
                {running ? "Ejecutando…" : "Ejecutar"}
              </button>
              <button
                type="submit"
                className={PRIMARY_BUTTON}
                disabled={!canSubmit}
              >
                {submitting ? "Enviando…" : "Enviar"}
              </button>
              {hasCode ? null : (
                <p className="text-xs text-slate-500">
                  Escribe código para ejecutar o enviar.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="explicacion"
                className="text-sm font-medium text-slate-200"
              >
                Explica tu solución (opcional)
              </label>
              <p className="text-xs text-slate-500">
                En dos o tres frases: qué decidiste y por qué.
              </p>
              <textarea
                id="explicacion"
                className="block w-full rounded-xl border border-line/70 bg-ink-card/60 px-4 py-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                maxLength={2000}
                rows={3}
                value={selfExplanation}
                onChange={(event) => setSelfExplanation(event.target.value)}
              />
            </div>
          </form>

          {runError ? <ErrorNotice message={describeError(runError)} /> : null}
          {submitError ? (
            <ErrorNotice message={describeError(submitError)} />
          ) : null}
          {run ? <RunPanel run={run} /> : null}
          {submission ? <SubmissionPanel submission={submission} /> : null}
        </section>
      </div>
    </div>
  );
}

export interface ExerciseLabProps {
  readonly unitCode: string;
  readonly slug: string;
  /** Inyectable en pruebas; por defecto resuelve el slug contra la API. */
  readonly loadLab?: LoadExerciseLab;
  readonly editorSurface?: ComponentType<CodeSurfaceProps> | null;
  readonly runCode?: (input: SandboxRunRequest) => Promise<SandboxRunResponse>;
  readonly submitSolution?: (
    exerciseId: string,
    input: CreateSubmissionInput,
  ) => Promise<SubmissionSummary>;
  readonly requestHint?: RequestHint;
}

/** Una URL mal formada y un ejercicio no publicado son el mismo caso. */
function isMissingContent(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 404 || error.status === 400)
  );
}

/**
 * Laboratorio de un ejercicio: carga el detalle, y una vez listo delega en
 * `LabWorkspace`. La carga usa el mismo `useContentLoader` que las vistas de
 * contenido, así que la petición se aborta al desmontar.
 */
export function ExerciseLab({
  unitCode,
  slug,
  loadLab = loadExerciseLab,
  editorSurface,
  runCode = (input) => sandboxApi.run(input),
  submitSolution = (exerciseId, input) =>
    exercisesApi.submit(exerciseId, input),
  requestHint,
}: ExerciseLabProps) {
  const load = useCallback(
    (signal: AbortSignal) => loadLab(unitCode, slug, signal),
    [loadLab, unitCode, slug],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando el ejercicio…
      </p>
    );
  }

  if (state.status === "error") {
    if (isMissingContent(state.error)) {
      return (
        <div
          role="alert"
          className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6"
        >
          <p className="text-sm font-medium text-slate-200">
            No encontramos este ejercicio.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Puede que ya no esté publicado en la unidad.
          </p>
          <Link
            href={`/learn/units/${unitCode}`}
            className={`${LINK_CLASSES} mt-4 inline-block`}
          >
            Volver a la unidad
          </Link>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>No pudimos cargar el ejercicio. Inténtalo de nuevo en unos segundos.</p>
        <button type="button" className={SECONDARY_BUTTON} onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <LabWorkspace
      editorSurface={editorSurface}
      exercise={state.data.exercise}
      requestHint={requestHint}
      runCode={runCode}
      submitSolution={submitSolution}
      unitCode={unitCode}
      unitTitle={state.data.unitTitle}
    />
  );
}

