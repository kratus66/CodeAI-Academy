import type { Metadata } from "next";

import { PublicPortfolio } from "@/features/projects/components/PublicPortfolio";

export const metadata: Metadata = {
  title: "Portafolio",
  description:
    "Proyectos publicados por un estudiante de CodeAI Academy, con su repositorio y despliegue.",
};

interface PublicPortfolioPageProps {
  readonly params: Promise<{ readonly userId: string }>;
}

/** Ruta pública: no exige sesión y sólo muestra lo que el autor publicó. */
export default async function PublicPortfolioPage({
  params,
}: PublicPortfolioPageProps) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14 sm:px-8">
      <PublicPortfolio userId={(await params).userId} />
    </main>
  );
}
