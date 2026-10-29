import type { Metadata } from "next";

import { ProjectWorkspace } from "@/features/projects/components/ProjectWorkspace";

export const metadata: Metadata = {
  title: "Proyecto",
  description:
    "Enunciado, rúbrica, entrega e historial de un proyecto de CodeAI Academy.",
};

interface ProjectPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  return <ProjectWorkspace slug={(await params).slug} />;
}
