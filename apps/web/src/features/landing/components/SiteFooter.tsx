import { Container } from "@/components/layout/Container";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/60 bg-ink-soft/40 py-10">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-mint font-mono text-xs font-bold text-ink"
            >
              CA
            </span>
            <span className="text-sm font-semibold text-white">
              CodeAI Academy
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Formación profesional para comprender, construir y auditar software
            asistido por IA.
          </p>
        </div>

        <nav aria-label="Enlaces del sitio" className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#ruta" className="text-sm text-slate-400 hover:text-white">
            Ruta
          </a>
          <a href="#metodo" className="text-sm text-slate-400 hover:text-white">
            Método
          </a>
          <a
            href="#competencias"
            className="text-sm text-slate-400 hover:text-white"
          >
            Competencias
          </a>
          <a href="#no-es" className="text-sm text-slate-400 hover:text-white">
            Qué no es
          </a>
        </nav>
      </Container>

      <Container className="mt-8 border-t border-line/60 pt-6">
        <p className="text-xs text-slate-600">
          © 2026 CodeAI Academy · La documentación es la fuente de verdad del
          producto.
        </p>
      </Container>
    </footer>
  );
}
