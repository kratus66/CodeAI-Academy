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
      {process.env.NODE_ENV === "development" ? <DemoCredentials /> : null}
    </AuthCard>
  );
}

/** Solo en desarrollo: credenciales de las cuentas de prueba sembradas localmente. */
function DemoCredentials() {
  const accounts = [
    { role: "Estudiante", email: "estudiante@codeai.test", password: "Estudiante123" },
    { role: "Instructor", email: "instructor@codeai.test", password: "Instructor123" },
    { role: "Admin", email: "admin@codeai.test", password: "Admin123456" },
  ];

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-400">
      <p className="mb-2 font-mono uppercase tracking-wide text-accent">
        Cuentas de prueba (solo desarrollo)
      </p>
      <ul className="space-y-1">
        {accounts.map((account) => (
          <li key={account.email}>
            <span className="text-slate-300">{account.role}:</span>{" "}
            {account.email} / {account.password}
          </li>
        ))}
      </ul>
    </div>
  );
}
