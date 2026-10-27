# Sprint 03 — Plataforma de aprendizaje

> **Estado:** 🔄 cierre técnico · **Inicio:** 2026-10-27 · **Depende de:** S1 ✅ y S2 ✅
> **Avance:** 10/11 tareas · 5/10 criterios de aceptación (los cinco restantes exigen navegador con sesión).
> **Terminal por tarea:** cada tarea se implementa y verifica en una invocación aislada de comandos; su salida real queda en la bitácora §9.

---

## 1. Objetivo

El estudiante **navega la ruta** (etapa → módulo → unidad) dentro de la aplicación y **lee lecciones** con el contenido que sirve la API, sin contenido duplicado en el frontend.

Al cerrar el sprint, la plataforma puede asumir:

1. Existe un **shell autenticado** en `/learn/*`: sin sesión se redirige a `/login` y no se pinta contenido privado.
2. El **catálogo** lista las etapas publicadas y cada etapa muestra sus módulos con sus unidades, todo desde `GET /api/content/*`.
3. La **vista de unidad** muestra objetivo, prerrequisitos, lecciones y ejercicios, con navegación **anterior/siguiente** dentro de la etapa.
4. El **lector de lección** renderiza los bloques de contenido, los 7 pasos y los recursos verificados.
5. Cada vista declara sus **estados de carga, error y vacío**; ningún texto de currículo está escrito en el frontend.

---

## 2. Alcance

| Incluye | No incluye (queda para otro sprint) |
|---------|-------------------------------------|
| Unidades dentro del módulo en `GET /api/content/stages/:id` | Endpoint nuevo `GET /api/content/modules/:code` |
| `stageId` en `UnitSummary` (contexto para migas y navegación) | `?sort=` y búsqueda de texto completo |
| Cliente `contentApi` en la web con validación Zod de cada respuesta | Caché, ETag y streaming (S11) |
| Shell autenticado, catálogo, vista de etapa, vista de unidad y lector de lección | Progreso, desbloqueos y porcentaje (S4) |
| Estados de carga, error, vacío y `404` de contenido | Laboratorio de código y editor (S5) |
| Verificación HTTP real contra PostgreSQL local | Panel de instructor y mutaciones de contenido |

**Fuera de alcance explícito (heredado de S1):** el guard de roles, el decorador `@Public` y el módulo `users` no se implementan en este sprint porque **no tienen consumidor** (no hay rutas de administración ni listado de usuarios hasta S9/S11). Se reprograman y se documentan en §8. Es una decisión reversible: no se borra ni se deja a medias nada de S1.

**Brecha de contenido declarada:** la semilla de S2 siembra etapas, módulos y unidades, pero **cero lecciones**. Este sprint entrega el lector y lo prueba con el repositorio en memoria; la primera lección real requiere autoría pedagógica con revisión humana y queda como tarea S3-T11 (⬜). No se inventa contenido curricular para «poder demostrar» la pantalla.

---

## 3. Decisiones de arquitectura

| Decisión | Motivo | Alternativa descartada |
|----------|--------|------------------------|
| Las **unidades viajan dentro de cada módulo** en `GET /stages/:id` | Una petición pinta la etapa completa; evita N+1 y un endpoint nuevo | `GET /modules/:code` + una petición por módulo |
| Añadir `units` a `ModuleSummary` y `stageId` a `UnitSummary` | Es un cambio **compatible** (campos nuevos, §7 de `contratos-api.md`): no rompe v1 | Renombrar o reordenar el contrato existente |
| `stageId` en la unidad, no deducido del código `U0.1.1` | El cliente no debe parsear códigos curriculares | Parsear `moduleCode`/`code` en la web |
| Navegación **anterior/siguiente dentro de la etapa** | Es lo que la etapa ya devuelve ordenado; el recorrido global depende de progreso (S4) | Navegación global con una consulta nueva al backend |
| La sesión se resuelve **en cliente** (`SessionProvider` de S1) | La cookie httpOnly la emite la API en otro origen; el servidor de Next no la reenvía hoy | Proxy de cookies en Next (cambio de infraestructura) |
| Los componentes reciben el **loader por props** | Prueba sin red y sin mocks de `fetch`; el loader estable evita efectos repetidos | `fetch` dentro del componente |
| Cada respuesta se **valida con el esquema Zod de `shared`** | Un cambio de contrato falla en la web, no en producción | Tipar con `as` |
| El lector muestra estado vacío cuando la unidad no tiene lecciones | La API es la única fuente de verdad del catálogo | Sembrar lecciones de relleno |

---

## 4. Contrato

### 4.1 Cambios en `packages/shared`

