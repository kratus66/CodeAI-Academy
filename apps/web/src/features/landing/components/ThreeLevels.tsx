import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";

import { AI_LEVELS } from "../data/content";

export function ThreeLevels() {
  return (
    <section id="problema" className="border-b border-line/60 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="El problema"
          title="Producir código es fácil. Responder por él, no."
          description="La IA redujo el costo de escribir software y elevó el valor de evaluarlo. Por eso el programa se organiza en tres niveles que no son equivalentes."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {AI_LEVELS.map((level) => (
            <article
              key={level.code}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6",
                level.highlighted
                  ? "border-accent/50 bg-accent/[0.06] shadow-glow"
                  : "border-line bg-ink-soft/50",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink font-mono text-sm text-accent">
                  {level.code}
                </span>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider",
                    level.highlighted
                      ? "bg-accent/15 text-accent"
                      : "bg-white/5 text-slate-400",
                  )}
                >
                  {level.badge}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                {level.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {level.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-8 max-w-3xl border-l-2 border-accent/50 pl-4 text-sm leading-relaxed text-slate-400">
          <span className="font-medium text-slate-200">Regla editorial:</span>{" "}
          ninguna lección enseña los niveles B o C mientras no haya dominio
          verificable del nivel anterior. No se puede auditar código generado sin
          saber programar.
        </p>
      </Container>
    </section>
  );
}
