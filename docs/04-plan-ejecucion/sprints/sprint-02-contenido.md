# Sprint 02 — Modelo de datos y API de contenido

> **Estado:** ✅ completado · **Inicio:** 2026-10-26 · **Cierre:** 2026-10-26 · **Depende de:** S1 ✅
> **Avance:** **10/10 tareas ✅** (S2-T1…S2-T10) · **12/12 criterios de aceptación ✅** · suite completa verde.
> **Terminal por tarea:** cada tarea se implementa y verifica en un terminal propio (no se mezclan verificaciones).

---

## 1. Objetivo

El currículo deja de vivir en archivos del repositorio y pasa a la base de datos: la jerarquía **etapa → módulo → unidad → lección → ejercicio** se sirve por una API pública y paginada, y la semilla es reproducible desde cero.

Al cerrar el sprint, el resto de la plataforma puede asumir:

1. Existen tablas de contenido con sus relaciones e integridad referencial (`Stage`, `Module`, `Unit`, `Lesson`, `Resource`, `Exercise`).
2. `GET /api/content/*` devuelve `{ data, meta }` en listados y `{ stage | unit | lesson }` en detalles, siempre **solo contenido publicado**.
3. La semilla se ejecuta dos veces seguidas sin duplicar filas y desde una base vacía sin intervención manual.
4. Ninguna respuesta de contenido expone `solution`, `sources` ni pruebas ocultas.

---

## 2. Alcance

| Incluye | No incluye (queda para otro sprint) |
|---------|-------------------------------------|
| Modelos de contenido en Prisma + migración `content_structure` | `UnitProgress`, `Submission`, `ReviewItem`, `Project*`, `Interview*`, `AiInteraction` (S4–S10) |
| Semilla idempotente desde JSON validado con Zod | Contenido de lecciones y ejercicios reales (se produce en S3–S6) |
| Módulo `content`: etapas, módulos, unidades, lecciones y recursos | Escritura de contenido desde la app (no hay panel de instructor) |
| Paginación `{ data, meta }` y filtros `level`, `stage`, `type` | Ordenamiento configurable (`?sort=`) y búsqueda de texto completo |
| Lectura pública de contenido publicado | Guard de roles, `@Public` y perfil (S3) |

---

## 3. Decisiones de arquitectura

| Decisión | Motivo | Alternativa descartada |
|----------|--------|------------------------|
| **Solo contenido publicado** (`isPublished`) en todas las consultas | Un borrador a medio escribir no debe llegar al estudiante; el seed puede crecer sin publicar | Filtrar en el controlador (se olvida en una ruta nueva) |
| Semilla **incremental por nivel**: 12 etapas y 48 módulos declarados; unidades de E0–E3 | El currículo maestro define 207 unidades, pero solo Nivel 1 tiene contenido listo; inventar objetivos para el resto sería contenido falso | Sembrar 207 unidades con objetivos genéricos |
| E4–E11 se siembran como **borrador** (`isPublished: false`) y sin unidades | La ruta completa queda en base de datos sin mostrar etapas vacías en la API | Publicar etapas sin unidades |
| `upsert` por `Stage.id`, `Module.code` y `Unit.code` | La semilla es idempotente por clave natural, no por conteo | `deleteMany` + `createMany` (rompe FKs y progreso futuro) |
| JSON de semilla **validado con Zod** al cargar (`contentSeedSchema`) | Un error tipográfico falla antes de tocar la base de datos | Insertar y confiar en las restricciones SQL |
| `select` explícito en Prisma para ejercicios | Impide que `solution`, `sources` o `maxAttempts` salgan por descuido | Traer la fila completa y omitir campos en el mapper |
| `content` y `steps` de la lección validados con Zod en el mapper | La regla «7 pasos o no se publica» se verifica al servir, no solo al escribir | Devolver el JSON tal cual |
| Seed en `seed.mts` ejecutado con `node` (type stripping nativo) | No añade `ts-node`/`tsx`; el typecheck del seed se ejecuta antes de correr | Dependencia nueva de runtime |
| Orden curricular fijo (`order asc`) | Es el único orden que el catálogo necesita hoy | Implementar `?sort=` sin consumidor |

**Contrato de estado publicado**

| Nivel | `isPublished` | Expuesto por la API |
|-------|----------------|---------------------|
| Etapa | `true` en E0–E3 · `false` en E4–E11 | Solo publicadas |
| Módulo / unidad / lección / ejercicio | `true` en Nivel 1 | Solo publicados y con ancestros publicados |
| Recurso | `VERIFIED` | Solo verificados |

---

## 4. Contrato de los endpoints

