import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { ExamCohortView } from "@/features/exams/components/ExamCohortView";
import { SessionGate } from "@/features/learning/components/SessionGate";

export const metadata: Metadata = {
  title: "Simulacros de la cohorte",
  robots: { index: false, follow: false },
};

/** Vista agregada de simulacros; `RolesGuard` vuelve a exigir el rol en la API. */
export default function InstructorExamsPage() {
  return (
    <SessionGate roles={["INSTRUCTOR", "ADMIN"]}>
      <main className="flex-1 py-10 sm:py-14">
        <Container className="space-y-8">
          <header className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              Instructor
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Simulacros de la cohorte
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Qué dominios de cada certificación cuestan más, sin nombres ni
              respuestas: solo datos agregados de los últimos 30 días.
            </p>
          </header>

          <ExamCohortView />
        </Container>
      </main>
    </SessionGate>
  );
}
