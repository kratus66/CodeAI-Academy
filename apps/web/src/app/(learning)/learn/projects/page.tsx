import type { Metadata } from "next";

import { ProjectCatalog } from "@/features/projects/components/ProjectCatalog";

export const metadata: Metadata = {
  title: "Proyectos",
  description:
    "Proyectos evaluables por etapa de CodeAI Academy, con su entregable y su rúbrica.",
};

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Proyectos
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Cada etapa termina en un proyecto
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Elige un proyecto para leer su enunciado, sus requisitos y la rúbrica
          con la que se evalúa. Puedes entregar varias veces: la nota y la
          retroalimentación quedan en tu historial.
        </p>
      </header>

      <ProjectCatalog />
    </div>
  );
}
