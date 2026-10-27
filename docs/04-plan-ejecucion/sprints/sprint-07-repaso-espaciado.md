# Sprint 07 — Repaso espaciado

> **Estado:** 🔄 en curso · **Inicio:** 2026-10-27 · **Depende de:** S4 ✅ (progreso por estudiante) y S6 ✅ (`Submission` con `outcome`, `score` y `hintsUsed`).
> **Avance:** 0/14 tareas · 0/12 criterios de aceptación.
> **Sesión por tarea:** cada tarea se implementa y verifica en una invocación aislada de comandos; su salida real queda en la bitácora §9.

---

## 1. Objetivo

Los fundamentos se reevalúan a lo largo del tiempo (regla permanente 4 de `07-flujo-operativo.md`). Al cerrar el sprint:

1. Existe un motor **SM-2** puro y probado que, dada la calidad de una recuperación (`q` 0–5), recalcula facilidad, repeticiones, intervalo y próxima fecha.
2. Cada envío de ejercicio **programa** un ítem de repaso para el concepto del ejercicio; fallar lo adelanta, acertar sin pistas lo aplaza.
3. `GET /api/review/queue` sirve la cola diaria del estudiante (máximo 30, intercalada por concepto) y `POST /api/review/items/:id/answer` registra la calidad y devuelve el próximo repaso.
4. El panel de avance deja de mentir: `dueReviews` cuenta los ítems vencidos reales.
5. La web expone la cola en `/learn/review`, con estados de carga, error y vacío, y la enlaza desde la navegación del área privada.

---

## 2. Alcance

| Incluye | No incluye (queda para otro sprint) |
|---------|-------------------------------------|
| Contrato compartido de cola y respuesta (`review.ts`) | Notificaciones, correo o recordatorios push |
| Motor SM-2 puro (`sm2.ts`) con la fórmula de `prerequisitos-y-progreso.md` §5.2 | Analítica agregada de repaso por cohorte (S11) |
| Programación automática del repaso desde el envío corregido (S6) | Repaso de lecciones, quices no ligados a ejercicio o flashcards sueltas |
| Modelos `ReviewItem` y `ReviewLog` + migración `spaced_repetition` | Panel de instructor para reprogramar a mano |
| `GET /api/review/queue` (30 máximo, intercalado) y `POST /api/review/items/:id/answer` | Ajuste de la cuota diaria desde la UI (se documenta la constante) |
| `dueReviews` real en `GET /api/progress/overview` | Cambiar `UnitProgress`/`CompetencyProgress` desde el repaso |
| Web: cola de repaso con las seis calidades y el próximo intervalo | Tutor IA que explique el error (S8) |

**Traspaso desde S6.** El envío ya persiste `outcome`, `score`, `hintsUsed` y `achievedLevel`. S7 **no** vuelve a corregir: deriva `q` de esos campos con una función pura (`qualityFromSubmission`) y programa el repaso. La penalización por pistas de nivel 3+ que S6 difirió (`prerequisitos-y-progreso.md` §5.3) se aplica aquí.

**Traspaso a S4.** `dueReviews` se sirve real, pero el repaso **no** escribe `UnitProgress` ni `CompetencyProgress`: el estado de una unidad sigue decidiéndose por sus lecciones y envíos. Un ítem vencido es una señal para el estudiante, no un cambio de estado.

## 3. Decisiones de diseño

