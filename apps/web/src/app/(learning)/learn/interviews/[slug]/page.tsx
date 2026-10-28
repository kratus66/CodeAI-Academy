import type { Metadata } from "next";

import { InterviewRoom } from "@/features/interviews/components/InterviewRoom";

export const metadata: Metadata = {
  title: "Sala de entrevista",
  description:
    "Entrevista técnica por fases, con turnos limitados y cierre con autoevaluación.",
};

interface InterviewRoomPageProps {
  readonly params: { readonly slug: string };
}

export default function InterviewRoomPage({ params }: InterviewRoomPageProps) {
  return <InterviewRoom scenarioSlug={params.slug} />;
}
