"use client";

import type {
  ReviewQueueResponse,
  StageSummary,
  StudentSummary,
  UnitProgressSummary,
} from "@codeai/shared";
import { DEFAULT_ANALYTICS_RANGE } from "@codeai/shared";
import Link from "next/link";

import { percentLabel } from "@/features/analytics/components/format";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import {
  analyticsApi,
  contentApi,
  progressApi,
  reviewApi,
} from "@/lib/api-client";

const CARD_CLASSES = "glass rounded-2xl p-5";

const PRIMARY_LINK_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SECONDARY_LINK_CLASSES =
  "inline-flex items-center text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Todo lo que pinta el panel, pedido en paralelo al abrir la vista. */
export interface StudentDashboardData {
  readonly summary: StudentSummary;
  readonly units: readonly UnitProgressSummary[];
  readonly review: ReviewQueueResponse;
  readonly stages: readonly StageSummary[];
}

export type LoadStudentDashboard = (
  signal: AbortSignal,
) => Promise<StudentDashboardData>;

/**
 * Referencia de módulo: el loader del hook debe ser estable entre renders. El
 * catálogo de etapas solo aporta el destino cuando el alumno aún no ha empezado;
 * el resto de números llegan resueltos de la API.
 */
const defaultLoadDashboard: LoadStudentDashboard = async (signal) => {
  const [summary, units, review, stagePage] = await Promise.all([
    analyticsApi.getSummary(DEFAULT_ANALYTICS_RANGE, signal),
    progressApi.listUnits(signal),
    reviewApi.getQueue(signal),
    contentApi.listStages(signal),
  ]);

  return { summary, units, review, stages: stagePage.stages };
};

interface StudentDashboardProps {
  /** Inyectable en pruebas; por defecto consulta analítica, progreso y repaso. */
  readonly loadDashboard?: LoadStudentDashboard;
}

function lastActivityValue(unit: UnitProgressSummary): number {
  return unit.lastActivityAt === null
    ? Number.NEGATIVE_INFINITY
    : Date.parse(unit.lastActivityAt);
}

/** La unidad en curso (o para repasar) con actividad más reciente. */
function latestUnitInCourse(
  units: readonly UnitProgressSummary[],
): UnitProgressSummary | null {
  const candidates = units.filter(
    (unit) => unit.state === "IN_PROGRESS" || unit.state === "NEEDS_REVIEW",
  );

  let latest: UnitProgressSummary | null = null;

  for (const unit of candidates) {
    if (latest === null || lastActivityValue(unit) > lastActivityValue(latest)) {
      latest = unit;
    }
  }

  return latest;
}

/**
 * Un alumno recién registrado recibe todas las unidades en `AVAILABLE`: el
 * progreso solo existe cuando alguna salió de ese estado o hay actividad.
 */
function hasRecordedProgress(
  summary: StudentSummary,
  units: readonly UnitProgressSummary[],
): boolean {
  return (
    summary.activeDays > 0 ||
    summary.submissions.total > 0 ||
    summary.reviews.completed > 0 ||
    units.some((unit) => unit.state !== "AVAILABLE" && unit.state !== "LOCKED") ||
    units.some((unit) => unit.progressPct > 0)
  );
}

function firstStage(stages: readonly StageSummary[]): StageSummary | null {
  let first: StageSummary | null = null;

  for (const stage of stages) {
    if (first === null || stage.order < first.order) {
      first = stage;
    }
  }

  return first;
}

interface NextStep {
  readonly href: string;
  readonly hint: string;
}

/** Única acción primaria del panel: retomar, elegir etapa o empezar la ruta. */
function resolveNextStep(
  units: readonly UnitProgressSummary[],
  stages: readonly StageSummary[],
  progressMade: boolean,
): NextStep {
  const latest = latestUnitInCourse(units);

  if (latest !== null) {
    return {
      href: `/learn/units/${latest.unitCode}`,
      hint: `Unidad ${latest.unitCode} · ${percentLabel(latest.progressPct)} completada.`,
    };
  }

  if (progressMade) {
    return {
      href: "/learn/stages",
      hint: "No tienes unidades en curso: elige la siguiente etapa del catálogo.",
    };
  }

  const stage = firstStage(stages);

  if (stage !== null) {
    return {
      href: `/learn/stages/${stage.id}`,
      hint: `Empieza por la etapa ${stage.order}: ${stage.title}.`,
    };
  }

  return {
    href: "/learn/stages",
    hint: "El currículo se publica por etapas: vuelve pronto para empezar.",
  };
}

