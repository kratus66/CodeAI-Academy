import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { LEVELS, TOTAL_HOURS_LABEL, stagesByLevel } from "../data/path";

export function LearningPath() {
  return (
    <section id="ruta" className="border-b border-line/60 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="La ruta"
          title="12 etapas, de los fundamentos al proyecto integrador."
          description="Cada etapa exige evidencia: proyecto, ejercicios y evaluación. Se avanza por dominio demostrado, no por calendario."
        />

        <div className="mt-14 space-y-12">
          {LEVELS.map((level) => (
            <div key={level.number}>
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
                    Nivel {level.number}
                  </span>
                  <h3 className="text-xl font-semibold text-white">
                    {level.name}
                  </h3>
                </div>
                <p className="text-sm text-slate-400">{level.focus}</p>
              </div>

              <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stagesByLevel(level.number).map((stage) => (
                  <li
                    key={stage.code}
                    className="rounded-2xl border border-line bg-ink-soft/60 p-5 transition hover:border-accent/40 hover:bg-ink-soft"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-accent">
                        {stage.code}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {stage.hours}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-snug text-white">
                      {stage.title}
                    </p>
                    <p className="mt-4 font-mono text-[11px] text-slate-500">
                      {stage.competencies.join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 border-l-2 border-line pl-4 text-sm leading-relaxed text-slate-400">
          Duración orientativa total:{" "}
          <span className="text-slate-200">{TOTAL_HOURS_LABEL}</span>. A 10 horas
          por semana, entre 16 y 24 meses. Las horas son estimaciones de
          planificación, no una promesa de duración.
        </p>
      </Container>
    </section>
  );
}
