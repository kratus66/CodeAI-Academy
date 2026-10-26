import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { ADVANCED_COMPETENCIES, COMPETENCIES } from "../data/content";

export function Competencies() {
  return (
    <section
      id="competencias"
      className="border-b border-line/60 py-20 sm:py-24"
    >
      <Container>
        <SectionHeading
          eyebrow="Competencias"
          title="Diez competencias obligatorias y cuatro de especialización."
          description="No se evalúa asistencia ni horas de video. Cada competencia se observa en entregables y se califica en una escala de cinco niveles de dominio."
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {COMPETENCIES.map((competency) => (
            <li
              key={competency.code}
              className="rounded-2xl border border-line bg-ink-soft/50 p-5 transition hover:border-accent/30"
            >
              <span className="font-mono text-xs text-accent">
                {competency.code}
              </span>
              <h3 className="mt-3 text-sm font-semibold leading-snug text-white">
                {competency.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {competency.description}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">
            Ruta avanzada
          </h3>
          <p className="text-sm text-slate-400">
            Ingeniería de IA · se certifica al completar las etapas 9 y 10
          </p>
        </div>

        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANCED_COMPETENCIES.map((competency) => (
            <li
              key={competency.code}
              className="rounded-2xl border border-mint/25 bg-mint/[0.04] p-5"
            >
              <span className="font-mono text-xs text-mint">
                {competency.code}
              </span>
              <h4 className="mt-3 text-sm font-semibold leading-snug text-white">
                {competency.title}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {competency.description}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-3xl border-l-2 border-line pl-4 text-sm leading-relaxed text-slate-400">
          El egreso exige{" "}
          <span className="text-slate-200">nivel 3 en C1–C9</span> y{" "}
          <span className="text-slate-200">nivel 4 en C10</span>. Esas diez
          competencias constituyen el perfil profesional obligatorio; C11–C14 son
          la especialización adicional, no un requisito de egreso.
        </p>
      </Container>
    </section>
  );
}

