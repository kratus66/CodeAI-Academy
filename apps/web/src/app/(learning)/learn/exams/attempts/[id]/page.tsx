import type { Metadata } from "next";

import { ExamRoom } from "@/features/exams/components/ExamRoom";

export const metadata: Metadata = {
  title: "Simulacro en curso",
  description:
    "Sala de examen del simulacro: una pregunta a la vez, cronómetro y entrega sin corrección previa.",
};

interface ExamRoomPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/** El `id` llega tal cual: la API responde `404` si el intento no es de esta persona. */
export default async function ExamRoomPage({ params }: ExamRoomPageProps) {
  return <ExamRoom attemptId={(await params).id} />;
}
