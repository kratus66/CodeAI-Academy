"use client";

import type {
  CreateProjectSubmissionInput,
  ProjectDetail,
  ProjectSubmission,
} from "@codeai/shared";
import { PROJECT_CRITERION_LABELS } from "@codeai/shared";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { FormEvent } from "react";

import { LockNotice, isLocked } from "@/components/ui/LockNotice";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { ApiError, projectsApi } from "@/lib/api-client";

const CARD_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-5";

const LABEL_CLASSES = "text-sm font-medium text-slate-200";

const INPUT_CLASSES =
  "mt-2 w-full rounded-xl border border-line/70 bg-ink px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const SMALL_BUTTON_CLASSES =
  "mt-3 inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

type LoadProject = (slug: string, signal: AbortSignal) => Promise<ProjectDetail>;
type SubmitProject = (
  slug: string,
  input: CreateProjectSubmissionInput,
) => Promise<ProjectSubmission>;
type SetPublished = (
  submissionId: string,
  isPublic: boolean,
) => Promise<ProjectSubmission>;

interface ProjectWorkspaceProps {
  readonly slug: string;
  /** Inyectables en pruebas; por defecto llaman a `/api/projects`. */
  readonly loadProject?: LoadProject;
  readonly submitProject?: SubmitProject;
  readonly setPublished?: SetPublished;
}

const defaultLoadProject: LoadProject = (slug, signal) =>
  projectsApi.getDetail(slug, signal);

const defaultSubmitProject: SubmitProject = (slug, input) =>
  projectsApi.submit(slug, input);

const defaultSetPublished: SetPublished = (submissionId, isPublic) =>
  isPublic ? projectsApi.publish(submissionId) : projectsApi.unpublish(submissionId);

function formatScore(score: number | null): string {
  return score === null ? "Sin revisar" : `${score.toFixed(2)} / 100`;
}

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function statusLabel(submission: ProjectSubmission): string {
  return submission.status === "REVIEWED" ? "Revisada" : "Pendiente de revisión";
}

/**
 * Espacio de trabajo de un proyecto (`contratos-api.md` §4.11): rúbrica legible,
 * formulario de entrega e historial con nota, retroalimentación y la publicación
 * explícita en el portafolio. No calcula notas: sólo muestra lo que sirve la API.
 */
