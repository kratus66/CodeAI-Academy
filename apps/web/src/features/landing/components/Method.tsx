import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { METHOD_PILLARS } from "../data/content";

export function Method() {
  return (
    <section id="metodo" className="border-b border-line/60 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="El método"
          title="Aprender haciendo, con dificultad calibrada y evidencia."
          description="Seis decisiones pedagógicas sostienen el programa. No son opcionales: cada una tiene consecuencias verificables en la plataforma."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {METHOD_PILLARS.map((pillar, index) => (
            <article
              key={pillar.title}
              className="rounded-2xl border border-line bg-ink-soft/50 p-6 transition hover:border-accent/30"
            >
              <span className="font-mono text-xs text-slate-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-base font-semibold text-white">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {pillar.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-8 max-w-3xl border-l-2 border-accent/50 pl-4 text-sm leading-relaxed text-slate-400">
          La IA es una herramienta del programa, no sustituto del aprendizaje.
          El tutor nunca entrega la solución completa por defecto: entrega pistas
          graduales, y el estudiante sigue siendo responsable del código que
          entrega.
        </p>
      </Container>
    </section>
  );
}
