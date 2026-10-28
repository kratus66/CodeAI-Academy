# Sprint 10 — Simulaciones de entrevista

> **Estado:** ✅ implementado y verificado (2026-10-28) · **Depende de:** S8 ✅ (capa de IA: `AiService`, presupuesto, auditoría y filtro de fuga), S9 ✅ (motor de rúbricas y evidencia de competencia) y S4 ✅ (metas y `CompetencyProgress`).
> **Avance:** 17/17 tareas · 16/16 criterios de aceptación · verificación HTTP real **16/16**.
> **Sesión por tarea:** cada tarea se implementa y verifica en una invocación aislada de comandos; su salida real queda en la bitácora §9.
> **Por qué este sprint existe:** el criterio de egreso no es «terminó las lecciones», es «defiende lo que construyó». S10 convierte la rúbrica §2.6 de `rubricas-evaluacion.md` en un flujo ejecutable dentro del producto, con transcripción guardada y nota comparable entre intentos.

---

## 1. Objetivo

Al cerrar el sprint, un estudiante puede abrir un escenario de entrevista técnica (rol, nivel, lenguaje y competencias), sostener una conversación por turnos con un entrevistador que respeta un guion por fases, cerrar la sesión, autoevaluarse con la rúbrica §2.6 y recibir una nota de un instructor con evidencia en su competencia **C10 (comunicación técnica / entrevista)**. Puede repetir el mismo escenario y **comparar** nota, duración y criterios débiles entre intentos.

## 2. Alcance

**Incluye**

- Contrato compartido `interviews`: escenarios, fases, estados de sesión, entradas de transcripción, rúbrica §2.6, payloads de turno/cierre/autoevaluación/revisión y respuestas del historial.
- Persistencia de escenarios (catálogo sembrado) y de sesiones con transcripción en `Json`, estado y notas (`InterviewScenario` + `InterviewSession`, ampliando `modelo-datos.md` §6).
- Servicio con el ciclo completo: crear sesión → intercambiar turnos → cerrar → autoevaluar → revisar (instructor) → historial comparativo.
- Entrevistador generado por el puerto de IA de S8 (caso de uso `interview`, temperatura 0,7 y 800 tokens), con degradación a **guion estático** cuando no hay proveedor o cuando se agota el presupuesto.
- Reglas de propiedad y rol: solo el dueño lee y escribe su sesión; la revisión exige `INSTRUCTOR` o `ADMIN` vía `RolesGuard` (S9-T2).
- Web: catálogo de escenarios, sala de entrevista con chat por fases y cronómetro, e informe con historial y comparación entre intentos.
- Documentación de los contratos nuevos (§4.12 de `contratos-api.md`) y del modelo.

**No incluye**

- Audio, vídeo ni reconocimiento de voz. La entrevista es **texto**; la grabación audiovisual del perfil profesional se hace fuera del producto y se declara en §8.
- Emparejamiento en vivo entre dos personas ni entrevistas en tiempo real con WebSockets.
- Corrección automática de la nota por IA. La IA conduce la entrevista y puede **sugerir** criterios, pero la nota que cuenta es la del instructor (§3.5).

**Fuera de alcance explícito**

- Elaborar el banco completo de preguntas por competencia (`banco-ejercicios.md` §3.8). S10 siembra **9 escenarios** (3 roles × 3 niveles) y deja el resto como contenido de autoría.

## 3. Decisiones de diseño

**3.1 La sesión es una máquina de estados, no un chat libre.** `IN_PROGRESS → COMPLETED → REVIEWED`, con `ABANDONED` como salida por inactividad (48 h sin turnos, calculada al leer, no por cron). Las transiciones viven en el servicio y se prueban como tabla: `COMPLETED → IN_PROGRESS` es `409`, revisar dos veces la misma sesión es `409` y autoevaluar antes de cerrar es `409`. Sin estas guardas, la nota de una sesión podría cambiar después de emitirla.

