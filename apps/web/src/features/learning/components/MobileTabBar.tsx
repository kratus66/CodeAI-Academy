"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { PieceIcon } from "@/components/effects/PieceIcon";
import { activeHref } from "@/features/learning/components/LearnNav";
import { cn } from "@/lib/cn";
import type { TetrominoId } from "@/lib/tetromino";

interface TabItem {
  readonly href: string;
  readonly label: string;
  readonly piece: TetrominoId;
}

/**
 * Los cuatro destinos de uso diario. El resto de secciones no se pierde: viaja
 * en el panel «Más», porque en una barra inferior no caben siete píldoras y el
 * alumno consulta esas secciones mucho menos.
 */
const TABS: readonly TabItem[] = [
  { href: "/learn", label: "Aprender", piece: "I" },
  { href: "/learn/lab", label: "Laboratorio", piece: "J" },
  { href: "/learn/review", label: "Repaso", piece: "S" },
  { href: "/learn/projects", label: "Proyectos", piece: "T" },
];

const MORE: readonly TabItem[] = [
  { href: "/learn/insights", label: "Métricas", piece: "Z" },
  { href: "/learn/interviews", label: "Entrevistas", piece: "L" },
  { href: "/learn/portfolio", label: "Mi portafolio", piece: "O" },
];

const ITEM_CLASSES =
  "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset";

const PANEL_LINK_CLASSES =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset";

/**
 * Barra inferior del área de aprendizaje (S12-T7). Sustituye en móvil al
 * carrusel de píldoras de `LearnNav`, que se queda en escritorio: cuatro
 * destinos fijos con la ruta activa marcada en `aria-current` y un panel «Más»
 * para las secciones de consulta ocasional.
 *
 * El panel se abre con el botón y se cierra con Escape, con el propio botón, al
 * elegir un destino o al tocar fuera. Se guarda la ruta con la que se abrió, así
 * que al navegar queda cerrado sin necesidad de sincronizarlo con un efecto.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const navRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const open = openedFor === pathname;
  const moreActive = MORE.some((item) => item.href === active);

  useEffect(() => {
    if (!open) {
      return;
    }

    // El foco entra en el panel: si no, seguiría en el botón que lo abre y el
    // lector de pantalla no anunciaría el contenido nuevo.
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenedFor(null);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenedFor(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <nav
      ref={navRef}
      aria-label="Secciones de aprendizaje"
      data-mobile-tab-bar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          className="absolute inset-x-2 bottom-full mb-2 rounded-2xl border border-line/70 bg-ink-card/95 p-2 shadow-lg backdrop-blur"
        >
          <ul className="flex flex-col">
            {MORE.map((item) => {
              const isActive = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setOpenedFor(null)}
                    className={cn(
                      PANEL_LINK_CLASSES,
                      isActive
                        ? "bg-accent/10 text-white"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
                    )}
                  >
                    <PieceIcon id={item.piece} className="h-4 w-auto" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-1 border-t border-line/60 pt-1">
              <Link
                href="/"
                onClick={() => setOpenedFor(null)}
                className={cn(
                  PANEL_LINK_CLASSES,
                  "text-slate-400 hover:text-white",
                )}
              >
                Volver a la portada
              </Link>
            </li>
          </ul>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-md items-stretch gap-1 px-2 py-1.5">
        {TABS.map((item) => {
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                ITEM_CLASSES,
                isActive ? "text-white" : "text-slate-500 hover:text-slate-200",
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent"
                />
              ) : null}
              <PieceIcon id={item.piece} className="h-4 w-auto" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}

        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-current={moreActive ? "page" : undefined}
          onClick={() => setOpenedFor(open ? null : pathname)}
          className={cn(
            ITEM_CLASSES,
            moreActive || open ? "text-white" : "text-slate-500 hover:text-slate-200",
          )}
        >
          {moreActive ? (
            <span
              aria-hidden
              className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent"
            />
          ) : null}
          <span aria-hidden className="-my-0.5 text-base leading-none">
            ⋯
          </span>
          Más
        </button>
      </div>
    </nav>
  );
}
