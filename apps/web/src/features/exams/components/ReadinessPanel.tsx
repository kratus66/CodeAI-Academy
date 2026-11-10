"use client";

import type {
  CertificationCode,
  ExamReadiness,
  ReadinessCriterion,
  ReadinessCriterionId,
  ReadinessStatus,
  RealExamResult,
  RegisterRealResultInput,
} from "@codeai/shared";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import type { ContentState } from "@/features/learning/lib/use-content-loader";
import { examsApi } from "@/lib/api-client";

/**
 * Panel de preparación (S15, T11b): el criterio «listo para presentar»
 * desglosado en sus cuatro piezas y el registro del resultado real.
 *
 * Un criterio nunca se comunica con un sí o un no (`metodo-aws.md` §9): cada uno
 * lleva su estado en texto, su resumen y lo que falta. El resultado real del
 * examen oficial es voluntario y privado: la plataforma no lo calcula ni lo
 * verifica, solo lo guarda para el propio estudiante.
 */

const CARD_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-200";

const ALERT_CLASSES =
  "rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200";

const BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50";

const GHOST_BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const RADIO_CLASSES =
  "flex cursor-pointer items-center gap-2 rounded-full border border-line/70 bg-ink-card/40 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30";

const INPUT_CLASSES =
  "w-full rounded-xl border border-line/70 bg-ink px-3 py-2 text-sm text-slate-100";

const LABEL_CLASSES = "text-xs font-medium uppercase tracking-[0.15em] text-slate-500";

const PANEL_LABEL = "Preparación y resultado real";

const READY_TITLE = "Listo para presentar";

const NOT_READY_TITLE = "Todavía no";

const LOADING_MESSAGE = "Cargando tu preparación…";

const LOAD_ERROR_MESSAGE = "No pudimos cargar tu preparación.";

/** Distinto del «Reintentar» del historial: dos botones iguales confunden. */
const RETRY_LABEL = "Reintentar la preparación";

const FORM_TITLE = "Registra tu resultado real";

const FORM_HINT = "Opcional y privado: solo lo ves tú.";

const PASSED_LABEL = "¿Aprobaste?";

const YES_LABEL = "Sí";

const NO_LABEL = "No";

const SCORE_LABEL = "Puntuación (100–1000, opcional)";

const DATE_LABEL = "Fecha del examen";

const SUBMIT_LABEL = "Registrar resultado";

const SAVING_LABEL = "Registrando…";

const PASSED_MISSING_MESSAGE = "Indica si aprobaste.";

const DATE_MISSING_MESSAGE = "Indica la fecha del examen.";

const FORM_ERROR_MESSAGE = "No pudimos registrar tu resultado.";

const LAST_RESULT_TITLE = "Último resultado registrado";

const RESULT_PASSED_LABEL = "Aprobado";

const RESULT_FAILED_LABEL = "No aprobado";

/** Nombre de cada criterio en la interfaz. */
const CRITERIA_LABELS: Readonly<Record<ReadinessCriterionId, string>> = {
  mastery: "Dominio",
  "mock-exams": "Simulacros",
  review: "Repaso",
  evidence: "Evidencia",
};

const STATUS_LABELS: Readonly<Record<ReadinessStatus, string>> = {
  met: "Cumplido",
  missing: "Falta",
  unavailable: "Aún no disponible",
};

const STATUS_STYLES: Readonly<Record<ReadinessStatus, string>> = {
  met: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  missing: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  unavailable: "border-white/15 bg-white/5 text-slate-400",
};

/** Lo mínimo que el panel necesita del cliente: leer y registrar. */
export interface ReadinessPanelApi {
  readonly readiness: (certification: string) => Promise<ExamReadiness>;
  readonly registerRealResult: (
    certification: string,
    body: RegisterRealResultInput,
  ) => Promise<RealExamResult>;
}

export interface ReadinessPanelProps {
  readonly certification: CertificationCode;
  /** Inyectable en pruebas; por defecto llama a `GET /api/exams/:code/readiness`. */
  readonly api?: ReadinessPanelApi;
}

export function ReadinessPanel({ certification, api = examsApi }: ReadinessPanelProps) {
  const load = useMemo(
    () => (): Promise<ExamReadiness> => api.readiness(certification),
    [api, certification],
  );
  const request = useContentLoader(load);

  return (
    <section aria-label={PANEL_LABEL} className="space-y-4">
      <ReadinessBody
        state={request.state}
        onRetry={request.reload}
        certification={certification}
        api={api}
      />
    </section>
  );
}

interface ReadinessBodyProps {
  readonly state: ContentState<ExamReadiness>;
  readonly onRetry: () => void;
  readonly certification: CertificationCode;
  readonly api: ReadinessPanelApi;
}

/**
 * El fallo de carga se anuncia con `role="status"`: el panel es contenido
 * secundario y no debe competir con los errores de la acción principal.
 */
function ReadinessBody({
  state,
  onRetry,
  certification,
  api,
}: ReadinessBodyProps) {
  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        {LOADING_MESSAGE}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div role="status" aria-live="polite" className={`${CARD_CLASSES} space-y-3`}>
        <p>{LOAD_ERROR_MESSAGE}</p>
        <button type="button" onClick={onRetry} className={GHOST_BUTTON_CLASSES}>
          {RETRY_LABEL}
        </button>
      </div>
    );
  }

  const readiness = state.data;

  return (
    <>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          {readiness.ready ? READY_TITLE : NOT_READY_TITLE}
        </h2>
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
          {readiness.criteria.map((criterion) => (
            <CriterionCard key={criterion.id} criterion={criterion} />
          ))}
        </ul>
      </div>

      <RealResultForm
        certification={certification}
        api={api}
        lastResult={readiness.lastRealResult}
      />
    </>
  );
}

