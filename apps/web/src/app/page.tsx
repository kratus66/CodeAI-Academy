import { TetrisBackground } from "@/components/effects/TetrisBackground";
import { Competencies } from "@/features/landing/components/Competencies";
import { FinalCta } from "@/features/landing/components/FinalCta";
import { Hero } from "@/features/landing/components/Hero";
import { LearningPath } from "@/features/landing/components/LearningPath";
import { Method } from "@/features/landing/components/Method";
import { NotThis } from "@/features/landing/components/NotThis";
import { ThreeLevels } from "@/features/landing/components/ThreeLevels";

export default function LandingPage() {
  return (
    <main>
      <TetrisBackground />
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