**3.2 El guion se impone desde el servidor, no desde el modelo.** Cada escenario declara fases (`warmup`, `conceptual`, `live-coding`, `code-review`, `follow-ups`, `candidate-questions`) con un número máximo de turnos. El servicio avanza la fase por conteo, no por lo que diga el modelo: así una respuesta persuasiva del proveedor no puede saltarse la parte de código ni alargar la sesión hasta consumir el presupuesto. El prompt de sistema recibe la fase actual y **no** las respuestas de la rúbrica.

**3.3 El turno del estudiante se valida antes de gastar tokens.** Longitud 1–2 000 caracteres, sin bloques de código de más de 400 líneas, tope de 40 turnos por sesión y cuota horaria heredada de S8 (`aiRateLimit`). Un turno rechazado no escribe transcripción ni auditoría. El límite existe por dinero: cada turno es una llamada al proveedor.

**3.4 La transcripción se guarda completa, con roles y fase.** `transcript: Json` es una lista de `{ role, phase, content, at }` validada al leer con `readTranscript` (mismo patrón que `readRubric` de S9). Se guarda y se sirve solo al dueño y a instructores/admin: es el dato más sensible del producto, contiene lo que el estudiante **no** sabe. En el listado de cohorte (S11) no se expone.

**3.5 Nota: autoevaluación + revisión humana, en ese orden.** `selfReview` exige rúbrica completa (5 criterios) y una reflexión de ≥ 200 caracteres; es un requisito pedagógico del perfil profesional, no un adorno, y queda guardado en `selfScores` junto a la nota del instructor para que el estudiante vea su desvío. La revisión del instructor usa el motor de puntuación de S9 (pesos, niveles 0–4, puerta de correctitud, dos decimales), no una copia. Nota ≥ 80 escribe evidencia `CompetencyProgress` para **C10**; por debajo, no.

**3.6 La IA nunca ve la solución a medias.** El caso `interview` reutiliza el filtro de fuga de S8 sobre la solución de referencia del escenario (`referenceSolution`, solo en el catálogo, nunca servida al cliente). Si el filtro no puede garantizar que la respuesta no contiene la solución, se sustituye por la réplica estática de la fase.

**3.7 Sin proveedor, la entrevista sigue existiendo.** `AI_PROVIDER=mock` (o presupuesto agotado) devuelve la réplica estática del guion y marca `degraded: true` en la respuesta del turno. La sesión puede completarse, cerrarse y evaluarse igual: el producto no depende de una clave de API para acreditar C10.

**3.8 Un escenario, varios intentos.** No hay índice único por usuario y escenario; el criterio de salida pide **repetir y comparar**. Lo que sí se limita es la concurrencia: una sesión `IN_PROGRESS` por usuario y escenario (`409 SESSION_IN_PROGRESS`); las anteriores deben cerrarse o abandonarse.

---

## 4. Contrato

### 4.1 Tipos compartidos (`packages/shared/src/schemas/interview.ts`)

```ts
export const INTERVIEW_PHASES = [
  "warmup", "conceptual", "live-coding", "code-review", "follow-ups", "candidate-questions",
] as const;
export type InterviewPhase = (typeof INTERVIEW_PHASES)[number];

export const INTERVIEW_STATUSES = ["IN_PROGRESS", "COMPLETED", "REVIEWED", "ABANDONED"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_CRITERIA = [
  "razonamiento", "correctitud", "comunicacion", "seguimiento", "limites",
] as const;
export type InterviewCriterion = (typeof INTERVIEW_CRITERIA)[number];

// Pesos de rubricas-evaluacion.md §2.6 (suman 100).
export const DEFAULT_INTERVIEW_RUBRIC: Record<InterviewCriterion, number> = {
  razonamiento: 30, correctitud: 25, comunicacion: 20, seguimiento: 15, limites: 10,
};
```

