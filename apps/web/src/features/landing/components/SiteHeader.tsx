import { Container } from "@/components/layout/Container";

const NAVIGATION = [
  { href: "#ruta", label: "Ruta" },
  { href: "#metodo", label: "Método" },
  { href: "#competencias", label: "Competencias" },
  { href: "#no-es", label: "Qué no es" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <a
          href="#inicio"
          className="group flex items-center gap-3"
          aria-label="CodeAI Academy, ir al inicio"
        >
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-mint font-mono text-sm font-bold text-ink"
          >
            CA
          </span>
          <span className="hidden items-baseline gap-1.5 sm:flex">
            <span className="text-sm font-semibold tracking-tight text-white">
              CodeAI
            </span>
            <span className="text-sm font-medium text-slate-400 transition group-hover:text-slate-300">
              Academy
            </span>
          </span>
        </a>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-8 md:flex"
        >
          {NAVIGATION.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href="#ruta"
          className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          Explorar la ruta
          <span aria-hidden>→</span>
        </a>
      </Container>
    </header>
  );
}
