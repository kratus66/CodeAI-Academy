import type { Metadata } from "next";

import { ExamResult } from "@/features/exams/components/ExamResult";

export const metadata: Metadata = {
  title: "Resultado del simulacro",
  description:
    "Aciertos por dominio y revisión pregunta a pregunta del simulacro entregado.",
};

interface ExamResultPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/** El `id` llega tal cual: la API responde `404` si el intento no es de esta persona. */
export default async function ExamResultPage({ params }: ExamResultPageProps) {
  return <ExamResult attemptId={(await params).id} />;
}
