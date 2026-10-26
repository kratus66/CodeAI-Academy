import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";

export interface AuthCardProps {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}

/** Marco visual común de las pantallas de acceso, con un único `h1` por página. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <section
      id="acceso"
      className="relative flex-1 overflow-hidden border-b border-line/60 py-16 sm:py-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid bg-[length:64px_64px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
      />

      <Container className="relative flex justify-center">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-ink-soft/80 p-1 shadow-glow">
            <div className="rounded-[1.35rem] border border-white/5 bg-ink-card/80 p-6 sm:p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                CodeAI Academy
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {description}
              </p>

              <div className="mt-7">{children}</div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">{footer}</p>
        </div>
      </Container>
    </section>
  );
}