| Esquema | Forma esencial |
|---------|----------------|
| `interviewScenarioSummarySchema` | `{ slug, title, role, level, language, competencies[], phaseCount, estimatedMinutes, attempts }` |
| `interviewScenarioSchema` | lo anterior + `phases[{ phase, maxTurns, objective }]` + `rubric` (nunca `referenceSolution`) |
| `interviewTranscriptEntrySchema` | `{ role: "interviewer" \| "candidate", phase, content, at }` |
| `interviewSessionSummarySchema` | `{ id, scenarioSlug, scenarioTitle, status, phase, turns, startedAt, finishedAt, durationMinutes, score, selfScore }` |
| `interviewSessionSchema` | resumen + `transcript[]`, `selfScores`, `scores`, `feedback`, `degraded` |
| `interviewSelfReviewRecordSchema` | `{ scores, score, reflection }` guardado en `selfScores` |
| `startInterviewSessionSchema` | `{ scenarioSlug }` |
| `sendInterviewMessageSchema` | `{ message }` con `1..2000` |
| `interviewTurnResponseSchema` | `{ reply, phase, turn, turnsRemaining, degraded, budgetRemainingUsd }` |
| `selfReviewSchema` | `{ scores: { [criterio]: 0..4 }, reflection }` con `200..2000` |
| `reviewInterviewSchema` | `{ scores, feedback, invalidate? }` |
| `interviewHistoryResponseSchema` | `{ items[], best: { score, sessionId } \| null, average }` |

Reglas de validación compartidas: `role` ∈ `{ backend, frontend, fullstack, data, qa }`, `level` ∈ `{ junior, semi-senior, senior }`, `language` ∈ `{ ts, py, java, go }`; `scores` acepta enteros 0–4 y exige **todos** los criterios; `feedback` es obligatorio salvo `invalidate: true`.

### 4.2 Rutas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/interviews/scenarios` | ✅ | Catálogo publicado; filtros `role`, `level`, `language`, paginación |
| `GET` | `/api/interviews/scenarios/:slug` | ✅ | Detalle con fases y rúbrica; sin `referenceSolution` |
| `POST` | `/api/interviews/sessions` | ✅ | Crea sesión `IN_PROGRESS`; `409` si ya hay una del mismo escenario |
| `GET` | `/api/interviews/sessions/me` | ✅ | Historial propio con mejor nota y promedio |
| `GET` | `/api/interviews/sessions/:id` | ✅ dueño · 🎓 | Detalle con transcripción; ajeno → `404` |
| `POST` | `/api/interviews/sessions/:id/messages` | ✅ dueño | Turno del candidato → réplica del entrevistador |
| `POST` | `/api/interviews/sessions/:id/finish` | ✅ dueño | Cierra la sesión |
| `POST` | `/api/interviews/sessions/:id/self-review` | ✅ dueño | Autoevaluación §2.6 + reflexión |
| `POST` | `/api/interviews/sessions/:id/review` | 🎓 `INSTRUCTOR`/`ADMIN` | Nota, retroalimentación y evidencia C10 |

`🎓` = requiere `RolesGuard`. `dueño` = el `userId` sale del token, nunca del cuerpo ni de la ruta.

### 4.3 Ejemplo de turno

```jsonc
// POST /api/interviews/sessions/<id>/messages
{ "message": "Empezaría validando si el array puede venir vacío y si los números pueden ser negativos." }

// 200
{
  "reply": "Bien. Antes de escribir código: ¿qué harías si el array tiene 10^6 elementos?",
  "phase": "conceptual",
  "turn": 3,
  "turnsRemaining": 37,
  "degraded": false,
  "budgetRemainingUsd": 4.82
}
```

### 4.4 Errores propios

