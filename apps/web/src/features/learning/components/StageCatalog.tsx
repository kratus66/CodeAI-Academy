"use client";

import type { StageSummary, UnitProgressSummary } from "@codeai/shared";
import Link from "next/link";
import { useCallback } from "react";

import { LockNotice } from "@/components/ui/LockNotice";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { contentApi, progressApi } from "@/lib/api-client";
import type { StageCatalogPage } from "@/lib/api-client";

const CARD_CLASSES =
  "group flex h-full flex-col rounded-2xl border border-line/70 bg-ink-card/50 p-6 transition hover:border-accent/50 hover:bg-ink-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const LOCKED_CARD_CLASSES =
  "flex h-full flex-col rounded-2xl border border-line/70 bg-ink-card/30 p-6";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BADGE_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium";

const STATUS_STYLES = {
  mastered: {
    label: "Dominada",
    icon: "✓",
    classes: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  },
  inProgress: {
    label: "En curso",
    icon: "▸",
    classes: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
  },
  locked: {
    label: "Bloqueada",
    icon: "🔒",
    classes: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  },
} as const;

/** Estado agregado de una etapa a partir del avance de sus unidades. */
export type StageStatus = keyof typeof STATUS_STYLES;

export interface StageProgress {
  readonly status: StageStatus;
  /** Media del avance de las unidades publicadas, 0–100. */
  readonly pct: number;
  readonly units: number;
}

type LoadStages = (signal?: AbortSignal) => Promise<StageCatalogPage>;
type LoadProgress = (
  signal?: AbortSignal,
) => Promise<readonly UnitProgressSummary[]>;

interface StageCatalogProps {
  /** Inyectable en pruebas; por defecto llama a `GET /api/content/stages`. */
  readonly loadStages?: LoadStages;
  /** Inyectable en pruebas; por defecto llama a `GET /api/progress/units`. */
  readonly loadProgress?: LoadProgress;
}

function moduleCountLabel(count: number): string {
  return count === 1 ? "1 módulo" : `${count} módulos`;
}

/**
 * El `unitCode` codifica la etapa (`U0.1.1` → 0), la misma regla que ya usa
 * `summarizeStages` en métricas: el contrato de progreso no publica `stageId`
 * por unidad y `stage.id` coincide con esa primera cifra.
 */
