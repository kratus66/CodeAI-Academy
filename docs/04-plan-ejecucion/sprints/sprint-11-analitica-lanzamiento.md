# Sprint 11 — Analítica, rendimiento y lanzamiento

> **Estado:** 🔄 abierto (14/16 tareas; T15 y la firma del checklist bloqueados, ver §9) · **Duración prevista:** 5–6 sesiones · **Depende de:** S4 y S7 (progreso y repaso), S6 (envíos con `outcome` y `errorCategory`), S8 (auditoría de IA), S9 (proyectos), S10 (entrevistas) y S1–S3 (sesión, contenido, usuarios).
> **Avance:** 14/16 tareas · 13/15 criterios de aceptación (2026-10-29). Abiertos: criterio 12 (checklist de producción: el sandbox `docker` no tiene adaptador) y la compilación de las imágenes (sin red dentro de Docker en este entorno).
> **Sesión por tarea:** cada tarea se implementa y verifica en una invocación aislada de comandos; su salida real queda en la bitácora §9.
> **Por qué este sprint existe:** los diez sprints anteriores construyen producto; este lo vuelve operable. Sin métricas no se puede saber si el curso funciona, sin `ready` no se puede desplegar y las dependencias aceptadas en `seguridad-dependencias.md` se pagan aquí o no se pagan nunca.

---

## 1. Objetivo

Al cerrar el sprint, el estudiante ve su progreso real y sus errores frecuentes en una pantalla propia, el instructor ve la cohorte sin datos personales innecesarios, la API responde `ready` con el estado de sus dependencias, el catálogo de contenido se sirve con caché medible, el sistema deja trazas correlacionadas y el proyecto se puede desplegar y **restaurar** con un runbook probado. Las dependencias con avisos críticos de producción quedan actualizadas o con una justificación escrita y verificada.

## 2. Alcance

**Incluye**

- Contrato compartido `analytics`: resumen personal, categorías de error, agregados de cohorte y estado de dependencias de `ready`.
- Puerto `AnalyticsRepository` con agregados en SQL (`groupBy`, `count`, `avg`), adaptador Prisma y uno en memoria para pruebas.
- `GET /api/analytics/me/summary`, `GET /api/analytics/me/errors` y `GET /api/analytics/cohort` (este último con `RolesGuard`: `INSTRUCTOR`/`ADMIN`).
- Web: pantalla `/learn/insights` con progreso, competencias y errores frecuentes; panel `/instructor/cohort` con la cohorte.
- Caché en memoria con TTL para el catálogo de contenido, con invalidación por versión y medición antes/después.
- `GET /api/health/ready` separado del `health` de S0, con comprobación de base de datos y timeout corto.
- Logs estructurados con `traceId`, ruta, estado y duración; aviso `SLOW_REQUEST` por encima del umbral.
- Actualización de las dependencias críticas de producción (`next`) y de la cadena de desarrollo (`vitest`/`vite`), con verificación funcional.
- Respaldos: script `db:backup`, script `db:restore` y simulacro de restauración documentado.
- Despliegue: `docker-compose.prod.yml`, `Dockerfile` multi-etapa para API y web, checklist de producción y runbook.
- Documentación: `contratos-api.md` §4.8 y §4.9, `arquitectura-general.md` §7 (entornos), `seguridad-dependencias.md` (estado final) y `README.md`.

**No incluye**

- Herramientas de terceros de analítica (PostHog, Metabase, Grafana). S11 entrega **las consultas y las pantallas**; montar un almacén externo es una decisión de infraestructura posterior.
- Alertas automáticas al 80 % del presupuesto de IA (deuda de S8): aquí solo se expone el dato.
- Instrumentación de tiempo de permanencia (§3.1).

**Fuera de alcance explícito**

- Sustituir `RateLimitGuard` en memoria por Redis. Sigue siendo deuda declarada de S5–S7 y S8; con una sola instancia no cambia el resultado.

## 3. Decisiones de diseño

**3.1 Se mide lo que existe; no se inventan datos.** El contrato original de `contratos-api.md` §4.8 prometía «progreso, **tiempo**, errores frecuentes», pero el producto nunca ha guardado tiempo de permanencia: no hay tabla de eventos ni campo `timeSpent` en `LessonProgress`. Inventar minutos a partir de `updatedAt` daría cifras falsas con apariencia de precisión. El resumen reporta **actividad** (días activos en los últimos 30, última actividad, unidades dominadas, envíos, repasos y consumo de IA) y la instrumentación de tiempo real queda declarada en §8 como deuda con su propio sprint. La documentación se corrige en T15 para que el contrato y el código digan lo mismo.