| Decisión | Motivo | Alternativa descartada |
|----------|--------|------------------------|
| La **fórmula SM-2 vive en el servidor** (`apps/api/src/modules/review/sm2.ts`) y es pura | El cliente no puede reprogramarse un repaso a medida; una función sin dependencias se prueba con tabla de casos | Calcular el intervalo en la web y enviarlo |
| `q` se deriva del envío con una tabla explícita | `prerequisitos-y-progreso.md` §5.1 define la escala; el mapeo debe ser auditable y estable | Pedir al estudiante que se autoevalúe tras cada envío |
| Tabla de derivación: `PASSED` + 0 pistas + `score ≥ 90` → 5 · `PASSED` + 0 pistas → 4 · `PASSED` + 1–2 pistas → 3 · `PASSED` + 3+ pistas → 2 · `PARTIAL` → 2 · `FAILED` → 1 · `ERROR`/`TIMEOUT` → 0 | Reproduce las filas 5→0 de §5.1 y aplica el tope de §5.3 («pistas de nivel 3+ penalizan») | `q = score / 20`: ignoraría las pistas, que es justo lo que §5.3 prohíbe |
| Un **único ítem por usuario y ejercicio** (`@@unique([userId, exerciseId])`), reprogramado en cada envío | `modelo-datos.md` §5 ya fija la unicidad; repetir el ejercicio no multiplica la cola | Un ítem por envío: la cola crecería sin límite |
| `concept` del ítem = **primer concepto del ejercicio** (`Exercise.concepts[0]`), `"general"` si no declara | El modelo guarda un concepto por ítem y el ejercicio ya declara sus conceptos para SM-2 (`banco-ejercicios.md` §2) | Concatenar todos los conceptos: rompería el índice y la agrupación |
| La cola se ordena por `priority` desc, `dueAt` asc y se **intercala por concepto** antes de servir | §5.3 pide que al menos el 30 % de la cola mezcle conceptos distintos | Servir el orden crudo: llegarían bloques del mismo concepto |
| Límite diario = **30 ítems** (`REVIEW_QUEUE_MAX`) | §5.3 lo fija como límite configurable; la constante se publica en `shared` y la respuesta la declara | Devolver todo lo vencido: sobrecarga y respuestas enormes |
| `dueReviews` cuenta **todos** los vencidos, no los 30 servidos | El panel debe avisar de la deuda real aunque la sesión diaria esté acotada | Contar sólo la cola: ocultaría repasos pendientes |
| Al responder se actualiza el ítem y se **añade** un `ReviewLog` en la misma transacción | El registro es la evidencia de aciertos/errores; sin transacción un fallo dejaría estado y bitácora divergentes | Escribir primero la bitácora y luego el estado |
| La respuesta de `answer` devuelve `nextDueAt` **sin** el ítem completo | `contratos-api.md` §4.5 fija exactamente cuatro campos; añadir más rompería el contrato vigente | Devolver `ReviewItem` con `exercise` incluido |
| `durationMs` se valida pero **no se persiste** | `modelo-datos.md` §5 no le da columna; inventarla sería cambiar el modelo desde una tarea de API | Ignorarlo sin validar (aceptaría negativos o texto) |
| `GET /queue` y `POST /answer` exigen cookie de sesión y filtran por `userId` del token | `contratos-api.md` §5: «toda ruta protegida se cubre con una prueba de aislamiento» | Recibir `userId` por query o cuerpo |
| Programar el repaso ocurre **después** de persistir el envío | Si la programación falla, el envío no se pierde ni se duplica; el ítem se recalcula en el siguiente envío | Programar antes de corregir: un envío fallido movería la cola |

---


**Traspaso a S11.** El análisis de tiempos (`durationMs`) y de errores frecuentes por ejercicio no entra: la petición de respuesta lo acepta por contrato, pero `ReviewLog` (modelo de `modelo-datos.md` §5) no tiene columna de duración y no se inventa una en este sprint.

---

## 4. Contrato

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/api/review/queue` | ✅ | `200 { items: ReviewQueueItem[], dueReviews: number, limit: number }` |
| POST | `/api/review/items/:id/answer` | ✅ | `200 { nextDueAt, intervalDays, easeFactor, repetitions }` |

```ts
interface ReviewQueueItem {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  exerciseSlug: string;
  concept: string;
  competencies: string[];   // C1–C14
  dueAt: string;            // ISO 8601
  intervalDays: number;     // ≥ 1
  repetitions: number;      // ≥ 0
  easeFactor: number;       // ≥ 1.3
  priority: number;
}

interface ReviewAnswerInput {
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  durationMs?: number;      // ≥ 1; se valida y hoy no se persiste
}

interface ReviewAnswerResult {
  nextDueAt: string;        // ISO 8601
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}
```

```json
// GET /api/review/queue
{
  "items": [
    {
      "id": "ckx…", "exerciseId": "ckx…", "exerciseTitle": "Suma segura",
      "exerciseSlug": "suma-segura-001", "concept": "funciones",
      "competencies": ["C1"], "dueAt": "2026-10-28T09:00:00.000Z",
      "intervalDays": 1, "repetitions": 1, "easeFactor": 2.6, "priority": 0
    }
  ],
  "dueReviews": 7,
  "limit": 30
}
```

```json
// POST /api/review/items/ckx…/answer
{ "quality": 4, "durationMs": 42000 }

// 200
{ "nextDueAt": "2026-11-02T09:00:00.000Z", "intervalDays": 6, "easeFactor": 2.5, "repetitions": 2 }
```

**Fórmula (única fuente de verdad, `sm2.ts`).**

```
facilidad' = facilidad + (0.1 - (5 - q) · (0.08 + (5 - q) · 0.02))
facilidad' = max(1.3, redondeo a 2 decimales)

