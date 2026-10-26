# Stack tecnológico

> Versiones, decisiones y justificación. Toda dependencia nueva debe justificarse aquí antes de entrar al proyecto.

---

## 1. Resumen por capa

| Capa | Tecnología | Versión objetivo |
|------|-----------|------------------|
| Runtime | Node.js | 20 LTS o superior (entorno actual: v24) |
| Gestor de paquetes | npm (workspaces) | 10+ |
| Frontend | Next.js (App Router) | 14.x |
| UI | React | 18.x |
| Lenguaje | TypeScript | 5.x (strict) |
| Estilos | Tailwind CSS | 3.x |
| Estado servidor | TanStack Query | 5.x |
| Estado cliente | Zustand | 4.x |
| Editor de código | Monaco Editor | última estable |
| Backend | NestJS | 10.x |
| ORM | Prisma | 5.x |
| Base de datos | PostgreSQL | 16.x |
| Validación | Zod (shared) + class-validator (api) | 3.x |
| Autenticación | JWT (`@nestjs/jwt`) + bcrypt | — |
| Documentación API | Swagger (`@nestjs/swagger`) | — |
| Pruebas | Vitest + Testing Library + Supertest | — |
| Contenedores | Docker + docker-compose | — |

---

## 2. Justificación de las decisiones clave

### ¿Por qué Next.js en lugar de React + Vite?

| Criterio | Next.js | React + Vite |
|----------|---------|--------------|
| SEO de la landing pública | ✅ SSR/SSG nativo | ❌ requiere trabajo extra |
| Rendimiento inicial | ✅ streaming y RSC | ⚠️ CSR puro |
| Curva de aprendizaje | ⚠️ mayor | ✅ menor |
| Coherencia con el curso | ✅ enseña SSR y App Router (valor de mercado) | ✅ enseña SPA |

**Decisión:** Next.js. La landing pública necesita SEO para captar estudiantes, y el curso se beneficia de enseñar SSR.

### ¿Por qué NestJS separado?

- Coherencia pedagógica: la Etapa 5 del propio currículo enseña NestJS.
- Separación real de responsabilidades: la API no depende del framework de UI.
- Escalado independiente del frontend.
- La capa de IA y el sandbox necesitan procesos con configuración propia.

### ¿Por qué PostgreSQL?

- Transacciones ACID (necesarias para progreso y submissions).
- Búsqueda de texto (`tsvector`) útil para lecciones y recursos.
- Extensión `pgvector` disponible para la Etapa 9 (RAG).
- Es el motor que el currículo enseña.

### ¿Por qué Prisma?

- Migraciones versionadas y reproducibles.
- Tipado fuerte generado, que se comparte con `apps/web` a través de `shared`.
- Menos fricción que TypeORM para el equipo y para agentes de IA.

### ¿Por qué `packages/shared` con Zod?

- **Un solo contrato** para web y api evita la deriva más común en proyectos full-stack.
- Zod permite validar en runtime **y** derivar tipos en compilación.
- Facilita que cada tarea atómica de DeepSeek sepa exactamente qué tipo consumir o producir.

### ¿Por qué Vitest y no Jest?

- Más rápido, configuración nativa de ESM y TypeScript.
- Misma API que Jest (fácil migración si se necesita).

---

## 3. Estructura del monorepo

```
CodeAI Academy/
├── package.json                 # workspaces: apps/*, packages/*
├── tsconfig.base.json           # configuración TS compartida
├── docker-compose.yml           # postgres + servicios de desarrollo
├── .env.example
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── public/media/
│   │   └── src/
│   │       ├── app/             # App Router (rutas)
│   │       ├── components/      # componentes reutilizables
│   │       ├── features/        # módulos por dominio
│   │       ├── lib/             # cliente API, utils, hooks
│   │       └── styles/
│   └── api/
│       ├── package.json
│       ├── nest-cli.json
│       ├── tsconfig.json
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           └── modules/
│               ├── auth/
│               ├── users/
│               ├── content/
│               ├── exercises/
│               ├── progress/
│               ├── review/
│               ├── sandbox/
│               ├── ai/
│               ├── projects/
│               ├── interviews/
│               ├── analytics/
│               └── health/
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            ├── enums/
            ├── schemas/          # esquemas Zod
            ├── types/            # tipos derivados
            └── constants/
```

---

## 4. Scripts raíz (contrato de comandos)

```json
{
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "dev:web": "npm run dev -w apps/web",
    "dev:api": "npm run dev -w apps/api",
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "db:up": "docker compose up -d postgres",
    "db:down": "docker compose down",
    "db:migrate": "npm run db:migrate -w apps/api",
    "db:seed": "npm run db:seed -w apps/api",
    "db:reset": "npm run db:reset -w apps/api"
  }
}
```

> Estos comandos son el **contrato de verificación** de cada tarea atómica. Si `npm run typecheck && npm run lint && npm run test` no pasa, la tarea no está terminada.

---

## 5. Convenciones de TypeScript

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@codeai/shared": ["packages/shared/src/index.ts"],
      "@codeai/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

**Reglas:**
- `any` prohibido (usar `unknown` + narrowing).
- Sin `// @ts-ignore` sin justificación escrita al lado.
- Todo tipo exportado desde `shared` debe ser derivable de un esquema Zod.

---

## 6. Dependencias que NO se usarán (y por qué)

| Tecnología | Motivo del rechazo |
|------------|-------------------|
| Redux Toolkit | Exceso para el tipo de estado de esta app; Zustand + TanStack Query bastan |
| TypeORM | Prisma ofrece mejor tipado y migraciones más simples |
| Create React App | Obsoleto |
| Jest | Vitest es más rápido y compatible con ESM |
| CSS-in-JS pesado | Tailwind reduce superficie y mejora consistencia |
| SDK de IA específico en módulos de negocio | Rompería la intercambiabilidad de proveedor |

---

## 7. Variables de entorno

```bash
# apps/api
DATABASE_URL=postgresql://codeai:codeai@localhost:5432/codeai
JWT_SECRET=cambiar-en-produccion
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AI_PROVIDER=mock            # mock | openai | anthropic
AI_API_KEY=
AI_MONTHLY_BUDGET_USD=50
SANDBOX_MODE=mock           # mock | docker
SANDBOX_TIMEOUT_MS=5000
SANDBOX_MEMORY_MB=256
PORT=3001

# apps/web
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

> `.env` **nunca** se versiona. `.env.example` sí, con valores de desarrollo seguros.

---

## Documentos relacionados

- [`arquitectura-general.md`](arquitectura-general.md)
- [`modelo-datos.md`](modelo-datos.md)
- [`../04-plan-ejecucion/convenciones-codigo.md`](../04-plan-ejecucion/convenciones-codigo.md)

