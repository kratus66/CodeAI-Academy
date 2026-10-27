import type { Metadata } from "next";

import { ReviewQueue } from "@/features/review/components/ReviewQueue";

export const metadata: Metadata = {
  title: "Repaso",
  description:
    "Cola diaria de ejercicios que el motor de repetición espaciada vuelve a traer.",
};

export default function ReviewPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Repaso espaciado
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Vuelve a lo que ya estudiaste
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Cada envío programa un repaso con el algoritmo SM-2. Un acierto sin pistas
          lo aleja; un fallo o el uso de pistas lo adelanta. El intervalo lo calcula
          el servidor: tú sólo declaras cómo recordaste el ejercicio.
        </p>
      </header>

      <ReviewQueue />
    </div>
  );
}
