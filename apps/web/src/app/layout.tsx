import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/features/landing/components/SiteFooter";
import { SiteHeader } from "@/features/landing/components/SiteHeader";

import "./globals.css";

const DESCRIPTION =
  "Formación profesional en desarrollo de software con IA: 12 etapas, 4 niveles y 10 competencias obligatorias para comprender, construir, probar, desplegar y auditar aplicaciones asistidas por IA.";

export const metadata: Metadata = {
  title: {
    default: "CodeAI Academy — Desarrollo de software con IA, con criterio",
    template: "%s · CodeAI Academy",
  },
  description: DESCRIPTION,
  applicationName: "CodeAI Academy",
  keywords: [
    "desarrollo de software",
    "inteligencia artificial",
    "formación profesional",
    "full-stack",
    "ingeniería de software",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "CodeAI Academy",
    title: "CodeAI Academy — Desarrollo de software con IA, con criterio",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  colorScheme: "dark",
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="flex min-h-screen flex-col bg-ink font-sans text-slate-100 antialiased">
        <a
          href="#inicio"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
