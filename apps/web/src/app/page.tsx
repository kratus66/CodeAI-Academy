import { GlowTracker } from "@/components/effects/GlowTracker";
import { TetrisBackground } from "@/components/effects/TetrisBackground";
import { Competencies } from "@/features/landing/components/Competencies";
import { FinalCta } from "@/features/landing/components/FinalCta";
import { Hero } from "@/features/landing/components/Hero";
import { LearningPath } from "@/features/landing/components/LearningPath";
import { Method } from "@/features/landing/components/Method";
import { NotThis } from "@/features/landing/components/NotThis";
import { ThreeLevels } from "@/features/landing/components/ThreeLevels";

/**
 * Los efectos de movimiento (fondo animado, escena 3D y halo que sigue al
 * cursor) viven solo aquí: la app privada no paga su coste (S12-T8).
 */
export default function LandingPage() {
  return (
    <main>
      <TetrisBackground />
      <GlowTracker />
      <Hero />
      <ThreeLevels />
      <LearningPath />
      <Method />
      <Competencies />
      <NotThis />
      <FinalCta />
    </main>
  );
}
