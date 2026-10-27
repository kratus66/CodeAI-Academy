import type { Metadata } from "next";

import { ProgressOverview } from "@/features/progress/components/ProgressOverview";

export const metadata: Metadata = {
  title: "Tu avance",
  description:
    "Progreso por etapa, unidad y competencia, calculado en el servidor.",
};

export default function ProgressPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Progreso
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Tu avance
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          El avance se calcula en el servidor con las lecciones que has visto y las
          competencias que has demostrado. Ver una lección no acredita una unidad:
          eso lo decide la evaluación.
        </p>
      </header>

      <ProgressOverview />
    </div>
  );
}
