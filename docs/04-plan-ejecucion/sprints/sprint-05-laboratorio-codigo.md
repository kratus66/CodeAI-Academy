# Sprint 05 — Laboratorio de código

> **Estado:** 🔄 en curso · **Inicio:** 2026-10-27 · **Depende de:** S2 ✅ (contenido) y S3 🔄 (unidad servida); de S4 sólo hereda el vocabulario de progreso, no su código.
> **Avance:** 0/14 tareas · 0/13 criterios de aceptación.
> **Sesión por tarea:** cada tarea se implementa y verifica en una invocación aislada de comandos; su salida real queda en la bitácora §9.

---

## 1. Objetivo

El estudiante **escribe código en el navegador, lo ejecuta y envía**, y el resultado de las pruebas visibles vuelve desde un sandbox en modo `mock`. Ningún fragmento de código del estudiante se evalúa en el proceso de la API (`sandbox-ejecucion.md` §1).

Al cerrar el sprint, la plataforma puede asumir:

1. Existen `Exercise`, `ExerciseHint`, `ExerciseTest`, `Submission` y `SubmissionTestResult` con sus relaciones y cascadas.
2. Un usuario autenticado lista los ejercicios de una unidad y abre el detalle **sin recibir `solution` ni los tests ocultos**.
3. `POST /api/sandbox/run` ejecuta a través de una **interfaz** `SandboxService` con adaptador `mock` determinista; el adaptador real (`subprocess`, `docker`) no se escribe en este sprint.
4. `POST /api/exercises/:id/submissions` persiste el envío y devuelve `outcome`, `score`, `results` de pruebas visibles y `stdout`/`stderr` del sandbox.
5. La web ofrece editor, botón de ejecutar y botón de enviar en la página del ejercicio, y funciona **sin sandbox real**.

---

## 2. Alcance

| Incluye | No incluye (queda para otro sprint) |
|---------|-------------------------------------|
| Contratos compartidos de sandbox y de ejercicio/envío | Evaluación de tests ocultos, `hintsUsed` con recálculo y `achievedLevel` (S6) |
| Migración `exercises_and_submissions` (5 modelos) | `Project*`, `Interview*`, `AiInteraction`, `ReviewItem` (S7–S10) |
| `SandboxService` como puerto + `MockSandboxService` determinista + `SANDBOX_MODE` validado al arrancar | Contenedor real, límites de CPU/memoria en ejecución, checklist `docker` de `sandbox-ejecucion.md` §9 |
| `exercises` (listado, detalle, envío) con aislamiento por usuario | Corrección contra pruebas ocultas y pistas graduadas (S6) |
| `sandbox` (`POST /run`, `GET /status`) con cuota básica por usuario | Cuotas por hora y concurrencia de sistema (S11) |
| Web: `codeApi`, editor de código y laboratorio en la ruta de la unidad | Monaco obligatorio: si se rechaza la dependencia, `CodeEditor` cae en `<textarea>` monoespaciado |

**Traspaso a S4:** este sprint **no** escribe `UnitProgress` ni `CompetencyProgress`. El campo `exercisesDone` de `UnitProgressSummary` (S4-T1) sigue servido desde el progreso; su incremento real se conecta cuando S4 cierre. El envío en S5 **no acredita** `MASTERED` (lo hace S6 sobre envíos).

**Traspaso a S6:** la evaluación de pruebas ocultas, el tope de nivel por pistas (`rubricas-evaluacion.md`: «si se usaron pistas de nivel 3+, el máximo alcanzable es Nivel 2») y `achievedLevel` reciben de S5 el envío persistido y el `SandboxService` ya probado. En S5 `achievedLevel` se sirve como `null`.

---

## 3. Decisiones de arquitectura