```ts
interface UnitSummary {
  id: string; code: string; title: string; objective: string;
  estimatedMin: number | null; order: number;
  stageId: number;          // nuevo: etapa a la que pertenece
  moduleCode: string; prerequisiteIds: string[];
}

interface ModuleSummary {
  id: string; code: string; title: string; order: number;
  unitCount: number;
  units: UnitSummary[];     // nuevo: unidades publicadas del módulo
}
```

`GET /api/content/stages/:id` mantiene su forma `{ stage: StageDetail }`; dentro de cada módulo aparece `units` ordenado por `order` ascendente y sin elementos no publicados.

### 4.2 Rutas de la web

| Ruta | Contenido | Fuente |
|------|-----------|--------|
| `/learn` | Catálogo de etapas publicadas | `GET /api/content/stages` |
| `/learn/stages/:id` | Etapa con módulos y unidades | `GET /api/content/stages/:id` |
| `/learn/units/:code` | Unidad, prerrequisitos, lecciones y ejercicios | `GET /api/content/units/:code` + `GET /api/content/stages/:stageId` |
| `/learn/lessons/:slug` | Lección: bloques, 7 pasos y recursos | `GET /api/content/lessons/:slug` |

Toda ruta de `/learn/*` exige sesión: mientras se restaura, se anuncia `role="status"`; sin sesión se redirige a `/login`.

### 4.3 Errores esperados en la web

| Caso | Comportamiento |
|------|----------------|
| `404 NOT_FOUND` | Mensaje «No encontramos …» con enlace al catálogo, sin traza interna |
| `400 VALIDATION_ERROR` | Igual que `404` desde la perspectiva del estudiante (la URL está mal formada) |
| Error de red o `5xx` | `role="alert"` con botón «Reintentar»; nunca se pinta un estado vacío engañoso |
| Respuesta fuera de contrato | Error de contrato con `traceId` si existe |

---

## 5. Tareas

Cada tarea se ejecuta y verifica en una invocación aislada de comandos. Ninguna se da por cerrada sin su comando de verificación y su salida real.

| ID | Tarea | Archivos principales | Estado |
|----|-------|----------------------|--------|
| S3-T1 | Contrato y API: `units` en el módulo, `stageId` en la unidad | `packages/shared/src/schemas/content.ts` + spec, `content.mapper.ts`, `prisma-content.repository.ts`, `content.service.spec.ts` | ✅ `1d02d14` |
| S3-T2 | Cliente `contentApi` con validación Zod de las respuestas | `apps/web/src/lib/api-client.ts`, `api-client.spec.ts` | ✅ `85fcca0` |
| S3-T3 | Shell autenticado: guard de sesión y layout de aprendizaje | `features/learning/components/SessionGate.tsx` + spec, `app/(learning)/learn/layout.tsx` | ✅ `56a1bc6` |
| S3-T4 | Catálogo de etapas con carga, error y vacío | `features/learning/lib/use-content-loader.ts` + spec, `features/learning/components/StageCatalog.tsx` + spec, `learn/page.tsx` | ✅ `d5ac85b` |
| S3-T5 | Vista de etapa: módulos y unidades | `features/learning/lib/format.ts` + spec, `features/learning/components/StageOutline.tsx` + spec, `learn/stages/[id]/page.tsx` | ✅ `0f114d4` |
| S3-T6 | Navegación anterior/siguiente como función pura | `features/learning/lib/navigation.ts` + spec | ✅ `6ca874a` |
| S3-T7 | Vista de unidad con prerrequisitos y navegación | `features/learning/lib/unit-view-loader.ts` + spec, `features/learning/components/UnitView.tsx` + spec, `learn/units/[code]/page.tsx` | ✅ `153d2b4` |
| S3-T8 | Lector de lección: bloques, 7 pasos y recursos | `features/learning/components/LessonReader.tsx` + spec, `learn/lessons/[slug]/page.tsx` | ✅ `daf0261` |
| S3-T9 | Verificación HTTP real y compilación de la web | — (guion de comandos) | ✅ `5205d46` |
| S3-T10 | Cierre documental: contratos, roadmap y bitácora | docs | ✅ `docs(s3)` |
| S3-T10 | Cierre documental: contratos, roadmap y bitácora | docs | ⬜ |
| S3-T11 | Autoría de la primera lección real (requiere revisión pedagógica) | `apps/api/prisma/seed/content.seed.json` | ⬜ |

> **Regla de tamaño:** cada tarea se parte hasta que **su commit deja `typecheck`, `lint` y `test` en verde**. El límite orientativo es de 3 archivos; S3-T1 lo supera a propósito porque un campo obligatorio nuevo en `shared` rompe el mapper y el adaptador en el mismo instante, y separarlos dejaría un commit rojo.


