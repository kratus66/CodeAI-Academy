"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroScene3D = dynamic(() => import("./HeroScene3D"), { ssr: false });

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Carga la escena 3D solo en pantallas anchas y con WebGL. El resto del sitio
 * y los móviles no descargan `three` ni pagan su coste.
 */
export function HeroScene() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setEnabled(query.matches && supportsWebGl());
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <HeroScene3D />
    </div>
  );
}