si q < 3 → repeticiones = 0, intervalo = 1
si q ≥ 3 → repeticiones += 1
           intervalo = 1 si repeticiones = 1
                       6 si repeticiones = 2
                       round(intervalo_anterior · facilidad') si repeticiones > 2

dueAt = ahora + intervalo días
```

**Errores esperados**

| Caso | Respuesta |
|------|-----------|
| Sin cookie de sesión | `401 UNAUTHENTICATED` |
| `:id` inexistente o de otro usuario | `404 NOT_FOUND` |
| `quality` fuera de 0–5, no entera o ausente | `400 VALIDATION_ERROR` con `details[].field = "quality"` |
| `durationMs` no positivo | `400 VALIDATION_ERROR` |

---


## 5. Tareas

| ID | Tarea | Archivos | Estimación | Estado |
|----|-------|----------|-----------|--------|
| S7-T1 | Contrato compartido de repaso (`review.ts`, export en `index.ts`, spec) | `packages/shared/src/schemas/review.ts`, `packages/shared/src/index.ts`, `packages/shared/src/schemas/review.spec.ts` | 1 sesión | ⬜ |
| S7-T2 | Motor SM-2 puro y derivación de `q` desde el envío | `apps/api/src/modules/review/sm2.ts`, `apps/api/src/modules/review/sm2.spec.ts` | 1 sesión | ⬜ |
| S7-T3 | Intercalado de la cola por concepto | `apps/api/src/modules/review/review.queue.ts`, `apps/api/src/modules/review/review.queue.spec.ts` | 1 sesión | ⬜ |
| S7-T4 | Modelos `ReviewItem` y `ReviewLog` + migración `spaced_repetition` | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<ts>_spaced_repetition/migration.sql` | 1 sesión | ⬜ |
| S7-T5 | Puerto de repaso y sus adaptadores Prisma/en memoria | `apps/api/src/modules/review/review.repository.ts`, `prisma-review.repository.ts`, `in-memory-review.repository.ts` | 1 sesión | ⬜ |
| S7-T6 | `ReviewService`: cola, respuesta y programación desde el envío | `apps/api/src/modules/review/review.service.ts`, `review.service.spec.ts` | 1 sesión | ⬜ |
| S7-T7 | Controlador, módulo y registro en `AppModule` | `review.controller.ts`, `review.module.ts`, `apps/api/src/app.module.ts` | 1 sesión | ⬜ |
| S7-T8 | Enganche del envío corregido con la programación SM-2 | `exercises.service.ts`, `exercises.module.ts`, `exercises.service.spec.ts` | 1 sesión | ⬜ |
| S7-T9 | `dueReviews` real en el resumen de progreso | `progress.service.ts`, `progress.module.ts`, `progress.service.spec.ts` | 1 sesión | ⬜ |
| S7-T10 | Cliente web de repaso y sus pruebas | `apps/web/src/lib/api-client.ts`, `api-client.spec.ts` | 1 sesión | ⬜ |
| S7-T11 | Componente de cola de repaso con las seis calidades | `apps/web/src/features/review/components/ReviewQueue.tsx`, `ReviewQueue.spec.tsx` | 1 sesión | ⬜ |
| S7-T12 | Página `/learn/review` y enlace en la navegación del área privada | `apps/web/src/app/(learning)/learn/review/page.tsx`, `apps/web/src/app/(learning)/learn/layout.tsx` | 1 sesión | ⬜ |
| S7-T13 | Documentación de cierre (`contratos-api.md` §4.5, `modelo-datos.md` §5, roadmap, README, esta ficha) | docs | 1 sesión | ⬜ |
| S7-T14 | Verificación HTTP de cierre con dos usuarios y limpieza | guion fuera del repositorio + docs | 1 sesión | ⬜ |

> **Regla de tamaño:** ninguna tarea toca más de 3 archivos. T13 es sólo documentación (el Orquestador la ejecuta al cerrar) y T14 no toca archivos de producción.

**Orden y dependencias.** T1–T6 no dependen de nada más que de S4/S6 cerrados. T7 depende de T6; T8 de T6 y del `ExercisesService` de S6; T9 de T6 y de `ProgressService`; T10 de T1; T11 de T10; T12 de T11; T13 y T14 cierran.

---


## 6. Criterios de aceptación

- [ ] `S7-T1`: `reviewAnswerSchema` rechaza `quality: 6`, `quality: 2.5` y un cuerpo con `userId`; `reviewQueueItemSchema` rechaza `easeFactor: 1.2` e `intervalDays: 0`.
- [ ] `S7-T2`: con `q = 5` la facilidad sube a `2.6` y con `q = 0` baja a `1.7`; `q < 3` deja `repetitions: 0` e `intervalDays: 1`.
- [ ] `S7-T2`: la secuencia `q = 5, 5, 5` produce intervalos `1, 6, 16` días y la fecha `dueAt` es exactamente `ahora + intervalo` días.
- [ ] `S7-T2`: un `PASSED` con 0 pistas y `score ≥ 90` deriva `q = 5`; con 3 pistas deriva `q = 2`; `FAILED` deriva 1 y `ERROR` deriva 0.
- [ ] `S7-T3`: una cola con dos conceptos alterna conceptos en al menos el 30 % de las parejas adyacentes y conserva el orden relativo dentro de cada concepto.
- [ ] `S7-T4`: la migración `spaced_repetition` crea `ReviewItem` y `ReviewLog`, con cascada desde `User` y `Exercise`, unicidad `[userId, exerciseId]` e índices `[userId, dueAt]` y `[reviewItemId, reviewedAt]`.
- [ ] `S7-T6`: responder con `quality: 4` un ítem con `repetitions: 1` devuelve `intervalDays: 6` y `repetitions: 2`; un ítem ajeno o inexistente devuelve `404 NOT_FOUND`.
- [ ] `S7-T7`: `GET /api/review/queue` sin cookie responde `401 UNAUTHENTICATED` e incluye cabecera `x-trace-id`.
- [ ] `S7-T8`: un envío `PASSED` sin pistas crea un `ReviewItem` con `repetitions: 1`; un `FAILED` posterior lo deja en `repetitions: 0` con `intervalDays: 1` y `dueAt` a un día.
- [ ] `S7-T9`: `GET /api/progress/overview` publica el número real de ítems vencidos y `0` cuando no hay ninguno.
- [ ] `S7-T11`: la cola muestra estados de carga, error y vacío; al responder informa el próximo intervalo y retira el ítem.
- [ ] `S7-T14`: la verificación HTTP real recorre cola, respuesta, aislamiento, validación y repaso programado por el envío, con `OK=… FAIL=0`, y deja la base limpia.

**Estado:** 0/12 verificados.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Reprogramar en cada envío y convertir el repaso en un bucle diario infinito | El intervalo se recalcula desde el estado guardado; un acierto sin pistas lo alarga (1 → 6 → ~16 días) y la cola sólo sirve lo vencido |
| `q` derivado del `outcome` del sandbox en vez de la corrección de S6 | Se usa lo que persiste `Submission` (corregido por S6), no la salida cruda del sandbox |
| Un ítem se responde dos veces seguidas y adelanta la fecha | Responder vuelve a aplicar SM-2 desde el estado actual; el ítem sale de la cola hasta su nueva fecha. La prueba fija la progresión |
| La cola filtra datos de otro estudiante | `userId` sale del token; el adaptador filtra `[userId, id]` y hay prueba de aislamiento |
| El intercalado rompe la prioridad | Se agrupa por concepto conservando el orden de entrada y se reparte por turnos; una prueba comprueba ambos órdenes |
| El límite de 30 oculta deuda | `dueReviews` se cuenta sobre el total, no sobre la página servida |
| `ReviewLog` crece sin control | `@@index([reviewItemId, reviewedAt])` y una fila por respuesta; la purga analítica es de S11 |

---

## 8. Fuera de alcance (a propósito)

- Notificaciones, rachas, correo o recordatorios.
- Repaso de lecciones o quices no ligados a un ejercicio.
- Analítica de tiempos (`durationMs`) y errores frecuentes por ejercicio: S11.
- Panel de instructor para reprogramar ítems a mano.
- Sincronizar `needs_review` de unidades con la cola: el estado de unidad sigue siendo de S4.
- Tutor IA sobre el fallo: S8.

---

## 9. Bitácora

| Tarea | Verificación | Resultado | Commit |
|-------|--------------|-----------|--------|
| S7-T1 | — | ⬜ pendiente | — |

---

## Documentos relacionados

- [`roadmap-sprints.md`](../roadmap-sprints.md) §S7 — objetivo, entregables y criterio de salida.
- [`prerequisitos-y-progreso.md`](../../01-curriculo/prerequisitos-y-progreso.md) §5 — intervalos, fórmula y ajustes del dominio.
- [`contratos-api.md`](../../03-arquitectura/contratos-api.md) §4.5 — contrato de repaso.
- [`modelo-datos.md`](../../03-arquitectura/modelo-datos.md) §5 — `ReviewItem` y `ReviewLog`.
- [`sprint-06-correccion-pistas.md`](sprint-06-correccion-pistas.md) — envío corregido del que se deriva `q`.