| Método | Ruta | Respuesta |
|--------|------|-----------|
| GET | `/api/content/stages?page&pageSize&level` | `{ data: StageSummary[], meta }` |
| GET | `/api/content/stages/:id` | `{ stage: StageDetail }` (incluye `modules`) |
| GET | `/api/content/units/:code` | `{ unit: UnitDetail }` (incluye `lessons` y `exercises`) |
| GET | `/api/content/lessons/:slug` | `{ lesson: LessonDetail }` (incluye `content`, `steps`, `resources`) |
| GET | `/api/content/resources?page&pageSize&stage&type` | `{ data: ResourceSummary[], meta }` |

```ts
interface StageSummary {
  id: number; slug: string; title: string; objective: string;
  level: number; estimatedMin: number | null; order: number; moduleCount: number;
}
interface ModuleSummary { id: string; code: string; title: string; order: number; unitCount: number }
interface UnitSummary {
  id: string; code: string; title: string; objective: string;
  estimatedMin: number | null; order: number; moduleCode: string; prerequisiteIds: string[];
}
interface ExerciseSummary {
  id: string; slug: string; type: ExerciseType; title: string; statement: string;
  ladder: Ladder; difficulty: number; concepts: string[]; competencies: string[];
  estimatedMin: number | null; order: number;
}
```

**Errores esperados**

| Caso | Respuesta |
|------|-----------|
| Etapa / unidad / lección inexistente o no publicada | `404 NOT_FOUND` |
| `:id` no numérico, `pageSize > 100`, `level` fuera de 1–4, `type` desconocido | `400 VALIDATION_ERROR` con `details[].field` |

---

## 5. Tareas

Cada tarea se ejecuta y verifica en **un terminal distinto** (`Terminal 1`, `Terminal 2`, …). Ninguna tarea se da por cerrada sin su comando de verificación y su salida real.

| ID | Tarea | Archivos principales | Terminal | Estado |
|----|-------|----------------------|----------|--------|
| S2-T1 | Persistencia: modelos de contenido y migración `content_structure` | `apps/api/prisma/schema.prisma` + migración | 1 | ✅ |
| S2-T2 | Contratos compartidos: enums de recurso y esquemas Zod de contenido | `packages/shared/src/enums/resource.ts`, `schemas/content.ts`, `index.ts` | 2 | ✅ |
| S2-T3 | Pruebas de los contratos de contenido y de la semilla | `packages/shared/src/schemas/content.spec.ts` | 3 | ✅ |
| S2-T4 | Dataset semilla del currículo (12 etapas, 48 módulos, 63 unidades) | `apps/api/prisma/seed/content.seed.json` | 4 | ✅ |
| S2-T5 | Cargador de semilla idempotente y script `db:seed` | `apps/api/prisma/seed/seed.mts`, `apps/api/prisma/tsconfig.seed.json`, `apps/api/package.json` | 5 | ✅ |
| S2-T6 | Puerto `ContentRepository`, adaptador Prisma y mapper | `content.repository.ts`, `prisma-content.repository.ts`, `content.mapper.ts` | 6 | ✅ |
| S2-T7 | `ContentService` con paginación y `404`, repositorio en memoria y pruebas | `content.service.ts`, `in-memory-content.repository.ts`, `content.service.spec.ts` | 7 | ✅ |
| S2-T8 | Controlador `/api/content` y módulo conectado a `AppModule` | `content.controller.ts`, `content.module.ts`, `app.module.ts` | 8 | ✅ |
| S2-T9 | Verificación HTTP real y semilla ejecutada dos veces | — (guion de comandos) | 9 | ✅ |
| S2-T10 | Cierre documental: modelo de datos, contratos, README y roadmap | docs | 10 | ✅ |

> **Regla de tamaño:** ninguna tarea toca más de 3 archivos de código. Si una tarea necesita más, se parte antes de empezar.

---

## 6. Criterios de aceptación

- [x] La migración `content_structure` crea `Stage`, `Module`, `Unit`, `Lesson`, `Resource`, `LessonResource` y `Exercise` con sus enums y claves foráneas en cascada.
- [x] `npm run db:seed` termina en 0 y deja 12 etapas, 48 módulos y 63 unidades.
- [x] Ejecutar la semilla dos veces seguidas no cambia ningún conteo (idempotencia).
- [x] `prisma migrate reset --force` reconstruye el esquema y ejecuta la semilla sin pasos manuales.
- [x] `GET /api/content/stages` responde `200` con `{ data, meta }` y solo etapas publicadas (4).
- [x] `GET /api/content/stages/1` responde `200` y devuelve los módulos de la etapa con `unitCount`.
- [x] `GET /api/content/units/U0.1.1` responde `200`; una unidad inexistente o no publicada (`U9.1.1`) responde `404 NOT_FOUND`.
- [x] `GET /api/content/lessons/:slug` inexistente responde `404` con el envelope único y `x-trace-id`.
- [x] `pageSize=500` y `stages/abc` responden `400 VALIDATION_ERROR` con `details[].field`.
- [x] Ninguna respuesta de unidad incluye `solution`, `sources` ni pruebas ocultas (verificado en prueba y con `select` explícito).
- [x] Los esquemas Zod de contenido y semilla están probados en `packages/shared`.
- [x] Suite del monorepo verde: `typecheck`, `lint`, `test` y `build`.