---

## 6. Criterios de aceptación

- [x] `GET /api/content/stages/1` devuelve, para cada módulo, `units` ordenadas por `order` y solo publicadas.
- [x] `GET /api/content/units/U0.1.1` incluye `stageId` correcto; ninguna respuesta expone `solution` ni `sources`.
- [x] `packages/shared` valida el contrato nuevo y rechaza un módulo sin `units`.
- [ ] `/learn` sin sesión redirige a `/login` y no muestra etapas.
- [ ] `/learn` con sesión lista las 4 etapas publicadas con datos de la API.
- [ ] `/learn/stages/0` muestra los módulos de E0 con sus unidades enlazadas.
- [ ] `/learn/units/U0.1.1` muestra objetivo y prerrequisitos, y deshabilita «Anterior» en la primera unidad de la etapa.
- [ ] `/learn/units/U0.1.2` ofrece «Anterior» (U0.1.1) y «Siguiente» (U0.1.3).
- [x] `/learn/lessons/no-existe` muestra el estado de error con enlace al catálogo, no una página en blanco.
- [x] `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` terminan en 0.

> Los cinco criterios de navegador (sesión, listado, etapa, unidad y vecinos) se comprueban en la revisión manual del cierre: exigen una sesión iniciada contra la web levantada, algo que la verificación por `curl` de S3-T9 no cubre.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Cambiar `ModuleSummary` rompe consumidores de S2 | Es un campo añadido; se actualizan fixtures y la prueba de servicio en la misma tarea |
| Doble petición en la vista de unidad (unidad + etapa) | Ambas caben en la misma navegación; la alternativa (endpoint nuevo) se descartó a propósito |
| Sin lecciones sembradas, el lector no se demuestra | Se prueba con dataset en memoria y la UI declara el vacío; tarea S3-T11 abierta |
| Redirección en cliente provoca parpadeo | `SessionGate` anuncia `role="status"` y no monta contenido hasta tener sesión |
| API caída durante la verificación | `npm run db:up` y arranque de la API con `node dist/main.js` antes del `curl` |

---

## 8. Fuera de alcance (a propósito)

- Progreso, porcentaje y desbloqueos por prerrequisitos: S4. En S3 los prerrequisitos solo se **muestran**.
- Guard de roles, `@Public` y módulo `users`: sin consumidor hasta S9/S11 (ver §2).
- Contenido de lecciones: autoría pedagógica separada (S3-T11).
- Editor de código, envíos y corrección: S5–S6.

---

## 8.1 Resumen de cierre (2026-10-27)

**Construido.** Contrato de contenido ampliado (`ModuleSummary.units`, `UnitSummary.stageId`), cliente `contentApi` con validación Zod, shell autenticado de `/learn`, catálogo de etapas, vista de etapa con módulos y unidades, vista de unidad con prerrequisitos y navegación anterior/siguiente (función pura `findUnitNeighbours`), y lector de lección con los seis tipos de bloque, los 7 pasos y los recursos verificados. Suite completa en verde: shared 45 · API 68 · web 81 (194 pruebas), más `typecheck`, `lint` y `build` en 0.

**Desviado.** Nada del plan se recortó. Se añadieron dos piezas no previstas: `unit-view-loader.ts` (compone unidad + etapa en una sola carga, sin vistas parciales) y el `useContentLoader` compartido (carga, error, `Reintentar` y `AbortSignal`), que evitó repetir la misma lógica en las cuatro vistas.

**Pendiente.**
- S3-T11: primera lección real. La semilla siembra 0 lecciones, así que el lector se demuestra con dataset en memoria; escribir contenido curricular exige autoría y revisión pedagógica humana.
- Los criterios de navegador (sesión, listado, etapa, unidad y vecinos de unidad) se comprueban en la revisión manual con la web y la API levantadas.

---

## 9. Bitácora de ejecución

