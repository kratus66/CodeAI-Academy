"use client";

import type { CertificationCode, ExamCohort } from "@codeai/shared";
import { CERTIFICATION_CODES, CERTIFICATION_REGISTRY } from "@codeai/shared";
import { useMemo, useState } from "react";

import { useContentLoader } from "@/features/learning/lib/use-content-loader";
import type { ContentState } from "@/features/learning/lib/use-content-loader";
import { examsApi } from "@/lib/api-client";

/**
 * Vista del instructor (S15, T12c): cómo van los simulacros de la cohorte.
 *
 * Solo lectura y agregada: la API no devuelve a ninguna persona, y con menos
 * de 5 no entrega dominios para que nadie quede identificable. La tabla de
 * resultados reales sale de datos voluntarios que la plataforma no verifica.
 */

const CARD_CLASSES =
  "rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-4 text-sm text-slate-200";

const GHOST_BUTTON_CLASSES =
  "inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const SELECT_CLASSES =
  "w-full max-w-md rounded-xl border border-line/70 bg-ink px-3 py-2 text-sm text-slate-100";

const LABEL_CLASSES = "text-xs font-medium uppercase tracking-[0.15em] text-slate-500";

const TH_CLASSES = "px-4 py-2 text-left text-xs font-medium text-slate-400";

const TD_CLASSES = "px-4 py-2 text-slate-200";

const ROW_HEADER_CLASSES = `${TD_CLASSES} text-left font-normal`;

const VIEW_LABEL = "Simulacros de la cohorte";

const SELECT_LABEL = "Certificación";

const LOADING_MESSAGE = "Cargando los simulacros de la cohorte…";

const LOAD_ERROR_MESSAGE = "No pudimos cargar los simulacros de la cohorte.";

const RETRY_LABEL = "Reintentar";

const PRIVACY_NOTICE = "Hacen falta al menos 5 personas para mostrar dominios";

const DOMAINS_TITLE = "Dominios, del más débil al más fuerte";

const DOMAINS_CAPTION = "Media de aciertos por dominio";

const DOMAIN_HEADER = "Dominio";

const AVERAGE_HEADER = "Media de aciertos";

const ATTEMPTS_HEADER = "Intentos";

const READINESS_TITLE = "«Listo para presentar» y examen real";

const READINESS_CAPTION = "Listo para presentar frente a aprobó el examen real";

const READINESS_NOTE =
  "Los resultados reales son voluntarios: solo aparecen los de quienes los registraron y la plataforma no los verifica.";

const READY_ROW = "Listo para presentar";

const NOT_READY_ROW = "No estaba listo";

const PASSED_HEADER = "Aprobó";

const FAILED_HEADER = "No aprobó";

const SUMMARY_NOTE = "Solo cuentan los simulacros terminados y no orientativos.";

/** Lo mínimo que la vista necesita del cliente: leer la cohorte. */
export interface ExamCohortViewApi {
  readonly cohort: (certification: string) => Promise<ExamCohort>;
}

export interface ExamCohortViewProps {
  /** Inyectable en pruebas; por defecto llama a `GET /api/exams/:code/cohort`. */
  readonly api?: ExamCohortViewApi;
}

export function ExamCohortView({ api = examsApi }: ExamCohortViewProps) {
  const [certification, setCertification] = useState<CertificationCode>(
    CERTIFICATION_CODES[0],
  );
  const load = useMemo(
    () => (): Promise<ExamCohort> => api.cohort(certification),
    [api, certification],
  );
  const request = useContentLoader(load);

  return (
    <section aria-label={VIEW_LABEL} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="certificacion-cohorte" className={LABEL_CLASSES}>
          {SELECT_LABEL}
        </label>
        <select
          id="certificacion-cohorte"
          value={certification}
          onChange={(event) => {
            const chosen = CERTIFICATION_CODES.find(
              (code) => code === event.target.value,
            );

            if (chosen !== undefined) {
              setCertification(chosen);
            }
          }}
          className={SELECT_CLASSES}
        >
          {CERTIFICATION_CODES.map((code) => (
            <option key={code} value={code}>
              {`${code} · ${CERTIFICATION_REGISTRY[code].name}`}
            </option>
          ))}
        </select>
      </div>

      <CohortBody state={request.state} onRetry={request.reload} />
    </section>
  );
}

interface CohortBodyProps {
  readonly state: ContentState<ExamCohort>;
  readonly onRetry: () => void;
}

function CohortBody({ state, onRetry }: CohortBodyProps) {
  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-sm text-slate-400">
        {LOADING_MESSAGE}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className={`${CARD_CLASSES} space-y-3`}>
        <p>{LOAD_ERROR_MESSAGE}</p>
        <button type="button" onClick={onRetry} className={GHOST_BUTTON_CLASSES}>
          {RETRY_LABEL}
        </button>
      </div>
    );
  }

  const cohort = state.data;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-300">
        {`${cohort.attempts} simulacros de ${cohort.learners} personas. ${SUMMARY_NOTE}`}
      </p>
      <DomainsTable cohort={cohort} />
      <ReadinessTable cohort={cohort} />
    </div>
  );
}

function DomainsTable({ cohort }: { readonly cohort: ExamCohort }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{DOMAINS_TITLE}</h2>
      {cohort.domains.length === 0 ? (
        <p role="status" className={CARD_CLASSES}>
          {PRIVACY_NOTICE}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line/70">
          <table className="w-full text-sm">
            <caption className="sr-only">{DOMAINS_CAPTION}</caption>
            <thead>
              <tr>
                <th scope="col" className={TH_CLASSES}>
                  {DOMAIN_HEADER}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {AVERAGE_HEADER}
                </th>
                <th scope="col" className={TH_CLASSES}>
                  {ATTEMPTS_HEADER}
                </th>
              </tr>
            </thead>
            <tbody>
              {cohort.domains.map((domain) => (
                <tr key={domain.domain} className="border-t border-line/70">
                  <th scope="row" className={ROW_HEADER_CLASSES}>
                    {`${domain.domain}. ${domain.name}`}
                  </th>
                  <td className={TD_CLASSES}>{`${domain.avgPct} %`}</td>
                  <td className={TD_CLASSES}>{domain.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReadinessTable({ cohort }: { readonly cohort: ExamCohort }) {
  const { readyPassed, readyFailed, notReadyPassed, notReadyFailed } =
    cohort.readinessVsReal;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{READINESS_TITLE}</h2>
      <div className="overflow-x-auto rounded-2xl border border-line/70">
        <table className="w-full text-sm">
          <caption className="sr-only">{READINESS_CAPTION}</caption>
          <thead>
            <tr>
              <td className={TH_CLASSES} />
              <th scope="col" className={TH_CLASSES}>
                {PASSED_HEADER}
              </th>
              <th scope="col" className={TH_CLASSES}>
                {FAILED_HEADER}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line/70">
              <th scope="row" className={ROW_HEADER_CLASSES}>
                {READY_ROW}
              </th>
              <td className={TD_CLASSES}>{readyPassed}</td>
              <td className={TD_CLASSES}>{readyFailed}</td>
            </tr>
            <tr className="border-t border-line/70">
              <th scope="row" className={ROW_HEADER_CLASSES}>
                {NOT_READY_ROW}
              </th>
              <td className={TD_CLASSES}>{notReadyPassed}</td>
              <td className={TD_CLASSES}>{notReadyFailed}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{READINESS_NOTE}</p>
    </div>
  );
}