export function ProjectWorkspace({
  slug,
  loadProject = defaultLoadProject,
  submitProject = defaultSubmitProject,
  setPublished = defaultSetPublished,
}: ProjectWorkspaceProps) {
  const load = useCallback(
    (signal: AbortSignal) => loadProject(slug, signal),
    [loadProject, slug],
  );
  const { state, reload } = useContentLoader(load);

  const [updated, setUpdated] = useState<ProjectDetail | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [deployUrl, setDeployUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const applySubmission = useCallback(
    (submission: ProjectSubmission) => {
      setUpdated((current) => {
        const base = current ?? (state.status === "ready" ? state.data : null);

        if (!base) {
          return current;
        }

        const exists = base.mySubmissions.some(
          (entry) => entry.id === submission.id,
        );
        const mySubmissions = exists
          ? base.mySubmissions.map((entry) =>
              entry.id === submission.id ? submission : entry,
            )
          : [submission, ...base.mySubmissions];
        const scores = mySubmissions
          .map((entry) => entry.score)
          .filter((score): score is number => score !== null);

        return {
          ...base,
          submitted: true,
          bestScore: scores.length > 0 ? Math.max(...scores) : null,
          mySubmissions,
        };
      });
    },
    [state],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setErrors({});
      setNotice(null);
      setFailure(null);

      try {
        const submission = await submitProject(slug, {
          repoUrl: repoUrl.trim(),
          ...(deployUrl.trim() ? { deployUrl: deployUrl.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });

        applySubmission(submission);
        setRepoUrl("");
        setDeployUrl("");
        setNotes("");
        setNotice("Entrega registrada. Un instructor la revisará con la rúbrica.");
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          setErrors(error.fieldErrors());

          if (error.details.length === 0) {
            setFailure(error.message);
          }
        } else {
          setFailure("No pudimos registrar la entrega. Inténtalo de nuevo.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [applySubmission, deployUrl, notes, repoUrl, slug, submitProject],
  );

  const togglePublication = useCallback(
    async (submission: ProjectSubmission) => {
      setPendingId(submission.id);
      setFailure(null);

      try {
        applySubmission(await setPublished(submission.id, !submission.isPublic));
      } catch (error: unknown) {
        setFailure(
          error instanceof ApiError
            ? error.message
            : "No pudimos cambiar la publicación de la entrega.",
        );
      } finally {
        setPendingId(null);
      }
    },
    [applySubmission, setPublished],
  );

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando el proyecto…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>
          No pudimos cargar el proyecto. Comprueba tu conexión y vuelve a
          intentarlo.
        </p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const project = updated ?? state.data;

  return (
    <article className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Etapa E{project.stageId}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {project.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          {project.brief}
        </p>
        <p className="mt-4 text-sm text-slate-400">
          Mejor nota:{" "}
          <span className="font-medium text-slate-200">
            {formatScore(project.bestScore)}
          </span>
        </p>
      </header>

      <section aria-labelledby="requisitos" className="space-y-3">
        <h2 id="requisitos" className="text-lg font-semibold text-white">
          Qué tienes que entregar
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          {project.requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rubrica" className="space-y-4">
        <h2 id="rubrica" className="text-lg font-semibold text-white">
          Rúbrica de evaluación
        </h2>
        <p className="max-w-3xl text-sm text-slate-400">
          La nota se calcula con estos pesos. Correctitud 0 invalida la entrega y,
          sin explicación propia, la justificación resta el 15 % completo.
        </p>
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
          {project.rubric.criteria.map((criterion) => (
            <li key={criterion.criterion} className={CARD_CLASSES}>
              <h3 className="text-sm font-semibold text-white">
                {PROJECT_CRITERION_LABELS[criterion.criterion]}
              </h3>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-accent">
                Peso {criterion.weight} %
              </p>
              <ol className="mt-3 space-y-1 text-xs text-slate-400">
                {criterion.levels.map((level) => (
                  <li key={level.level}>
                    <span className="font-medium text-slate-300">
                      Nivel {level.level}:
                    </span>{" "}
                    {level.anchor}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          Competencias: {project.competencies.join(", ")}
        </p>
      </section>

      <section aria-labelledby="entrega" className="space-y-3">
        <h2 id="entrega" className="text-lg font-semibold text-white">
          Entregar el proyecto
        </h2>
        {project.unlock && isLocked(project.unlock) ? (
          <LockNotice unlock={project.unlock} subject="La entrega de este proyecto" />
        ) : (
        <form onSubmit={handleSubmit} className={CARD_CLASSES} noValidate>
          <label className="block">
            <span className={LABEL_CLASSES}>Repositorio (obligatorio)</span>
            <input
              type="url"
              name="repoUrl"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              className={INPUT_CLASSES}
              placeholder="https://github.com/tu-usuario/proyecto"
              aria-invalid={Boolean(errors.repoUrl)}
            />
            {errors.repoUrl ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.repoUrl}
              </span>
            ) : null}
          </label>

          <label className="mt-4 block">
            <span className={LABEL_CLASSES}>Despliegue (opcional)</span>
            <input
              type="url"
              name="deployUrl"
              value={deployUrl}
              onChange={(event) => setDeployUrl(event.target.value)}
              className={INPUT_CLASSES}
              placeholder="https://tu-proyecto.vercel.app"
              aria-invalid={Boolean(errors.deployUrl)}
            />
            {errors.deployUrl ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.deployUrl}
              </span>
            ) : null}
          </label>

          <label className="mt-4 block">
            <span className={LABEL_CLASSES}>Explicación propia (opcional)</span>
            <textarea
              name="notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={INPUT_CLASSES}
              placeholder="Qué decidiste, por qué y qué alternativas descartaste."
              aria-invalid={Boolean(errors.notes)}
            />
            {errors.notes ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.notes}
              </span>
            ) : null}
            <span className="mt-1 block text-xs text-slate-500">
              Sin explicación, la justificación vale 0 y la nota pierde el 15 %.
            </span>
          </label>

          <button type="submit" disabled={submitting} className={BUTTON_CLASSES}>
            {submitting ? "Enviando…" : "Registrar entrega"}
          </button>

          {notice ? (
            <p role="status" className="mt-3 text-sm text-emerald-200">
              {notice}
            </p>
          ) : null}
          {failure ? (
            <p role="alert" className="mt-3 text-sm text-rose-200">
              {failure}
            </p>
          ) : null}
        </form>
        )}
      </section>

      <section aria-labelledby="entregas" className="space-y-3">
        <h2 id="entregas" className="text-lg font-semibold text-white">
          Mis entregas
        </h2>
        {project.mySubmissions.length === 0 ? (
          <p className="text-sm text-slate-400">
            Aún no has entregado este proyecto.
          </p>
        ) : (
          <ol className="space-y-4">
            {project.mySubmissions.map((submission) => {
              const reviewedOn = formatDate(submission.reviewedAt);

              return (
                <li key={submission.id} className={CARD_CLASSES}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-slate-200">
                      {statusLabel(submission)}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
                      {formatScore(submission.score)}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-slate-400">
                      {submission.isPublic
                        ? "Pública en tu portafolio"
                        : "Privada"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm">
                    <a
                      href={submission.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      Repositorio
                    </a>
                    {submission.deployUrl ? (
                      <a
                        href={submission.deployUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-4 text-accent underline-offset-4 hover:underline"
                      >
                        Despliegue
                      </a>
                    ) : null}
                  </p>

                  <p className="mt-3 text-sm text-slate-400">
                    {submission.notes
                      ? `Tu explicación: ${submission.notes}`
                      : "Sin explicación propia: la justificación vale 0."}
                  </p>

                  {submission.feedback ? (
                    <p className="mt-2 text-sm text-slate-300">
                      Retroalimentación: {submission.feedback}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-slate-500">
                    Entregada el {formatDate(submission.createdAt)}
                    {reviewedOn ? ` · Revisada el ${reviewedOn}` : ""}
                  </p>

                  <button
                    type="button"
                    onClick={() => void togglePublication(submission)}
                    disabled={pendingId === submission.id}
                    className={SMALL_BUTTON_CLASSES}
                  >
                    {submission.isPublic
                      ? "Retirar del portafolio"
                      : "Publicar en el portafolio"}
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-sm text-slate-400">
          Tu portafolio público vive en{" "}
          <Link
            href="/learn/portfolio"
            className="text-accent underline-offset-4 hover:underline"
          >
            Mi portafolio
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