| Decisión | Motivo | Alternativa descartada |
|----------|--------|------------------------|
| `SandboxService` es un **puerto** con adaptadores intercambiables; S5 sólo implementa `mock` | `sandbox-ejecucion.md` §3 y §8: el modo `mock` desbloquea S5–S6 sin infraestructura; ningún módulo importa un runtime concreto | Escribir el adaptador `docker` sin las pruebas de límites del §9 |
| La selección de modo se valida **al arrancar** y en producción sólo se acepta `docker` | Regla explícita de `sandbox-ejecucion.md` §3: `subprocess` nunca en producción | Leer el modo en cada petición |
| El mock decide con una **heurística determinista** sobre el código (`TODO`), no con aleatoriedad | CI reproducible y pruebas sin reloj ni azar | Respuestas aleatorias o dependientes de la red |
| `solution` y los tests con `isHidden: true` se filtran en el **mapper**, no en el repositorio | Un único punto de fuga posible y una sola prueba que lo fija | Filtrar en cada endpoint |
| En S5 el envío evalúa **sólo pruebas visibles** y `achievedLevel` va en `null` | No adelantar S6: el contrato admite nulos (`Submission.achievedLevel` es opcional en `modelo-datos.md` §3) | Inventar puntuaciones de pruebas ocultas |
| `difficulty` es entero **1–4** y `ladder` usa los tres valores ya existentes | `banco-ejercicios.md` §6 fija `difficulty: 1-4`; `LADDERS` ya vive en `shared` | Escala 1–5 inventada |
| `language` significa **lenguaje de programación** (`typescript`, `javascript`, `sql`), no idioma del contenido | `sandbox-ejecucion.md` §5 fija esos tres valores y `Exercise.language` es el que consume el sandbox | Modelar `es|en|both` de `banco-ejercicios.md` §6, que ningún endpoint usa |
| `POST /api/sandbox/run` y `GET /api/sandbox/status` exigen sesión y cuota de 20 ejecuciones/minuto | `contratos-api.md` §4.6 («límite por minuto») y `sandbox-ejecucion.md` §7 | Sandbox abierto a anónimos |

**Nota de reconstrucción (supuestos).** Esta ficha **no existía**: `sandbox-ejecucion.md` §222 dice literalmente «sprint S5 (ficha pendiente de redacción al abrir el sprint)». Se redacta el 2026-10-27 a partir de [`roadmap-sprints.md`](../roadmap-sprints.md) §S5, [`contratos-api.md`](../../03-arquitectura/contratos-api.md) §4.3 y §4.6, [`modelo-datos.md`](../../03-arquitectura/modelo-datos.md) §3, [`sandbox-ejecucion.md`](../../03-arquitectura/sandbox-ejecucion.md) §3–§8 y [`banco-ejercicios.md`](../../02-contenido/banco-ejercicios.md) §3.1 y §6. La descomposición en catorce tareas es una **propuesta** y requiere ratificación del Orquestador antes de darse por definitiva.


---

## 4. Contrato

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/api/exercises/units/:unitCode` | ✅ | `{ data: ExerciseSummary[], meta }` |
| GET | `/api/exercises/:id` | ✅ | `{ exercise: ExerciseDetail }` |
| POST | `/api/exercises/:id/submissions` | ✅ | `201 { submission: SubmissionSummary }` |
| GET | `/api/exercises/:id/submissions` | ✅ | `{ data: SubmissionSummary[], meta }` |
| POST | `/api/sandbox/run` | ✅ | `{ run: SandboxRunResponse }` |
| GET | `/api/sandbox/status` | ✅ | `{ status, provider, mode }` |

```ts
interface ExerciseSummary {
  id: string; unitId: string; unitCode: string; slug: string;
  type: ExerciseType; title: string; ladder: Ladder; difficulty: number;
  estimatedMin: number | null; language: SandboxLanguage | null;
  competencies: string[];
}
interface ExerciseDetail extends ExerciseSummary {
  statement: string;
  config: Record<string, unknown>;
  publicTests: { testId: string; name: string }[];   // sólo isHidden = false
  hintsAvailable: number;                            // cantidad, nunca el texto
  starterCode: string | null;
}
interface SubmissionSummary {
  id: string; outcome: SubmissionOutcome; score: number;
  achievedLevel: number | null;      // S5 siempre null
  hintsUsed: number;
  results: { testId: string; name: string; passed: boolean; durationMs?: number }[];
  feedback: string; createdAt: string;
}
```

```json
// POST /api/exercises/:id/submissions
{ "code": "export async function fetchUser(id) { … }", "selfExplanation": "Valido el status antes de parsear." }

// 201
{
  "submission": {
    "id": "ckx…", "outcome": "PARTIAL", "score": 75, "achievedLevel": null, "hintsUsed": 1,
    "results": [{ "testId": "t1", "name": "devuelve el usuario", "passed": true }],
    "feedback": "1 de 2 pruebas visibles superadas.", "createdAt": "2026-10-27T14:30:00.000Z"
  }
}
```

```json
// POST /api/sandbox/run
{ "language": "typescript", "files": [{ "path": "index.ts", "content": "console.log(1)" }] }

