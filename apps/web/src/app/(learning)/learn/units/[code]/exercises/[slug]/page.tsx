import type { Metadata } from "next";

import { ExercisePlayer } from "@/features/lab/components/ExercisePlayer";

export const metadata: Metadata = {
  title: "Práctica",
  description:
    "Practica un ejercicio de CodeAI Academy: quiz, tarjeta de repaso o laboratorio de código.",
};

interface ExercisePageProps {
  readonly params: { readonly code: string; readonly slug: string };
}

/**
 * El `code` y el `slug` llegan tal cual: la vista resuelve el slug contra la
 * unidad y la API responde `400`/`404` si alguno no existe.
 */
export default function ExercisePage({ params }: ExercisePageProps) {
  return <ExercisePlayer slug={params.slug} unitCode={params.code} />;
}
