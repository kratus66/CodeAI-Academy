import type { Metadata } from "next";

import { PublicPortfolio } from "@/features/projects/components/PublicPortfolio";

export const metadata: Metadata = {
  title: "Mi portafolio",
  description:
    "Tus entregas de proyecto, con su nota, su retroalimentación y su estado de publicación.",
};

/** Vista propia: incluye las entregas privadas y cuántas están publicadas. */
export default function MyPortfolioPage() {
  return <PublicPortfolio />;
}
