import type { Metadata } from "next";

import { LessonReader } from "@/features/learning/components/LessonReader";

export const metadata: Metadata = {
  title: "Lección",
  description:
    "Lección publicada de CodeAI Academy con sus pasos y recursos verificados.",
};

interface LessonPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

/** Sin lecciones sembradas todavía, un slug inexistente cae en el 404 de la API. */
export default async function LessonPage({ params }: LessonPageProps) {
  return <LessonReader slug={(await params).slug} />;
}
