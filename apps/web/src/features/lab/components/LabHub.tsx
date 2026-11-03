"use client";

import type { ExerciseType, StageDetail, UnitProgressSummary, UnitState } from "@codeai/shared";
import Link from "next/link";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import { contentApi, progressApi } from "@/lib/api-client";

const STATE_LABELS: Readonly<Record<UnitState, string>> = {
  LOCKED: "Bloqueada",
  AVAILABLE: "Disponible",
  IN_PROGRESS: "En curso",
  NEEDS_REVIEW: "Repasar",
  MASTERED: "Dominada",
};

const STATE_CLASSES: Readonly<Record<UnitState, string>> = {
  LOCKED: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  AVAILABLE: "border-sky-400/40 bg-sky-500/10 text-sky-200",
  IN_PROGRESS: "border-accent/40 bg-accent/10 text-accent",
  NEEDS_REVIEW: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  MASTERED: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
};

const LINK_CLASSES =
  "inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Ejercicio de práctica del laboratorio (lo justo para listarlo y abrirlo). */
export interface PracticeExercise {
  readonly slug: string;
  readonly title: string;
  readonly type: ExerciseType;
  readonly difficulty: number;
}

export interface LabHubData {
  readonly currentStage: number;
  readonly stage: StageDetail;
  readonly units: readonly UnitProgressSummary[];
  /** Práctica por código de unidad; una unidad sin entrada no tiene (o no se pudo cargar). */
  readonly practice?: Readonly<Record<string, readonly PracticeExercise[]>>;
}

/**
 * Lo que se resuelve en Aprender (quizzes, tarjetas, reflexiones y lecturas) no
 * es laboratorio: aquí sólo va la práctica de manos a la obra.
 */
const LEARN_ONLY_TYPES: readonly ExerciseType[] = ["QUIZ", "FLASHCARD", "REFLECT", "READING"];

const TYPE_LABELS: Readonly<Partial<Record<ExerciseType, string>>> = {
  LAB: "Código",
  DEBUG: "Depuración",
  MEMORY: "Memoria",
  AUDIT: "Auditoría",
  CHALLENGE: "Reto",
  SIM: "Simulación",
  PROJECT: "Proyecto",
};

export type LoadLabHub = (signal: AbortSignal) => Promise<LabHubData>;

/** Etapa en curso, su contenido y el estado de cada unidad, en una sola carga. */
const defaultLoadLabHub: LoadLabHub = async (signal) => {
  const overview = await progressApi.getOverview(signal);
  const [stage, units] = await Promise.all([
    contentApi.getStage(overview.currentStage, signal),
    progressApi.listUnits(signal),
  ]);
  const stateByCode = new Map(units.map((unit) => [unit.unitCode, unit.state]));
  const open = stage.modules
    .flatMap((module) => module.units)
    .filter((unit) => (stateByCode.get(unit.code) ?? "LOCKED") !== "LOCKED");

  // La práctica es un añadido: si una unidad no carga, su tarjeta cae al estado «sin práctica».
  const details = await Promise.allSettled(open.map((unit) => contentApi.getUnit(unit.code, signal)));
  const practice: Record<string, readonly PracticeExercise[]> = {};

  details.forEach((result, index) => {
    const code = open[index]?.code;

    if (code === undefined || result.status !== "fulfilled") return;

    practice[code] = result.value.exercises
      .filter((exercise) => !LEARN_ONLY_TYPES.includes(exercise.type))
      .map((exercise) => ({
        slug: exercise.slug,
        title: exercise.title,
        type: exercise.type,
        difficulty: exercise.difficulty,
      }));
  });

  return { currentStage: overview.currentStage, stage, units, practice };
};

interface LabHubProps {
  /** Inyectable en pruebas. */
  readonly loadHub?: LoadLabHub;
}

/**
 * Entrada al laboratorio: las unidades de la etapa en curso con su práctica de
 * manos a la obra (código, depuración, memoria…). Los quizzes, tarjetas y
 * reflexiones se hacen en Aprender, dentro de cada unidad. Una unidad bloqueada
 * no abre su laboratorio hasta dominar los prerrequisitos (la API lo exige, no
 * sólo esta pantalla).
 */
export function LabHub({ loadHub = defaultLoadLabHub }: LabHubProps) {
  const { state, reload } = useContentLoader(loadHub);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        Cargando tu laboratorio…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
      >
        <p>No pudimos cargar tu laboratorio. Comprueba tu conexión e inténtalo de nuevo.</p>
        <button type="button" onClick={reload} className={BUTTON_CLASSES}>
          Reintentar
        </button>
      </div>
    );
  }

  const { currentStage, stage, units, practice = {} } = state.data;
  const byCode = new Map(units.map((unit) => [unit.unitCode, unit]));
  const modules = stage.modules.filter((module) => module.units.length > 0);
  const practiceLoaded = Object.keys(practice).length > 0;
  const stageHasPractice = Object.values(practice).some((list) => list.length > 0);

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-400">
        Etapa en curso: <span className="font-medium text-white">E{currentStage} · {stage.title}</span>
      </p>

      {practiceLoaded && !stageHasPractice ? (
        <p
          role="note"
          className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-4 text-sm leading-relaxed text-sky-100"
        >
          Esta etapa todavía no tiene ejercicios de código ni juegos. Mientras tanto, sus quizzes,
          tarjetas y reflexiones están en Aprender, dentro de cada unidad.{" "}
          <Link href="/learn/stages" className="font-medium underline underline-offset-4">
            Ver el catálogo
          </Link>
        </p>
      ) : null}

      {modules.length === 0 ? (
        <p className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6 text-sm text-slate-300">
          Esta etapa todavía no tiene unidades publicadas.
        </p>
      ) : (
        modules.map((module) => (
          <section key={module.id} aria-label={module.title} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{module.title}</h2>
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
              {module.units.map((unit) => {
                const progress = byCode.get(unit.code);
                const unitState: UnitState = progress?.state ?? "LOCKED";
                const locked = unitState === "LOCKED";

                return (
                  <li
                    key={unit.id}
                    className={`flex flex-col rounded-2xl border border-line/70 bg-ink-card/50 p-5 ${locked ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        {unit.code}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STATE_CLASSES[unitState]}`}
                      >
                        {locked ? "🔒 " : ""}
                        {STATE_LABELS[unitState]}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-white">{unit.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                      {unit.objective}
                    </p>
                    <div className="mt-4 space-y-3">
                      {locked ? (
                        <p className="text-xs text-amber-200/80">
                          Domina los prerrequisitos de la unidad para abrir su laboratorio.
                        </p>
                      ) : (practice[unit.code]?.length ?? 0) > 0 ? (
                        <ul aria-label={`Práctica de ${unit.title}`} className="grid list-none gap-2 p-0">
                          {(practice[unit.code] ?? []).map((exercise) => (
                            <li key={exercise.slug}>
                              <Link
                                href={`/learn/units/${unit.code}/exercises/${exercise.slug}`}
                                className={LINK_CLASSES}
                              >
                                <span className="mr-2 text-xs uppercase tracking-[0.14em] opacity-80">
                                  {TYPE_LABELS[exercise.type] ?? exercise.type}
                                </span>
                                {exercise.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs leading-relaxed text-slate-500">
                          Esta unidad todavía no tiene práctica de código ni juegos.
                        </p>
                      )}
                      {locked ? null : (
                        <Link
                          href={`/learn/units/${unit.code}#ejercicios`}
                          className="inline-block text-xs font-medium text-slate-400 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          Ver quizzes y tarjetas en Aprender
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
