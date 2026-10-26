# @codeai/web

Interfaz web de CodeAI Academy. Next.js 14 (App Router) + TypeScript + Tailwind CSS.

## Alcance actual (Sprint 0)

- Landing pública con la propuesta, los tres niveles de uso de IA, las 12 etapas
  agrupadas en 4 niveles, el método, las 10 competencias obligatorias (+4 de la
  ruta avanzada) y la delimitación del producto.
- Sin autenticación, sin consumo de la API y sin contenido dinámico: el texto
  proviene de `src/features/landing/data/`, que refleja la documentación.

## Estructura

```
src/
  app/                      layout raíz, página y estilos globales
  components/layout/        primitivas de maquetación (Container)
  components/ui/            primitivas visuales (SectionHeading)
  features/landing/
    components/             secciones de la landing
    data/                   contenido y ruta curricular tipados
  lib/                      utilidades sin dependencias
```

## Scripts

```bash
npm run dev        # http://localhost:3000
npm run build      # build de producción
npm run lint       # ESLint (next/core-web-vitals)
npm run typecheck  # tsc --noEmit
npm test           # Vitest + Testing Library (jsdom)
```

Los imports usan el alias `@/*` → `src/*`, configurado tanto en `tsconfig.json`
como en `vitest.config.ts`.

## Criterio de contenido

Toda afirmación de la landing debe poder rastrearse a `docs/`. Si un texto no
está respaldado por la documentación, se elimina o se corrige la documentación;
la landing no inventa promesas (empleo, duración exacta, certificaciones).
