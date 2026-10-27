# Sprint 06 — Corrección automática y pistas graduadas

> **Estado:** 🔄 en curso · **Inicio:** 2026-10-27 · **Depende de:** S5 🔄 (envío persistido y `SandboxService` con su puerto); hereda de S4 sólo el vocabulario de progreso, no su código.
> **Avance:** 15/16 tareas · 14/15 criterios de aceptación.
> **Sesión por tarea:** cada tarea se implementa y verifica en una invocación aislada de comandos; su salida real queda en la bitácora §9.

---

## 1. Objetivo

El envío deja de ser un registro pasivo: **se corrige**. El estudiante recibe `outcome`, `score` y `achievedLevel`, puede pedir **pistas graduadas** (concepto → dirección → fragmento) y ve su historial de intentos. Ninguna respuesta —ni la corrección ni la pista— devuelve la solución completa: es el criterio de salida del roadmap §S6.

Al cerrar el sprint, la plataforma puede asumir:

1. Existe una función pura `gradeSubmission` que, dadas las pruebas con su peso y su resultado, devuelve `outcome`, `score` (0–100), `achievedLevel` (1–4 o `null`), el recuento de pruebas visibles y un `feedback` en español.
2. `POST /api/exercises/:id/hints` sirve **una** pista del nivel pedido (`1..3`) y registra el uso; la progresión es obligatoria (no hay nivel 2 sin nivel 1).
3. `POST /api/exercises/:id/submissions` corrige con pruebas visibles **y ocultas** y persiste `achievedLevel` y `hintsUsed`, columnas que ya existen en `modelo-datos.md` §3.
4. El tope por pistas de `rubricas-evaluacion.md` §2.1 («si se usaron pistas de nivel 3+, el máximo alcanzable es Nivel 2») se aplica en el evaluador y el estudiante **lee el motivo** del tope.
5. `GET /api/exercises/:id/submissions` devuelve el historial propio, paginado y aislado por usuario.

---

## 2. Alcance

| Incluye | No incluye (queda para otro sprint) |
|---------|-------------------------------------|
| Evaluador determinista de casos (visibles + ocultos) con pesos y `achievedLevel` | Análisis estático de calidad de código y de pruebas propias aportadas (S11) |
| Pistas por nivel servidas por endpoint, con progresión obligatoria y registro de uso | Tutor IA que explique el error o sugiera la siguiente pista (S8) |
| Persistencia de `achievedLevel`, `hintsUsed` y resultados por prueba | Repaso espaciado derivado del envío (`q` de SM-2): S7 |
| Historial de intentos propio y límite de intentos (`Exercise.maxAttempts`) | Rúbricas de proyecto y portafolio: S9 |
| Web: panel de pistas, nivel alcanzado con su motivo e historial | Analítica de errores frecuentes por ejercicio: S11 |

**Traspaso desde S5.** S6 **consume** lo que S5 deja probado: `SandboxService` como puerto, `Submission` persistido y el mapper que filtra `solution` y tests ocultos. Si S5-T2…T10 aún no existen, S6 **sólo** puede avanzar en las tareas puras (T1–T6).

**Traspaso a S4.** S6 calcula `achievedLevel` pero **no** escribe `UnitProgress` ni `CompetencyProgress`; el paso de nivel alcanzado a estado `MASTERED` sigue siendo de S4. La penalización `q ≤ 2` por pistas de nivel 3+ (`prerequisitos-y-progreso.md` §5.3) se aplica en S7, que leerá `hintsUsed`.

**Decisión de secuencia.** El roadmap (§4) dice «S6 requiere S5 (envíos)». Este sprint **abre** con las tareas que no tocan el código de S5 (evaluador y pistas puras) y deja para el final las que modifican archivos que S5 aún no ha creado. No se adelanta ningún archivo de S5: T8 vive en `submissions.service.ts`, que **no** aparece en la ficha de S5.

**Ratificación del Orquestador (2026-10-27).** S5 se cerró antes de abrir S6, así que se ratifica la ficha con tres ajustes de realidad:

