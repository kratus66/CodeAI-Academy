import type { Metadata } from "next";

import { ScenarioCatalog } from "@/features/interviews/components/ScenarioCatalog";

export const metadata: Metadata = {
  title: "Entrevistas",
  description:
    "Entrevistas técnicas de práctica por rol y nivel, con guion, autoevaluación y revisión.",
};

export default function InterviewsPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Entrevistas
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Practica la entrevista antes de vivirla
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Cada escenario recorre seis fases, desde la presentación hasta tus
          preguntas. Al cerrar, autoevalúas tu desempeño con la misma rúbrica que
          usa un instructor.
        </p>
      </header>

      <ScenarioCatalog />
    </div>
  );
}
