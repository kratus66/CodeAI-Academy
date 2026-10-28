import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import { SessionGate } from "@/features/learning/components/SessionGate";

export const metadata: Metadata = {
  title: "Aprender",
  robots: { index: false, follow: false },
};

interface LearningLayoutProps {
  readonly children: ReactNode;
}

/**
 * Shell del área privada. La sesión se resuelve en cliente (la cookie httpOnly la
 * emite la API en otro origen), así que el guard vive en `SessionGate` y aquí solo
 * queda el marco de navegación del área.
 */
export default function LearningLayout({ children }: LearningLayoutProps) {
  return (
    <main id="aprendizaje" className="flex flex-1 flex-col">
      <div className="border-b border-line/70 bg-ink-card/40">
        <Container className="flex h-12 items-center justify-between gap-4">
          <nav
            aria-label="Navegación de aprendizaje"
            className="flex items-center gap-2 text-sm"
          >
            <Link
              href="/learn"
              className="font-medium text-white transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Aprender
            </Link>
            <Link
              href="/learn/review"
              className="text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Repaso
            </Link>
            <Link
              href="/learn/projects"
              className="text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Proyectos
            </Link>
            <Link
              href="/learn/interviews"
              className="text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Entrevistas
            </Link>
            <Link
              href="/learn/portfolio"
              className="text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Mi portafolio
            </Link>
          </nav>
          <Link
            href="/"
            className="text-xs text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Volver a la portada
          </Link>
        </Container>
      </div>

      <Container className="flex-1 py-10 sm:py-14">
        <SessionGate>{children}</SessionGate>
      </Container>
    </main>
  );
}
