import { Container } from "@/components/layout/Container";

export function FinalCta() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="grid gap-10 rounded-3xl border border-line bg-gradient-to-br from-ink-card via-ink-soft to-ink p-8 sm:p-12 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
          <div>
            <blockquote className="text-2xl font-medium leading-snug text-white sm:text-3xl">
              “Esta aplicación la entiendo, la puedo defender, la puedo romper a
              propósito y la puedo arreglar.”
            </blockquote>
            <p className="mt-4 text-sm uppercase tracking-[0.18em] text-slate-500">
              Criterio final de egreso · CodeAI Academy
            </p>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-slate-400">
              Si al terminar no puedes auditar tu propio código, el programa no
              se completó, aunque la plataforma diga lo contrario.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <a
              href="#ruta"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Empezar por la ruta
              <span aria-hidden>→</span>
            </a>
            <a
              href="#inicio"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Volver al inicio
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
