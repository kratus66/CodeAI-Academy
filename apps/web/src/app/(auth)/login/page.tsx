import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/AuthCard";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Accede a tu cuenta de CodeAI Academy.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Iniciar sesión"
      description="Tu progreso, tus entregas y tu identidad en la plataforma quedan ligados a esta cuenta."
      footer={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link
            href="/register"
            className="font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
