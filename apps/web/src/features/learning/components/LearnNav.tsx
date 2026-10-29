"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import { PieceIcon } from "@/components/effects/PieceIcon";
import { cn } from "@/lib/cn";
import type { TetrominoId } from "@/lib/tetromino";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly piece: TetrominoId;
}

const ITEMS: readonly NavItem[] = [
  { href: "/learn", label: "Aprender", piece: "I" },
  { href: "/learn/review", label: "Repaso", piece: "S" },
  { href: "/learn/projects", label: "Proyectos", piece: "T" },
  { href: "/learn/interviews", label: "Entrevistas", piece: "L" },
  { href: "/learn/portfolio", label: "Mi portafolio", piece: "O" },
];

/** La ruta activa es la coincidencia más específica (`/learn` abarca lecciones y etapas). */
export function activeHref(pathname: string): string | null {
  const matches = ITEMS.filter(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  const best = matches.sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href ?? null;
}

interface Indicator {
  readonly left: number;
  readonly width: number;
}

/** Barra flotante de vidrio con un indicador que se desliza hacia la sección activa. */
export function LearnNav() {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const trackRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const link = track.querySelector<HTMLElement>("[aria-current='page']");
      setIndicator(
        link ? { left: link.offsetLeft, width: link.offsetWidth } : null,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [active]);

  return (
    <nav
      aria-label="Navegación de aprendizaje"
      className="glass max-w-full overflow-x-auto rounded-full p-1"
    >
      <div ref={trackRef} className="relative flex items-center gap-1">
        {indicator && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 rounded-full border border-accent/40 bg-accent/15 shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] transition-[transform,width] duration-300 ease-out"
            style={{
              width: indicator.width,
              transform: `translateX(${indicator.left}px)`,
            }}
          />
        )}
        {ITEMS.map((item) => {
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative z-10 flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isActive
                  ? "font-medium text-white"
                  : "text-slate-400 hover:text-slate-100",
              )}
            >
              <PieceIcon id={item.piece} className="h-3.5 w-auto" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