1. **T7** añade `findHint(exerciseId, level)` al puerto `ExercisesRepository` y a sus dos adaptadores. El listado del ejercicio sólo expone `hintsAvailable`; el texto de la pista se lee de `ExerciseHint` en el momento de servirla, de modo que el catálogo sigue siendo la única fuente y la respuesta no puede inventar texto.
2. **T9** **extiende** el flujo de envío que S5 ya centraliza en `ExercisesService`, en vez de extraer un `submissions.service.ts`. Mover el flujo exigiría duplicar los helpers de sandbox y crearía un ciclo `SubmissionsService → ExercisesService → SubmissionsService`. La tarea se verifica sobre `exercises.service.ts` y su spec.
3. **T11** ya está implementado por S5 (`GET /api/exercises/:id/submissions` con paginación y aislamiento por usuario). No se crea `submissions.module.ts` para no envolver un módulo que ya exporta todo lo necesario; la tarea se limita a verificar el criterio y a completar la prueba que falte.
4. **T9** toca un sexto archivo, `exercises.mapper.ts`: el `feedback` del evaluador es el único texto que explica el motivo del tope de nivel, y el mapper es el punto único por el que pasa todo envío hacia el cliente. Sin ese cambio, el motivo se perdería al serializar y el historial no podría reconstruirlo. Los adaptadores siguen siendo dos.
5. **T12** no crea `hints-rate-limit.guard.ts`. El repositorio ya tiene `RateLimitGuard` con `429` y `Retry-After` en uso por `login` y `register`; duplicarlo habría dejado dos limitadores que mantener. Se añade `keyFromUser` al decorador y a la clave, y la tarea toca cuatro archivos (decorador, guard, su spec y el controlador) porque la cuota debe ser por usuario y el guard sólo sabía segmentar por IP o por campo del cuerpo.
6. **T13** no crea `codeApi.submissionHistory`: el cliente del laboratorio ya se llama `exercisesApi` y su `listSubmissions` (S5-T11) cubre el historial propio, así que la tarea sólo añade `requestHint` y tres pruebas. La fila de la tabla conserva el nombre del plan para que se reconozca, pero el identificador real es `exercisesApi`.

**Regla de tamaño ratificada:** ≤ 3 archivos por tarea; ≤ 5 cuando la tarea incluya un puerto compartido y sus dos adaptadores (T7, T8, T9). El resto de la ficha no cambia.

---

## 3. Decisiones de arquitectura

| Decisión | Motivo | Alternativa descartada |
|----------|--------|------------------------|
| `score` es la proporción **ponderada** de pruebas superadas, redondeada a entero | Es el único criterio que S6 puede medir sin inventar señales; `ExerciseTest.weight` existe justo para esto (`modelo-datos.md` §3). El `75` del ejemplo de `contratos-api.md` §4.3 queda como **ilustrativo**, no como fórmula | Repartir el 100 % entre los cuatro criterios de la rúbrica §2.1 cuando dos de ellos (calidad y pruebas propias) todavía no se pueden medir |
| `selfExplanation` vacía y `ladder` GUIDED **topan** el nivel, no restan puntos | La rúbrica dice que la justificación vacía «resta el 15 % completo»; con dos criterios sin medir, descontar puntos sería un castigo arbitrario. Se traduce a un tope explícito y visible | Descontar veinte puntos por justificación ausente |
| Umbrales de nivel tomados de `rubricas-evaluacion.md` §3 | `< 70` Nivel 1 · `70–79` Nivel 2 · `80–89` Nivel 3 · `90–100` Nivel 4; son los mismos cortes que desbloquean etapa (≥ 80 %) | Inventar una escala nueva |
| El evaluador **calcula** el `outcome` a partir de las pruebas y sólo reenvía `ERROR`/`TIMEOUT` del sandbox | Un sandbox puede responder `PASSED` con una prueba fallida; la verdad está en los resultados | Confiar en el `outcome` que devuelve el sandbox |
| `hintsUsed` sale de un registro `HintRequest` propio, nunca del cliente | `Submission.hintsUsed` existe pero nada lo alimenta; aceptar el número del cliente convierte el tope en opcional | Aceptar `hintsUsed` en el cuerpo del envío |
| Progresión obligatoria de pistas (1 → 2 → 3) | `banco-ejercicios.md` §3.1: «las pistas son **progresivas** y su uso se registra (afecta al nivel máximo alcanzable)»; los tres niveles los nombra el roadmap §S6 (concepto → dirección → fragmento). Pedir el fragmento sin el concepto destruye el propósito | Servir cualquier nivel a demanda |
| La web pinta un botón por nivel y bloquea los posteriores hasta pedir el anterior | Repite en la interfaz la regla que el servidor ya impone: el `422` queda como red de seguridad, no como forma de descubrir el orden. La nota «Pide antes la pista N−1» y el aviso de `nextLevelAvailable` evitan el callejón sin salida de §7 | Un único botón «Pedir la siguiente pista», que oculta cuántos niveles ofrece el ejercicio |
| El historial se refresca por un contador (`refreshToken`) que sube tras cada envío | La lista la sigue poseyendo el servidor: el laboratorio no guarda envíos ni intenta insertar el nuevo a mano, y `useContentLoader` vuelve a pedir con el mismo loader. Coste: durante el refresco se ve un instante el estado de carga | Pasar el envío nuevo como callback y que el padre lo anteponga a la lista |
| El escalón topa el nivel: GUIDED 2 · SEMI 3 · AUTONOMOUS 4 | `banco-ejercicios.md` §4: «no se puede certificar Nivel 3 con ejercicios del escalón 1» y la tabla da 2 · 2–3 · 3. El 4 se permite sólo en `AUTONOMOUS` porque la rúbrica §3 lo llama «Nivel 4 **potencial**»; certificarlo no es de este sprint | Dejar que la puntuación decida sola el nivel, ignorando el escalón |
| El `feedback` se construye **sólo** con pruebas visibles | Nombrar una prueba oculta filtra el conjunto de casos y permite sobreajuste (`rubricas-evaluacion.md` §4) | Incluir el listado completo de resultados |
| `feedback` y pista se generan con datos del catálogo, nunca con el código del estudiante | Evita reenviar la solución por eco y mantiene el mensaje estable en las pruebas | Devolver el `stderr` del sandbox como explicación |

