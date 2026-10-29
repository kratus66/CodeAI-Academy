"use client";

import type { SandboxLanguage } from "@codeai/shared";
import dynamic from "next/dynamic";
import { Component, useId } from "react";
import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Editor de código del laboratorio (S5-T12).
 *
 * Monaco pesa varios MB y toca `window` al importarse, así que se carga con
 * `next/dynamic` y `ssr: false`: nunca entra en el bundle del servidor. La
 * reserva accesible es un `<textarea>` monoespaciado que se pinta mientras el
 * chunk viaja y siempre que Monaco no llegue a cargar, de modo que escribir
 * código nunca depende de la red.
 */

/** Idioma de Monaco por lenguaje del sandbox (`sandbox-ejecucion.md` §5). */
const MONACO_LANGUAGE: Record<SandboxLanguage, string> = {
  typescript: "typescript",
  javascript: "javascript",
  sql: "sql",
};

const SURFACE_WRAPPER_CLASSES =
  "overflow-hidden rounded-xl border border-line/70 bg-ink-card/60 focus-within:border-accent/50";

const TEXTAREA_CLASSES =
  "block w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";

const STATUS_CLASSES = "px-4 py-3 text-sm text-slate-400";

/** Props que toda superficie del editor debe aceptar (Monaco o `textarea`). */
export interface CodeSurfaceProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly language: SandboxLanguage;
  readonly label: string;
  readonly inputId: string;
  readonly minRows: number;
  readonly readOnly: boolean;
  readonly describedBy?: string;
}

export type CodeEditorLoader = () => Promise<ComponentType<CodeSurfaceProps>>;

/**
 * Reserva accesible: monoespaciada, sin corrector ortográfico y etiquetada por
 * el texto visible. Es la misma pieza en carga y en degradación, así que lo que
 * el estudiante escriba se conserva al llegar Monaco (el valor vive en la vista).
 */
function CodeTextarea({
  value,
  onChange,
  language,
  readOnly,
  inputId,
  minRows,
  describedBy,
  label,
}: CodeSurfaceProps) {
  return (
    <textarea
      id={inputId}
      aria-label={label}
      aria-describedby={describedBy}
      className={cn(TEXTAREA_CLASSES, "min-h-[16rem]")}
      data-language={language}
      rows={minRows}
      readOnly={readOnly}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * Monaco servido desde el bundle local (decisión de S5-T12: sin CDN). Se
 * configura el `loader` con el paquete `monaco-editor` antes de montar el
 * editor; el idioma se resuelve con `MONACO_LANGUAGE` para no acoplar el
 * contrato a los identificadores de Monaco.
 */
export async function loadMonacoSurface(): Promise<
  ComponentType<CodeSurfaceProps>
> {
  const [{ default: Editor, loader }, monaco] = await Promise.all([
    import("@monaco-editor/react"),
    // Sólo el API del editor (sin `editor.main`): los servicios de lenguaje y
    // sus workers quedan fuera; S5 necesita escribir y resaltar, no IntelliSense.
    // Con `monaco-editor` 0.51 el worker se resuelve con `MonacoEnvironment` y,
    // si no existe, Monaco cae al hilo principal en vez de romper el build.
    import("monaco-editor/esm/vs/editor/editor.api"),
    // Tokenizadores básicos (typescript, javascript, sql): color sin workers.
    import("monaco-editor/esm/vs/basic-languages/monaco.contribution"),
  ]);

  loader.config({ monaco });

  return function MonacoCodeSurface({
    value,
    onChange,
    language,
    readOnly,
    label,
    describedBy,
    minRows,
  }: CodeSurfaceProps) {
    return (
      <div aria-describedby={describedBy} aria-label={label} role="group">
        <Editor
          height={`${Math.max(minRows, 8) * 1.7}rem`}
          language={MONACO_LANGUAGE[language]}
          loading={<p className={STATUS_CLASSES}>Cargando el editor…</p>}
          options={{
            ariaLabel: label,
            readOnly,
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "none",
          }}
          theme="vs-dark"
          value={value}
          onChange={(next: string | undefined) => onChange(next ?? "")}
        />
      </div>
    );
  };
}

/** Monaco en su propio chunk: si el import falla, el límite muestra la reserva. */
const MonacoCodeEditor = dynamic(() => loadMonacoSurface(), {
  ssr: false,
  loading: () => (
    <p role="status" aria-live="polite" className={STATUS_CLASSES}>
      Cargando el editor…
    </p>
  ),
});

interface SurfaceBoundaryProps {
  readonly fallback: ReactNode;
  readonly children: ReactNode;
}

interface SurfaceBoundaryState {
  readonly failed: boolean;
}

/** Un chunk inalcanzable no puede dejar al estudiante sin editor. */
class SurfaceBoundary extends Component<
  SurfaceBoundaryProps,
  SurfaceBoundaryState
> {
  override state: SurfaceBoundaryState = { failed: false };

  static getDerivedStateFromError(): SurfaceBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface CodeEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly language: SandboxLanguage;
  readonly label: string;
  readonly description?: string;
  readonly readOnly?: boolean;
  readonly minRows?: number;
  readonly id?: string;
  /**
   * Superficie inyectable. `undefined` monta Monaco; `null` fuerza la reserva
   * (pruebas de degradación y vistas que no pueden pagar el chunk).
   */
  readonly surface?: ComponentType<CodeSurfaceProps> | null;
}

/** Etiqueta visible, descripción opcional y superficie de edición. */
export function CodeEditor({
  value,
  onChange,
  language,
  label,
  description,
  readOnly = false,
  minRows = 12,
  id,
  surface,
}: CodeEditorProps) {
  const generatedId = useId();
  const inputId = id ?? `code-editor${generatedId}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const Surface = surface === undefined ? MonacoCodeEditor : surface;

  const fallback = (
    <CodeTextarea
      value={value}
      onChange={onChange}
      language={language}
      label={label}
      inputId={inputId}
      minRows={minRows}
      readOnly={readOnly}
      describedBy={descriptionId}
    />
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="rounded-full border border-line/70 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.14em] text-slate-400">
          {language}
        </span>
      </div>

      {description ? (
        <p id={descriptionId} className="text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}

      <div className={SURFACE_WRAPPER_CLASSES}>
        <SurfaceBoundary fallback={fallback}>
          {Surface ? (
            <Surface
              value={value}
              onChange={onChange}
              language={language}
              label={label}
              inputId={inputId}
              minRows={minRows}
              readOnly={readOnly}
              describedBy={descriptionId}
            />
          ) : (
            fallback
          )}
        </SurfaceBoundary>
      </div>
    </div>
  );
}