/** Un criterio: nombre, estado en texto, resumen y lo que falta. */
function CriterionCard({ criterion }: { readonly criterion: ReadinessCriterion }) {
  return (
    <li className={`${CARD_CLASSES} space-y-2`}>
      <p className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-100">
          {CRITERIA_LABELS[criterion.id]}
        </span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[criterion.status]}`}
        >
          {STATUS_LABELS[criterion.status]}
        </span>
      </p>
      <p className="text-slate-300">{criterion.summary}</p>
      {criterion.missing.length === 0 ? null : (
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
          {criterion.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface RealResultFormProps {
  readonly certification: CertificationCode;
  readonly api: ReadinessPanelApi;
  readonly lastResult: RealExamResult | null;
}

/**
 * Formulario del resultado real. `takenOn` viaja tal cual (`AAAA-MM-DD`): el
 * servidor es quien rechaza una fecha futura con `400`, así que el formulario
 * solo comprueba lo que puede saber sin red.
 */
function RealResultForm({ certification, api, lastResult }: RealResultFormProps) {
  const [passed, setPassed] = useState<boolean | null>(null);
  const [score, setScore] = useState("");
  const [takenOn, setTakenOn] = useState("");
  const [registered, setRegistered] = useState<RealExamResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (saving) {
      return;
    }

    setFormError(null);

    if (passed === null) {
      setFormError(PASSED_MISSING_MESSAGE);
      return;
    }

    if (takenOn === "") {
      setFormError(DATE_MISSING_MESSAGE);
      return;
    }

    const parsedScore = score.trim() === "" ? null : Number(score);

    const body: RegisterRealResultInput =
      parsedScore === null ? { passed, takenOn } : { passed, scaledScore: parsedScore, takenOn };

    setSaving(true);

    try {
      const result = await api.registerRealResult(certification, body);

      setRegistered(result);
    } catch (cause: unknown) {
      setFormError(cause instanceof Error ? cause.message : FORM_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmitEvent(event: FormEvent<HTMLFormElement>): void {
    void handleSubmit(event);
  }

  const shown = registered ?? lastResult;

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmitEvent} className={`${CARD_CLASSES} space-y-4`}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">{FORM_TITLE}</h3>
          <p className="text-xs text-slate-500">{FORM_HINT}</p>
        </div>

        <fieldset className="space-y-2">
          <legend className={LABEL_CLASSES}>{PASSED_LABEL}</legend>
          <div className="flex flex-wrap gap-3">
            <label className={RADIO_CLASSES}>
              <input
                type="radio"
                name="aprobo"
                checked={passed === true}
                onChange={() => setPassed(true)}
              />
              {YES_LABEL}
            </label>
            <label className={RADIO_CLASSES}>
              <input
                type="radio"
                name="aprobo"
                checked={passed === false}
                onChange={() => setPassed(false)}
              />
              {NO_LABEL}
            </label>
          </div>
        </fieldset>

        <div className="space-y-2">
          <label htmlFor="puntuacion-real" className={LABEL_CLASSES}>
            {SCORE_LABEL}
          </label>
          <input
            id="puntuacion-real"
            type="number"
            inputMode="numeric"
            min={100}
            max={1000}
            step={1}
            value={score}
            onChange={(event) => setScore(event.target.value)}
            className={INPUT_CLASSES}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="fecha-examen-real" className={LABEL_CLASSES}>
            {DATE_LABEL}
          </label>
          <input
            id="fecha-examen-real"
            type="date"
            value={takenOn}
            onChange={(event) => setTakenOn(event.target.value)}
            className={INPUT_CLASSES}
          />
        </div>

        {formError === null ? null : (
          <div role="alert" className={ALERT_CLASSES}>
            <p>{formError}</p>
          </div>
        )}

        <button type="submit" disabled={saving} className={BUTTON_CLASSES}>
          {saving ? SAVING_LABEL : SUBMIT_LABEL}
        </button>
      </form>

      {shown === null ? null : <LastResultCard result={shown} />}
    </div>
  );
}

function LastResultCard({ result }: { readonly result: RealExamResult }) {
  return (
    <div className={`${CARD_CLASSES} space-y-1`}>
      <h3 className="text-base font-semibold text-white">{LAST_RESULT_TITLE}</h3>
      <p className="text-slate-300">
        {formatTakenOn(result.takenOn)} ·{" "}
        {result.passed ? RESULT_PASSED_LABEL : RESULT_FAILED_LABEL}
      </p>
      {result.scaledScore === null ? null : (
        <p className="text-slate-400">{`Puntuación ${result.scaledScore}`}</p>
      )}
    </div>
  );
}

/** `AAAA-MM-DD` sin pasar por `Date`: el día registrado no se desplaza de zona. */
function formatTakenOn(value: string): string {
  const [year, month, day] = value.split("-");

  if (year === undefined || month === undefined || day === undefined) {
    return value;
  }

  return `${day}/${month}/${year}`;
}
