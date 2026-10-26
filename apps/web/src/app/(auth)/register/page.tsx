import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/AuthCard";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de CodeAI Academy y empieza la ruta.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Crear cuenta"
      description="Empieza la ruta de 12 etapas. La cuenta guarda tu avance y tus entregas; el rol inicial es estudiante."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Iniciar sesión
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
