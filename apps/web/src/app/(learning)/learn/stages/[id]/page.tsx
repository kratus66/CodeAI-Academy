import { certificationForStageId } from "@codeai/shared";
import type { CertificationDefinition } from "@codeai/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { StageOutline } from "@/features/learning/components/StageOutline";

export const metadata: Metadata = {
  title: "Etapa",
  description:
    "Módulos y unidades publicadas de una etapa de CodeAI Academy.",
};

const EXAMS_LINK_CLASSES =
  "inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const EXAMS_LINK_LABEL = "Simulacros y preparación";

interface StagePageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Solo las etapas que son una certificación tienen simulacro; el resto de
 * etapas (por ejemplo, la 1) no muestran el enlace.
 */
function certificationOf(stageId: string): CertificationDefinition | null {
  const parsed = Number(stageId);

  return Number.isInteger(parsed) ? certificationForStageId(parsed) : null;
}

/**
 * El `id` se pasa como texto tal cual llega: `contentApi.getStage` acepta
 * `number | string` y es la API quien responde `400` ante un segmento inválido.
 */
export default async function StagePage({ params }: StagePageProps) {
  const { id } = await params;
  const certification = certificationOf(id);

  return (
    <div className="space-y-6">
      {certification === null ? null : (
        <Link href={`/learn/exams/${certification.code}`} className={EXAMS_LINK_CLASSES}>
          {EXAMS_LINK_LABEL}
        </Link>
      )}
      <StageOutline stageId={id} />
    </div>
  );
}