**Estado:** 12/12 verificados ✅ (ver bitácora §9).

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Postgres no disponible | `npm run db:up`; las pruebas de dominio usan el repositorio en memoria |
| Semilla que duplica filas al reejecutarse | `upsert` por clave natural + verificación de conteos en S2-T9 |
| Contenido corrupto en base de datos | `content` y `steps` se validan con Zod al servirlos; un JSON inválido no se publica como lección vacía |
| Fuga de soluciones | `select` explícito en el adaptador; la prueba de servicio comprueba que la clave no existe |
| Etapas vacías visibles | E4–E11 se siembran como borrador |

---

## 8. Fuera de alcance (a propósito)

- Contenido de lecciones, ejercicios, pistas y pruebas ocultas: se produce en S3–S6 con la plantilla de lección.
- `?sort=` configurable y búsqueda de texto completo: sin consumidor todavía.
- Caché de catálogo y ETag: S11.
- Panel de administración de contenido: no está en el roadmap de los 12 sprints.

---

## 9. Bitácora de ejecución (2026-10-26)

| Tarea | Terminal | Verificación ejecutada | Resultado |
|-------|----------|------------------------|-----------|
| S2-T1 | 1 | `prisma migrate dev` + consulta a PostgreSQL | `Stage`, `Module`, `Unit`, `Lesson`, `Resource`, `LessonResource`, `Exercise` y sus enums creados en `content_structure` |
| S2-T2 | 2 | `npm run build -w packages/shared` | Esquemas de contenido, paginación, parámetros de ruta y semilla exportados desde `index.ts` |
| S2-T3 | 3 | `npm run test -w packages/shared` (42 pruebas) | Siete pasos obligatorios, unicidad de códigos, prerrequisitos válidos, unidad dentro de su etapa y mensajes de validación en español |
| S2-T4 | 4 | Validación con `contentSeedSchema` | 12 etapas · 48 módulos · 63 unidades; E0–E3 publicadas y E4–E11 en borrador |
| S2-T5 | 5 | `npm run db:seed` dos veces + `psql` sobre `codeai` | Ambas ejecuciones en 0 y conteos idénticos (12 etapas / 48 módulos / 63 unidades · 4 etapas publicadas) |
| S2-T6 | 6 | `npm run typecheck` + pruebas de servicio | `select` explícito sin `solution`/`sources` y validación Zod de `content`/`steps` al servir la lección |
| S2-T7 | 7 | `npm run test -w @codeai/api` (13 pruebas de contenido) | `{ data, meta }` 1-based, página vacía, filtros `level`/`stage`/`type`, `404` de etapa, unidad y lección |
| S2-T8 | 8 | `nest build` + arranque con `node dist/main.js` | Cinco rutas mapeadas y `ContentModule` registrado en `AppModule` sin errores de DI |
| S2-T9 | 9 | `curl` contra PostgreSQL local (`localhost:5433`) | `stages` 200 (4 etapas, `totalPages:1`); `?level=2` 200 con `total:0`; `?page=2&pageSize=3` 200 (1 etapa); `stages/1` 200 con `unitCount`; `units/U0.1.1` 200; `U9.1.1` y `lessons/no-existe` 404 `NOT_FOUND`; `pageSize=500`, `stages/abc`, `stages/12` y `units/U1.1` 400 `VALIDATION_ERROR` con `details[].field`; `x-trace-id` en todas; ningún cuerpo con `solution`, `sources` ni `notes` |
| S2-T10 | 10 | Suite completa del monorepo | `typecheck`, `lint`, `test` (API 66 · web 30 · shared 42) y `build` verdes; documentación sincronizada |

---

## Documentos relacionados

- [`../roadmap-sprints.md`](../roadmap-sprints.md)
- [`sprint-01-auth.md`](sprint-01-auth.md)
- [`../../03-arquitectura/modelo-datos.md`](../../03-arquitectura/modelo-datos.md)
- [`../../03-arquitectura/contratos-api.md`](../../03-arquitectura/contratos-api.md)
- [`../../05-orquestacion/plantilla-tarea.md`](../../05-orquestacion/plantilla-tarea.md)