**Nota de reconstrucción (supuestos).** Esta ficha **no existía**: el roadmap §S6 sólo fija objetivo, entregables y criterio de salida. Se redacta el 2026-10-27 a partir de [`roadmap-sprints.md`](../roadmap-sprints.md) §S6 y §4, [`contratos-api.md`](../../03-arquitectura/contratos-api.md) §4.3, [`modelo-datos.md`](../../03-arquitectura/modelo-datos.md) §3, [`rubricas-evaluacion.md`](../../01-curriculo/rubricas-evaluacion.md) §2.1 y §3, [`prerequisitos-y-progreso.md`](../../01-curriculo/prerequisitos-y-progreso.md) §5.3 y [`banco-ejercicios.md`](../../02-contenido/banco-ejercicios.md) §3.1 y §4. La descomposición en dieciséis tareas es una **propuesta** y requiere ratificación del Orquestador.

**Deuda documental que abre este sprint.** `modelo-datos.md` §3 no define ningún modelo para registrar pistas usadas; el sprint introduce `HintRequest` (T4) y **debe** reflejarlo en ese documento al cerrar. Sin ese registro, `hintsUsed` no tiene fuente.

---

## 4. Contrato

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| POST | `/api/exercises/:id/hints` | ✅ | `201 { hint: HintResponse }` |
| GET | `/api/exercises/:id/submissions` | ✅ | `{ data: SubmissionSummary[], meta }` |
| POST | `/api/exercises/:id/submissions` | ✅ | `201 { submission: SubmissionSummary }` (misma forma que S5; `achievedLevel` deja de ser `null`) |

```ts
interface HintRequestInput {
  level: 1 | 2 | 3;
}
interface HintResponse {
  level: 1 | 2 | 3;
  text: string;                 // concepto, dirección o fragmento: nunca la solución completa
  nextLevelAvailable: boolean;  // existe pista del nivel siguiente en el catálogo
}
```

**Fórmula de corrección (T1), única fuente de verdad.**

```
ratio        = Σ peso(prueba superada) / Σ peso(prueba)          // 0 si no hay pruebas
score        = redondeado(100 · ratio)                          // entero 0..100
nivelBase    = score < 70 → 1 · score < 80 → 2 · score < 90 → 3 · resto → 4
tope         = mínimo de:
                 hintsUsed >= 3            → 2
                 selfExplanation vacía     → 2
                 ladder GUIDED → 2 · SEMI  → 3 · AUTONOMOUS → 4
achievedLevel = mínimo(nivelBase, tope)                          // null sin pruebas o con ERROR/TIMEOUT
outcome       = todas superadas → PASSED · ninguna → FAILED · resto → PARTIAL
```

```json
// POST /api/exercises/:id/hints
{ "level": 2 }

// 201
{ "hint": { "level": 2, "text": "Comprueba el estado de la respuesta antes de leer el cuerpo.", "nextLevelAvailable": true } }
```

```json
// 201 POST /api/exercises/:id/submissions (tras el evaluador de S6)
{
  "submission": {
    "id": "ckx…", "outcome": "PARTIAL", "score": 50, "achievedLevel": 2, "hintsUsed": 3,
    "results": [{ "testId": "t1", "name": "devuelve el usuario", "passed": true }],
    "feedback": "1 de 2 pruebas visibles superadas. Revisa los casos que fallan y vuelve a enviar. Nivel máximo 2: usaste pistas de nivel 3.",
    "createdAt": "2026-10-27T15:10:00.000Z"
  }
}
```

