"use client";

import { useEffect } from "react";

/**
 * Publica la posición del cursor sobre cada `.glass` como variables CSS
 * (`--mx`, `--my`) para que el halo de la tarjeta lo siga. Un único listener.
 */
export function GlowTracker() {
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const card = target.closest<HTMLElement>(".glass");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  return null;
}
