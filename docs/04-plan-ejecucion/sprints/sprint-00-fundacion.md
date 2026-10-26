# Sprint 0 — Fundación técnica y landing pública

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completado |
| **Cerrado** | 2026-10-26 |
| **Depende de** | — |
| **Habilita** | S1 (identidad y acceso) |
| **Rama / commit** | `main` (repositorio sin commits todavía) |

---

## 1. Objetivo

Dejar un monorepo ejecutable y verificable donde el currículo ya sea visible: contratos compartidos, API con observabilidad mínima y landing pública que explique la ruta de 12 etapas, 4 niveles y las competencias C1–C14.

---

## 2. Alcance ejecutado

| ID | Tarea | Entregable | Estado |
|----|-------|------------|--------|
| S0-T1 | Monorepo npm workspaces | `package.json`, `tsconfig.base.json`, `.editorconfig`, `.gitignore`, `.env.example`, `docker-compose.yml` (Postgres reservado) | ✅ |
| S0-T2 | Contratos compartidos | `packages/shared`: enums (`role`, `exercise`), constantes (errores, paginación), esquemas Zod (`auth`, `common`, `health`) y pruebas | ✅ |
| S0-T3 | Bootstrap NestJS | `apps/api`: `loadEnv` validado, prefijo `/api`, CORS, `ValidationPipe`, Swagger en `/api/docs` | ✅ |
| S0-T4 | Observabilidad y errores | `TraceIdMiddleware` (`x-trace-id`) + `AllExceptionsFilter` con el formato único de `contratos-api.md` §2 | ✅ |
| S0-T5 | Módulo `health` | `GET /api/health` con contrato `HealthResponse` compartido | ✅ |
| S0-T6 | Landing pública | `apps/web`: Next.js 14 + Tailwind, secciones Hero, niveles, ruta, método, competencias, "no es esto", CTA | ✅ |
| S0-T7 | Pruebas y verificación | Vitest en los 3 workspaces, Testing Library con limpieza explícita, build de producción | ✅ |

### Contenido de la landing

- 12 etapas organizadas en 4 niveles, con horas orientativas y competencias asociadas.
- Competencias obligatorias **C1–C10** y línea avanzada **C11–C14** (etapas 9–10).
- Mensaje central: la IA es herramienta **y** objeto de estudio; no se delega la comprensión.

---

## 3. Fuera de alcance (a propósito)

- Autenticación, base de datos y Prisma (S1–S2).
- Laboratorio de código, sandbox e IA (S5–S8).
- CI/CD y despliegue (S11).
- Contenido de lecciones: la landing describe la ruta, no la imparte.

---

## 4. Criterios de aceptación

- [x] `npm install` funciona desde cero con workspaces (`apps/*`, `packages/*`).
- [x] `@codeai/shared` compila antes que sus consumidores (scripts `pre*`).
- [x] `GET /api/health` responde 200 con `status`, `service`, `version`, `uptimeSeconds`, `timestamp`.
- [x] Toda respuesta de error cumple `{ error: { code, message, details?, traceId } }`.
- [x] Cada petición devuelve cabecera `x-trace-id` (reutiliza la entrante si es válida).
- [x] La landing renderiza sin JavaScript de cliente para el contenido principal.
- [x] `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan en los 3 workspaces.

---

## 5. Verificación ejecutada

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ 0 errores en `shared`, `api` y `web` |
| `npm run lint` | ✅ 0 warnings (`eslint --max-warnings 0`, `next lint --max-warnings 0`) |
| `npm test` | ✅ 37 pruebas: `shared` 19, `api` 10, `web` 8 |
| `npm run build` | ✅ `nest build` + `next build` (landing estática) |
| `next start` + `GET /` | ✅ 200 y contenido esperado (H1 y ruta de 12 etapas) |

---

## 6. Decisiones y hallazgos

| Decisión | Motivo |
|----------|--------|
| npm workspaces (sin Turborepo/Nx) | Menos capas para un equipo pequeño; `npm` ya es el gestor |
| Zod como contrato único en `shared` | Evita duplicar tipos entre web y API; el mismo esquema valida en ambos lados |
| `loadEnv` con Zod al arrancar | Un proceso no debe iniciar con configuración inválida |
| `WEB_ORIGIN` exige `http(s)` | `z.string().url()` acepta `localhost:3000` (lo interpreta como esquema); se detectó con una prueba y se corrigió con `refine` |
| Filtro global de errores | Los agentes y el frontend dependen de una forma estable; nunca se expone stack |
| Vitest en los 3 workspaces | Un solo runner, configuración simple, rápido |
| `vitest.config.mts` | El paquete es ESM (`"type": "module"`); `.ts` se cargaba como CJS y fallaba |
| `afterEach(cleanup)` explícito | Testing Library desactiva su auto-limpieza sin `globals`; sin esto los tests se contaminaban |
| Import de valor en `health.controller.ts` | Nest resuelve DI por `design:paramtypes`; `import type` lo convertiría en `Object`. Excepción documentada de `consistent-type-imports` |

---

## 7. Deuda conocida

| Deuda | Impacto | Cuándo se paga | Estado (2026-10-26) |
|-------|---------|----------------|---------------------|
| Repositorio sin commits ni CI | No hay historial ni verificación automática | Antes de S1 | 🔄 historial creado (`85652f0`); CI sigue pendiente (S11) |
| Sin Prisma ni migraciones | `db:*` reservados pero inoperativos | S2 | ✅ pagada en S1: `schema.prisma` + migración `init_identity` |
| Sin pruebas E2E ni de accesibilidad automatizadas | Cobertura de integración baja | S3 | ⬜ pendiente |
| `details` del error sin `field` en validaciones de Nest | El contrato admite `field` opcional | S1 | ✅ pagada en S1 (S1-T5) |
| Sin rate limiting | Riesgo de abuso en auth | S1 | ✅ pagada en S1 (S1-T10) |
| `docs/06-plantillas/` sin contenido | Plantillas de lección/ejercicio pendientes | Antes de producir contenido | ✅ lección y ejercicio disponibles · ⬜ ADR prevista |

---

## 8. Siguiente paso

> ✅ **Cumplido:** S1 se redactó y cerró el 2026-10-26; ver [`sprint-01-auth.md`](sprint-01-auth.md). El siguiente sprint es **S2 — Modelo de datos y API de contenido** (⏳).
>
> *Instrucción original (histórica):* redactar la ficha **S1-T1** (Prisma + modelo de usuario, o bootstrap de `auth` según decisión del Orquestador) y abrir el sprint S1 en [`roadmap-sprints.md`](../roadmap-sprints.md).

---

## Documentos relacionados

- [`../roadmap-sprints.md`](../roadmap-sprints.md)
- [`../convenciones-codigo.md`](../convenciones-codigo.md)
- [`../../03-arquitectura/contratos-api.md`](../../03-arquitectura/contratos-api.md)
- [`../../05-orquestacion/plantilla-tarea.md`](../../05-orquestacion/plantilla-tarea.md)
