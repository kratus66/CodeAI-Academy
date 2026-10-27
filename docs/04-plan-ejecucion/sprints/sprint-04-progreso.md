# Sprint 04 — Progreso, desbloqueos y competencias

> **Estado:** 🔄 en curso · **Inicio:** 2026-10-27 · **Depende de:** S1 ✅, S2 ✅ y S3 🔄 (cierre técnico)
> **Avance:** 1/10 tareas · 1/10 criterios de aceptación.
> **Sesión por tarea:** cada tarea se implementa y verifica en una invocación aislada de comandos; su salida real queda en la bitácora §9.

---

## 1. Objetivo

El avance del estudiante **se registra en el servidor** y **desbloquea la siguiente unidad según sus prerrequisitos**. El porcentaje y el estado de cada unidad se calculan en el backend (`docs/03-arquitectura/modelo-datos.md` §4: «ningún endpoint permite que el cliente los fije»).

Al cerrar el sprint, la plataforma puede asumir:

1. Existen `UnitProgress` y `CompetencyProgress` con sus relaciones a `User` y `Unit`.
2. Un usuario autenticado consulta su avance (`/api/progress/overview`, `/units`, `/competencies`) y **solo ve el suyo**: dos usuarios nunca comparten filas.
3. Una unidad con prerrequisitos pendientes se sirve como `LOCKED`; al cumplirlos pasa a `AVAILABLE` sin intervención manual.
4. Marcar una lección vista incrementa el avance de la unidad sin acreditarla como `MASTERED`.
5. La web muestra un panel de avance con el porcentaje global, los contadores por estado y el mapa C1–C14.

---

## 2. Alcance

| Incluye | No incluye (queda para otro sprint) |
|---------|-------------------------------------|
| Modelos `UnitProgress` y `CompetencyProgress` + migración `progress_tracking` | `Submission`, `ReviewItem`, `Project*`, `Interview*`, `AiInteraction` (S6–S10) |
| Reglas de desbloqueo por prerrequisitos como función pura | Evaluación de etapa ≥ 80 % y nivel 3 en competencias críticas (requieren envíos: S6) |
| `POST /api/progress/units/:id/complete-lesson` (marca vista, no acredita) | Otorgar `MASTERED` desde el cliente o desde un endpoint (solo lo acredita S6) |
| Lectura del progreso propio con aislamiento por usuario | Panel de instructor y progreso de terceros |
| Cliente `progressApi` en la web y panel de avance en `/learn/progress` | Rachas, notificaciones y exportación de certificados |
| Verificación HTTP real con **dos** usuarios | Recalculo de `progressPct` por pesos de evaluación (S6 lo alimenta) |

**Dependencia declarada con S6:** el porcentaje de unidad se calcula hoy como proporción de lecciones vistas sobre lecciones publicadas (100 % de la unidad cuando no hay ejercicios sembrados). Los pesos de evaluación (20/45/35 de `prerequisitos-y-progreso.md` §4.1) se activan cuando existan envíos; la fórmula vive en una sola función para que S6 la sustituya sin tocar endpoints.

**Estado heredado de S3:** la semilla siembra **0 lecciones**, así que `complete-lesson` se prueba contra el repositorio en memoria y con una lección creada por la prueba; no se inventa contenido curricular (S3-T11 sigue pendiente).

---

## 3. Decisiones de arquitectura

| Decisión | Motivo | Alternativa descartada |
|----------|--------|------------------------|
| `UnitState` como enum de Prisma **y** tupla en `shared` (ya existe en `enums/exercise.ts`) | El estado cruza web↔api y Prisma necesita el enum; los valores son idénticos | Duplicar literales en el frontend |
| Estado y porcentaje **solo** se calculan en el servidor | Regla crítica de `modelo-datos.md` §4: el cliente no fija `state` ni `level` | Aceptar `state` en el cuerpo de la petición |
| Desbloqueo por **prerrequisitos** en S4 | Es la única condición verificable con los datos que existen (no hay envíos ni evaluación de etapa hasta S6) | Implementar las tres condiciones con datos inexistentes |
| `LOCKED` y `AVAILABLE` se derivan al leer, no se persisten como verdad | Si se guardara `LOCKED`, completar un prerrequisito exigiría actualizar N filas de otros usuarios | Recalcular y escribir todos los registros en cada avance |
| `POST /units/:id/complete-lesson` es **idempotente** | Marcar dos veces la misma lección no debe inflar el porcentaje | Contador incremental sin clave de lección |
| Contadores de `overview` con los cuatro campos publicados (`mastered`, `inProgress`, `needsReview`, `locked`) | `contratos-api.md` §4.4 es el contrato vigente; añadir `available` lo cambiaría | Inventar un quinto contador |
| `dueReviews` se sirve como `0` en S4 | El contrato ya lo pide y todavía no existe `ReviewItem`; `0` es la verdad actual | Omitir el campo y romper el contrato |
| `progressPct` es `Float` 0–100 (no dinero) | Es un porcentaje, no un importe: ADR-0004 no aplica y no hay aritmética monetaria en el sprint | Decimales como `string` |