**3.2 Los agregados se calculan en la base, no en JavaScript.** `AnalyticsRepository` recibe el rango de fechas y devuelve filas ya agrupadas; el servicio solo compone porcentajes. Traer todos los envíos de un estudiante para contarlos en memoria funciona con 200 filas y se cae con 200 000. Cuando una consulta no se puede expresar con el cliente Prisma (`groupBy` con dos campos, por ejemplo), se usa `$queryRaw` parametrizado, nunca interpolación de cadenas.

**3.3 La cohorte lleva lo justo: sin correo, sin transcripciones, sin respuestas.** Un instructor necesita saber **a quién** ayudar; por eso `atRisk[]` incluye `userId` y nombre visible. Lo que no sale nunca es el correo, el hash de contraseña, la transcripción de una entrevista (S10 §3.4) ni el contenido de un envío. La regla se prueba con una aserción sobre el JSON serializado completo, no sobre los campos que se recuerdan.

**3.4 La caché caduca por versión, no solo por reloj.** El catálogo de contenido cambia cuando un administrador siembra o edita, no cada minuto. `ContentCache` guarda por `contentVersion` (entero que incrementa toda mutación de contenido) con TTL de 60 s como red de seguridad: un cambio se ve al instante y una consulta repetida no toca la base. Se mide con un contador de aciertos expuesto en el log de arranque, no con una corazonada.

**3.5 `ready` no es `health`.** `GET /api/health` (S0) dice «el proceso vive». `GET /api/health/ready` dice «puedo atender»: comprueba la base con un `SELECT 1` y timeout de 2 s y responde `503` con la lista de dependencias caídas, sin cadenas de conexión, sin usuario y sin host. Un orquestador necesita distinguir ambos casos: reiniciar un proceso vivo pero sin base solo empeora la caída.

**3.6 La traza se propaga, no se reconstruye.** El `x-trace-id` que S1 puso en las respuestas pasa a un interceptor que lo inyecta en cada línea de log junto a método, ruta normalizada (sin ids), estado y duración. Con `LOG_LEVEL=info` no se registra ningún cuerpo de petición ni correo; con `debug` tampoco, porque el interceptor no los tiene a mano. Un `SLOW_REQUEST` supera los 500 ms (1500 ms en rutas que llaman a la IA).

**3.7 Las dependencias aceptadas se pagan con verificación, no con fe.** `next@14.2.35` tiene un aviso crítico cuyo arreglo es `next@16`; posponerlo otra vez convierte la aceptación en deuda permanente. T11 lo actualiza con una lista de comprobación explícita (build, `typecheck`, arranque, rutas principales, `middleware`/`rewrites` inexistentes, sin `next/image` remoto) y **revierte** con justificación escrita si algo se rompe: un árbol roto no es una actualización. La cadena de desarrollo (`vitest`/`vite`) va en T12, con menos riesgo porque no se despliega.

**3.8 Un respaldo que no se ha restaurado no es un respaldo.** T13 entrega `npm run db:backup` ( `pg_dump` a `backups/<fecha>.sql.gz`, fuera del volumen de datos) y `npm run db:restore <archivo>` contra una base desechable, más el simulacro: restaurar el respaldo del día anterior en `codeai_restore_test`, contar filas de tres tablas y comparar. Sin ese simulacro, la tarea no se cierra.

---

## 4. Contrato

### 4.1 Tipos compartidos (`packages/shared/src/schemas/analytics.ts`)

