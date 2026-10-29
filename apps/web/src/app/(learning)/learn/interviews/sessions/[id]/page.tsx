import type { Metadata } from "next";

import { InterviewReport } from "@/features/interviews/components/InterviewReport";

export const metadata: Metadata = {
  title: "Informe de entrevista",
  description:
    "Transcripción, autoevaluación, nota del instructor y comparación entre intentos.",
};

interface InterviewReportPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function InterviewReportPage({
  params,
}: InterviewReportPageProps) {
  return <InterviewReport sessionId={(await params).id} />;
}