**Nota de reconstrucción (supuestos).** Esta ficha **no existía** en el repositorio: el roadmap solo tenía la línea de S4 y no había archivo de tareas. Se reconstruye el 2026-10-27 a partir de [`roadmap-sprints.md`](../roadmap-sprints.md) §S4, [`contratos-api.md`](../../03-arquitectura/contratos-api.md) §4.4, [`modelo-datos.md`](../../03-arquitectura/modelo-datos.md) §4 y [`prerequisitos-y-progreso.md`](../../01-curriculo/prerequisitos-y-progreso.md) §1–§4. La ruta de las fichas es `docs/04-plan-ejecucion/sprints/` (no `docs/sprints/`, que no existe en este repositorio). La descomposición en diez tareas es una propuesta y requiere ratificación del Orquestador antes de darse por definitiva.

---

## 4. Contrato

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/api/progress/overview` | ✅ | `{ user, currentStage, overallPct, units, competencies, dueReviews }` |
| GET | `/api/progress/units` | ✅ | `{ data: UnitProgressSummary[], meta }` |
| GET | `/api/progress/competencies` | ✅ | `{ data: CompetencyProgress[], meta }` |
| POST | `/api/progress/units/:id/complete-lesson` | ✅ | `{ unit: UnitProgressSummary }` |

```ts
interface UnitProgressSummary {
  unitId: string; unitCode: string; state: UnitState;
  progressPct: number; lessonsDone: number; exercisesDone: number;
  bestScore: number | null;
  lastActivityAt: string | null; completedAt: string | null;
}
interface CompetencyProgress { code: string; level: number; evidenceCount: number }
interface ProgressCounts { mastered: number; inProgress: number; needsReview: number; locked: number }
```

**Errores esperados**

| Caso | Respuesta |
|------|-----------|
| Sin sesión o token inválido | `401 UNAUTHORIZED` |
| Unidad inexistente o no publicada | `404 NOT_FOUND` |
| Unidad `LOCKED` al marcar lección | `409 CONFLICT` |
| `:id` vacío o `pageSize > 100` | `400 VALIDATION_ERROR` con `details[].field` |

---

## 5. Tareas

| ID | Tarea | Archivos principales | Sesión | Estado |
|----|-------|----------------------|--------|--------|
| S4-T1 | Contrato compartido del progreso: esquemas Zod y porcentaje | `packages/shared/src/schemas/progress.ts` + spec, `index.ts` | 1 | ✅ `0ffe003` |
| S4-T2 | Persistencia: `UnitProgress`, `CompetencyProgress` y migración `progress_tracking` | `apps/api/prisma/schema.prisma` + migración | 2 | ⬜ |
| S4-T3 | Reglas de desbloqueo como función pura | `apps/api/src/modules/progress/progress.rules.ts` + spec | 3 | ⬜ |
| S4-T4 | Puerto `ProgressRepository`, adaptador Prisma y mapper | `progress.repository.ts`, `prisma-progress.repository.ts`, `progress.mapper.ts` | 4 | ⬜ |
| S4-T5 | `ProgressService` (overview, unidades, competencias, complete-lesson) y repositorio en memoria | `progress.service.ts` + spec, `in-memory-progress.repository.ts` | 5 | ⬜ |
| S4-T6 | Controlador `/api/progress`, módulo y registro en `AppModule` | `progress.controller.ts`, `progress.module.ts`, `app.module.ts` | 6 | ⬜ |
| S4-T7 | Cliente `progressApi` con validación Zod | `apps/web/src/lib/api-client.ts` + spec | 7 | ⬜ |
| S4-T8 | Panel de avance y ruta `/learn/progress` | `features/progress/components/ProgressOverview.tsx` + spec, `learn/progress/page.tsx` | 8 | ⬜ |
| S4-T9 | Verificación HTTP real con dos usuarios (aislamiento) | — (guion de comandos) | 9 | ⬜ |
| S4-T10 | Cierre documental: modelo de datos, contratos, roadmap y bitácora | docs | 10 | ⬜ |

> **Regla de tamaño:** ninguna tarea toca más de 3 archivos de código. Si una tarea necesita más, se parte antes de empezar.

---

## 6. Criterios de aceptación

- [x] `S4-T1`: `progressPctSchema` rechaza < 0 y > 100; `competencyCodeSchema` acepta `C1`–`C14` y rechaza `C0`, `C15` y `c1`.
- [ ] La migración `progress_tracking` crea `UnitProgress`, `CompetencyProgress` y `UnitState`, con cascada desde `User` y `Unit`.
- [ ] Las reglas de desbloqueo cubren: sin prerrequisitos → `AVAILABLE`; un prerrequisito `MASTERED` → `AVAILABLE`; un prerrequisito pendiente → `LOCKED`; prerrequisitos inexistentes no desbloquean.
- [ ] `POST /api/progress/units/:id/complete-lesson` dos veces con la misma lección no supera el 100 % (idempotencia).
- [ ] Dos usuarios con sesión ven exclusivamente su propio progreso (prueba de aislamiento).
- [ ] `GET /api/progress/*` responde `401` sin cookie y `404` con una unidad inexistente.
- [ ] `GET /api/progress/overview` responde con los seis campos del contrato y `x-trace-id`.
- [ ] La web muestra el panel de avance con estados de carga, error y vacío.
- [ ] Suite del monorepo verde: `typecheck`, `lint`, `test` y `build`.

**Estado:** 1/10 verificados.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Estado calculado en el cliente | El contrato no acepta `state` en el cuerpo; toda escritura pasa por el servicio |
| Progreso cruzado entre usuarios | El `userId` sale siempre del token (`CurrentUser`), nunca del cuerpo ni de la ruta |
| Unidades sin lecciones sembradas | El porcentaje se deriva de lecciones **publicadas**; sin lecciones la unidad permanece en `AVAILABLE` con 0 % y se prueba con dataset en memoria |
| Desbloqueo con prerrequisitos inexistentes | La regla trata un código desconocido como no cumplido y la prueba lo fija |
| Dependencia de S3-T11 | El panel declara el vacío; no se inventa contenido |

---

## 8. Fuera de alcance (a propósito)

- Acreditar `MASTERED` por envíos y evaluación de etapa: S6.
- Repaso espaciado y `dueReviews` real: S7.
- Notificaciones, rachas y certificados: no están en el roadmap de los 12 sprints.
- Analítica agregada de cohortes: S11.

---

## 9. Bitácora de ejecución

| Tarea | Verificación ejecutada | Resultado | Commit |
|-------|------------------------|-----------|--------|
| S4-T1 | `npm run test -w @codeai/shared` (rojo: `Failed to load url ./progress`, 1 suite fallida y 45 verdes) → `npm run test -w @codeai/shared` (64) · `pnpm typecheck` · `pnpm lint` · `npm test` (shared 64 · API 68 · web 81) · `npm run typecheck` · `npm run lint` · `npm run build` | Verde: `progressPctSchema` acepta 0/34.5/100 y rechaza −0.1 y 100.1; `competencyCodeSchema` acepta `C1`, `C10` y `C14` y rechaza `C0`, `C15`, `c1` y `C`; el resumen de unidad rechaza estado `DONE`, 140 % y fechas no ISO; el resumen global acepta el ejemplo de `contratos-api.md` §4.4 y rechaza `currentStage: 12`, contadores negativos y `C99`. `typecheck`, `lint` y `build` en 0 | `0ffe003` |

> **Artefacto de verificación:** `pnpm typecheck` y `pnpm lint` ejecutan los scripts `npm` del monorepo, pero `pnpm` creó un `pnpm-lock.yaml` que no se versiona (el lockfile del repo es `package-lock.json`); se eliminó antes del commit.

---

## Documentos relacionados

- [`../roadmap-sprints.md`](../roadmap-sprints.md)
- [`sprint-03-aprendizaje.md`](sprint-03-aprendizaje.md)
- [`../../03-arquitectura/modelo-datos.md`](../../03-arquitectura/modelo-datos.md)
- [`../../03-arquitectura/contratos-api.md`](../../03-arquitectura/contratos-api.md)
- [`../../01-curriculo/prerequisitos-y-progreso.md`](../../01-curriculo/prerequisitos-y-progreso.md)