// 200
{
  "run": {
    "outcome": "PASSED", "score": 100,
    "results": [{ "testId": "t1", "passed": true, "durationMs": 3 }],
    "stdout": "1\n", "stderr": "", "durationMs": 12
  }
}
```

**Errores esperados**

| Caso | Respuesta |
|------|-----------|
| Sin sesión o token inválido | `401 UNAUTHORIZED` |
| Ejercicio o unidad inexistente / no publicado | `404 NOT_FOUND` |
| Cuerpo inválido (`code` vacío, lenguaje no permitido, > 100 KB) | `400 VALIDATION_ERROR` con `details[].field` |
| Más de 20 ejecuciones por minuto | `429 RATE_LIMITED` + `Retry-After` |
| Sandbox no disponible | `503 SERVICE_UNAVAILABLE` (mensaje del catálogo, nunca stack ni rutas del host) |

---

## 5. Tareas

| ID | Tarea | Archivos principales | Sesión | Estado |
|----|-------|----------------------|--------|--------|
| S5-T1 | Contrato compartido del sandbox (`sandbox-ejecucion.md` §5) | `packages/shared/src/schemas/sandbox.ts` + spec, `index.ts` | 1 | ⬜ |
| S5-T2 | Contrato compartido del ejercicio, las pruebas públicas y el envío | `packages/shared/src/schemas/exercise.ts` + spec, `index.ts` | 2 | ⬜ |
| S5-T3 | Migración `exercises_and_submissions` (5 modelos y 2 enums) | `apps/api/prisma/schema.prisma` + migración | 3 | ⬜ |
| S5-T4 | Puerto `SandboxService` y `MockSandboxService` determinista | `modules/sandbox/sandbox.service.ts`, `mock-sandbox.service.ts` + spec | 4 | ⬜ |
| S5-T5 | `SANDBOX_MODE` en `loadEnv`: en producción sólo `docker` | `apps/api/src/config/env.ts` + `env.spec.ts` | 5 | ⬜ |
| S5-T6 | Mapper del ejercicio (filtra `solution` y tests ocultos) y puerto de repositorio | `exercises.mapper.ts` + spec, `exercises.repository.ts` | 6 | ⬜ |
| S5-T7 | Adaptadores de repositorio: memoria y Prisma | `in-memory-exercises.repository.ts`, `prisma-exercises.repository.ts` | 7 | ⬜ |
| S5-T8 | `ExercisesService`: listado por unidad, detalle y envío | `exercises.service.ts` + spec | 8 | ⬜ |
| S5-T9 | `/api/sandbox` con cuota por usuario y estado del servicio | `sandbox.controller.ts`, `sandbox.module.ts`, `app.module.ts` | 9 | ⬜ |
| S5-T10 | `/api/exercises` y registro del módulo | `exercises.controller.ts`, `exercises.module.ts`, `app.module.ts` | 10 | ⬜ |
| S5-T11 | `codeApi` en la web con validación Zod | `apps/web/src/lib/api-client.ts` + spec | 11 | ⬜ |
| S5-T12 | `CodeEditor`: Monaco en carga dinámica con reserva accesible | `features/lab/components/CodeEditor.tsx` + spec | 12 | ⬜ |
| S5-T13 | `ExerciseLab` (ejecutar, enviar, resultado) y ruta de la unidad | `features/lab/components/ExerciseLab.tsx` + spec, `learn/units/[code]/exercises/[slug]/page.tsx` | 13 | ⬜ |
| S5-T14 | Verificación HTTP real con dos usuarios y cierre documental | — (guion de comandos) y docs | 14 | ⬜ |

> **Regla de tamaño:** ninguna tarea toca más de 3 archivos. Si una tarea necesita más, se parte antes de empezar.

**Orden y dependencias internas:** T2 depende de T1 (reutiliza `sandboxLanguageSchema`); T3 no depende de nada; T4 y T5 se pueden adelantar; T6–T8 dependen de T3; T9 y T10 dependen de T4–T8; T11 depende de T1, T2 y T10; T12–T13 dependen de T11.

---

## 6. Criterios de aceptación

- [ ] `S5-T1`: `sandboxRunRequestSchema` aplica los límites por defecto (`timeoutMs` 5000, `memoryMb` 256) y rechaza `files` vacío, lenguajes fuera de `typescript|javascript|sql` y más de 30 tests.
- [ ] `S5-T2`: `ExerciseSummary` rechaza `difficulty: 5`; `SubmissionSummary` acepta `achievedLevel: null` y rechaza `outcome: "OK"`.
- [ ] La migración `exercises_and_submissions` crea los 5 modelos con cascada desde `User`, `Unit` y `Exercise`.
- [ ] `MockSandboxService` es determinista: el mismo código produce el mismo `outcome`, y el código con `TODO` devuelve `FAILED` con puntuación 0.
- [ ] `SANDBOX_MODE=subprocess` con `NODE_ENV=production` impide arrancar; fuera de producción se acepta.
- [ ] El detalle de un ejercicio **nunca** incluye `solution` ni el nombre de un test con `isHidden: true` (prueba del mapper).
- [ ] `POST /api/exercises/:id/submissions` persiste el envío y devuelve sólo pruebas visibles; `achievedLevel` es `null`.
- [ ] Dos usuarios con sesión ven exclusivamente sus propios envíos (prueba de aislamiento).
- [ ] `GET /api/exercises/*` y `POST /api/sandbox/run` responden `401` sin cookie, `404` con ejercicio inexistente y `429` al superar 20 ejecuciones por minuto.
- [ ] Todas las respuestas incluyen `x-trace-id` y los errores respetan el formato único de `contratos-api.md` §2.
- [ ] La web permite escribir, ejecutar, enviar y ver el resultado del ejercicio, con estados de carga, error y vacío.
- [ ] Sin `@monaco-editor/react` disponible, `CodeEditor` sigue siendo usable con un área de texto monoespaciada (prueba de reserva).
- [ ] Suite del monorepo verde: `typecheck`, `lint`, `test` y `build`.

**Estado:** 0/13 verificados.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Fuga de `solution` o de tests ocultos al cliente | El mapper es el único punto de salida y su prueba fija los dos casos; el repositorio entrega la fila completa sólo al servicio |
| Ejecutar código del estudiante en el proceso de la API | S5 sólo implementa `mock`; el puerto no expone `child_process` y el adaptador real llega con el checklist de `sandbox-ejecucion.md` §9 |
| Dependencia nueva (Monaco) que rompe el build por SSR | Carga con `next/dynamic` y `ssr: false`, reserva accesible y prueba de degradación; la dependencia se declara en T12 y requiere aprobación |
| Mock demasiado benévolo que oculte fallos al llegar el sandbox real | La interfaz y los contratos son los mismos; las pruebas de S6 se escriben contra el puerto, no contra el mock |
| S4 sin cerrar (`exercisesDone` en 0) | Se documenta el traspaso en §2; S5 no escribe progreso y el panel de S4 no depende de estos datos |
| Ruta del banco de ejercicios citada de forma imprecisa en el código | El documento real es `docs/02-contenido/banco-ejercicios.md`; el comentario de `enums/exercise.ts` se corrige cuando se toque ese archivo |

---

## 8. Fuera de alcance (a propósito)

- Corrección de pruebas ocultas, pistas servidas por endpoint y `achievedLevel`: S6.
- Sandbox `subprocess` y `docker` con límites de recursos: sprint posterior con infraestructura; el checklist de `sandbox-ejecucion.md` §9 queda pendiente.
- Repaso espaciado a partir de `errorCategory`: S7.
- Tutor IA que explique el error del envío: S8.
- Analítica de errores frecuentes por ejercicio: S11.

---

## 9. Bitácora de ejecución

| Tarea | Verificación ejecutada | Resultado | Commit |
|-------|------------------------|-----------|--------|
| S5-T1 | — | — | — |

---

## Documentos relacionados

- [`roadmap-sprints.md`](../roadmap-sprints.md) — estado de los sprints.
- [`contratos-api.md`](../../03-arquitectura/contratos-api.md) §4.3 y §4.6 — contratos de ejercicios y sandbox.
- [`modelo-datos.md`](../../03-arquitectura/modelo-datos.md) §3 — modelos de ejercicios y envíos.
- [`sandbox-ejecucion.md`](../../03-arquitectura/sandbox-ejecucion.md) — aislamiento, límites y modo `mock`.
- [`banco-ejercicios.md`](../../02-contenido/banco-ejercicios.md) §3.1 y §6 — estructura del `LAB` y metadatos.
- [`rubricas-evaluacion.md`](../../01-curriculo/rubricas-evaluacion.md) — tope de nivel por pistas (traspaso a S6).

