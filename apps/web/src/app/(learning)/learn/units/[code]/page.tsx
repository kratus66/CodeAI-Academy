import type { Metadata } from "next";

import { UnitView } from "@/features/learning/components/UnitView";

export const metadata: Metadata = {
  title: "Unidad",
  description:
    "Objetivo, prerrequisitos, lecciones y ejercicios de una unidad de CodeAI Academy.",
};

interface UnitPageProps {
  readonly params: Promise<{ readonly code: string }>;
}

/** El `code` llega tal cual: la API responde `400` si no es un código válido. */
export default async function UnitPage({ params }: UnitPageProps) {
  return <UnitView code={(await params).code} />;
}
