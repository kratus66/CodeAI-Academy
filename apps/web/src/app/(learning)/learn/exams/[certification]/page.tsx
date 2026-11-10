import { CERTIFICATION_CODES, CERTIFICATION_REGISTRY } from "@codeai/shared";
import type { CertificationDefinition } from "@codeai/shared";
import type { Metadata } from "next";

import { ExamHome } from "@/features/exams/components/ExamHome";

export const metadata: Metadata = {
  title: "Simulacros de la certificación",
  description:
    "Modos de simulacro, formato oficial e historial de intentos de una certificación de la ruta AWS.",
};

interface ExamHomePageProps {
  readonly params: Promise<{ readonly certification: string }>;
}

/** Solo los códigos del registro tienen simulacro; el resto no rompe la página. */
function findCertification(code: string): CertificationDefinition | null {
  for (const known of CERTIFICATION_CODES) {
    if (known === code) {
      return CERTIFICATION_REGISTRY[known];
    }
  }

  return null;
}

export default async function ExamHomePage({ params }: ExamHomePageProps) {
  const definition = findCertification((await params).certification);

  if (definition === null) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-line/70 bg-ink-card/40 px-5 py-6"
      >
        <p className="text-sm font-medium text-slate-200">
          No encontramos esta certificación.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Puede que el código no exista o que el enlace esté mal formado.
        </p>
      </div>
    );
  }

  return <ExamHome certification={definition.code} />;
}