**Errores esperados**

| Caso | Respuesta |
|------|-----------|
| Sin sesión o token inválido | `401 UNAUTHENTICATED` |
| Ejercicio inexistente / no publicado, o nivel sin pista en el catálogo | `404 NOT_FOUND` |
| Cuerpo inválido (`level` fuera de `1..3`) | `400 VALIDATION_ERROR` con `details[].field` |
| Nivel pedido sin haber usado el anterior | `422 RULE_VIOLATION` (regla del programa, no del formato) |
| Intentos agotados (`maxAttempts`) | `409 CONFLICT` |
| Cuota de pistas por minuto superada | `429 RATE_LIMITED` + `Retry-After` (20 por minuto y usuario, T12) |

Los errores respetan el formato único de `contratos-api.md` §2 y usan sólo códigos de `ERROR_CODES`.

---

## 5. Tareas

| ID | Tarea | Archivos principales | Sesión | Estado |
|----|-------|----------------------|--------|--------|
| S6-T1 | Evaluador `gradeSubmission`: puntuación, desenlace, nivel y tope | `apps/api/src/modules/exercises/grading.ts` + spec | 1 | ✅ `f182d46` |
| S6-T2 | Contrato compartido de la pista | `packages/shared/src/schemas/hint.ts` + spec, `index.ts` | 2 | ✅ `ca0a889` |
| S6-T3 | Selección de pista por nivel con progresión obligatoria (pura) | `modules/exercises/hint-selection.ts` + spec | 3 | ✅ `30730df` |
| S6-T4 | Migración `hint_requests` (modelo `HintRequest` con cascada) | `apps/api/prisma/schema.prisma` + migración | 4 | ✅ `739a411` |
| S6-T5 | Puerto `HintRequestRepository` + adaptador en memoria | `hint-requests.repository.ts`, `in-memory-hint-requests.repository.ts` | 5 | ✅ `26c5849` |
| S6-T6 | Adaptador Prisma de `HintRequestRepository` | `prisma-hint-requests.repository.ts` | 6 | ✅ `1315554` |
| S6-T7 | `HintsService`: sirve la pista del nivel pedido y registra el uso | `hints.service.ts` + spec, `exercises.repository.ts`, adaptadores `in-memory` y Prisma | 7 | ✅ `ad9fc8c` |
| S6-T8 | Límite de intentos y numeración del intento (`maxAttempts`) | `submit-limits.ts` + spec, `exercises.repository.ts`, adaptadores `in-memory` y Prisma | 8 | ✅ `d9e7c17` |
| S6-T9 | Corrección completa en `ExercisesService`: nivel, `hintsUsed`, historial | `exercises.service.ts` + spec, `exercises.repository.ts`, adaptadores `in-memory` y Prisma, `exercises.mapper.ts` | 9 | ✅ `44d25d6` |
| S6-T10 | Endpoint `POST /api/exercises/:id/hints` y registro en el módulo | `exercises.controller.ts`, `exercises.module.ts` | 10 | ✅ `ff93ae1` |
| S6-T11 | Verificación de `GET /api/exercises/:id/submissions` (historial propio paginado) | Sin archivos nuevos: implementado en S5; se completa la prueba si falta | 11 | ✅ `6f9aae6` |
| S6-T12 | Cuota de pistas por minuto y traducción de la regla de progresión a `422` | `rate-limit.decorator.ts`, `rate-limit.guard.ts` + spec, `exercises.controller.ts` | 12 | ✅ `3081836` |
| S6-T13 | `codeApi.requestHint` y `codeApi.submissionHistory` en la web | `apps/web/src/lib/api-client.ts` + spec | 13 | ✅ `464e0f6` |
| S6-T14 | `HintPanel` y nivel alcanzado con su motivo en el resultado | `features/lab/components/HintPanel.tsx` + spec, `ExerciseLab.tsx` + spec (4 archivos, ratificado) | 14 | ✅ `ca80c4d` |
| S6-T15 | `AttemptHistory` con estados de carga, error y vacío | `features/lab/components/AttemptHistory.tsx` + spec, `ExerciseLab.tsx` + spec (4 archivos, ratificado) | 15 | ✅ `6da9575` |
| S6-T16 | Verificación HTTP real con dos usuarios y cierre documental | — (guion de comandos) y docs | 16 | ⬜ |

