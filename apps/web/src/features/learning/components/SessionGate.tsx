"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useSession } from "@/features/auth/context/SessionProvider";

const NOTICE_CLASSES =
  "mx-auto mt-16 max-w-md rounded-2xl border border-line/70 bg-ink-card/60 px-6 py-8 text-center text-sm text-slate-300";

const LINK_CLASSES =
  "mt-5 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

interface SessionGateProps {
  readonly children: ReactNode;
}

/**
 * Puerta del área de aprendizaje. Mientras la sesión se restaura no se pinta
 * contenido privado; sin sesión se manda a `/login` y se deja un enlace por si la
 * redirección automática no llega (scripts desactivados, navegador antiguo).
 */
export function SessionGate({ children }: SessionGateProps) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status === "loading") {
    return (
      <p role="status" aria-live="polite" className={NOTICE_CLASSES}>
        Restaurando tu sesión…
      </p>
    );
  }

  if (status === "anonymous") {
    return (
      <div role="alert" className={NOTICE_CLASSES}>
        <p>
          Necesitas iniciar sesión para abrir la plataforma de aprendizaje.
        </p>
        <Link href="/login" className={LINK_CLASSES}>
          Iniciar sesión
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