| Código | HTTP | Cuándo |
|--------|------|--------|
| `SCENARIO_NOT_FOUND` | 404 | Escenario inexistente o no publicado |
| `SESSION_NOT_FOUND` | 404 | Sesión inexistente o de otro usuario (mismo texto, no se filtra existencia) |
| `SESSION_IN_PROGRESS` | 409 | Ya hay una sesión abierta de ese escenario |
| `SESSION_CLOSED` | 409 | Turno o cierre sobre una sesión `COMPLETED`/`REVIEWED` |
| `SESSION_ALREADY_REVIEWED` | 409 | Segunda revisión sin `invalidate` |
| `SELF_REVIEW_REQUIRED` | 409 | Revisión del instructor antes de la autoevaluación |
| `TURN_LIMIT_REACHED` | 429 | 40 turnos consumidos |
| `RATE_LIMITED` | 429 | Cuota horaria de IA (S8) |

---

## 5. Tareas

| # | Tarea | Archivos (≤ 4 por tarea) | Verificación |
|---|-------|--------------------------|--------------|
| **T1** ✅ | Contrato compartido: fases, estados, criterios, pesos §2.6, esquemas de escenario, sesión, transcripción, turno, autoevaluación, revisión e historial | `packages/shared/src/schemas/interview.ts`, `packages/shared/src/index.ts`, `packages/shared/src/schemas/interview.spec.ts` | `npm run test -w @codeai/shared` |
| **T2** ✅ | Modelos `InterviewScenario` e `InterviewSession` (`transcript Json`, `scores Json`, `selfScores Json`, enum `InterviewSessionStatus`, relaciones en `User`) y migración `interviews` aplicada a la base de desarrollo | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_interviews/migration.sql` | `prisma migrate diff` + `psql \d "InterviewSession"` |
| **T3** ✅ | Semilla de 9 escenarios (3 roles × 3 niveles) idempotente por `slug`, con fases, rúbrica y solución de referencia; script `db:seed:interviews` | `apps/api/prisma/seed/interviews.seed.json`, `apps/api/prisma/seed/seed-interviews.mts`, `apps/api/package.json`, `package.json` | `npm run db:seed:interviews` + `psql select count(*)` |
| **T4** ✅ | Lectores de `Json` guardado: `readTranscript` y `readInterviewScores` | `apps/api/src/modules/interviews/transcript.ts`, `…/transcript.spec.ts` | `npm run test -w @codeai/api` |
| **T5** ✅ | Puerto `InterviewRepository` (escenarios, sesión, turnos, cierre, autoevaluación, revisión, historial) con adaptador Prisma y uno en memoria | `apps/api/src/modules/interviews/interview.repository.ts`, `…/prisma-interview.repository.ts`, `…/in-memory-interview.repository.ts` | `npm run test -w @codeai/api` |
| **T6** ✅ | `InterviewsService.listScenarios`/`getScenario`: solo publicados, filtros por rol/nivel/lenguaje, paginación y número de intentos del usuario | `apps/api/src/modules/interviews/interviews.service.ts`, `…/interviews.service.spec.ts` | `npm run test -w @codeai/api` |
| **T7** ✅ | `startSession`: escenario publicado, una sola sesión `IN_PROGRESS` por usuario y escenario, `userId` del token, primer turno del entrevistador (o réplica estática) | `…/interviews.service.ts`, `…/interviews.service.spec.ts` | `npm run test -w @codeai/api` |
| **T8** ✅ | `sendMessage`: validación previa, fase por conteo, prompt con la fase y sin rúbrica, llamada al puerto de IA de S8, filtro de fuga, degradación y auditoría con `module: "interview"` | `…/interviews.service.ts`, `…/interviews.service.spec.ts` | `npm run test -w @codeai/api` |
| **T9** ✅ | `finishSession` (solo dueño, desde `IN_PROGRESS`, duración calculada) y `getSession`/`getHistory` con `404` indistinguible para sesiones ajenas | `…/interviews.service.ts`, `…/interviews.service.spec.ts` | `npm run test -w @codeai/api` |
| **T10** ✅ | `selfReview`: exige `COMPLETED`, rúbrica completa y reflexión de 200+ caracteres; reutiliza el motor de S9 para la nota autoevaluada | `…/interviews.service.ts`, `…/interviews.service.spec.ts` | `npm run test -w @codeai/api` |
| **T11** ✅ | `review`: solo `INSTRUCTOR`/`ADMIN`, autoevaluación previa, nota con el motor de S9, `reviewedById`, `409` en segunda revisión y evidencia `CompetencyProgress` de C10 con nota ≥ 80 | `…/interviews.service.ts`, `…/interviews.service.spec.ts` | `npm run test -w @codeai/api` |
| **T12** ✅ | `InterviewsController` (9 rutas, `JwtAuthGuard` y `RolesGuard` en la revisión), `InterviewsModule` y registro en `AppModule` | `apps/api/src/modules/interviews/interviews.controller.ts`, `…/interviews.module.ts`, `apps/api/src/app.module.ts` | `npm run test -w @codeai/api` + `npm run build -w @codeai/api` |
| **T13** ✅ | `interviewsApi` en el cliente web (catálogo, detalle, sesión, turno, cierre, autoevaluación, revisión, historial) con `401`/`403`/`404`/`409`/`429` tipados | `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/api-client.spec.ts` | `npm run test -w @codeai/web` |
| **T14** ✅ | `ScenarioCatalog` con carga, error, vacío y `attempts`, y página `/learn/interviews` | `apps/web/src/features/interviews/components/ScenarioCatalog.tsx`, `…/ScenarioCatalog.spec.tsx`, `apps/web/src/app/(learning)/learn/interviews/page.tsx` | `npm run test -w @codeai/web` |
| **T15** ✅ | `InterviewRoom`: chat por fases, fase actual, turnos restantes, cronómetro, aviso `degraded`, cierre con confirmación y página `/learn/interviews/[slug]` | `…/components/InterviewRoom.tsx`, `…/InterviewRoom.spec.tsx`, `apps/web/src/app/(learning)/learn/interviews/[slug]/page.tsx` | `npm run test -w @codeai/web` |
| **T16** ✅ | `InterviewReport`: transcripción, autoevaluación frente a nota, comparación entre intentos y formulario de revisión para instructores | `…/components/InterviewReport.tsx`, `…/InterviewReport.spec.tsx`, `apps/web/src/app/(learning)/learn/interviews/sessions/[id]/page.tsx`, `apps/web/src/app/(instructor)/instructor/interviews/[id]/page.tsx` | `npm run test -w @codeai/web` |
| **T17** ✅ | Enlace a Entrevistas en la navegación; `contratos-api.md` §4.12, `modelo-datos.md` §6 y `roadmap-sprints.md` §S10 con el contrato real; verificación HTTP de cierre (§10) | `apps/web/src/app/(learning)/learn/layout.tsx`, `docs/03-arquitectura/contratos-api.md`, `docs/03-arquitectura/modelo-datos.md`, `docs/04-plan-ejecucion/roadmap-sprints.md` | `typecheck && lint && test && build` en la raíz |

**Orden de ejecución.** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17. T8 exige S8 cerrado (puerto de IA, presupuesto y filtro de fuga) y T10/T11 exigen S9-T5 (motor de puntuación); si alguno no existe, el sprint no arranca.

---

## 6. Criterios de aceptación

| # | Criterio (binario: se cumple o no) | Tarea |
|---|------------------------------------|-------|
| 1 | `@codeai/shared` exporta los 11 esquemas y las 3 constantes; el spec cubre fases inválidas, criterios incompletos y `message` vacío o de 2 001 caracteres | T1 |
| 2 | `prisma migrate diff` sale vacío y `InterviewSession` tiene `transcript`, `scores`, `selfScores` y `status` | T2 |
| 3 | `npm run db:seed:interviews` dos veces deja 9 escenarios, no 18 | T3 |
| 4 | Un `Json` de transcripción corrupto devuelve `422` de dominio, no revienta el proceso | T4 |
| 5 | `GET /api/interviews/scenarios` devuelve solo publicados, respeta `role`/`level`/`language` y no incluye `referenceSolution` en el JSON serializado | T6 |
| 6 | Dos `POST /api/interviews/sessions` seguidos del mismo escenario y usuario: el segundo devuelve `409 SESSION_IN_PROGRESS` | T7 |
| 7 | Con el proveedor `mock`, un turno devuelve `200`, `degraded: true` y deja una fila de auditoría con `module: "interview"` | T8 |
| 8 | Un turno con la solución de referencia pegada no la reproduce en `reply` (0 apariciones del código) | T8 |
| 9 | Tras 40 turnos, el 41 devuelve `429 TURN_LIMIT_REACHED` sin llamar al proveedor | T8 |
| 10 | `GET /api/interviews/sessions/:id` de una sesión ajena devuelve exactamente el mismo cuerpo que una inexistente | T9 |
| 11 | `finish` desde `COMPLETED` es idempotente y desde `REVIEWED` devuelve `409`; la duración guardada está entre 1 y 240 minutos | T9 |
| 12 | Autoevaluar antes de cerrar devuelve `409 SESSION_CLOSED`; con reflexión de 199 caracteres, `400` | T10 |
| 13 | `POST …/review` sin rol devuelve `403`; con rol y sin autoevaluación, `409 SELF_REVIEW_REQUIRED`; dos veces, `409 SESSION_ALREADY_REVIEWED` | T11 |
| 14 | Nota 85 escribe una fila de `CompetencyProgress` para C10; nota 79 no escribe nada | T11 |
| 15 | El historial propio devuelve `best`, `average` y los intentos del mismo escenario ordenados; no incluye sesiones de otros usuarios | T9 |
| 16 | La prueba de componente de `InterviewRoom` verifica envío, fase, turnos restantes, aviso `degraded` y cierre con confirmación; `npm run build -w @codeai/web` termina con 0 | T15 |

---

## 7. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Coste descontrolado: cada turno es una llamada al proveedor | Alta | Alto | Tope de 40 turnos, cuota horaria de S8, presupuesto compartido y `degraded` al agotarlo; el turno se valida antes de gastar |
| La transcripción expone lo que el estudiante no sabe | Media | Alto | Solo dueño e instructores; nunca en cohortes (S11); `404` indistinguible y sin correo en las respuestas |
| El modelo se salta fases o alarga la conversación | Media | Medio | La fase y el turno los decide el servidor por conteo (§3.2); el prompt no recibe la rúbrica |
| Nota del instructor inconsistente entre revisores | Alta | Medio | Rúbrica fija §2.6 con niveles 0–4 y motor compartido de S9; la autoevaluación previa da un ancla y el desvío queda visible |
| El estudiante «aprende» las réplicas del `mock` y no la entrevista | Media | Bajo | El mock se marca como `degraded` en la UI y no otorga evidencia por sí solo: la nota que cuenta es humana |
| La rúbrica cambia y las sesiones viejas no se pueden puntuar | Media | Alto | La sesión guarda la rúbrica aplicada en `scores.rubric`; el lector la valida y nunca recalcula con la rúbrica actual |
| Migración divergente entre `schema.prisma` y la base | Media | Alto | Mismo procedimiento que S2–S9: `migrate diff --script`, `psql` por `stdin` y fila en `_prisma_migrations` |
| `prisma migrate dev` se cuelga en este entorno | Alta | Alto | Verificado en S2–S9: SQL generado y aplicado a mano |

---

## 8. Fuera de alcance (aplazado con motivo)

- **Voz y vídeo.** Requiere almacenamiento de objetos, transcripción y consentimiento explícito; el producto es texto hasta que haya presupuesto de infraestructura.
- **Emparejamiento entre estudiantes** (mock interviews cruzadas). Necesita calendario, salas y moderación; no hay caso de uso antes de S11.
- **Sugerencia automática de nota por IA.** La rúbrica §2.6 exige juicio; la IA puede proponer criterios, pero la propuesta **no** se persiste hasta que exista el clasificador de calidad de `capa-ia.md` §8 (deuda de S8).
- **Banco completo de preguntas por competencia.** S10 siembra 9 escenarios; el contenido de autoría queda como tarea de contenido.
- **Puntuación en tiempo real durante la sesión.** El informe se calcula al cerrar; mostrar la nota mientras se responde incentiva actuar para la nota.

---

## 9. Bitácora

| Tarea | Commit | Verificación ejecutada | Resultado real |
|-------|--------|------------------------|----------------|
| T1 | — | `npm run test -w @codeai/shared -- src/schemas/interview.spec.ts` + `typecheck` | **18/18** pruebas del contrato; typecheck en 0 |
| T2 | — | `prisma migrate diff --script` + `migrate deploy` + `\dt` en psql | Migración `20261028170000_interviews` aplicada; diff posterior «empty migration»; `InterviewScenario` e `InterviewSession` presentes |
| T3 | — | `npm run db:seed:interviews` dos veces + `count(*)` | **9 escenarios** (backend 3 · frontend 3 · data 3), la segunda ejecución no duplica; `referenceSolution` solo en base |
| T4 | — | `npm run test -w @codeai/api -- src/modules/interviews/transcript.spec.ts src/modules/projects/rubric.spec.ts` | **16 + 20** pruebas; motor de S9 sin regresiones tras extraer `scoreLevels` |
| T5 | — | `typecheck` + pruebas de servicio con el adaptador en memoria | Puerto, adaptador Prisma y adaptador en memoria compilan; 31 pruebas de servicio lo ejercitan |
| T6 | — | `npm run test -w @codeai/api -- src/modules/interviews` | Catálogo: solo publicados, filtros y `attempts` propios verificados |
| T7 | — | ídem | `IN_PROGRESS` + apertura estática; segundo intento **409 SESSION_IN_PROGRESS**; inactividad 48 h → `ABANDONED` |
| T8 | — | ídem + `src/modules/ai/ai.service.spec.ts` | Turno 200 con fase por conteo, degradación propagada, 41.º turno **429** sin proveedor, auditoría `module: "interview"` y filtro de fuga |
| T9 | — | ídem | Cierre idempotente con duración 32 min, `404` indistinguible, historial con `best`/`average` y solo sesiones propias |
| T10 | — | ídem | Autoevaluación exige `COMPLETED`; reflexión de 199 → **400**; nota autoevaluada 93.75 |
| T11 | — | ídem | **403** sin rol, **409 SELF_REVIEW_REQUIRED**, **409 SESSION_ALREADY_REVIEWED**; nota 85 deja C10 nivel 3 y 76.25 no deja evidencia |
| T12 | — | `typecheck` + `lint` + `npm run build -w @codeai/api` | 9 rutas mapeadas (`sessions/me` antes de `sessions/:id`); build en 0 |
| T13 | — | `npm run test -w @codeai/web -- src/lib/api-client.spec.ts` | **65/65** pruebas (8 nuevas de entrevistas); `409`/`429` tipados con `Retry-After` |
| T14 | — | `npm run test -w @codeai/web -- src/features/interviews` | **4** pruebas de `ScenarioCatalog` (carga, error con reintento, vacío, intentos) |
| T15 | — | ídem | **5** pruebas de `InterviewRoom`: envío, fase, turnos restantes, aviso `degraded`, reanudación por `409` y cierre con confirmación |
| T16 | — | ídem + `npm run build -w @codeai/web` | **5** pruebas de `InterviewReport`; build de la web en 0 |
| T17 | — | `npm run typecheck && npm run lint && npm test && npm run build` + script HTTP | Suite **1 200** (shared 241 · API 739 · web 220); HTTP **16/16**; todo en 0 |

---

## 10. Verificación HTTP de cierre

Script fuera del repositorio (`%TEMP%\codeai-s10\verify-s10.ps1`), contra la API en `http://localhost:3001`, con tres usuarios sembrados (estudiante A, estudiante B, instructor) y `AI_PROVIDER=mock`.