> **Regla de tamaño:** ninguna tarea toca más de 3 archivos. Si una tarea necesita más, se parte antes de empezar.
>
> **Ratificación (2026-10-27):** S6-T14 y S6-T15 usaron un cuarto archivo, `ExerciseLab.spec.tsx`, para cubrir la integración del panel con el ejercicio real (id, `hintsAvailable`, nivel alcanzado en el resultado) y el refresco del historial tras enviar. La alternativa —dejar el cableado sin prueba de integración— obligaba además a que las pruebas existentes del laboratorio golpearan la red, porque el historial se carga al montar. Se ratifican ambas excepciones: el cuarto archivo es siempre el spec del componente que integra, no un archivo de producción. La regla sigue vigente para T16, que no toca archivos de producción.

**Orden y dependencias internas.** T1, T2, T3, T4 y T8 no dependen de nada (son las que pueden ejecutarse mientras S5 siga abierto). T5 depende de T4; T6 de T5; T7 de T2, T3 y T5. Desde T9 el sprint **necesita** lo que S5 deja: T9 depende de T1, T5 y `ExercisesService` (S5-T8); T10 depende de T7 y del controlador de S5-T10; T11 depende de T9; T12 de T10. En la web, T13 depende de T2 y de `codeApi` (S5-T11); T14 y T15 dependen de T13; T16 cierra el sprint.

---

## 6. Criterios de aceptación

- [x] `S6-T1`: dos pruebas de peso 1 con una superada dan `score: 50` y `outcome: PARTIAL`; con pesos 2 y 1 y la de peso 2 superada, `score: 67`.
- [x] `S6-T1`: con `score` 100 y `hintsUsed: 3` el nivel queda en 2 y el `feedback` explica el motivo.
- [x] `S6-T1`: `selfExplanation` vacía topa a 2, `ladder: GUIDED` topa a 2, `SEMI` a 3 y `AUTONOMOUS` no topa.
- [x] `S6-T1`: `ERROR` y `TIMEOUT` del sandbox se conservan con `score: 0` y `achievedLevel: null`.
- [x] `S6-T1`: el `feedback` **nunca** contiene el nombre de una prueba con `isHidden: true` ni el código enviado.
- [x] `S6-T2`: `hintRequestSchema` rechaza `level: 4` y `hintResponseSchema` rechaza `text` vacío y `level: 0`.
- [x] `S6-T3`: pedir el nivel 2 sin el 1 devuelve `422 RULE_VIOLATION`; pedir el 1 dos veces devuelve la misma pista sin duplicar el registro.
- [x] La pista servida es **exactamente** el texto del catálogo: ni `solution` ni código del estudiante en la respuesta.
- [x] La migración `hint_requests` crea `HintRequest` con cascada desde `User` y `Exercise` y unicidad `[userId, exerciseId, level]`.
- [x] `hintsUsed` persistido es el número de niveles distintos usados desde el intento anterior, calculado en el servidor.
- [x] El envío se corrige con pruebas ocultas: una oculta fallida baja el `score` aunque todas las visibles pasen.
- [x] Superar `maxAttempts` devuelve `409 CONFLICT` sin crear `Submission`.
- [x] El historial devuelve sólo los envíos del usuario autenticado, en orden descendente y paginado.
- [x] La web muestra la pista pedida, el motivo del tope y el historial, con estados de carga, error y vacío. — Verificado con pruebas de componente: `HintPanel.spec.tsx` (7), `AttemptHistory.spec.tsx` (6) y `ExerciseLab.spec.tsx` (8, dos de integración), más `npm run build -w @codeai/web`.
- [ ] Suite del monorepo verde: `typecheck`, `lint`, `test` y `build`.

**Estado:** 14/15 verificados. Queda la suite completa del monorepo, que ejecuta T16 junto con la verificación HTTP de cierre.

> **Corrección de recuento (2026-10-27):** el encabezado decía catorce criterios, pero la lista tiene quince. Se ajusta el total a quince en lugar de borrar una línea, porque las quince están formuladas como criterios del sprint (§1 y contrato §4).

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Confiar en el `outcome` del sandbox y acreditar un envío que falló | El evaluador recalcula desde las pruebas; `sandboxOutcome` sólo puede forzar `ERROR`/`TIMEOUT`, y la prueba lo fija |
| El `feedback` filtra pruebas ocultas | Se construye sólo con el recuento de visibles; una prueba con nombre reconocible comprueba que no aparece |
| La pista filtra la solución | Se sirve el `text` del catálogo, sin interpolar código ni `solution`; la prueba usa una fila con `solution` y verifica que no viaja |
| `hintsUsed` declarado por el cliente | Se calcula en el servidor desde `HintRequest`; el cuerpo del envío no acepta ese campo |
| Pesos de prueba mal puestos que inflan el `score` | El peso lo fija el autor del ejercicio y la suma se normaliza; un peso 0 no altera el resto |
| Tareas T9–T15 bloqueadas porque S5 no está cerrado | Están declaradas como dependientes y el sprint no se cierra sin `ExercisesService` y su controlador; T1–T8 avanzan igual |
| Nivel 4 regalado por un ejercicio guiado | El tope por `ladder` es explícito y la UI muestra el motivo; la autonomía sólo se acredita en `SEMI` y `AUTONOMOUS` |
| Progresión de pistas frustrante para el estudiante | El panel indica qué nivel falta y `nextLevelAvailable` anticipa si hay más |

