import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { CohortOverview } from "@/features/analytics/components/CohortOverview";
import { SessionGate } from "@/features/learning/components/SessionGate";

export const metadata: Metadata = {
  title: "Cohorte",
  robots: { index: false, follow: false },
};

/** Panel de analítica de la cohorte; `RolesGuard` vuelve a exigir el rol en la API. */
export default function InstructorCohortPage() {
  return (
    <SessionGate roles={["INSTRUCTOR", "ADMIN"]}>
      <main className="flex-1 py-10 sm:py-14">
        <Container className="space-y-8">
          <header className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              Instructor
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Tu cohorte
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Quién avanza, quién necesita ayuda y qué errores se repiten. El
              panel sólo muestra el nombre visible: ni correo ni respuestas de
              los envíos.
            </p>
          </header>

          <CohortOverview />
        </Container>
      </main>
    </SessionGate>
  );
}
