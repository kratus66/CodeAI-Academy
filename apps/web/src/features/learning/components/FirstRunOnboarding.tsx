"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import {
  isOnboardingGoal,
  isOnboardingLevel,
  isOnboardingPace,
  saveOnboardingChoice,
  type OnboardingAnswers,
  type OnboardingGoal,
  type OnboardingLevel,
  type OnboardingPace,
} from "@/features/learning/lib/onboarding-preference";

interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly detail: string;
}

const GOAL_OPTIONS: readonly Option<OnboardingGoal>[] = [
  {
    value: "career-change",
    label: "Cambiar de carrera",
    detail: "Quiero pasar al desarrollo desde otro sector.",
  },
  {
    value: "upskill",
    label: "Crecer donde ya trabajo",
    detail: "Programo algo y quiero hacerlo con criterio.",
  },
  {
    value: "self-taught",
    label: "Aprender por mi cuenta",
    detail: "Estudio sin prisa, a mi ritmo.",
  },
];

const LEVEL_OPTIONS: readonly Option<OnboardingLevel>[] = [
  {
    value: "beginner",
    label: "Empiezo de cero",
    detail: "Nunca he escrito código en serio.",
  },
  {
    value: "some-experience",
    label: "Ya hago mis pinitos",
    detail: "Sé lo básico y me lío cuando el proyecto crece.",
  },
  {
    value: "experienced",
    label: "Tengo experiencia",
    detail: "Trabajo con código y quiero afinar el criterio con IA.",
  },
];

const PACE_OPTIONS: readonly Option<OnboardingPace>[] = [
  {
    value: "light",
    label: "Un par de horas a la semana",
    detail: "Avanzo sin prisa, sin perder el hilo.",
  },
  {
    value: "steady",
    label: "Unas cinco horas",
    detail: "Un rato casi cada día.",
  },
  {
    value: "intense",
    label: "Diez horas o más",
    detail: "Quiero entrar a fondo cuanto antes.",
  },
];

type StepKey = keyof OnboardingAnswers;

interface Step {
  readonly key: StepKey;
  readonly question: string;
  readonly hint: string;
  readonly options: readonly Option<string>[];
}

/** Tres preguntas, una por pantalla: objetivo, punto de partida y ritmo. */
export const ONBOARDING_STEPS: readonly [Step, Step, Step] = [
  {
    key: "goal",
    question: "¿Qué te trae a CodeAI Academy?",
    hint: "Con esto ordenamos las etapas que te proponemos primero.",
    options: GOAL_OPTIONS,
  },
  {
    key: "level",
    question: "¿De dónde partes?",
    hint: "Marca el punto de entrada; puedes adelantar etapas cuando quieras.",
    options: LEVEL_OPTIONS,
  },
  {
    key: "pace",
    question: "¿Cuánto tiempo le vas a dedicar?",
    hint: "Nos sirve para calibrar el ritmo de repaso, no para exigirte.",
    options: PACE_OPTIONS,
  },
];

const EMPTY_ANSWERS: Record<StepKey, string> = { goal: "", level: "", pace: "" };

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-5 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BUTTON_CLASSES =
  "inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SKIP_BUTTON_CLASSES =
  "inline-flex items-center text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/**
 * Tarjeta de primer uso. Aparece solo mientras el panel no tenga progreso y no
 * haya una elección guardada (`useOnboardingChoice`); al responder o saltar se
 * guarda en `localStorage` y el panel deja de mostrarla. No es un diálogo modal:
 * el resto del área sigue visible y usable.
 */
export function FirstRunOnboarding() {
  const id = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<StepKey, string>>(EMPTY_ANSWERS);
  /** El foco solo viaja al grupo al cambiar de paso, nunca al montar. */
  const moved = useRef(false);

  const step = ONBOARDING_STEPS[stepIndex] ?? ONBOARDING_STEPS[0];
  const answered = answers[step.key] !== "";
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  const choose = (key: StepKey, value: string) => {
    setAnswers((previous) => ({ ...previous, [key]: value }));
  };

  const goTo = (index: number) => {
    moved.current = true;
    setStepIndex(index);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!answered) return;
    if (!isLast) {
      goTo(stepIndex + 1);
      return;
    }

    const { goal, level, pace } = answers;

    if (
      isOnboardingGoal(goal) &&
      isOnboardingLevel(level) &&
      isOnboardingPace(pace)
    ) {
      saveOnboardingChoice({ status: "completed", answers: { goal, level, pace } });
    }
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      data-first-run-onboarding
      className="glass rounded-2xl p-5 sm:p-6"
    >
      <p
        aria-live="polite"
        className="text-xs uppercase tracking-[0.18em] text-slate-500"
      >
        Paso {stepIndex + 1} de {ONBOARDING_STEPS.length}
      </p>
      <h2 id={`${id}-title`} className="mt-2 text-lg font-semibold text-white">
        Empecemos por conocerte
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Tres preguntas para ajustar tu ruta. Puedes saltarlo: no bloquea nada y
        se cambia cuando quieras.
      </p>

      <form onSubmit={handleSubmit} className="mt-4">
        <fieldset
          key={step.key}
          ref={(node) => {
            if (node !== null && moved.current) node.focus();
          }}
          tabIndex={-1}
          aria-describedby={`${id}-hint`}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          <legend className="text-sm font-medium text-slate-200">
            {step.question}
          </legend>
          <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
            {step.hint}
          </p>
          <div className="mt-3 space-y-2">
            {step.options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/25 has-[:checked]:border-accent/50 has-[:checked]:bg-accent/5"
              >
                <input
                  type="radio"
                  name={`${id}-${step.key}`}
                  value={option.value}
                  checked={answers[step.key] === option.value}
                  onChange={() => choose(step.key, option.value)}
                  className="mt-0.5 size-4 shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-200">
                    {option.label}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {option.detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => goTo(stepIndex - 1)}
              className={SECONDARY_BUTTON_CLASSES}
            >
              Anterior
            </button>
          ) : null}
          <button type="submit" disabled={!answered} className={PRIMARY_BUTTON_CLASSES}>
            {isLast ? "Empezar la ruta" : "Siguiente"}
          </button>
          <button
            type="button"
            onClick={() => saveOnboardingChoice({ status: "skipped" })}
            className={SKIP_BUTTON_CLASSES}
          >
            Saltar por ahora
          </button>
        </div>
      </form>
    </section>
  );
}
