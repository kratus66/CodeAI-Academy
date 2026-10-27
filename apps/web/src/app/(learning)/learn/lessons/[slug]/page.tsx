import type { Metadata } from "next";

import { LessonReader } from "@/features/learning/components/LessonReader";

export const metadata: Metadata = {
  title: "Lección",
  description:
    "Lección publicada de CodeAI Academy con sus pasos y recursos verificados.",
};

interface LessonPageProps {
  readonly params: { readonly slug: string };
}

/** Sin lecciones sembradas todavía, un slug inexistente cae en el 404 de la API. */
export default function LessonPage({ params }: LessonPageProps) {
  return <LessonReader slug={params.slug} />;
}
