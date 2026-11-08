import type { Metadata } from "next";

import { CourseCatalog } from "@/features/learning/components/CourseCatalog";

export const metadata: Metadata = {
  title: "Catálogo de rutas",
  description:
    "Rutas de aprendizaje publicadas en CodeAI Academy, con sus objetivos y etapas.",
};

export default function LearnCoursesPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Rutas de aprendizaje
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Catálogo de rutas
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Elige una ruta para ver sus etapas. Cada ruta declara su objetivo y
          cuántas etapas la componen.
        </p>
      </header>

      <CourseCatalog />
    </div>
  );
}