```ts
export const ANALYTICS_RANGES = ["7d", "30d", "90d", "all"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export interface StudentSummary {
  range: AnalyticsRange;
  overallPct: number;                 // 0..100, media ponderada por etapa
  activeDays: number;                 // días con al menos un envío o repaso en el rango
  lastActivityAt: string | null;
  units: { mastered: number; inProgress: number; needsReview: number; locked: number; total: number };
  submissions: { total: number; passed: number; failed: number; avgScore: number | null };
  reviews: { due: number; completed: number; lapses: number };
  ai: { calls: number; costUsd: number; budgetLevel: "ok" | "warning" | "exceeded" };
}

export interface ErrorBreakdown {
  range: AnalyticsRange;
  total: number;
  byCategory: { category: string; count: number; share: number }[];  // ordenado desc.
  byConcept: { conceptSlug: string; conceptName: string; count: number }[];
}

export interface CohortAnalytics {
  range: AnalyticsRange;
  students: { total: number; active: number };   // activo = envío o repaso en el rango
  avgOverallPct: number;
  stageCompletion: { stage: string; completedPct: number; studentsAtStage: number }[];
  topErrors: { category: string; count: number; share: number }[];
  reviewBacklog: number;
  atRisk: { userId: string; displayName: string; overallPct: number; daysSinceActivity: number }[];
}

export interface ReadinessResponse {
  status: "ready" | "degraded";
  checks: { name: "database"; ok: boolean; latencyMs: number }[];
  version: string;
  timestamp: string;
}
```

### 4.2 Rutas

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `GET` | `/api/analytics/me/summary?range=30d` | ✅ | cualquiera | Resumen propio; `userId` del token |
| `GET` | `/api/analytics/me/errors?range=30d` | ✅ | cualquiera | Errores propios por categoría y concepto |
| `GET` | `/api/analytics/cohort?range=30d` | ✅ | 🎓 `INSTRUCTOR`/`ADMIN` | Agregados de cohorte |
| `GET` | `/api/health/ready` | — | — | `200` listo · `503` no listo |

`range` por defecto `30d`; un valor fuera de `ANALYTICS_RANGES` devuelve `400 VALIDATION_ERROR` con `details.field = "range"`.

### 4.3 Ejemplo

```jsonc
// GET /api/analytics/me/summary?range=30d
{
  "range": "30d",
  "overallPct": 62,
  "activeDays": 11,
  "lastActivityAt": "2026-10-27T21:12:04.000Z",
  "units": { "mastered": 9, "inProgress": 2, "needsReview": 1, "locked": 14, "total": 26 },
  "submissions": { "total": 34, "passed": 21, "failed": 13, "avgScore": 71.4 },
  "reviews": { "due": 12, "completed": 40, "lapses": 5 },
  "ai": { "calls": 18, "costUsd": 0.42, "budgetLevel": "ok" }
}
```

```jsonc
// GET /api/health/ready → 503
{
  "status": "degraded",
  "checks": [{ "name": "database", "ok": false, "latencyMs": 2001 }],
  "version": "0.1.0",
  "timestamp": "2026-10-28T09:00:00.000Z"
}
```

### 4.4 Reglas de respuesta

- `cohort` **nunca** incluye `email`, `passwordHash`, `transcript`, `content` de envíos ni `repoUrl`; la prueba lo verifica sobre el JSON serializado completo.
- `atRisk` se limita a 20 filas ordenadas por `daysSinceActivity` desc.; el resto se resume en `reviewBacklog`.
- `ready` no incluye `DATABASE_URL`, host, usuario ni mensaje de error del motor; solo `ok` y `latencyMs`.
- Todo listado respeta la paginación común de `contratos-api.md` §3 cuando aplica (`atRisk` es la excepción documentada).

### 4.5 Códigos de error nuevos

| Código | HTTP | Cuándo |
|--------|------|--------|
| `INVALID_RANGE` | 400 | `range` fuera del catálogo |
| `SERVICE_NOT_READY` | 503 | Comprobación de dependencia fallida en `ready` |

---

## 5. Tareas

