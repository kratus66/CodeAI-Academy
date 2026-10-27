import type { Metadata } from "next";

import { StageOutline } from "@/features/learning/components/StageOutline";

export const metadata: Metadata = {
  title: "Etapa",
  description:
    "Módulos y unidades publicadas de una etapa de CodeAI Academy.",
};

interface StagePageProps {
  readonly params: { readonly id: string };
}

/**
 * El `id` se pasa como texto tal cual llega: `contentApi.getStage` acepta
 * `number | string` y es la API quien responde `400` ante un segmento inválido.
 */
export default function StagePage({ params }: StagePageProps) {
  return <StageOutline stageId={params.id} />;
}
