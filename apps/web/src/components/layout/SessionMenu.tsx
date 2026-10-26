"use client";

import type { Role } from "@codeai/shared";
import Link from "next/link";
import { useState } from "react";

import { useSession } from "@/features/auth/context/SessionProvider";

const ROLE_LABELS: Readonly<Record<Role, string>> = {
  STUDENT: "Estudiante",
  INSTRUCTOR: "Instructor",
  ADMIN: "Administrador",
};

const LINK_CLASSES =
  "text-sm text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** Acciones de identidad de la cabecera: entrar, crear cuenta o cerrar sesión. */
export function SessionMenu() {
  const { user, status, signOut } = useSession();
  const [pending, setPending] = useState(false);

  if (status === "loading") {
    return (
      <p role="status" aria-live="polite" className="flex items-center">
        <span className="sr-only">Comprobando sesión…</span>
        <span
          aria-hidden
          className="block h-9 w-32 animate-pulse rounded-full bg-white/5"
        />
      </p>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/login" className={LINK_CLASSES}>
          Iniciar sesión
        </Link>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          Crear cuenta
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  async function handleSignOut(): Promise<void> {
    setPending(true);

    try {
      await signOut();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-white">{user.name}</p>
        <p className="text-[11px] uppercase tracking-wider text-slate-500">
          {ROLE_LABELS[user.role]}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={pending}
        className="rounded-full border border-white/15 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saliendo…" : "Cerrar sesión"}
      </button>
    </div>
  );
}