| # | Tarea | Archivos (≤ 4 por tarea) | Verificación |
|---|-------|--------------------------|--------------|
| **T1** | Contrato compartido `analytics`: rangos, resumen, desglose de errores, cohorte y `ready` | `packages/shared/src/schemas/analytics.ts`, `packages/shared/src/index.ts`, `packages/shared/src/schemas/analytics.spec.ts` | `npm run test -w @codeai/shared` |
| **T2** | Puerto `AnalyticsRepository` con agregados en SQL (unidades, envíos, repasos, IA por rango) y adaptador en memoria con datos de fixture | `apps/api/src/modules/analytics/analytics.repository.ts`, `…/prisma-analytics.repository.ts`, `…/in-memory-analytics.repository.ts` | `npm run test -w @codeai/api` |
| **T3** | `AnalyticsService.getSummary` y `getErrors`: rango validado, porcentajes calculados una sola vez, `userId` del token | `apps/api/src/modules/analytics/analytics.service.ts`, `…/analytics.service.spec.ts` | `npm run test -w @codeai/api` |
| **T4** | `AnalyticsService.getCohort`: agregados, `atRisk` limitado a 20, sin PII innecesaria (aserción sobre el JSON completo) | `…/analytics.service.ts`, `…/analytics.service.spec.ts` | `npm run test -w @codeai/api` |
| **T5** | `AnalyticsController` (3 rutas con `JwtAuthGuard` y `RolesGuard` en cohorte), `AnalyticsModule` y registro en `AppModule` | `apps/api/src/modules/analytics/analytics.controller.ts`, `…/analytics.module.ts`, `apps/api/src/app.module.ts` | `npm run test -w @codeai/api` + `npm run build -w @codeai/api` |
| **T6** | `analyticsApi` en el cliente web (resumen, errores, cohorte) con `400`/`403` tipados | `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/api-client.spec.ts` | `npm run test -w @codeai/web` |
| **T7** | `StudentInsights`: progreso por etapa, competencias y errores frecuentes con estado vacío explicativo; página `/learn/insights` | `apps/web/src/features/analytics/components/StudentInsights.tsx`, `…/StudentInsights.spec.tsx`, `apps/web/src/app/(learning)/learn/insights/page.tsx` | `npm run test -w @codeai/web` |
| **T8** | `CohortDashboard`: KPIs, avance por etapa, errores más frecuentes y lista de riesgo; página `/instructor/cohort` con guarda por rol | `…/components/CohortDashboard.tsx`, `…/CohortDashboard.spec.tsx`, `apps/web/src/app/(instructor)/instructor/cohort/page.tsx` | `npm run test -w @codeai/web` |
| **T9** | `GET /api/health/ready`: comprobación de base con timeout de 2 s, `503` sin filtrar detalles, contrato compartido | `apps/api/src/health/health.controller.ts`, `…/health.controller.spec.ts`, `packages/shared/src/schemas/analytics.ts` | `npm run test -w @codeai/api` |
| **T10** | `ContentCache` con TTL de 60 s e invalidación por `contentVersion` en las mutaciones de contenido; contador de aciertos en el log | `apps/api/src/modules/content/content-cache.ts`, `…/content-cache.spec.ts`, `…/content.service.ts` | `npm run test -w @codeai/api` |
| **T11** | Interceptor de traza: `x-trace-id`, `durationMs`, ruta normalizada sin ids, `SLOW_REQUEST` > 500 ms (> 1500 ms con IA) y `LOG_LEVEL` respetado | `apps/api/src/common/interceptors/trace.interceptor.ts`, `…/trace.interceptor.spec.ts`, `apps/api/src/app.module.ts` | `npm run test -w @codeai/api` |
| **T12** | Actualización de `next` a la versión sin avisos críticos con lista de comprobación (`build`, arranque, rutas principales) o reversión documentada | `apps/web/package.json`, `package-lock.json`, `docs/03-arquitectura/seguridad-dependencias.md` | `npm run build -w @codeai/web` + `npm audit --omit=dev` |
| **T13** | Actualización de la cadena de pruebas (`vitest`/`vite`) y ajuste de configuración si cambia la API del runner | `package.json`, `vitest.config.ts` compartido de cada workspace, `package-lock.json` | `npm test` en la raíz |
| **T14** | Respaldos: `npm run db:backup`, `npm run db:restore` y simulacro de restauración en base desechable | `scripts/db-backup.mjs`, `scripts/db-restore.mjs`, `package.json`, `docs/05-orquestacion/runbook-operacion.md` | restauración + conteo de filas en tres tablas |
| **T15** | Despliegue: `Dockerfile` multi-etapa por app, `docker-compose.prod.yml`, checklist de producción (secretos, cookies `Secure`, `WEB_ORIGIN` HTTPS, `SANDBOX_MODE=docker`) | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.prod.yml`, `docs/03-arquitectura/arquitectura-general.md` | `docker compose -f docker-compose.prod.yml config` |
| **T16** | Cierre documental y verificación HTTP: `contratos-api.md` §4.8/§4.9, `README.md`, `seguridad-dependencias.md` con el estado final y §10 completo | `docs/03-arquitectura/contratos-api.md`, `README.md`, `docs/03-arquitectura/seguridad-dependencias.md`, `docs/04-plan-ejecucion/roadmap-sprints.md` | `typecheck && lint && test && build` + §10 |

**Orden de ejecución.** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T15 → T16. T12 (actualización de `next`), T14 (respaldos) y T15 (despliegue) **requieren red y Docker con PostgreSQL**; si el entorno no los tiene, se ejecutan al final y el sprint queda abierto hasta cerrarlos (§7).

---

## 6. Criterios de aceptación

| # | Criterio (binario: se cumple o no) | Tarea |
|---|------------------------------------|-------|
| 1 | `@codeai/shared` exporta los 4 tipos y `ANALYTICS_RANGES`; el spec rechaza `range` inválido y porcentajes fuera de 0–100 | T1 |
| 2 | `me/summary` con el fixture de pruebas devuelve exactamente los números esperados (unidades, envíos, repasos, IA), no aproximaciones | T2 |
| 3 | Dos usuarios distintos obtienen resúmenes distintos y ninguno ve el del otro; `userId` nunca se lee del query | T3 |
| 4 | `me/errors` ordena por `count` desc. y las cuotas suman 1 (dentro de redondeo) | T3 |
| 5 | `cohort` sin rol devuelve `403`; con `INSTRUCTOR`, `200` | T5 |
| 6 | El JSON serializado de `cohort` no contiene `@`, `passwordHash`, `transcript`, `repoUrl` ni `content` | T4 |
| 7 | `atRisk` devuelve como máximo 20 filas y `reviewBacklog` cuenta el resto | T4 |
| 8 | `GET /api/health/ready` con base disponible devuelve `200` y `checks[0].latencyMs ≥ 0`; con doble de prueba que falla, `503` sin `DATABASE_URL` en el cuerpo | T9 |
| 9 | La segunda petición al catálogo no ejecuta la consulta a la base (contador en 1) y una mutación de contenido invalida la caché | T10 |
| 10 | Dos peticiones con el mismo `x-trace-id` generan líneas de log con ese id y `durationMs`; ninguna línea contiene correo ni cuerpo | T11 |
| 11 | `npm run db:backup` produce un archivo > 0 bytes y `db:restore` en base desechable reproduce el conteo de filas de tres tablas | T14 |
| 12 | `docker compose -f docker-compose.prod.yml config` termina con 0 y el checklist de producción está firmado con fecha | T15 |
| 13 | `npm audit --omit=dev` no reporta avisos críticos de producción, o cada uno está listado con su tarea de pago y fecha | T12, T16 |
| 14 | `npm test` en la raíz sigue verde tras actualizar `vitest`/`vite`; el total de pruebas no baja | T13 |
| 15 | `contratos-api.md` §4.8 y §4.9 describen lo implementado (incluida la ausencia de «tiempo» y su motivo) y §10 pasa completo | T16 |

---

## 7. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Las consultas agregadas son lentas con datos reales | Media | Medio | `groupBy` en base, rangos acotados, pruebas con 200 000 envíos sintéticos y umbral de 300 ms por consulta antes de cerrar T4 |
| La cohorte filtra datos personales | Media | Alto | Aserción sobre el JSON serializado completo; sin correo ni transcripciones; `atRisk` limitado y con nombre visible solo para instructor |
| `next@16` rompe el build o una ruta | Media | Alto | Lista de comprobación explícita antes del salto, sin `next/image` remoto ni Server Actions, y reversión con justificación escrita si falla |
| El entorno no tiene Docker: no se pueden probar despliegue ni restauración | **Alta** | Alto | T14/T15 quedan al final y bloquean el cierre; el resto del sprint (T1–T13) se puede completar y verificar sin Docker |
| Caché obsoleta tras sembrar contenido | Media | Medio | Invalidación por `contentVersion` además del TTL; prueba de que la mutación invalida |
| `ready` se usa como liveness y se reinicia un proceso sano | Baja | Medio | Dos rutas separadas y documentadas en §4 y en el runbook; `health` no toca dependencias |
| Los logs crecen sin control | Media | Bajo | Nivel configurable, sin cuerpos, rotación a cargo del entorno y `SLOW_REQUEST` como señal filtrable |
| Restauración lenta o incompleta | Media | Alto | Simulacro medido con tiempo y conteo de filas; el runbook declara el objetivo (RTO/RPO) aunque sea modesto |

---

## 8. Fuera de alcance (aplazado con motivo)

- **Tiempo de permanencia real.** Exige eventos de cliente o *heartbeat* por lección, tabla nueva y consentimiento; se declara como deuda y se sustituye por actividad (§3.1).
- **Alertas al 80 % del presupuesto de IA** (deuda de S8). El dato existe en `me/summary`; el envío de alertas requiere correo o webhooks.
- **Almacén de métricas externo** (Prometheus, OpenTelemetry, Grafana). S11 entrega logs correlacionados y `ready`; la integración es infraestructura.
- **Redis para caché y rate limiting.** Con una instancia el resultado es idéntico; la interfaz de caché ya es sustituible.
- **Analítica de cohortes históricas** (comparar promociones). Requiere modelo de cohorte por fecha de inscripción, que hoy no existe.
- **Cumplimiento formal** (RGPD, retención, borrado por solicitud). Se documenta el principio de minimización; el procedimiento legal no es un sprint de código.
- **Migraciones mayores que no desbloquean el lanzamiento:** `prisma@7` (cliente y CLI), `zod@4` (todos los contratos de `shared`) y `@nestjs/platform-express@12`. Cada una es una migración con su propia ficha; aquí solo se documenta el motivo y su mitigación en `seguridad-dependencias.md` §4.

---

## 9. Bitácora

| Tarea | Commit | Verificación ejecutada | Resultado real |
|-------|--------|------------------------|----------------|
| T1 | — | `npm run test -w @codeai/shared` | ✅ `analytics.spec.ts` 14 pruebas; rechaza `range` inválido y porcentajes fuera de 0–100 |
| T2 | — | `npm run test -w @codeai/api` | ✅ repositorio en memoria con fixture y adaptador Prisma con `groupBy`/`count`/`avg` |
| T3 | — | `npm run test -w @codeai/api` | ✅ `getSummary` y `getErrors`; `userId` del token, cuotas que suman 1 |
| T4 | — | `npm run test -w @codeai/api` | ✅ `getCohort`: `atRisk` ≤ 20, aserción sobre el JSON completo sin PII |
| T5 | — | `npm run test` + `npm run build -w @codeai/api` | ✅ 3 rutas, `RolesGuard` en cohorte; HTTP: estudiante `403`, instructor `200` |
| T6 | — | `npm run test -w @codeai/web` | ✅ `analyticsApi` con `400`/`403` tipados |
| T7 | — | `npm run test -w @codeai/web` | ✅ `StudentInsights` y `/learn/insights` (HTTP `200`) |
| T8 | — | `npm run test -w @codeai/web` | ✅ implementado como `CohortOverview` (no `CohortDashboard`) y `/instructor/cohort` con guarda por rol (HTTP `200`) |
| T9 | — | `npm run test -w @codeai/api` | ✅ `GET /api/health/ready`: HTTP `200`, `database.ok=true`, `latencyMs` 4–6; el `503` lo cubre una prueba con doble que falla (el módulo vive en `modules/health/`, no `health/`) |
| T10 | — | `npm run test -w @codeai/api` | ✅ `ContentCache`; HTTP: `GET /content/stages` 31 ms la primera vez y 1 ms la segunda |
| T11 | — | `npm run test -w @codeai/api` | ✅ `TraceInterceptor`; HTTP: `x-trace-id: prueba-s11` aparece en la línea de log con `durationMs` |
| T12 | — | `typecheck` + `lint` + `build` + `next start` + `npm audit --omit=dev` | ✅ `next@16.4.3`, React 19.3.1, `@react-three/fiber@9`, `eslint@9`; build de 22 rutas; `/`, `/login`, `/learn/insights` y `/instructor/cohort` → `200`; producción 14 avisos, **0 críticos** (antes 1). Detalle en `seguridad-dependencias.md` §2 |
| T13 | — | `npm test` en la raíz | ✅ `vitest@5.0.5`: shared 255 · API 780 · web 256 = **1 291**, igual que antes (no baja). Ajustes: `vitest` también en la raíz, `oxc.jsx.runtime` en `vitest.config.mts`, tipo de `vi.fn` en `TutorPanel.spec.tsx` |
| T14 | — | `npm run db:backup` y `npm run db:restore` | ✅ respaldo de 1 215 378 B; restauración en `codeai_restore_test` en ~4 s con `User` 32=32, `Unit` 207=207, `Lesson` 207=207. Simulacro en `runbook-operacion.md` §3 |
| T15 | — | `docker compose -f docker-compose.prod.yml config` y `docker build --check` | 🔄 compose válido (falla con mensaje claro sin secretos) y ambos `Dockerfile` sin avisos de `--check`. **No se compilaron las imágenes**: `npm ci` dentro de Docker no alcanza el registro de npm (fallo de red del entorno). **Bloqueo de lanzamiento:** `NODE_ENV=production` exige `SANDBOX_MODE=docker` y `SandboxModule` solo implementa `mock`, así que la API no arrancaría en producción; el checklist no puede firmarse |
| T16 | — | `typecheck` + `lint` + `test` + `build` + §10 | 🔄 `contratos-api.md` §4.8/§4.9, `arquitectura-general.md` §7, `runbook-operacion.md`, `seguridad-dependencias.md`, `README.md` y roadmap actualizados. §10: 1–8, 10, 11, 12, 13, 15 y 16 ejecutados; 9 por prueba unitaria; 14 solo la parte `config`. Pendiente cerrar T15 |

**Observación de la verificación HTTP (2026-10-29).** `cohort` con instructor devolvió `200` con 25 estudiantes. La comprobación de PII encontró un `@` en un `displayName`: es una cuenta de prueba antigua de S10 cuyo nombre visible es un correo. El código no emite `email` (el fixture lo verifica), pero `displayName` es texto libre del usuario; si se quiere garantizar que nunca aparezca un correo, hay que validarlo en el registro. Queda como decisión del dueño del producto.

---

## 10. Verificación HTTP de cierre

Script fuera del repositorio (`%TEMP%\codeai-s11\verify-s11.ps1`), contra la API en `http://localhost:3001`, con estudiante A, estudiante B e instructor.

