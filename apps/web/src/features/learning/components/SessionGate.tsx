"use client";

import type { Role } from "@codeai/shared";
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
  /**
   * Roles admitidos. Sin esta prop basta con tener sesión; con ella, una cuenta
   * autenticada del rol equivocado ve un aviso y nunca el contenido privado.
   */
  readonly roles?: readonly Role[];
}

/**
 * Puerta del área privada. Mientras la sesión se restaura no se pinta contenido
 * privado; sin sesión se manda a `/login` y se deja un enlace por si la
 * redirección automática no llega (scripts desactivados, navegador antiguo).
 *
 * La comprobación de rol es sólo de interfaz: la API vuelve a exigirlo con
 * `RolesGuard` y responde `403`, así que ocultar la pantalla no concede permisos.
 */
export function SessionGate({ children, roles }: SessionGateProps) {
  const { status, user } = useSession();
  const router = useRouter();
  const roleAllowed =
    roles === undefined || (user !== null && roles.includes(user.role));

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

  if (status === "authenticated" && !roleAllowed) {
    return (
      <div role="alert" className={NOTICE_CLASSES}>
        <p>
          Esta pantalla es sólo para el equipo instructor. Tu cuenta no tiene ese
          rol.
        </p>
        <Link href="/learn" className={LINK_CLASSES}>
          Volver a aprender
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
