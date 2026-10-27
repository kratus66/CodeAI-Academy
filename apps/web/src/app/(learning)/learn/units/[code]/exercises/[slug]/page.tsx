import type { Metadata } from "next";

import { ExerciseLab } from "@/features/lab/components/ExerciseLab";

export const metadata: Metadata = {
  title: "Laboratorio de código",
  description:
    "Escribe, ejecuta y envía un ejercicio de CodeAI Academy con pruebas visibles.",
};

interface ExercisePageProps {
  readonly params: { readonly code: string; readonly slug: string };
}

/**
 * El `code` y el `slug` llegan tal cual: la vista resuelve el slug contra la
 * unidad y la API responde `400`/`404` si alguno no existe.
 */
export default function ExercisePage({ params }: ExercisePageProps) {
  return <ExerciseLab slug={params.slug} unitCode={params.code} />;
}
