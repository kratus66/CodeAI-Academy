import { DEFAULT_COURSE_SLUG, courseSlugSchema } from "@codeai/shared";
import type { Metadata } from "next";

import { StageCatalog } from "@/features/learning/components/StageCatalog";

export const metadata: Metadata = {
  title: "Catálogo de etapas",
  description:
    "Etapas publicadas de la ruta de CodeAI Academy, con sus objetivos.",
};

interface LearnStagesPageProps {
  readonly searchParams: Promise<{ course?: string | string[] }>;
}

export default async function LearnStagesPage({
  searchParams,
}: LearnStagesPageProps) {
  const { course: requested } = await searchParams;
  const parsed = courseSlugSchema.safeParse(requested);
  const course = parsed.success ? parsed.data : DEFAULT_COURSE_SLUG;

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Ruta de aprendizaje
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Catálogo de etapas
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Elige una etapa para ver sus módulos y unidades. Cada unidad declara su
          objetivo y sus prerrequisitos antes de abrir una lección.
        </p>
      </header>

      <StageCatalog course={course} />
    </div>
  );
}