1. Login de A, B e instructor → `200`.
2. `GET /api/analytics/me/summary?range=30d` con A → `200` con `overallPct` entre 0 y 100 y `activeDays ≤ 30`.
3. Mismo endpoint con B → números distintos; `lastActivityAt` no es el de A.
4. `GET /api/analytics/me/summary?range=xx` con A → `400 INVALID_RANGE`.
5. `GET /api/analytics/me/errors` con A → `200`; las cuotas suman ~1.
6. `GET /api/analytics/cohort` con A (estudiante) → `403`.
7. `GET /api/analytics/cohort` con instructor → `200`; el JSON no contiene `@` ni `passwordHash` ni `transcript`.
8. `GET /api/health/ready` → `200` con `checks[0].ok = true`.
9. `psql` con `DATABASE_URL` apuntando a un puerto cerrado y `ready` → `503` sin cadena de conexión en el cuerpo (comprobado con doble de prueba en la suite; el script registra el caso unitario).
10. Dos `GET /api/content/stages` seguidos → la segunda respuesta llega antes y el log muestra un acierto de caché (contador en 1).
11. `GET /api/content/stages` con `x-trace-id: prueba-s11` → la línea de log contiene ese id y `durationMs`.
12. `npm run db:backup` → archivo con fecha y tamaño > 0.
13. `npm run db:restore <archivo>` en base desechable → `psql` devuelve el mismo conteo de `User`, `Unit`, `Lesson` que la base original.
14. `docker compose -f docker-compose.prod.yml config` → 0 (requiere Docker CLI).
15. `npm audit --omit=dev` → 0 críticos o cada aviso con tarea y fecha en `seguridad-dependencias.md`.
16. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` en la raíz → todo en 0.

---

## Documentos relacionados

- `docs/03-arquitectura/contratos-api.md` §4.8 y §4.9 — contrato que este sprint corrige e implementa.
- `docs/03-arquitectura/seguridad-dependencias.md` — avisos aceptados que S11 paga (T12, T13) y estado final.
- `docs/03-arquitectura/arquitectura-general.md` §7 — entornos y despliegue.
- `docs/03-arquitectura/modelo-datos.md` — tablas que alimentan los agregados.
- `docs/04-plan-ejecucion/sprints/sprint-08-capa-ia.md` §8 — deuda de alertas de presupuesto.
- `docs/04-plan-ejecucion/sprints/sprint-10-entrevistas.md` §3.4 — regla de transcripción que la cohorte respeta.
- `docs/05-orquestacion/runbook-operacion.md` — respaldos, restauración y checklist de producción (se crea en T14).
- `docs/05-orquestacion/plantilla-tarea.md` — estructura de esta ficha.