| Tarea | Verificación ejecutada | Resultado | Commit |
|-------|------------------------|-----------|--------|
| S3-T1 | `npm run test -w @codeai/shared` (rojo 4 fallos → verde 45), `npm run test -w @codeai/api` (68), `npm run typecheck`, `npm run lint` | Verde: módulos con `units` ordenadas, `stageId` validado en [0, 11] y requerido, `unitCount` derivado de la lista | `1d02d14` |
| S3-T2 | `npm run test -w @codeai/web` (rojo: import sin exportar → verde 36), `npm test` (11 + 6 + 4 archivos), `npm run typecheck`, `npm run lint` | Verde: `contentApi` pide `/content/stages`, `/content/stages/:id`, `/content/units/:code` y `/content/lessons/:slug`; una etapa con módulo sin `units` se rechaza como `INTERNAL_ERROR` y el `404` de la API llega intacto con `traceId` | `85fcca0` |
| S3-T3 | `npm run test -w @codeai/web` (rojo: `./SessionGate` inexistente → verde 39), `npm run typecheck`, `npm run lint` | Verde: `role="status"` mientras se restaura, `role="alert"` + `router.replace("/login")` sin sesión, contenido privado solo con sesión; lint de Next sin avisos | `56a1bc6` |
| S3-T4 | `npm run test -w @codeai/web` (rojo: módulos sin exportar → verde 47), `npm run typecheck`, `npm run lint` | Verde: el hook aborta al desmontar y al cambiar de loader; el catálogo anuncia la carga, lista etapas con enlace `/learn/stages/0`, declara el vacío y reintenta tras el fallo (2 llamadas) | `d5ac85b` |
| S3-T5 | `npm run test -w @codeai/web` (rojo: `./format` y `./StageOutline` inexistentes → verde 56), `npm run typecheck`, `npm run lint` | Verde: `formatMinutes` cubre `null`, minutos, horas exactas y mixtas; la vista pide la etapa por id, enlaza unidades y su duración, declara el módulo vacío, y separa 404/400 (con `traceId`, sin reintento) de un fallo de red (con reintento hasta el dato) | `0f114d4` |
| S3-T6 | `npm run test -w @codeai/web` (rojo: `./navigation` inexistente → verde 66), `npm run typecheck`, `npm run lint` | Verde: el recorrido cruza módulos y salta los vacíos; la primera unidad no tiene anterior ni la última siguiente; un código ajeno o una etapa vacía no inventan vecinos; los prerrequisitos se traducen por id y descartan lo despublicado | `6ca874a` |
| S3-T7 | `npm run test -w @codeai/web` (rojo: `./unit-view-loader` y `./UnitView` inexistentes → verde 75), `npm run typecheck`, `npm run lint` | Verde: el loader pide la etapa solo con el `stageId` de la unidad y no la pide si la unidad falla; la vista muestra objetivo y prerrequisitos enlazados, deshabilita «Anterior» en U0.1.1, enlaza anterior/siguiente en U0.1.2, declara la unidad sin lecciones y trata el 404 con `traceId` y vuelta al catálogo | `153d2b4` |
| S3-T8 | `npm run test -w @codeai/web` (rojo: `./LessonReader` inexistente → verde 81), `npm run typecheck` (rojo: `type: "course"` no es del catálogo `RESOURCE_TYPES` → corregido a `COURSE`), `npm run lint` | Verde: los seis tipos de bloque se pintan (párrafo, lista, código con lenguaje, aviso, diagrama y tabla), los 7 pasos aparecen con su nombre en castellano, los recursos abren en pestaña nueva con `noopener noreferrer`, y el 404 lleva `traceId` y vuelta al catálogo mientras un fallo de red ofrece reintento | `daf0261` |
| S3-T9 | `node dist/main.js` + `curl` contra PostgreSQL local (`localhost:5433`) y `npm run build` | Verde: `stages` 200 (4 etapas), `stages/1` 200 con 5 módulos y sus `units` ordenadas, `units/U0.1.1` 200 con `stageId: 0` y `lessons: []`, `resources` 200 vacío, `lessons/no-existe` 404 con `NOT_FOUND` y `traceId`; ninguna respuesta incluye `solution` ni `sources`. `npm run build` en 0 con las cuatro rutas nuevas (`/learn`, `/learn/stages/[id]`, `/learn/units/[code]`, `/learn/lessons/[slug]`), la última dinámica | `5205d46` |
| S3-T10 | `npm test` (shared 45 · API 68 · web 81), `npm run typecheck`, `npm run lint`, `npm run build` | Verde: el contrato de S3 queda documentado en `contratos-api.md` (ejemplo real de `units`/`stageId`, nota de compatibilidad en §7), el roadmap marca S3 🔄 con su estado y el cierre acumulado, y la ficha recoge el resumen construido/desviado/pendiente | `docs(s3)` |

---

## Documentos relacionados

- [`../roadmap-sprints.md`](../roadmap-sprints.md)
- [`sprint-02-contenido.md`](sprint-02-contenido.md)
- [`../../03-arquitectura/contratos-api.md`](../../03-arquitectura/contratos-api.md)
- [`../../03-arquitectura/arquitectura-general.md`](../../03-arquitectura/arquitectura-general.md)
- [`../../05-orquestacion/plantilla-tarea.md`](../../05-orquestacion/plantilla-tarea.md)