function stageIndexOf(unitCode: string): number | null {
  const match = /^U(\d+)(?:\.|$)/.exec(unitCode);

  return match === null ? null : Number(match[1]);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Agrupa el avance por unidad en el estado que se pinta en cada tarjeta: una
 * etapa está dominada cuando todas sus unidades lo están, bloqueada cuando
 * ninguna se puede abrir y en curso en cualquier otro caso.
 */
export function summarizeStageProgress(
  units: readonly UnitProgressSummary[],
): ReadonlyMap<number, StageProgress> {
  const buckets = new Map<number, UnitProgressSummary[]>();

  for (const unit of units) {
    const stage = stageIndexOf(unit.unitCode);

    if (stage === null) continue;

    const bucket = buckets.get(stage);

    if (bucket === undefined) {
      buckets.set(stage, [unit]);
    } else {
      bucket.push(unit);
    }
  }

  const summary = new Map<number, StageProgress>();

  for (const [stage, stageUnits] of buckets) {
    const total = stageUnits.reduce((sum, unit) => sum + unit.progressPct, 0);
    const status: StageStatus = stageUnits.every(
      (unit) => unit.state === "MASTERED",
    )
      ? "mastered"
      : stageUnits.every((unit) => unit.state === "LOCKED")
        ? "locked"
        : "inProgress";

    summary.set(stage, {
      status,
      pct: round1(total / stageUnits.length),
      units: stageUnits.length,
    });
  }

  return summary;
}

/** Etapa previa más cercana: es el prerrequisito que explica el bloqueo. */
function previousStage(
  stage: StageSummary,
  stages: readonly StageSummary[],
): StageSummary | null {
  const earlier = stages
    .filter((candidate) => candidate.order < stage.order)
    .sort((left, right) => right.order - left.order);

  return earlier[0] ?? null;
}

interface StageStatusBadgeProps {
  readonly status: StageStatus;
}

function StageStatusBadge({ status }: StageStatusBadgeProps) {
  const style = STATUS_STYLES[status];

  return (
    <span className={`${BADGE_CLASSES} ${style.classes}`}>
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  );
}


interface StageCardProps {
  readonly stage: StageSummary;
  readonly progress: StageProgress | undefined;
  readonly prerequisite: StageSummary | null;
}

/** Etiqueta de la etapa, compartida por la tarjeta abierta y la bloqueada. */
function StageHeading({ stage }: { readonly stage: StageSummary }) {
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
        Etapa {stage.order} · Nivel {stage.level}
      </p>
      <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">
        {stage.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
        {stage.objective}
      </p>
    </>
  );
}

function StageCard({ stage, progress, prerequisite }: StageCardProps) {
  const ring =
    progress === undefined ? null : (
      <ProgressRing
        value={progress.pct}
        label={`Avance de la etapa ${stage.order}`}
      />
    );

  if (progress?.status === "locked") {
    const reason =
      prerequisite === null
        ? "Avanza en las etapas anteriores de tu ruta para abrirla."
        : `Domina antes la etapa ${prerequisite.order}: ${prerequisite.title}.`;

    return (
      <article className={LOCKED_CARD_CLASSES}>
        <div className="flex items-start justify-between gap-3">
          <StageStatusBadge status="locked" />
          {ring}
        </div>
        <StageHeading stage={stage} />
        <p className="mt-4 text-xs text-slate-500">
          {moduleCountLabel(stage.moduleCount)}
        </p>
        <div className="mt-4">
          <LockNotice unlock={{ unlocked: false, reason }} subject="Esta etapa" />
        </div>
      </article>
    );
  }

  return (
    <Link
      href={`/learn/stages/${stage.id}`}
      aria-label={`Etapa ${stage.order}: ${stage.title}`}
      className={CARD_CLASSES}
    >
      {progress === undefined ? null : (
        <div className="mb-4 flex items-start justify-between gap-3">
          <StageStatusBadge status={progress.status} />
          {ring}
        </div>
      )}
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
        Etapa {stage.order} · Nivel {stage.level}
      </p>
      <h3 className="mt-3 text-lg font-semibold tracking-tight text-white transition group-hover:text-accent">
        {stage.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
        {stage.objective}
      </p>
      <p className="mt-4 text-xs text-slate-500">
        {moduleCountLabel(stage.moduleCount)}
        <span aria-hidden> →</span>
      </p>
    </Link>
  );
}

/** Catálogo de etapas publicadas con su estado de avance y estados de carga. */
export function StageCatalog({
  loadStages = contentApi.listStages,
  loadProgress = progressApi.listUnits,
}: StageCatalogProps) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [catalog, units] = await Promise.all([
        loadStages(signal),
        loadProgress(signal),
      ]);

      return { catalog, units };
    },
    [loadStages, loadProgress],
  );
  const { state, reload } = useContentLoader(load);

  if (state.status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid gap-4 sm:grid-cols-2"
      >
        <span className="sr-only">Cargando el catálogo de etapas…</span>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-44 animate-pulse rounded-2xl border border-line/60 bg-ink-card/30"
          />
        ))}
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
          No pudimos cargar el catálogo. Comprueba tu conexión y vuelve a
          intentarlo.
        </p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const { catalog, units } = state.data;

  if (catalog.stages.length === 0) {
    return (
      <div className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6">
        <p className="text-sm font-medium text-slate-200">
          Todavía no hay etapas publicadas.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          El currículo se publica por etapas: vuelve pronto.
        </p>
      </div>
    );
  }

  const progressByStage = summarizeStageProgress(units);

  return (
    <ol className="grid list-none gap-4 p-0 sm:grid-cols-2">
      {catalog.stages.map((stage) => (
        <li key={stage.id}>
          <StageCard
            stage={stage}
            progress={progressByStage.get(stage.id)}
            prerequisite={previousStage(stage, catalog.stages)}
          />
        </li>
      ))}
    </ol>
  );
}
