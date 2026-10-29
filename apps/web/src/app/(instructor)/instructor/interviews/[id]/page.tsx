import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { InterviewReport } from "@/features/interviews/components/InterviewReport";
import { SessionGate } from "@/features/learning/components/SessionGate";

export const metadata: Metadata = {
  title: "Revisión de entrevista",
  robots: { index: false, follow: false },
};

interface InstructorInterviewPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/** Bandeja de revisión de una entrevista; el rol lo exige también la API. */
export default async function InstructorInterviewPage({
  params,
}: InstructorInterviewPageProps) {
  return (
    <SessionGate>
      <main className="flex-1 py-10 sm:py-14">
        <Container>
          <InterviewReport sessionId={(await params).id} instructor />
        </Container>
      </main>
    </SessionGate>
  );
}
