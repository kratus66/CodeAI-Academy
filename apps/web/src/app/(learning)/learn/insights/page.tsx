import type { Metadata } from "next";

import { StudentInsights } from "@/features/analytics/components/StudentInsights";

export const metadata: Metadata = {
  title: "Tus métricas",
  description:
    "Actividad, avance por etapa, competencias y errores frecuentes del periodo.",
};

export default function InsightsPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Analítica
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Tus métricas
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Lo que ves sale de tus envíos y repasos, agrupado en la base de datos.
          No se mide tiempo de permanencia: se mide actividad real.
        </p>
      </header>

      <StudentInsights />
    </div>
  );
}