---

## 8. Fuera de alcance (a propósito)

- Análisis estático de calidad y de pruebas propias aportadas: S11. Los pesos 20 % + 20 % de la rúbrica §2.1 quedan sin medir y el sprint lo declara.
- Repaso espaciado derivado del envío (`q` de SM-2, `prerequisitos-y-progreso.md` §5): S7.
- Tutor IA que explique el fallo o proponga el siguiente paso: S8.
- `errorCategory` y analítica de errores frecuentes: S11.
- Rúbricas de proyecto, portafolio y entrevistas: S9 y S10.
- Sandbox real (`subprocess`, `docker`): sigue pendiente de infraestructura tras S5.

---

## 9. Bitácora de ejecución

| Tarea | Verificación ejecutada | Resultado | Commit |
|-------|------------------------|-----------|--------|
| S6-T1 | Rojo: `npm run test -w @codeai/api -- grading` → `FAIL src/modules/exercises/grading.spec.ts`, `Failed to load url ./grading`, 0 pruebas ejecutadas. Verde: misma orden → `Tests 26 passed (26)`. `npm run test -w @codeai/api` → `Test Files 12 passed (12)`, `Tests 94 passed (94)`. `npm test` → shared 83 · api 94 · web 81 (total 258), exit 0. `npm run typecheck` → exit 0 (api, web, shared). `npm run lint` → exit 0, `No ESLint warnings or errors` con `--max-warnings 0`. `npm run build` → exit 0. | La fórmula de §4 queda implementada tal cual, con `levelCap` para que la UI explique el motivo del tope. Antes de implementar corregí tres pruebas mías que omitían `selfExplanation`: sin ella, el tope de explicación dejaba el nivel en 2 y la prueba esperaba 3 o 4. | `f182d46` |
| S6-T2 | `npm run test -w @codeai/shared -- hint` → `Test Files 1 passed (1)`, `Tests 15 passed (15)`. `npm run typecheck -w @codeai/shared` → exit 0. `npm run lint -w @codeai/shared` → exit 0 con `--max-warnings 0`. | `hintLevelSchema` es unión de literales 1–3; los tres esquemas son estrictos. La prueba de tipo usa `expectTypeOf` y `tsc` la valida. | `ca0a889` |
| S6-T3 | `npm run test -w @codeai/api -- hint-selection` → `Test Files 1 passed (1)`, `Tests 14 passed (14)`. `npm run typecheck -w @codeai/api` → exit 0. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. | Progresión 1→2→3 completa (no sólo el nivel inmediatamente anterior); `nextLevelAvailable` refleja huecos del catálogo; la idempotencia del registro queda para T5. | `30730df` |
| S6-T4 | `npm run db:migrate -w @codeai/api -- --name hint_requests` → migración `20261027192622_hint_requests` creada y aplicada, Prisma Client regenerado. `npx prisma validate` y `npx prisma migrate status` (desde `apps/api`) → schema válido y `Database schema is up to date!`. `npm run typecheck -w @codeai/api` → exit 0. | Añadí `requests` y `lastRequestedAt` además del mínimo: el primero audita el pedido repetido sin crear fila y el segundo permite a T9 contar niveles distintos desde el envío anterior. El SQL generado confirma `ON DELETE CASCADE` en ambas FKs. | `739a411` |
| S6-T5 | `npm run test -w @codeai/api -- hint-requests` → `Test Files 1 passed (1)`, `Tests 8 passed (8)`. `npm run typecheck -w @codeai/api` → exit 0. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. | El puerto expone `findUsedLevels`, `findLevelsRequestedSince` (estricto, para no contar dos veces el envío anterior) y `recordRequest`. El adaptador copia fechas y filas del dataset, así que ninguna prueba puede mutar el estado del llamador. | `26c5849` |
| S6-T6 | `npx prisma generate` → Prisma Client v6.19.3 regenerado. `npm run typecheck -w @codeai/api` → exit 0. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. | El `upsert` usa el `where` compuesto `userId_exerciseId_level`, que sólo compila si la unicidad de T4 existe. Sin spec propia: los adaptadores Prisma del repositorio no la tienen y la semántica ya la cubre el adaptador en memoria. | `1315554` |
| S6-T7 | `npm run test -w @codeai/api -- hints` → `Test Files 1 passed (1)`, `Tests 12 passed (12)`. `npm run test -w @codeai/api` → `Test Files 22 passed (22)`, `Tests 213 passed (213)` (S5 sigue verde). `npm run typecheck -w @codeai/api` → exit 0 `tsc -p tsconfig.json --noEmit`. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. | `findHint` entra en el puerto y en los dos adaptadores sin tocar `ExerciseRow`: los fixtures de S5 compilan intactos y el dataset en memoria gana `hintTexts` opcional. El servicio lee el texto del catálogo, lo devuelve sin interpolar y sólo registra el uso cuando la pista se sirve; un `404`/`422` deja `findUsedLevels` vacío. `UnprocessableEntityException` sale como `422 RULE_VIOLATION` por el filtro global. | `ad9fc8c` |
| S6-T8 | `npm run test -w @codeai/api -- submit-limits` → `Test Files 1 passed (1)`, `Tests 9 passed (9)`. `npm run test -w @codeai/api -- exercises` → `Test Files 7 passed (7)`, `Tests 92 passed (92)`. `npm run typecheck -w @codeai/api` → exit 0. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. | `checkAttemptLimit` no lanza: devuelve `attemptNumber` (1-based) y `allowed`, y el `409` lo decide T9. `maxAttempts` nulo, no entero o menor que 1 se trata como sin límite, y entra en `ExerciseRow` como opcional para no romper los fixtures de S5. `countSubmissions` se añade al puerto y a los dos adaptadores. | `d9e7c17` |
| S6-T9 | `npm run test -w @codeai/api -- exercises` → `Test Files 7 passed (7)`, `Tests 101 passed (101)` (`exercises.service.spec.ts`: 23). `npm run test -w @codeai/api` → `Test Files 23 passed (23)`, `Tests 231 passed (231)`. `npm run typecheck -w @codeai/api` → exit 0. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. | El envío comprueba el tope antes de tocar el sandbox, cuenta `hintsUsed` desde `lastRequestedAt` posterior al envío anterior y corrige con las pruebas ocultas. Sólo las visibles se persisten, así que el historial no filtra nombres ocultos. Cambiaron cuatro esperados de S5 (los ids del sandbox, el `achievedLevel` ya no es `null`, el `score` de pesos incluye la oculta y el `feedback` añade el tope de escalón). El subproceso detectó que `Array.map` pasaría el índice como `feedback` y lo evitó con un envoltorio explícito. | `44d25d6` |
| S6-T10 | `npm run test -w @codeai/api` → `Test Files 23 passed (23)`, `Tests 231 passed (231)`. `npm run typecheck -w @codeai/api` → exit 0. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. `npm run build -w @codeai/api` → exit 0. Arranque real con `node dist/main.js` y base disponible: `[RouterExplorer] Mapped {/api/exercises/:id/hints, POST} route` y `Nest application successfully started`. | La ruta va después de `POST :id/submissions` y responde `201` con el sobre del contrato; el `userId` sigue saliendo del token. El módulo registra el segundo puerto con `PrismaHintRequestsRepository`, así que el arranque confirma también la dependencia nueva de T9. | `ff93ae1` |
| S6-T11 | `npm run test -w @codeai/api -- exercises` → `Test Files 7 passed (7)`, `Tests 105 passed (105)` (`exercises.service.spec.ts`: 27). `npm run test -w @codeai/api` → `Test Files 23 passed (23)`, `Tests 235 passed (235)`. `npm run typecheck -w @codeai/api` → exit 0. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. | Sin cambios de producción: el endpoint de S5 ya cumplía el criterio. Las pruebas siembran los envíos con fechas distintas en vez de encadenar `submit`, porque dos envíos seguidos comparten milisegundo y el orden quedaría ambiguo. La tercera comprueba además que el historial no expone el nombre ni el id de la prueba oculta. | `6f9aae6` |
| S6-T12 | `npm run test -w @codeai/api -- rate-limit` → `Test Files 1 passed (1)`, `Tests 8 passed (8)`. `npm run test -w @codeai/api` → `Test Files 23 passed (23)`, `Tests 238 passed (238)`. `npm run typecheck -w @codeai/api` → exit 0. `npm run lint -w @codeai/api` → exit 0 con `--max-warnings 0`. `npm run build -w @codeai/api` → exit 0. | No hay guard nuevo: `RateLimitGuard` gana `keyFromUser` y se reutiliza el mismo `429` + `Retry-After` que ya usan `login` y `register`. La cuota queda en 20 pistas/min **por usuario** (misma cifra que el sandbox): una IP compartida en un aula no debe penalizar a otros estudiantes. Sin usuario en la petición la clave cae a la IP. El `422 RULE_VIOLATION` de la progresión ya lo traducía el filtro global desde T7, así que la tarea no duplica esa regla. | `3081836` |
| S6-T13 | `npm run test -w @codeai/web -- api-client` → `Test Files 1 passed (1)`, `Tests 33 passed (33)`. `npm run test -w @codeai/web` → `Test Files 18 passed (18)`, `Tests 116 passed (116)`. `npm run typecheck -w @codeai/web` → exit 0. `npm run lint -w @codeai/web` → `No ESLint warnings or errors`. | `requestHint(id, level)` valida la respuesta con `hintResponseEnvelopeSchema`, que es estricto: si la API filtrara `solution`, el cliente fallaría con `500 INTERNAL_ERROR` en vez de pintarla. El `422 RULE_VIOLATION` de la progresión sube como `ApiError` para que la vista lo explique. No se añadió `submissionHistory` porque `listSubmissions` ya existía. | `464e0f6` |
| S6-T14 | `npm run test -w @codeai/web -- HintPanel` → `Test Files 1 passed (1)`, `Tests 7 passed (7)`. `npm run test -w @codeai/web` → `Test Files 19 passed (19)`, `Tests 124 passed (124)` (`ExerciseLab.spec.tsx`: 7). `npm run typecheck -w @codeai/web` → exit 0. `npm run lint -w @codeai/web` → `No ESLint warnings or errors`. `npm run build -w @codeai/web` → exit 0, `/learn/units/[code]/exercises/[slug]` 6.24 kB. | El panel pinta un botón por nivel: el siguiente habilitado, los posteriores deshabilitados con la nota «Pide antes la pista N−1» y, si `nextLevelAvailable` es `false`, «No hay más pistas». El 429 menciona las 20 pistas/min y el 422 explica el orden sin reenviar el `message` de la API. `ExerciseLab` inyecta `requestHint` con `exercisesApi.requestHint` por defecto y el resultado muestra `Nivel alcanzado: N/4 · N pistas usadas`. El primer subproceso recibió el enunciado truncado (Windows cortó el argumento de `claude -p`) e improvisó un único botón; la segunda pasada, con el enunciado por `stdin`, lo corrigió. | `ca80c4d` |
| S6-T15 | `npm run test -w @codeai/web` → `Test Files 20 passed (20)`, `Tests 131 passed (131)` (`AttemptHistory.spec.tsx`: 6; `ExerciseLab.spec.tsx`: 8). `npm run typecheck -w @codeai/web` → exit 0. `npm run lint -w @codeai/web` → `No ESLint warnings or errors`. `npm run build -w @codeai/web` → exit 0, `/learn/units/[code]/exercises/[slug]` 6.85 kB. | `AttemptHistory` carga con `useContentLoader` (aborta al desmontar), ignora el primer render para no duplicar la petición y llama a `reload()` sólo cuando cambia `refreshToken`; el loader por defecto es una referencia de módulo porque un lambda como valor por defecto se recrearía en cada render y dispararía el bucle que advierte el hook. El 401 de la carga pide volver a iniciar sesión en vez de ofrecer «Reintentar», que repetiría el fallo. `OUTCOME_LABEL` se movió al componente nuevo y `ExerciseLab` lo importa, así que la traducción del desenlace vive en un solo sitio. | `6da9575` |

---

## Documentos relacionados

- [`roadmap-sprints.md`](../roadmap-sprints.md) §S6 — objetivo, entregables y criterio de salida.
- [`sprint-05-laboratorio-codigo.md`](sprint-05-laboratorio-codigo.md) — sprint del que hereda el envío y el `SandboxService`.
- [`contratos-api.md`](../../03-arquitectura/contratos-api.md) §4.3 — contrato de ejercicios, pistas y envíos.
- [`modelo-datos.md`](../../03-arquitectura/modelo-datos.md) §3 — `ExerciseHint`, `ExerciseTest`, `Submission` y la deuda de `HintRequest`.
- [`rubricas-evaluacion.md`](../../01-curriculo/rubricas-evaluacion.md) §2.1 y §3 — tope por pistas y escala de niveles.
- [`prerequisitos-y-progreso.md`](../../01-curriculo/prerequisitos-y-progreso.md) §5.3 — penalización de repaso por pistas (traspaso a S7).
- [`banco-ejercicios.md`](../../02-contenido/banco-ejercicios.md) §3.1 y §4 — pistas progresivas con uso registrado y escalón máximo certificable.
