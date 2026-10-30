"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { highlightCode } from "@/lib/highlight";

const LINK_CLASSES =
  "text-xs font-medium text-accent underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const BUTTON_CLASSES =
  "inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

type CopyState = "idle" | "copied" | "error";

const COPY_MESSAGE: Record<CopyState, string> = {
  idle: "",
  copied: "Código copiado al portapapeles",
  error: "No pudimos copiar el código. Selecciónalo y cópialo a mano.",
};

interface CodeBlockProps {
  readonly code: string;
  readonly language?: string;
  /** Destino del atajo al laboratorio; sin él no se ofrece el enlace. */
  readonly labHref?: string;
}

/**
 * Bloque de código con resaltado y botón de copiar. El HTML llega ya resaltado
 * desde el servidor (`@/lib/highlight`), así que aquí no se carga ningún
 * resaltador; si el lenguaje no está soportado se muestra el texto plano.
 */
export function CodeBlock({ code, language, labHref }: CodeBlockProps) {
  const [highlighted, setHighlighted] = useState<{
    readonly requestKey: string;
    readonly html: string | null;
  } | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const languageId = useId();
  const label = language ?? "texto";
  const requestKey = `${label}\u0000${code}`;
  // Derivado, no estado: al cambiar el bloque nunca se pinta el HTML anterior.
  const html = highlighted?.requestKey === requestKey ? highlighted.html : null;

  useEffect(() => {
    if (!language) {
      return;
    }

    let active = true;

    highlightCode(code, language)
      .then((result) => {
        if (active) {
          setHighlighted({ requestKey, html: result });
        }
      })
      .catch(() => {
        // Sin resaltado: el texto plano ya está en pantalla como respaldo.
      });

    return () => {
      active = false;
    };
  }, [code, language, requestKey]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line/70 bg-ink-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-2">
        <span id={languageId} className="font-mono text-xs text-slate-400">
          {label}
        </span>
        <div className="flex items-center gap-3">
          {labHref ? (
            <Link href={labHref} className={LINK_CLASSES}>
              Abrir en el laboratorio <span aria-hidden>→</span>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            aria-describedby={languageId}
            className={BUTTON_CLASSES}
          >
            {copyState === "copied" ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      {html ? (
        <div
          // Shiki escapa el código y solo emite `pre`, `code` y `span` con estilos.
          className="overflow-x-auto px-4 py-3 text-sm [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto px-4 py-3 text-sm text-slate-200">
          <code>{code}</code>
        </pre>
      )}

      <p
        role="status"
        aria-live="polite"
        className={
          copyState === "idle"
            ? "sr-only"
            : `px-4 pb-2 text-xs ${copyState === "error" ? "text-rose-200" : "text-emerald-200"}`
        }
      >
        {COPY_MESSAGE[copyState]}
      </p>
    </div>
  );
}