function reviewCountLabel(count: number): string {
  return count === 1 ? "1 ejercicio vencido" : `${count} ejercicios vencidos`;
}

/**
 * Panel de inicio del área privada. No calcula estado: reúne el resumen de
 * analítica, el progreso por unidad y la cola de repaso para responder a tres
 * preguntas —dónde sigo, qué debo repasar y cómo voy— sin abrir otra pantalla.
 */
export function StudentDashboard({
  loadDashboard = defaultLoadDashboard,
}: StudentDashboardProps) {
  const { state, reload } = useContentLoader(loadDashboard);

  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <p className="sr-only">Cargando tu panel…</p>
        <div
          aria-hidden="true"
          className="glass h-40 animate-pulse rounded-2xl"
        />
        <div aria-hidden="true" className="grid gap-4 lg:grid-cols-2">
          <div className="glass h-32 animate-pulse rounded-2xl" />
          <div className="glass h-32 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>
          No pudimos cargar tu panel. Comprueba tu conexión y vuelve a intentarlo.
        </p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const { summary, units, review, stages } = state.data;
  const progressMade = hasRecordedProgress(summary, units);
  const nextStep = resolveNextStep(units, stages, progressMade);
  const dueReviews = review.dueReviews;

  return (
    <div className="space-y-6">
      <section aria-labelledby="siguiente-paso" className={CARD_CLASSES}>
        <h2 id="siguiente-paso" className="text-sm font-medium text-slate-300">
          Tu siguiente paso
        </h2>
        <p
          id="siguiente-paso-detalle"
          className="mt-2 text-base leading-relaxed text-slate-400"
        >
          {nextStep.hint}
        </p>
        <Link
          href={nextStep.href}
          aria-describedby="siguiente-paso-detalle"
          className={PRIMARY_LINK_CLASSES}
        >
          Continuar
        </Link>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="repaso-pendiente" className={CARD_CLASSES}>
          <h2
            id="repaso-pendiente"
            className="text-sm font-medium text-slate-300"
          >
            Repaso pendiente
          </h2>
          {dueReviews === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              No tienes repasos vencidos. Vuelve mañana para sostener lo
              aprendido.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-300">
              <span className="text-2xl font-semibold text-white">
                {reviewCountLabel(dueReviews)}
              </span>{" "}
              para hoy. La cola llega intercalada por concepto.
            </p>
          )}
          <Link href="/learn/review" className={`${SECONDARY_LINK_CLASSES} mt-4`}>
            {dueReviews === 0 ? "Ir al repaso" : "Repasar ahora"}
            <span aria-hidden="true"> →</span>
          </Link>
        </section>

        <section aria-labelledby="foto-progreso" className={CARD_CLASSES}>
          <h2 id="foto-progreso" className="text-sm font-medium text-slate-300">
            Tu progreso
          </h2>
          {progressMade ? (
            <>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {percentLabel(summary.overallPct)}
              </p>
              <p className="text-xs text-slate-500">
                del avance de {summary.units.total} unidades publicadas
              </p>
              <div
                role="progressbar"
                aria-label="Avance global"
                aria-valuenow={summary.overallPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-piece-i via-accent to-piece-t"
                  style={{ width: `${summary.overallPct}%` }}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    Dominadas
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-white">
                    {summary.units.mastered}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    En curso
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-white">
                    {summary.units.inProgress}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="mt-2">
              <p className="text-sm font-medium text-slate-200">
                Todavía no hay progreso registrado.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Cuando veas una lección o resuelvas un ejercicio, aquí verás tu
                porcentaje y las unidades dominadas.
              </p>
            </div>
          )}
        </section>
      </div>

      <nav
        aria-label="Accesos del área de aprendizaje"
        className="flex flex-wrap gap-x-6 gap-y-2"
      >
        <Link href="/learn/stages" className={SECONDARY_LINK_CLASSES}>
          Catálogo de etapas
          <span aria-hidden="true"> →</span>
        </Link>
        <Link href="/learn/progress" className={SECONDARY_LINK_CLASSES}>
          Tu avance completo
          <span aria-hidden="true"> →</span>
        </Link>
      </nav>
    </div>
  );
}