1. Login de A, B e instructor → `200` y cookies.
2. `GET /api/interviews/scenarios` con A → `200`, solo publicados, sin `referenceSolution` en el JSON serializado.
3. `GET /api/interviews/scenarios/<slug>` con A → `200` con 6 fases y rúbrica de 5 criterios que suma 100.
4. `POST /api/interviews/sessions` (A, slug) → `201` `IN_PROGRESS` con primer turno del entrevistador.
5. Repetir el mismo `POST` con A → `409 SESSION_IN_PROGRESS`.
6. `POST …/messages` con A → `200`, `degraded: true`, fase avanzada según conteo.
7. `POST …/messages` con B sobre la sesión de A → `404`, cuerpo idéntico al de un `id` aleatorio.
8. `GET /api/interviews/sessions/<id>` con A → `200` con transcripción de 3 entradas.
9. `POST …/finish` con A → `200` `COMPLETED` con `durationMinutes ≥ 1`.
10. `POST …/messages` con A sobre la sesión cerrada → `409 SESSION_CLOSED`.
11. `POST …/self-review` con A y rúbrica incompleta → `400`; completa → `200` con `selfScore`.
12. `POST …/review` con B (estudiante) → `403`; con instructor → `200` con nota y `feedback`.
13. Repetir `review` → `409 SESSION_ALREADY_REVIEWED`.
14. `psql` con nota ≥ 80 → una fila en `CompetencyProgress` para C10.
15. `GET /api/interviews/sessions/me` con A → 2 sesiones (una `REVIEWED`), `best` y `average` coherentes; con B → lista vacía.
16. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` en la raíz → todo en 0.

**Resultado real (2026-10-28):** **16/16** comprobaciones en verde.

- Script: `%TEMP%\codeai-s10\verify-s10.ps1`, API en `http://localhost:3001/api`, `AI_PROVIDER=mock`.
- Los tres usuarios de la corrida se insertan por SQL reutilizando el hash bcrypt de un usuario previo: el registro por HTTP tiene un límite de 3/hora por IP que impedía repetir la verificación.
- Evidencia comprobada en base: `CompetencyProgress` de **C10** con `level = 3` y `evidenceCount = 1`; el historial de A devuelve una sesión `REVIEWED`, `best = 85` y `average = 85`, y el de B queda vacío.
- Incidencia resuelta: `Out-File` de PowerShell añadió BOM al `migration.sql` y PostgreSQL lo rechazó (`syntax error at or near ""`). Se reescribió el archivo con `UTF8Encoding(false)`, se marcó la migración fallida como `rolled-back` y se reaplicó con `migrate deploy`; el `migrate diff` final sale vacío.

---

## Documentos relacionados

- `docs/01-curriculo/rubricas-evaluacion.md` §2.6 y §2.7 — pesos y niveles de la entrevista.
- `docs/01-curriculo/perfil-profesional.md` — C10 y la grabación de simulación con autoevaluación.
- `docs/03-arquitectura/capa-ia.md` §3 y §9 — caso de uso `interview`, presupuesto y auditoría.
- `docs/03-arquitectura/modelo-datos.md` §6 — `InterviewScenario`, `InterviewSession` y su extensión.
- `docs/03-arquitectura/contratos-api.md` §4.12 — contrato que este sprint escribe.
- `docs/04-plan-ejecucion/sprints/sprint-08-capa-ia.md` — puerto de IA que S10 consume.
- `docs/04-plan-ejecucion/sprints/sprint-09-proyectos-rubricas.md` — motor de puntuación y `RolesGuard`.
- `docs/05-orquestacion/plantilla-tarea.md` — estructura de esta ficha.

