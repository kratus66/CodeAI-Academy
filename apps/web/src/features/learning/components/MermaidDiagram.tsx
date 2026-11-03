"use client";

import { useEffect, useId, useState } from "react";

interface MermaidDiagramProps {
  /** Sintaxis Mermaid del diagrama. */
  readonly code: string;
  /** Texto alternativo: lo que el diagrama explica, para quien no lo ve. */
  readonly title?: string;
}

type RenderState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly svg: string }
  | { readonly status: "failed" };

/**
 * Diagrama Mermaid de una lección. `mermaid` se importa de forma diferida: solo
 * las lecciones con diagramas pagan su peso. Mientras carga, y si la sintaxis es
 * inválida, se muestra el código fuente en un `<pre>`; la lección nunca se rompe.
 * `securityLevel: "strict"` hace que Mermaid sanee el SVG antes de insertarlo.
 */
export function MermaidDiagram({ code, title }: MermaidDiagramProps) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [state, setState] = useState<RenderState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function draw(): Promise<void> {
      try {
        const { default: mermaid } = await import("mermaid");
        const light = document.documentElement.getAttribute("data-theme") === "light";

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: light ? "default" : "dark",
        });

        const { svg } = await mermaid.render(id, code);

        if (!cancelled) setState({ status: "ready", svg });
      } catch {
        if (!cancelled) setState({ status: "failed" });
      }
    }

    void draw();

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  return (
    <figure className="space-y-2">
      {title ? (
        <figcaption className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {title}
        </figcaption>
      ) : null}

      {state.status === "ready" ? (
        <div
          role="img"
          aria-label={title ?? "Diagrama"}
          className="overflow-x-auto rounded-xl border border-line/70 bg-ink-card px-4 py-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : (
        <pre className="overflow-x-auto whitespace-pre rounded-xl border border-line/70 bg-ink-card px-4 py-3 font-mono text-xs text-slate-300">
          {code}
        </pre>
      )}
    </figure>
  );
}
