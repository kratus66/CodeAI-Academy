import type { Metadata } from "next";

import { StudentDashboard } from "@/features/learning/components/StudentDashboard";

export const metadata: Metadata = {
  title: "Tu panel",
  description:
    "Dónde sigues, qué debes repasar y cómo va tu avance en CodeAI Academy.",
};

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Área de aprendizaje
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Tu siguiente paso
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Retoma donde lo dejaste, atiende el repaso del día y consulta cómo
          avanza tu ruta sin salir de esta pantalla.
        </p>
      </header>

      <StudentDashboard />
    </div>
  );
}

