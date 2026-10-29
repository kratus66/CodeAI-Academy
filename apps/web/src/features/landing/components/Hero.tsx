import { HeroScene } from "@/components/effects/HeroScene";
import { Container } from "@/components/layout/Container";

import { CRITERION_QUESTIONS } from "../data/content";
import { HeroBoard } from "./HeroBoard";

const STATS = [
  { value: "12", label: "etapas" },
  { value: "4", label: "niveles" },
  { value: "685–1.035", label: "horas orientativas" },
  { value: "10", label: "competencias de egreso" },
] as const;

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden border-b border-line/60"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid bg-[length:64px_64px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
      />

      <HeroScene />

      <Container className="relative grid gap-16 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
        <div>
          <p className="inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-accent">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            Formación profesional en desarrollo con IA
          </p>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Aprende a construir software con IA{" "}
            <span className="bg-gradient-to-r from-accent via-sky-300 to-mint bg-clip-text text-transparent">
              sin depender ciegamente de ella.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            CodeAI Academy forma desarrolladores capaces de comprender, diseñar,
            probar, desplegar y mantener software asistido por IA. El criterio
            no es que el código funcione: es que puedas explicar por qué
            funciona.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#ruta"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Ver la ruta completa
              <span aria-hidden>↓</span>
            </a>
            <a
              href="#no-es"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Qué no es este programa
            </a>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line/70 pt-8 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="relative rounded-3xl border border-white/10 bg-ink-soft/80 p-1 shadow-glow">
          <div className="rounded-[1.35rem] border border-white/5 bg-ink-card/80 p-6">
            <div className="flex items-center gap-2" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                criterio-de-egreso
              </span>
            </div>

            <div className="mt-6">
              <HeroBoard />
            </div>

            <p className="mt-6 font-mono text-sm text-slate-400">
              <span className="text-mint">$</span> codeai audit ./mi-proyecto
            </p>

            <ul className="mt-4 space-y-3">
              {CRITERION_QUESTIONS.map((question) => (
                <li key={question} className="flex gap-3 text-sm text-slate-200">
                  <span aria-hidden className="mt-0.5 text-mint">
                    ✓
                  </span>
                  {question}
                </li>
              ))}
            </ul>

            <p className="mt-6 border-t border-white/5 pt-4 text-xs leading-relaxed text-slate-500">
              El egreso exige nivel 3 en C1–C9 y nivel 4 en C10. Si no puedes
              auditar tu propio código, el programa no se completó.
            </p>
          </div>
        </aside>
      </Container>
    </section>
  );
}
