# Sprint 15 — Simulador de examen y preparación por certificación

> **Estado:** 🔄 fichas redactadas (2026-11-09), contrastadas con el código; nada construido aún · **Duración prevista:** 24–26 sesiones de Constructor · **Depende de:** S14 (metadatos y banco reservado), S7 (repaso SM-2), S4 (progreso).
> **Ámbito:** módulo nuevo `exams` en `apps/api`, contratos en `packages/shared` y vistas en `apps/web`. Las fichas (§4) siguen la [plantilla](../../05-orquestacion/plantilla-tarea.md). El orden de ejecución está en §7.
> **Por qué existe:** practicar preguntas sueltas no entrena la resistencia de 130–180 minutos ni la gestión del tiempo. Sin simulacros, la plataforma no puede decir con honestidad si alguien está listo para presentar.

---

## 1. Objetivo

Al cerrar el sprint, una persona puede:

- hacer un **simulacro completo** de una certificación, de una forma fija (A, B o C) o **aleatorio**, con el número de preguntas y los minutos oficiales, cronómetro en el servidor, preguntas marcadas para revisar y pantalla de revisión antes de entregar;
- hacer un **bloque por dominio** de 20 preguntas cronometradas;
- ver al entregar su resultado **por dominio**, cada pregunta con la explicación de cada opción y el enlace a la unidad del concepto;
- encontrar las preguntas que falló en su cola de repaso con prioridad alta;
- consultar su **panel de preparación** por certificación, con el criterio «listo para presentar» desglosado;
- registrar, si quiere, el **resultado real** de su examen para calibrar la regla.

Un instructor ve los dominios débiles de la cohorte y cómo se relaciona «listo para presentar» con los resultados reales registrados.

## 2. Decisiones de diseño

**2.1 Condiciones de examen reales.** No hay retroalimentación hasta entregar. El servidor fija el plazo y lo hace cumplir. Existe la opción de +30 minutos, que imita la adaptación de AWS para quien no presenta en su lengua materna.

**2.2 Puntuación honesta.** Se da el porcentaje de aciertos, global y por dominio. No se calcula ni se muestra una «puntuación escalada», porque AWS no publica cómo la obtiene.

**2.3 Formas fijas y exposición controlada.** Las formas A, B y C se definen en la semilla, como listas ordenadas de slugs del banco reservado. El aleatorio reparte las preguntas según el peso de cada dominio, con redondeo por mayor resto, y evita las preguntas vistas en los tres últimos intentos de la persona.

**2.4 Reglas puras.** El armado, la puntuación, el reparto por dominio y el criterio «listo para presentar» son funciones puras con sus pruebas, como `progress.rules.ts` y el motor SM-2.

**2.5 Lo no revisado es orientativo.** Si alguna pregunta de un intento no tiene `reviewedByHuman`, el resultado se marca «orientativo» y no cuenta para el criterio 2 de «listo para presentar».

**2.6 Decisiones del Orquestador (2026-11-09).** El responsable puede cambiarlas antes de la tarea que las usa.

| # | Decisión | Dónde se usa |
|---|----------|--------------|
| a | Una pregunta reservada fallada **entra en el repaso** con prioridad alta (`metodo-aws.md` §8.6), así que el filtro de S14-T8c sobre `listDue`/`countDue` se retira. Es seguro por construcción: solo el simulacro crea un `ReviewItem` de un ejercicio reservado, porque todas las rutas de `exercises` responden `404` a los reservados. La cola web solo muestra el título y el concepto (H4). El contexto del tutor de IA **mantiene** el filtro. | T7a, T7c |
| b | **Criterio 1** («dominio»): todas las unidades **publicadas** de la etapa están en `MASTERED`. La parte «nivel 3 en las competencias críticas» (`curriculo-aws.md` §6) se añadirá cuando esas competencias existan en los datos. | T5 |
| c | **Criterio 4** («evidencia»): exige un proyecto de la etapa revisado con nota ≥ 70 y la defensa técnica (SIM). Los escenarios SIM de AWS llegan en S26, así que hasta entonces el criterio es `unavailable` y nadie sale «listo». Es lo honesto. | T5 |
| d | **Criterio 2** («simulacros»): solo cuentan las formas fijas A/B/C, ya entregadas, no orientativas, con ≥ 80 % y todos los dominios ≥ 70 %. Hacen falta dos formas distintas, y la más reciente debe tener 14 días o menos. El aleatorio y el bloque por dominio no cuentan. | T5 |
| e | El bloque por dominio tiene **20 preguntas**. Si el banco tiene entre 15 y 19, se usan todas; con menos de 15, `409`. Los minutos son proporcionales: `ceil(n · durationMin / questionCount)`. | T4a |
| f | Cada persona tiene **un intento en curso como máximo por certificación** (`409` si ya hay uno). | T7a |
| g | **Expiración perezosa:** no hay tareas programadas. Cualquier lectura o escritura de un intento vencido lo cierra antes de responder, con estado `expired`. Hay 5 s de gracia para la latencia. | T4a, T7a |
| h | Una pregunta sin responder cuenta como fallo. Los porcentajes son enteros: `Math.round(100 · aciertos / total)`. | T4b |
| i | Si una certificación está en **beta** (MLA-C02), no hay simulacro: `409`. | T3a, T7a |

## 3. Contratos (resumen; cada ficha los fija al detalle)

```
POST /api/exams/:certification/attempts           { mode, domain?, extraTime? }   → 201 { attempt }
GET  /api/exams/attempts/:id                       → { attempt }   preguntas sin solución + segundos restantes
PUT  /api/exams/attempts/:id/items/:position       { answer?, flagged? } → { item, remainingSeconds }
POST /api/exams/attempts/:id/submit                → { result }
GET  /api/exams/attempts/:id/result                → { result }   sólo tras entregar
GET  /api/exams/:certification/history             → { attempts }
GET  /api/exams/:certification/readiness           → { readiness }
POST /api/exams/:certification/real-results        { passed, scaledScore?, takenOn } → 201 { realResult }
GET  /api/exams/:certification/cohort?from&to      → { cohort }   (INSTRUCTOR / ADMIN)
```

`mode` puede valer `form-a`, `form-b`, `form-c`, `random` o `domain`. La respuesta de cada pregunta usa **el mismo cuerpo que `quiz-answers`**: `{ optionId }`, `{ optionIds }`, `{ order }` o `{ pairs }` (`quizSubmissionSchema`, S14-T6).

## 4. Tareas

> **Verificación común** (salvo que la ficha diga otra cosa), desde la raíz:
> ```bash
> npm run build -w packages/shared
> npm run typecheck      # se reporta POR WORKSPACE: shared, api, web
> npm run lint
> npm run test           # se reporta POR WORKSPACE
> ```
> Resultado esperado: código de salida 0, 0 warnings y pruebas al 100 % en **todos** los workspaces. Antes de empezar se anota la línea base. Si la base ya está en rojo, **la tarea se detiene** y se reporta: no se construye sobre rojo (lección de S14-T10).

### 4.0 Reglas fijas de todo el sprint

1. **El banco reservado sigue invisible fuera del simulacro.** Solo el módulo `exams` lo lee, con consultas propias. Nunca pasa por `ExercisesRepository.findPublished`, que lo excluye (S14-H4). La única excepción es la decisión (a).
2. **Nada de solución antes de entregar.** Ni `GET` ni `PUT` de un intento en curso devuelven `correct`, `correctAnswer`, explicaciones ni la `solution` del ejercicio. El `config` que se sirve es el del ejercicio tal cual, que ya no lleva solución (S14-T5).
3. **El tiempo lo manda el servidor.** El cliente muestra `remainingSeconds` y nunca decide si el tiempo se acabó.
4. **Aislamiento:** un intento ajeno responde `404`, igual que uno que no existe.
5. **Seguridad de la base de datos (T2, T3b y T13):** igual que en S14 §4.0 regla 4.
   - Solo `localhost:5433`, nunca 5432.
   - Nunca `migrate reset`, `db:reset`, `db push` ni `--force`.
   - Las migraciones se crean con `migrate dev --create-only` y se revisa el SQL antes de aplicarlas.
   - Respaldo previo con `npm run db:backup`.
   - Para probar «desde base vacía», contenedor desechable en el puerto 5441.
6. **Cambios ajenos sin commit:** `apps/api/prisma/seed/content.seed.json`, `apps/web/src/features/lab/components/FlashcardPlayer.tsx` y `ReflectionPlayer.tsx` no se tocan. `git add` siempre por ruta.
7. Los mensajes al usuario van en español. Sin `any`, sin `TODO` y sin `console.log`. Los cuerpos llevan `.strict()` **dentro** del esquema (S14-H3).

### 4.1 Hallazgos al revisar el código (2026-11-09)

| # | Hallazgo | Consecuencia |
|---|----------|--------------|
| H1 | No existe ningún contenido reservado. `apps/api/prisma/seed/aws/units/` no existe y las etapas AWS no tienen ejercicios. | Todo se prueba con datos sintéticos. Las formas se validan con ejemplos dentro de los specs. La verificación HTTP (T13) usa una base desechable con ejercicios sintéticos que inserta un script fuera del repositorio. |
| H2 | `findPublished` y `UnitOpenGuard` excluyen `RESERVED` (S14-T8a). | `ExamsRepository` tiene sus propias consultas (T6b) y no reutiliza `ExercisesRepository`. |
| H3 | `PrismaReviewRepository.listDue` y `countDue` filtran `exercise: { examPool: "UNIT" }` (S14-T8c). Una pregunta reservada fallada nunca aparecería en el repaso. | T7c retira ese filtro, según la decisión (a). `prisma-ai.repository.ts` lo mantiene. |
| H4 | `ReviewQueue.tsx` muestra solo `exerciseTitle` y `concept` y pide una autocalificación (0–5). No abre el ejercicio. | Que una pregunta reservada aparezca en el repaso no expone su solución. |
| H5 | Los reproductores de quiz de S14 envían y corrigen al pulsar «Comprobar». | La sala de examen necesita controles que **solo capturen** la respuesta (T9b), sin corregir. |
| H6 | `gradeQuizAnswer(exercise, answer)` (`quiz-grading.ts`) es pura y nunca lanza. `readContent(config, solution)` es interna. | T4b la reutiliza y exporta `readContent` como `readQuizContent`, para revelar la respuesta correcta de las preguntas sin responder. |
| H7 | `InterviewScenario` no tiene etapa, y los escenarios AWS llegan en S26. Tampoco hay proyectos AWS sembrados. | Criterio 4 = `unavailable` (decisión c). |
| H8 | `CERTIFICATION_REGISTRY["MLA-C02"].status === "beta"`. | Decisión (i). |
| H9 | `ReviewService.scheduleFromSubmission({ userId, exerciseId, outcome, score, hintsUsed })` ya asigna `FAILED_PRIORITY` cuando la calidad es menor que 3. `listDue` ordena por `priority desc`. | T7a la llama con `outcome: "FAILED", score: 0, hintsUsed: 0` por cada pregunta fallada. |
| H10 | `ProjectsModule` es la plantilla de módulo: `imports: [PrismaModule, AuthModule, …]`, un token de repositorio y otro de reloj (`PROJECTS_CLOCK`), y `@UseGuards(JwtAuthGuard, RateLimitGuard)` con `@RateLimit({ limit, windowMs, keyFromUser: true })`. | `ExamsModule` la copia (T7a, T8). |
| H11 | Unidad → `moduleId` → Module → `stageId`. `ProjectSubmission.status` vale `SUBMITTED` o `REVIEWED` y `score` es Float. | Consultas de preparación (T6b). |

### 4.2 Índice

| ID | Tarea | Archivos | Depende de |
|----|-------|----------|------------|
| T1a | Contratos de intento, pregunta y entrega | 3 | — |
| T1b | Contratos de resultado, historial, preparación y resultado real | 2 | T1a |
| T2 | Modelos y migración `exams` | 2 | — |
| T3a | Archivo de formas, reparto por mayor resto y validación | 3 | T1a |
| T3b | La semilla escribe las formas | 2 | T2, T3a |
| T4a | Reglas puras de armado y plazo | 2 | T3a |
| T4b | Puntuación pura | 3 | T1b |
| T5 | Regla pura «listo para presentar» | 2 | T1b |
| T6a | Puerto `ExamsRepository` y adaptador en memoria | 3 | T2, T4a |
| T6b | Adaptador Prisma | 2 | T6a |
| T7a | Servicio: iniciar, leer, responder, entregar | 4 (excepción) | T4a, T4b, T6a |
| T7b | Servicio: resultado, historial, preparación, resultado real | 2 | T5, T7a |
| T7c | El repaso muestra las preguntas reservadas falladas | 2 | T7a |
| T8 | Controlador y límites | 3 | T7b |
| T9a | Cliente web `examsApi` | 2 | T8 |
| T9b | Controles de respuesta sin corrección | 2 | T9a |
| T9c | Cronómetro y cuadrícula de navegación | 3 | T9a |
| T9d | Sala de examen | 3 | T9b, T9c |
| T10 | Informe por dominio y revisión ítem a ítem | 3 | T9d |
| T11a | Página de la certificación: modos e historial | 3 | T9a |
| T11b | Panel de preparación y resultado real | 4 (excepción) | T11a |
| T12a | Contrato y agregación pura de la cohorte | 4 | T1b |
| T12b | Endpoint de cohorte | 5 (excepción) | T12a, T8 |
| T12c | Vista del instructor | 4 | T12b |
| T13 | Verificación HTTP con dos usuarios | 0 (informe) | todo lo anterior |
| T14 | Documentación | docs | Orquestador |

---

### S15-T1a — Contratos de intento, pregunta y entrega

| Campo | Valor |
|-------|-------|
| **Depende de** | — |
| **Archivos** | `packages/shared/src/schemas/exam.ts` (crear) · `packages/shared/src/schemas/exam.spec.ts` (crear) · `packages/shared/src/index.ts` (modificar: exportar `exam`) |

**Contexto mínimo.** `quizSubmissionSchema` (en `exercise.ts`) es un `ZodEffects`: cuerpo `.strict()` con `superRefine`, que acepta una sola clave. `certificationCodeSchema` está en `certification.ts`.

**Contrato**

```ts
export const EXAM_MODES = ["form-a", "form-b", "form-c", "random", "domain"] as const;
export type ExamMode = (typeof EXAM_MODES)[number];
export const EXAM_ATTEMPT_STATUSES = ["in-progress", "submitted", "expired"] as const;
export type ExamAttemptStatus = (typeof EXAM_ATTEMPT_STATUSES)[number];

export const EXAM_EXTRA_TIME_MIN = 30;
export const EXAM_GRACE_SECONDS = 5;
export const DOMAIN_BLOCK_SIZE = 20;
export const DOMAIN_BLOCK_MIN = 15;
export const RANDOM_EXCLUDE_LAST_ATTEMPTS = 3;

export const startExamAttemptSchema = z
  .object({ mode: z.enum(EXAM_MODES), domain: z.number().int().min(1).max(6).optional(), extraTime: z.boolean().default(false) })
  .strict()
  .superRefine(/* mode "domain" sin domain → «El bloque por dominio necesita domain» (path domain);
                  otro mode con domain → «domain solo se usa en el bloque por dominio» */);
export type StartExamAttemptInput = z.infer<typeof startExamAttemptSchema>;

export const examAttemptItemSchema = z.object({
  position: z.number().int().min(1),
  domain: z.number().int().min(1).max(6),
  statement: z.string().min(1),
  config: z.record(z.unknown()),            // config del QUIZ, sin solución
  answer: quizSubmissionSchema.nullable(),
  flagged: z.boolean(),
});

export const examAttemptSchema = z.object({
  id: z.string().min(1),
  certification: certificationCodeSchema,
  mode: z.enum(EXAM_MODES),
  domain: z.number().int().min(1).max(6).nullable(),
  extraTime: z.boolean(),
  status: z.enum(EXAM_ATTEMPT_STATUSES),
  orientative: z.boolean(),
  startedAt: z.string().datetime(),
  deadlineAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  remainingSeconds: z.number().int().nonnegative(),
  questionCount: z.number().int().positive(),
  answeredCount: z.number().int().nonnegative(),
  items: z.array(examAttemptItemSchema),
});
export const examAttemptResponseSchema = z.object({ attempt: examAttemptSchema });

export const updateExamItemSchema = z
  .object({ answer: quizSubmissionSchema.nullable().optional(), flagged: z.boolean().optional() })
  .strict()
  .refine((v) => v.answer !== undefined || v.flagged !== undefined, { message: "Envía answer, flagged o ambos" });
export const examItemUpdateResponseSchema = z.object({ item: examAttemptItemSchema, remainingSeconds: z.number().int().nonnegative() });
// tipos inferidos exportados para todos
```

**Criterios de aceptación**
- [ ] `startExamAttemptSchema` acepta `{ mode: "form-a" }`, con `extraTime` por defecto `false`, y `{ mode: "domain", domain: 2 }`. Rechaza `domain` sin el modo `domain`, el modo `domain` sin `domain`, una clave desconocida y `domain: 7`, cada caso con su mensaje.
- [ ] `updateExamItemSchema` acepta `{ flagged: true }`, `{ answer: null }` y `{ answer: { optionIds: ["a","c"] } }`. Rechaza `{}` y `{ answer: { optionId: "b", order: ["a"] } }`.
- [ ] `examAttemptSchema` parsea un intento completo de ejemplo y rechaza `remainingSeconds: -1`.
- [ ] Las constantes tienen los valores del contrato.
- [ ] Verificación común en verde.

**Qué NO hacer:** no tocar `exercise.ts` ni `certification.ts`; no definir aquí el resultado (T1b).

---

### S15-T1b — Contratos de resultado, historial, preparación y resultado real

| Campo | Valor |
|-------|-------|
| **Depende de** | T1a |
| **Archivos** | `packages/shared/src/schemas/exam.ts` (modificar) · `packages/shared/src/schemas/exam.spec.ts` (modificar) |

**Contrato**

```ts
export const examDomainScoreSchema = z.object({
  domain: z.number().int().min(1).max(6), name: z.string().min(1),
  correct: z.number().int().nonnegative(), total: z.number().int().positive(), pct: z.number().int().min(0).max(100),
});
export const examResultItemSchema = examAttemptItemSchema.extend({
  correct: z.boolean(),
  correctAnswer: quizSubmissionSchema,        // la respuesta correcta, con la misma forma que el cuerpo
  explanations: z.record(z.string(), z.string().min(1)), // de cada opción o elemento
  unitCode: z.string().min(1),                // para enlazar /learn/units/:code
});
export const examResultSchema = z.object({
  attemptId: z.string().min(1), certification: certificationCodeSchema, mode: z.enum(EXAM_MODES),
  domain: z.number().int().nullable(), status: z.enum(["submitted", "expired"]), orientative: z.boolean(),
  startedAt: z.string().datetime(), submittedAt: z.string().datetime(),
  correctCount: z.number().int().nonnegative(), questionCount: z.number().int().positive(),
  scorePct: z.number().int().min(0).max(100),
  domains: z.array(examDomainScoreSchema).min(1),
  items: z.array(examResultItemSchema),
});
export const examResultResponseSchema = z.object({ result: examResultSchema });

export const examHistoryItemSchema = z.object({
  attemptId, mode, domain: nullable, status: z.enum(EXAM_ATTEMPT_STATUSES), orientative,
  startedAt, submittedAt: nullable, scorePct: z.number().int().min(0).max(100).nullable(), questionCount,
});
export const examHistoryResponseSchema = z.object({ attempts: z.array(examHistoryItemSchema) }); // el más reciente primero

export const READINESS_CRITERIA = ["mastery", "mock-exams", "review", "evidence"] as const;
export const READINESS_STATUSES = ["met", "missing", "unavailable"] as const;
export const readinessCriterionSchema = z.object({
  id: z.enum(READINESS_CRITERIA), status: z.enum(READINESS_STATUSES),
  summary: z.string().min(1),                 // una frase en español
  missing: z.array(z.string().min(1)),        // lo que falta; vacío si status = met
});
export const realExamResultSchema = z.object({
  id: z.string().min(1), certification: certificationCodeSchema, passed: z.boolean(),
  scaledScore: z.number().int().min(100).max(1000).nullable(),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), readyAtRegistration: z.boolean(), createdAt: z.string().datetime(),
});
export const examReadinessSchema = z.object({
  certification: certificationCodeSchema, stageId: z.number().int(), ready: z.boolean(),
  criteria: z.array(readinessCriterionSchema).length(4),   // en el orden de READINESS_CRITERIA
  evaluatedAt: z.string().datetime(), lastRealResult: realExamResultSchema.nullable(),
});
export const examReadinessResponseSchema = z.object({ readiness: examReadinessSchema });

export const registerRealResultSchema = z
  .object({ passed: z.boolean(), scaledScore: z.number().int().min(100).max(1000).optional(), takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va en formato AAAA-MM-DD") })
  .strict();
export const realResultResponseSchema = z.object({ realResult: realExamResultSchema });
```

**Criterios de aceptación**
- [ ] Una prueba de parseo válido y otra de rechazo por esquema: `scorePct: 101`, `criteria` con 3 elementos, `scaledScore: 99` y `takenOn: "9/11/2026"`.
- [ ] `examResultSchema` no tiene ninguna clave de puntuación escalada.
- [ ] Las pruebas de T1a pasan sin modificarlas.
- [ ] Verificación común en verde.

**Qué NO hacer:** no añadir una puntuación escalada (decisión 2.2).

---

### S15-T2 — Modelos y migración `exams`

| Campo | Valor |
|-------|-------|
| **Depende de** | — |
| **Archivos** | `apps/api/prisma/schema.prisma` (modificar) · `apps/api/prisma/migrations/<timestamp>_exams/migration.sql` (generado con `--create-only` y revisado) |

**Contrato**

```prisma
enum ExamMode { FORM_A FORM_B FORM_C RANDOM DOMAIN }
enum ExamAttemptStatus { IN_PROGRESS SUBMITTED EXPIRED }

model ExamForm {
  id            String   @id @default(cuid())
  certification String
  code          String   // "A" | "B" | "C"
  exerciseSlugs String[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([certification, code])
}

model ExamAttempt {
  id            String            @id @default(cuid())
  userId        String
  certification String
  mode          ExamMode
  domain        Int?
  extraTime     Boolean           @default(false)
  status        ExamAttemptStatus @default(IN_PROGRESS)
  orientative   Boolean           @default(false)
  startedAt     DateTime          @default(now())
  deadlineAt    DateTime
  submittedAt   DateTime?
  correctCount  Int?
  scorePct      Int?
  domainScores  Json?
  user  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  items ExamAttemptItem[]
  @@index([userId, certification, startedAt])
  @@index([certification, status])
}

model ExamAttemptItem {
  id         String      @id @default(cuid())
  attemptId  String
  position   Int
  exerciseId String
  domain     Int
  answer     Json?
  flagged    Boolean     @default(false)
  correct    Boolean?
  answeredAt DateTime?
  attempt  ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  exercise Exercise    @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  @@unique([attemptId, position])
  @@index([exerciseId])
}

model RealExamResult {
  id                  String   @id @default(cuid())
  userId              String
  certification       String
  passed              Boolean
  scaledScore         Int?
  takenOn             DateTime @db.Date
  readyAtRegistration Boolean
  createdAt           DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, certification])
  @@index([certification, createdAt])
}
// Relaciones inversas: User.examAttempts, User.realExamResults, Exercise.examAttemptItems.
```

**Secuencia:** comprobar el puerto 5433 → `npm run db:backup` → `npx prisma migrate dev --create-only --name exams` (desde `apps/api`) → revisar el SQL, que solo puede contener `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` y `ADD CONSTRAINT … FOREIGN KEY`, sin `DROP` ni `ALTER` de columnas existentes → `npx prisma migrate dev` → `npm run db:generate -w apps/api`, con los puertos 3000 y 3001 libres. Si `migrate dev` propone un reset: **DETENERSE**.

**Criterios de aceptación**
- [ ] El SQL contiene solo lo listado y se pega resumido en el reporte.
- [ ] `npx prisma migrate status` dice «up to date» con 14 migraciones.
- [ ] `git ls-files --eol` de la migración nueva da `i/lf w/lf`.
- [ ] `npm run db:seed` dos veces con las cifras habituales y la huella de los quizzes `1662|8ca67124b00bae39a25ac73d1fb58d75` sin cambios (consulta de S14).
- [ ] Verificación común en verde.

**Qué NO hacer:** no editar migraciones anteriores; no añadir columnas a `Exercise`; no crear el índice parcial «un intento en curso» (se controla en el servicio, decisión f).

---

### S15-T3a — Archivo de formas, reparto por mayor resto y validación

| Campo | Valor |
|-------|-------|
| **Depende de** | T1a |
| **Archivos** | `packages/shared/src/schemas/exam-forms.ts` (crear) · `packages/shared/src/schemas/exam-forms.spec.ts` (crear) · `packages/shared/src/index.ts` (modificar) |

**Contrato**

```ts
export const EXAM_FORM_CODES = ["A", "B", "C"] as const;
export type ExamFormCode = (typeof EXAM_FORM_CODES)[number];

export const examFormsFileSchema = z.object({
  certification: certificationCodeSchema,
  forms: z.object({ A: slugList, B: slugList, C: slugList }).partial().strict()
    .refine((f) => Object.keys(f).length > 0, "Declara al menos una forma"),
}).strict();                                           // slugList = z.array(z.string().min(1)).min(1)

/** Reparto por mayor resto: suma exactamente `total`; empates → dominio de id menor. */
export function allocateByLargestRemainder(total: number, domains: readonly { id: number; weightPct: number }[]): Map<number, number>;

export interface FormExerciseFacts {
  readonly type: string; readonly examPool: "unit" | "reserved";
  readonly certification: string | null; readonly domain: number | null; readonly quizKind: string | null;
}
/** Devuelve los problemas de una forma; [] si es válida. */
export function examFormViolations(input: {
  definition: CertificationDefinition; code: ExamFormCode; slugs: readonly string[];
  exercises: ReadonlyMap<string, FormExerciseFacts>;
}): string[];
```

Mensajes exactos de `examFormViolations` (prefijo `` `Forma ${code} de ${cert}: ` ``):
- «la certificación está en beta: no hay formas hasta la guía definitiva»
- «tiene N preguntas y el examen tiene M»
- «repite ${slug}» · «${slug} no existe»
- «${slug} no es un QUIZ del banco reservado» · «${slug} es de otra certificación (${otra})»
- «${slug} usa un tipo de pregunta que el examen no tiene (${kind})». Solo se admiten los `itemTypes` del registro; `unconfirmedItemTypes` no cuenta.
- «el dominio ${d} tiene ${n} preguntas y le tocan ${t} (±1)»: se compara con `allocateByLargestRemainder(questionCount, domains)`.

**Criterios de aceptación**
- [ ] `allocateByLargestRemainder(65, CLF-C02)` con pesos 24/30/34/12 da `{1:16, 2:19, 3:22, 4:8}`, y la suma es siempre `total` (prueba con los 10 exámenes GA).
- [ ] Una forma sintética válida de CLF-C02 (65 slugs) devuelve `[]`.
- [ ] Una prueba por mensaje.
- [ ] Verificación común en verde.

**Qué NO hacer:** no leer archivos (eso es la semilla, T3b); no crear formas reales (H1).

---

### S15-T3b — La semilla escribe las formas

| Campo | Valor |
|-------|-------|
| **Depende de** | T2, T3a |
| **Archivos** | `apps/api/prisma/seed/seed-lib.mts` (modificar) · `apps/api/prisma/seed/seed-course.mts` (modificar) |

**Contexto mínimo.** `seed-course.mts aws-cloud` lee `aws/course.seed.json` y `aws/units/*.json`. `examColumns(exercise)` (en `seed-lib.mts`) ya traduce `exam` a columnas.

**Contrato**
- `seed-lib.mts`:
  - `readExamFormFiles(courseDir)` lee `<courseDir>/exam-forms/*.json`. Si la carpeta no existe, devuelve `[]`.
  - Valida cada archivo con `examFormsFileSchema`. Un archivo inválido lanza un error con `describeIssues`.
  - `upsertExamForms(prisma, files, exercisesBySlug)`:
    - por cada forma, ejecuta `examFormViolations`;
    - si hay algún problema, **lanza antes de escribir nada**, con todos los mensajes;
    - si no hay ninguno, hace `upsert` por `(certification, code)`.
- `seed-course.mts`, después de sembrar unidades y ejercicios:
  - calcula `exercisesBySlug` a partir de los ejercicios declarados en las unidades;
  - llama a `upsertExamForms`;
  - imprime «Formas de simulacro: N».

**Criterios de aceptación**
- [ ] `npm run typecheck:seed -w apps/api` da 0.
- [ ] `npm run db:seed:aws` (sin `exam-forms/`) imprime «Formas de simulacro: 0» y las mismas cifras que antes.
- [ ] Un script temporal **fuera del repositorio** prueba `upsertExamForms` contra la base desechable 5441, con una forma inválida (lanza y no escribe) y otra válida (escribe una fila). El reporte resume las salidas.
- [ ] `npm run db:seed` dos veces: huella de quizzes sin cambios.
- [ ] Verificación común en verde.

**Qué NO hacer:** no crear `aws/exam-forms/` en el repositorio; no tocar las ramas de `exerciseConfig`/`exerciseSolution`.

---

### S15-T4a — Reglas puras de armado y plazo

| Campo | Valor |
|-------|-------|
| **Depende de** | T3a |
| **Archivos** | `apps/api/src/modules/exams/exam.rules.ts` (crear) · `apps/api/src/modules/exams/exam.rules.spec.ts` (crear) |

**Contrato**

```ts
export interface PoolQuestion { readonly exerciseId: string; readonly domain: number }
export type Assembly =
  | { readonly status: "ok"; readonly items: readonly PoolQuestion[] }          // ya en el orden de examen
  | { readonly status: "insufficient"; readonly domain: number | null; readonly needed: number; readonly available: number };

/** Reparte con allocateByLargestRemainder; por dominio prefiere las no vistas y completa con vistas. Baraja el total. */
export function assembleRandom(input: { definition: CertificationDefinition; pool: readonly PoolQuestion[];
  recentExerciseIds: ReadonlySet<string>; random: () => number }): Assembly;

/** DOMAIN_BLOCK_SIZE preguntas del dominio (todas si hay 15–19; insufficient si < 15). Misma preferencia y barajado. */
export function assembleDomainBlock(input: { domain: number; pool: readonly PoolQuestion[];
  recentExerciseIds: ReadonlySet<string>; random: () => number }): Assembly;

/** Completo: durationMin (+30 con extraTime). Dominio: ceil(n · durationMin / questionCount) (+ ceil(n · 30 / questionCount)). */
export function attemptDurationMinutes(input: { definition: CertificationDefinition; mode: ExamMode; itemCount: number; extraTime: boolean }): number;

export function remainingSeconds(deadlineAt: Date, now: Date): number;     // max(0, floor(ms / 1000))
export function isPastDeadline(deadlineAt: Date, now: Date): boolean;      // now > deadlineAt + EXAM_GRACE_SECONDS
export function shuffle<T>(items: readonly T[], random: () => number): T[]; // Fisher–Yates; no muta la entrada
```

**Criterios de aceptación**
- [ ] El aleatorio de CLF-C02 con un banco de sobra tiene 65 preguntas y el reparto `{16,19,22,8}`.
- [ ] Con 3 intentos recientes que cubren parte del banco, no repite ninguna vista **si alcanza**. Si no alcanza, completa con vistas y sigue cumpliendo el reparto.
- [ ] Un dominio con menos preguntas de las que le tocan devuelve `insufficient` con `domain`, `needed` y `available`.
- [ ] Un bloque de dominio con 25 disponibles da 20; con 17, da 17; con 14, `insufficient`.
- [ ] `attemptDurationMinutes`: SAA-C03 da 130 y 160 con `extraTime`. Un bloque de 20 preguntas de SAA-C03 (65 preguntas, 130 min) da 40.
- [ ] `isPastDeadline` es falso a 5 s del plazo y verdadero a 6 s.
- [ ] `shuffle` con un `random` fijo es determinista y no muta la entrada.
- [ ] Verificación común en verde.

**Qué NO hacer:** no importar Nest ni Prisma; no usar `Math.random` dentro de las reglas (se inyecta).

---

### S15-T4b — Puntuación pura

| Campo | Valor |
|-------|-------|
| **Depende de** | T1b |
| **Archivos** | `apps/api/src/modules/exams/exam-scoring.ts` (crear) · `apps/api/src/modules/exams/exam-scoring.spec.ts` (crear) · `apps/api/src/modules/exercises/quiz-grading.ts` (modificar: solo exportar) |

**Contexto mínimo.** H6. `readContent(config, solution)` devuelve la variante interna (`kind`, ids, respuesta correcta y `explanations` de todas las opciones o elementos), o `null` si el contenido está roto.

**Contrato**
- `quiz-grading.ts`: `readContent` pasa a exportarse como `readQuizContent`, con sus tipos internos exportados. **Nada más cambia**, y `quiz-grading.spec.ts` pasa sin modificarse.
- `exam-scoring.ts`:

```ts
export interface ScoringItem { readonly position: number; readonly domain: number;
  readonly exercise: { readonly config: unknown; readonly solution: unknown }; readonly answer: QuizSubmissionInput | null }
export type AttemptScoring =
  | { readonly status: "scored"; readonly correctCount: number; readonly scorePct: number;
      readonly domains: readonly { domain: number; name: string; correct: number; total: number; pct: number }[];
      readonly items: readonly { position: number; correct: boolean; correctAnswer: QuizSubmissionInput; explanations: Record<string, string> }[] }
  | { readonly status: "broken-content"; readonly position: number };
export function scoreAttempt(items: readonly ScoringItem[], domains: readonly ExamDomain[]): AttemptScoring;
export function correctAnswerOf(quiz: QuizContent): QuizSubmissionInput;
// single → { optionId }, multiple → { optionIds }, ordering → { order }, matching → { pairs }
```

- `correct`: sin respuesta, `false`. Con respuesta, `gradeQuizAnswer(...).status === "graded" && result.correct`; una respuesta `invalid-answer` cuenta como `false`.
- `pct`: `Math.round(100 · correct / total)`. Solo aparecen los dominios con `total > 0`, ordenados por id.

**Criterios de aceptación**
- [ ] Hay una pregunta de cada variante: acierto, fallo y sin responder.
- [ ] Respuesta múltiple con una sola correcta de dos cuenta como fallo.
- [ ] Un intento de 3 dominios da los porcentajes por dominio y el global. `scorePct` de 2/3 es 67.
- [ ] Una pregunta con `solution` rota devuelve `broken-content` con su `position`.
- [ ] `correctAnswerOf` devuelve la forma de cuerpo de cada variante.
- [ ] Verificación común en verde.

**Qué NO hacer:** no cambiar ninguna regla de corrección de `quiz-grading.ts`.

---

### S15-T5 — Regla pura «listo para presentar»

| Campo | Valor |
|-------|-------|
| **Depende de** | T1b |
| **Archivos** | `apps/api/src/modules/exams/readiness.rules.ts` (crear) · `apps/api/src/modules/exams/readiness.rules.spec.ts` (crear) |

**Contrato**

```ts
export interface ReadinessInput {
  readonly now: Date;
  readonly units: { readonly total: number; readonly pendingCodes: readonly string[] }; // publicadas de la etapa / no MASTERED
  readonly formsAvailable: number;                                                       // formas A/B/C sembradas
  readonly attempts: readonly { mode: ExamMode; status: ExamAttemptStatus; orientative: boolean;
                                submittedAt: Date | null; scorePct: number | null; domainPcts: readonly number[] }[];
  readonly overdueReviewCount: number;            // ítems de la etapa con dueAt < now − 7 días
  readonly project: { readonly available: boolean; readonly bestReviewedScore: number | null };
  readonly defense: { readonly available: boolean; readonly done: boolean };   // S15: siempre { false, false } (H7)
}
export function evaluateReadiness(input: ReadinessInput): { ready: boolean; criteria: ReadinessCriterion[] };
```

| Criterio | `met` | `missing` (`missing[]`) | `unavailable` |
|----------|-------|--------------------------|---------------|
| `mastery` | `pendingCodes` vacío y `total > 0` | Un texto por unidad: «Unidad ${code} sin dominar» | `total = 0`: «La etapa aún no tiene unidades publicadas» |
| `mock-exams` | Decisión (d) | «Aprueba dos formas distintas con ≥ 80 % y ningún dominio por debajo del 70 % (llevas N)» y/o «Tu último simulacro válido tiene más de 14 días» | `formsAvailable < 2`: «Esta certificación aún no tiene dos formas de simulacro» |
| `review` | `overdueReviewCount = 0` | «N ítems de repaso llevan más de 7 días de retraso» | — |
| `evidence` | proyecto ≥ 70 **y** defensa hecha | «Falta el proyecto de la etapa aprobado con ≥ 70» y/o «Falta la defensa técnica» | `!project.available` o `!defense.available`, con un texto por cada pieza que falta, p. ej. «La defensa técnica de AWS llega en S26» |

`ready` es verdadero solo si los cuatro criterios están en `met`. Cada `summary` es una frase corta en español.

**Criterios de aceptación**
- [ ] Hay pruebas de cada criterio por separado en sus tres estados y una prueba combinada en la que los cuatro están en `met` y `ready` es verdadero.
- [ ] En `mock-exams`: dos intentos de la misma forma no cuentan dos veces; un orientativo no cuenta; un dominio al 69 % invalida el intento; un intento aleatorio no cuenta; el límite de 14 días se prueba en el día 14 (cuenta) y en el 15 (no cuenta).
- [ ] Con `defense.available = false`, `ready` es falso aunque todo lo demás esté en `met`.
- [ ] Verificación común en verde.

**Qué NO hacer:** no leer la base; no inventar heurísticas de «competencias críticas» (decisión b).

---

### S15-T6a — Puerto `ExamsRepository` y adaptador en memoria

| Campo | Valor |
|-------|-------|
| **Depende de** | T2, T4a |
| **Archivos** | `apps/api/src/modules/exams/exams.repository.ts` (crear) · `apps/api/src/modules/exams/in-memory-exams.repository.ts` (crear) · `apps/api/src/modules/exams/in-memory-exams.repository.spec.ts` (crear) |

**Contrato**

```ts
export const EXAMS_REPOSITORY = Symbol("EXAMS_REPOSITORY");
export const EXAMS_CLOCK = Symbol("EXAMS_CLOCK");      // () => Date
export const EXAMS_RANDOM = Symbol("EXAMS_RANDOM");    // () => number

export interface ReservedQuestionRow { exerciseId: string; slug: string; domain: number; unitCode: string;
  statement: string; config: unknown; solution: unknown; reviewedByHuman: boolean; competencies: string[] }
export interface AttemptItemRow { position: number; exerciseId: string; domain: number; answer: unknown | null;
  flagged: boolean; correct: boolean | null; question: ReservedQuestionRow }
export interface AttemptRow { id: string; userId: string; certification: CertificationCode; mode: ExamMode; domain: number | null;
  extraTime: boolean; status: ExamAttemptStatus; orientative: boolean; startedAt: Date; deadlineAt: Date; submittedAt: Date | null;
  correctCount: number | null; scorePct: number | null; domainScores: unknown | null; items: AttemptItemRow[] }

export interface ExamsRepository {
  listReservedPool(certification: CertificationCode): Promise<ReservedQuestionRow[]>; // QUIZ + RESERVED + publicado
  findFormSlugs(certification: CertificationCode, code: ExamFormCode): Promise<string[] | null>;
  countForms(certification: CertificationCode): Promise<number>;
  recentExerciseIds(userId: string, certification: CertificationCode, lastAttempts: number): Promise<Set<string>>; // de los N últimos intentos terminados
  findOpenAttemptId(userId: string, certification: CertificationCode): Promise<string | null>;
  createAttempt(input: { userId; certification; mode; domain; extraTime; orientative; startedAt; deadlineAt;
    items: { position: number; exerciseId: string; domain: number }[] }): Promise<AttemptRow>;
  findOwnedAttempt(userId: string, attemptId: string): Promise<AttemptRow | null>;   // null si es ajeno o no existe
  updateItem(attemptId: string, position: number, patch: { answer?: unknown | null; flagged?: boolean; answeredAt?: Date | null }): Promise<AttemptItemRow>;
  /** Cierra solo si sigue IN_PROGRESS; devuelve false si ya estaba cerrado (doble entrega). */
  finishAttempt(attemptId: string, input: { status: "SUBMITTED" | "EXPIRED"; submittedAt: Date; correctCount: number;
    scorePct: number; domainScores: unknown; itemCorrectness: { position: number; correct: boolean }[] }): Promise<boolean>;
  listAttempts(userId: string, certification: CertificationCode): Promise<Omit<AttemptRow, "items">[]>;  // más reciente primero
  readinessFacts(userId: string, stageId: number, now: Date): Promise<{ unitsTotal: number; pendingUnitCodes: string[];
    overdueReviewCount: number; projectAvailable: boolean; bestReviewedProjectScore: number | null }>;
  createRealResult(input: { userId; certification; passed; scaledScore: number | null; takenOn: Date; readyAtRegistration: boolean }): Promise<RealResultRow>;
  latestRealResult(userId: string, certification: CertificationCode): Promise<RealResultRow | null>;
}
```

El adaptador en memoria guarda filas en `Map`. Expone métodos de siembra para las pruebas: `seedQuestion`, `seedForm`, `seedReadinessFacts`. Respeta la propiedad y `finishAttempt` es condicional.

**Criterios de aceptación**
- [ ] `findOwnedAttempt` con otro `userId` devuelve `null`.
- [ ] `finishAttempt` dos veces: la primera `true` y la segunda `false`, sin cambiar nada.
- [ ] `recentExerciseIds` solo mira los N últimos intentos **terminados** de esa certificación.
- [ ] `listAttempts` ordena del más reciente al más antiguo.
- [ ] Verificación común en verde.

**Qué NO hacer:** no implementar Prisma (T6b); no poner reglas de negocio en el repositorio.

---

### S15-T6b — Adaptador Prisma

| Campo | Valor |
|-------|-------|
| **Depende de** | T6a |
| **Archivos** | `apps/api/src/modules/exams/prisma-exams.repository.ts` (crear) · `apps/api/src/modules/exams/prisma-exams.repository.spec.ts` (crear) |

**Contexto mínimo.** H2 y H11. Las pruebas usan un `PrismaService` falso que registra los argumentos, como `exercises.exam-pool.spec.ts` de S14-T8a.

**Contrato:** implementa `ExamsRepository`.
- `listReservedPool`: `where: { type: "QUIZ", examPool: "RESERVED", isPublished: true, certification }`, incluyendo `unit.code`.
- `createAttempt`: un solo `create` con los ítems anidados.
- `finishAttempt`: en una transacción, `updateMany({ where: { id, status: "IN_PROGRESS" } })`. Si `count === 0`, devuelve `false`. Si no, actualiza `correct` por posición.
- `readinessFacts`:
  - unidades publicadas de la etapa: `unit.isPublished` y `module.stageId`;
  - las que no tienen `UnitProgress` `MASTERED` del usuario;
  - `ReviewItem` del usuario con `dueAt < now − 7 días` y el ejercicio en una unidad de la etapa;
  - si hay `Project` publicado de la etapa;
  - el mejor `score` de `ProjectSubmission` `REVIEWED` del usuario en ese proyecto.
- Mapea los enums de Prisma (`FORM_A`…, `IN_PROGRESS`…) a los del contrato (`form-a`…, `in-progress`…) en un solo lugar.

**Criterios de aceptación**
- [ ] Hay una prueba por método con el `where` esperado. En `listReservedPool` se comprueba `examPool: "RESERVED"` y `isPublished: true`.
- [ ] `finishAttempt` devuelve `false` cuando `updateMany` da `count: 0` y entonces no toca los ítems.
- [ ] Mapeo de enums de ida y vuelta.
- [ ] Verificación común en verde.

**Qué NO hacer:** no usar `ExercisesRepository`; no ejecutar SQL crudo.

---

### S15-T7a — Servicio: iniciar, leer, responder, entregar

| Campo | Valor |
|-------|-------|
| **Depende de** | T4a, T4b, T6a |
| **Archivos** | `apps/api/src/modules/exams/exams.service.ts` (crear) · `apps/api/src/modules/exams/exams.service.spec.ts` (crear) · `apps/api/src/modules/exams/exams.module.ts` (crear) · `apps/api/src/app.module.ts` (modificar: registrar `ExamsModule`) |

**Contexto mínimo.** H9 y H10. `ExamsModule` importa `PrismaModule`, `AuthModule` y `ReviewModule` (que exporta `ReviewService`). Provee `EXAMS_REPOSITORY` → `PrismaExamsRepository`, `EXAMS_CLOCK` → `() => new Date()` y `EXAMS_RANDOM` → `Math.random`. Las pruebas usan el adaptador en memoria, un reloj fijo y un `random` fijo.

**Contrato**

| Método | Comportamiento | Errores |
|--------|----------------|---------|
| `start(userId, certification, input)` | Arma el intento con la forma (en el orden de la semilla) o con `assembleRandom`/`assembleDomainBlock`. Calcula `orientative`: alguna pregunta tiene `reviewedByHuman = false`. Calcula `deadlineAt = now + attemptDurationMinutes`. Devuelve `ExamAttempt`. | `409` «Esta certificación está en beta: el simulacro llegará con la guía definitiva» · `409` «Ya tienes un simulacro en curso de esta certificación» · `409` «La forma ${X} todavía no existe» · `409` «El banco reservado no alcanza para este simulacro» · `400` «Ese dominio no existe en el examen» |
| `get(userId, attemptId)` | Si está en curso y `isPastDeadline`, lo cierra como `expired` (igual que `submit`) antes de responder. Devuelve el `ExamAttempt` sin solución, con `remainingSeconds`. | `404` «El simulacro no existe» |
| `updateItem(userId, attemptId, position, body)` | Valida la respuesta con `gradeQuizAnswer` contra el ejercicio: un `invalid-answer` es `400` con su mensaje y nunca se devuelve si es correcta. Guarda `answer`, `flagged` y `answeredAt`. `answer: null` borra. | `404` · `400` «La pregunta ${n} no existe en este simulacro» · `409` «El simulacro ya se entregó» · `409` «El tiempo terminó: tu simulacro se entregó automáticamente» (y lo cierra como `expired`) |
| `submit(userId, attemptId)` | `scoreAttempt` → `finishAttempt` (`SUBMITTED`, o `EXPIRED` si ya pasó el plazo) → por cada pregunta fallada, `reviews.scheduleFromSubmission({ userId, exerciseId, outcome: "FAILED", score: 0, hintsUsed: 0 })`. Devuelve `ExamResult`. | `404` · `409` «El simulacro ya se entregó» (también si `finishAttempt` devuelve `false`) · `500` «El simulacro tiene una pregunta mal configurada» si da `broken-content` |

**Criterios de aceptación** (`exams.service.spec.ts`)
- [ ] Iniciar `form-a` sirve las preguntas en el orden de la forma, con `questionCount` igual al oficial y el plazo correcto.
- [ ] **Ninguna respuesta de `start`, `get` ni `updateItem` contiene** `correct`, `correctAnswer`, `explanations` ni `solution`: prueba recursiva sobre el JSON.
- [ ] Un segundo `start` con uno en curso da `409`. MLA-C02 da `409`.
- [ ] Con el reloj después del plazo + 5 s: `updateItem` da `409` y el intento queda `expired`; `get` lo devuelve `expired`. Un intento vencido de **otro** usuario no se toca.
- [ ] Otro usuario recibe `404` en `get`, `updateItem` y `submit`.
- [ ] `submit` llama a `scheduleFromSubmission` solo por las falladas. Un segundo `submit` da `409`.
- [ ] Verificación común en verde.

**Qué NO hacer:** no crear el controlador (T8); no crear `Submission` por cada pregunta; no exponer `exerciseId` ni `slug` en las preguntas.

---

### S15-T7b — Servicio: resultado, historial, preparación, resultado real

| Campo | Valor |
|-------|-------|
| **Depende de** | T5, T7a |
| **Archivos** | `apps/api/src/modules/exams/exams.service.ts` (modificar) · `apps/api/src/modules/exams/exams.readiness.spec.ts` (crear) |

**Contrato**
- `result(userId, attemptId)`:
  - si el intento está en curso y vencido, lo cierra primero;
  - si sigue en curso, `409` «El simulacro sigue en curso»;
  - si no, devuelve `ExamResult` con `correctAnswer`, `explanations` y `unitCode` por pregunta, recalculados con `scoreAttempt` sobre las respuestas guardadas.
- `history(userId, certification)` devuelve `ExamHistoryItem[]`.
- `readiness(userId, certification)`:
  - arma `ReadinessInput` con `readinessFacts`, `countForms`, `listAttempts` (`domainPcts` sale de `domainScores`) y `defense: { available: false, done: false }`;
  - devuelve `ExamReadiness`, con `lastRealResult`.
- `registerRealResult(userId, certification, body)`:
  - `takenOn` posterior a hoy da `400` «La fecha del examen no puede ser futura»;
  - `readyAtRegistration` se calcula con `readiness` en ese momento.

**Criterios de aceptación**
- [ ] `result` de un intento en curso da `409`; tras entregar, devuelve las explicaciones y el `unitCode` de cada pregunta.
- [ ] `readiness` con hechos sembrados devuelve los cuatro criterios en orden, y `evidence` como `unavailable`.
- [ ] `registerRealResult` guarda `readyAtRegistration` y rechaza una fecha futura.
- [ ] Las pruebas de T7a pasan sin modificarlas.
- [ ] Verificación común en verde.

---

### S15-T7c — El repaso muestra las preguntas reservadas falladas

| Campo | Valor |
|-------|-------|
| **Depende de** | T7a |
| **Archivos** | `apps/api/src/modules/review/prisma-review.repository.ts` (modificar) · `apps/api/src/modules/review/prisma-exam-pool.spec.ts` (modificar) |

**Contexto mínimo.** H3, H4 y la decisión (a).

**Contrato**
- `listDue` y `countDue` dejan de filtrar `exercise: { examPool: "UNIT" }`.
- Un comentario en el repositorio explica por qué es seguro: solo `ExamsService.submit` crea un `ReviewItem` de un ejercicio reservado.
- `prisma-ai.repository.ts` **no se toca** y su filtro sigue.

**Criterios de aceptación**
- [ ] Las pruebas del spec que exigían el filtro se reescriben: ahora comprueban que el `where` **no** lo lleva.
- [ ] `apps/api/src/modules/content/prisma-exam-pool.spec.ts` (unidad y progreso, S14-T8b) y las pruebas del tutor siguen pasando sin tocarlas.
- [ ] Verificación común en verde.

**Qué NO hacer:** no tocar `prisma-ai.repository.ts`, `prisma-content.repository.ts` ni `prisma-progress.repository.ts`.

---

### S15-T8 — Controlador y límites

| Campo | Valor |
|-------|-------|
| **Depende de** | T7b |
| **Archivos** | `apps/api/src/modules/exams/exams.controller.ts` (crear) · `apps/api/src/modules/exams/exams.controller.spec.ts` (crear) · `apps/api/src/modules/exams/exams.module.ts` (modificar) |

**Contrato**
- `@Controller("exams")` con `@UseGuards(JwtAuthGuard, RateLimitGuard)`. Rutas de §3, salvo `cohort` (T12b).
- Validación con `ZodValidationPipe`:
  - parámetros `:certification` con `certificationCodeSchema` (`400 VALIDATION_ERROR` si no es un código);
  - `:position` como entero ≥ 1;
  - cuerpos con los esquemas de T1a y T1b.
- Límites:
  - `POST …/attempts`: `{ limit: 10, windowMs: 3_600_000, keyFromUser: true }`;
  - el resto: `{ limit: 120, windowMs: 60_000, keyFromUser: true }`.
- Respuestas con la forma `{ attempt }`, `{ item, remainingSeconds }`, `{ result }`, `{ attempts }`, `{ readiness }` y `{ realResult }`. `POST attempts` y `POST real-results` responden `201`.

**Criterios de aceptación** (`exams.controller.spec.ts`, con el servicio simulado y lectura de metadatos)
- [ ] Cada ruta llama al método correcto del servicio con `user.sub`.
- [ ] La clase tiene `JwtAuthGuard` y `RateLimitGuard`, y `POST attempts` tiene su límite propio (se lee `RATE_LIMIT_METADATA`).
- [ ] `POST attempts` y `POST real-results` usan `@HttpCode(201)` o el valor por defecto de Nest.
- [ ] Verificación común en verde y `npm run build -w apps/api` en verde.

---

### S15-T9a — Cliente web `examsApi`

| Campo | Valor |
|-------|-------|
| **Depende de** | T8 |
| **Archivos** | `apps/web/src/lib/api-client.ts` (modificar) · `apps/web/src/lib/api-client.spec.ts` (modificar) |

**Contrato.** Sigue el patrón de `exercisesApi.submitAudit`, con `apiRequest` y `parseContract`.

```ts
export const examsApi = {
  start(certification, input: StartExamAttemptInput): Promise<ExamAttempt>,
  get(attemptId): Promise<ExamAttempt>,
  updateItem(attemptId, position, body: UpdateExamItemInput): Promise<{ item: ExamAttemptItem; remainingSeconds: number }>,
  submit(attemptId): Promise<ExamResult>,
  result(attemptId): Promise<ExamResult>,
  history(certification): Promise<ExamHistoryItem[]>,
  readiness(certification): Promise<ExamReadiness>,
  registerRealResult(certification, body): Promise<RealExamResult>,
};
```

**Criterios de aceptación**
- [ ] Hay una prueba por método con la ruta (con `encodeURIComponent`), el método HTTP y el cuerpo.
- [ ] Una respuesta que no cumple el contrato falla.
- [ ] Las pruebas existentes pasan sin modificarlas.
- [ ] Verificación común en verde.

---

### S15-T9b — Controles de respuesta sin corrección

| Campo | Valor |
|-------|-------|
| **Depende de** | T9a |
| **Archivos** | `apps/web/src/features/exams/components/ExamAnswerInput.tsx` (crear) · `apps/web/src/features/exams/components/ExamAnswerInput.spec.tsx` (crear) |

**Contexto mínimo.** H5. Las cuatro formas de `config` están en `banco-ejercicios.md` §3.2. Un `config` sin `kind` es `single`.

**Contrato:** `ExamAnswerInput({ config, statement, value, onChange, disabled })` es un componente **controlado**.
- `value` es una `QuizSubmissionInput | null`. `onChange(next)` recibe la respuesta completa o `null`.
- Variantes:
  - `single`: radios;
  - `multiple`: casillas con «Selecciona DOS/TRES». Las demás se deshabilitan al llegar a `selectCount`. Solo llama a `onChange` con `{ optionIds }` cuando hay exactamente `selectCount`; si no, `null`;
  - `ordering`: lista con «Subir» y «Bajar», `aria-label` «Subir: {texto}». Llama con `{ order }` en cada movimiento. Sin arrastre;
  - `matching`: `<select>` «Pareja de {texto}». Llama con `{ pairs }` solo cuando todas las filas están elegidas.
- **No** hay botón «Comprobar», ni texto de acierto o fallo, ni explicaciones.
- Un `kind` desconocido muestra `role="alert"` «Este tipo de pregunta todavía no está disponible.».

**Criterios de aceptación**
- [ ] Una prueba por variante que comprueba el valor que recibe `onChange`.
- [ ] `multiple` llama con `null` mientras no hay `selectCount` marcadas.
- [ ] Con `value` dado, el control lo refleja: se puede retomar una respuesta guardada.
- [ ] No aparece ningún texto «¡Correcto!» ni «Todavía no».
- [ ] Verificación común en verde.

**Qué NO hacer:** no reutilizar ni modificar `QuizPlayer`, `QuizMultiplePlayer`, `QuizOrderingPlayer` ni `QuizMatchingPlayer`.

---

### S15-T9c — Cronómetro y cuadrícula de navegación

| Campo | Valor |
|-------|-------|
| **Depende de** | T9a |
| **Archivos** | `apps/web/src/features/exams/components/ExamTimer.tsx` (crear) · `apps/web/src/features/exams/components/ExamNavigator.tsx` (crear) · `apps/web/src/features/exams/components/ExamRoomParts.spec.tsx` (crear) |

**Contrato**
- `ExamTimer({ remainingSeconds, onElapsed })`:
  - muestra `hh:mm:ss`;
  - cuenta hacia atrás cada segundo desde el valor del servidor y se resincroniza cuando cambia la prop;
  - lleva `role="timer"` con `aria-label` «Tiempo restante» y **no** usa `aria-live` por segundo;
  - un aviso `role="status"` anuncia una sola vez «Quedan 10 minutos» y otra «Queda 1 minuto»;
  - al llegar a 0 llama a `onElapsed` una sola vez.
- `ExamNavigator({ items, current, onSelect })`:
  - una cuadrícula de botones numerados;
  - cada uno con `aria-label` «Pregunta N: respondida/sin responder[, marcada]»;
  - `aria-current` en la actual;
  - el estado se indica con texto o icono, no solo con color.

**Criterios de aceptación**
- [ ] Con temporizadores falsos, el cronómetro baja, anuncia los dos avisos una vez cada uno y llama a `onElapsed` una vez.
- [ ] Al cambiar `remainingSeconds`, se resincroniza.
- [ ] La cuadrícula refleja respondida, marcada y actual, y `onSelect` recibe la posición.
- [ ] Verificación común en verde.

---

### S15-T9d — Sala de examen

| Campo | Valor |
|-------|-------|
| **Depende de** | T9b, T9c |
| **Archivos** | `apps/web/src/features/exams/components/ExamRoom.tsx` (crear) · `apps/web/src/features/exams/components/ExamRoom.spec.tsx` (crear) · `apps/web/src/app/(learning)/learn/exams/attempts/[id]/page.tsx` (crear) |

**Contrato:** `ExamRoom({ attemptId, api = examsApi })`.
- **Carga:** carga el intento. Si no está `in-progress`, navega a `/learn/exams/attempts/${id}/result`.
- **Pantalla:**
  - una pregunta a la vez: «Pregunta N de M», el enunciado y `ExamAnswerInput`;
  - una casilla «Marcar para revisar»;
  - «Anterior» y «Siguiente»;
  - `ExamNavigator`;
  - `ExamTimer`.
- **Guardado:**
  - cada cambio de respuesta o marca hace `PUT`, y la última llamada gana;
  - un error de red muestra `role="alert"` y conserva la respuesta local para reintentar;
  - tras cada `PUT`, se resincroniza `remainingSeconds`.
- **Revisión previa:**
  - «Revisar y entregar» abre una pantalla con las sin responder y las marcadas, cada una con un enlace a su pregunta;
  - «Entregar simulacro» pide una confirmación que dice cuántas quedan sin responder;
  - al confirmar, hace `submit` y navega al resultado.
- **Tiempo:**
  - al vencer (`onElapsed`), o si un `PUT` responde `409` de tiempo, se muestra «Se acabó el tiempo: tu simulacro se entregó» y se navega al resultado;
  - en ese caso el cliente **no** llama a `submit`: el servidor cierra el intento al leerlo.
- **Salir:** mientras el intento está en curso hay aviso antes de salir (`beforeunload`).

**Criterios de aceptación** (con `api` simulada)
- [ ] Responder dispara `updateItem(id, n, { answer })`, y marcar dispara `{ flagged: true }`.
- [ ] La revisión previa lista las sin responder y las marcadas.
- [ ] Entregar llama a `submit` una sola vez y navega.
- [ ] Al vencer el tiempo, navega al resultado sin llamar a `submit`.
- [ ] Un intento ya entregado redirige al cargar.
- [ ] Verificación común en verde y `npm run build -w apps/web` en verde (restaurar `next-env.d.ts`).

---

### S15-T10 — Informe por dominio y revisión ítem a ítem

| Campo | Valor |
|-------|-------|
| **Depende de** | T9d |
| **Archivos** | `apps/web/src/features/exams/components/ExamResult.tsx` (crear) · `apps/web/src/features/exams/components/ExamResult.spec.tsx` (crear) · `apps/web/src/app/(learning)/learn/exams/attempts/[id]/result/page.tsx` (crear) |

**Contrato:** `ExamResult({ attemptId, api = examsApi })`.
- **Cabecera:**
  - porcentaje global y «X de N correctas»;
  - si `orientative`, el aviso «Resultado orientativo: alguna pregunta aún no tiene revisión humana y no cuenta para «listo para presentar».»;
  - si `expired`, «Entregado automáticamente al terminar el tiempo»;
  - la nota «Porcentaje de aciertos. AWS usa una puntuación escalada que no publica; aquí no se imita.».
- **Dominios:** una tabla con nombre, aciertos, total y %. Los dominios por debajo del 70 % se señalan con texto («Por debajo del 70 %»), no solo con color.
- **Revisión ítem a ítem:**
  - un filtro: todas, falladas o marcadas;
  - por pregunta: el enunciado, tu respuesta, la respuesta correcta, la explicación de cada opción o elemento y el enlace «Repasar la unidad» a `/learn/units/${unitCode}`;
  - el aviso «Las preguntas falladas se añadieron a tu repaso con prioridad alta.».

**Criterios de aceptación**
- [ ] Muestra el global, la tabla por dominio con el marcador del 70 % y el aviso de orientativo.
- [ ] El filtro «falladas» oculta las acertadas.
- [ ] Hay un enlace por pregunta a su unidad.
- [ ] Cada variante muestra la respuesta correcta en texto legible: los textos de las opciones, no sus ids.
- [ ] Verificación común en verde.

---

### S15-T11a — Página de la certificación: modos e historial

| Campo | Valor |
|-------|-------|
| **Depende de** | T9a |
| **Archivos** | `apps/web/src/features/exams/components/ExamHome.tsx` (crear) · `apps/web/src/features/exams/components/ExamHome.spec.tsx` (crear) · `apps/web/src/app/(learning)/learn/exams/[certification]/page.tsx` (crear) |

**Contrato:** `ExamHome({ certification, api = examsApi })`.
- **Cabecera:** el nombre, el código y el formato oficial («65 preguntas · 130 minutos»), tomados de `CERTIFICATION_REGISTRY`.
- **Modos:** formulario con forma A, B o C, aleatorio y bloque por dominio (con un `<select>` de dominios del registro), más la casilla «+30 minutos (adaptación por idioma)».
- **Iniciar:** llama a `start` y navega a la sala.
  - Si responde `409` porque ya hay uno en curso, ofrece «Continuar el simulacro en curso», que enlaza al intento `in-progress` del historial.
  - El resto de `409` se muestran tal cual en `role="alert"`.
- **Historial:** una tabla con fecha, modo, estado, % y «orientativo», con enlaces a la sala (en curso) o al resultado.
- **Beta:** si la certificación está en beta, los modos se deshabilitan con la explicación.

**Criterios de aceptación**
- [ ] Iniciar `form-b` con `extraTime` llama a `start(cert, { mode: "form-b", extraTime: true })`.
- [ ] El bloque por dominio exige elegir un dominio.
- [ ] Un `409` de «en curso» muestra el enlace de continuar.
- [ ] Con MLA-C02, los modos están deshabilitados.
- [ ] Verificación común en verde.

---

### S15-T11b — Panel de preparación y resultado real

| Campo | Valor |
|-------|-------|
| **Depende de** | T11a |
| **Archivos** | `apps/web/src/features/exams/components/ReadinessPanel.tsx` (crear) · `apps/web/src/features/exams/components/ReadinessPanel.spec.tsx` (crear) · `apps/web/src/features/exams/components/ExamHome.tsx` (modificar: incluir el panel) · `apps/web/src/app/(learning)/learn/stages/[id]/page.tsx` (modificar: enlace) |

**Contrato**
- `ReadinessPanel({ certification, api })` muestra:
  - el titular «Listo para presentar» o «Todavía no»;
  - los cuatro criterios, cada uno con su estado en texto («Cumplido», «Falta», «Aún no disponible»), su `summary` y su lista `missing`;
  - nunca solo sí o no (`metodo-aws.md` §9).
- **Formulario «Registra tu resultado real»** (opcional y privado):
  - campos «¿Aprobaste?», «Puntuación (100–1000, opcional)» y fecha;
  - envía `registerRealResult`;
  - muestra el último resultado registrado.
- **Página de la etapa:** si `certificationForStageId(id)` no es `null`, muestra el enlace «Simulacros y preparación» a `/learn/exams/${code}`.

**Criterios de aceptación**
- [ ] Hay una prueba con los tres estados de criterio.
- [ ] El formulario envía el cuerpo correcto y muestra el error `400` de fecha futura.
- [ ] El enlace aparece en la etapa 103 y no en la 1.
- [ ] Verificación común en verde y `npm run build -w apps/web` en verde.

---

### S15-T12a — Contrato y agregación pura de la cohorte

| Campo | Valor |
|-------|-------|
| **Depende de** | T1b |
| **Archivos** | `packages/shared/src/schemas/exam.ts` (modificar) · `packages/shared/src/schemas/exam.spec.ts` (modificar) · `apps/api/src/modules/exams/exam-cohort.rules.ts` (crear) · `apps/api/src/modules/exams/exam-cohort.rules.spec.ts` (crear) |

**Contrato**

```ts
// shared
export const examCohortSchema = z.object({
  certification: certificationCodeSchema, from: z.string().datetime(), to: z.string().datetime(),
  attempts: z.number().int().nonnegative(), learners: z.number().int().nonnegative(),
  domains: z.array(z.object({ domain: z.number().int(), name: z.string(), avgPct: z.number().int().min(0).max(100), attempts: z.number().int() })),
  readinessVsReal: z.object({
    readyPassed: z.number().int(), readyFailed: z.number().int(), notReadyPassed: z.number().int(), notReadyFailed: z.number().int(),
  }),
});
export const examCohortResponseSchema = z.object({ cohort: examCohortSchema });
// api: función pura
export function aggregateCohort(input: { definition; from: Date; to: Date;
  attempts: { userId: string; orientative: boolean; domainScores: { domain: number; pct: number }[] }[];
  realResults: { readyAtRegistration: boolean; passed: boolean }[] }): ExamCohort;
```

- Solo cuentan los intentos terminados y **no orientativos**.
- `avgPct` es la media redondeada de los `pct` del dominio. Los dominios se ordenan de más débil a más fuerte.
- **Privacidad:** si hay menos de 5 personas (`learners < 5`), `domains` sale vacío.

**Criterios de aceptación**
- [ ] Tres personas: `domains` vacío. Cinco personas: medias correctas y orden ascendente.
- [ ] Los orientativos se excluyen.
- [ ] La tabla 2×2 de resultados reales es correcta.
- [ ] Verificación común en verde.

---

### S15-T12b — Endpoint de cohorte

| Campo | Valor |
|-------|-------|
| **Depende de** | T12a, T8 |
| **Archivos** | `exams.repository.ts` · `in-memory-exams.repository.ts` · `prisma-exams.repository.ts` · `exams.service.ts` · `exams.controller.ts` (todos en `apps/api/src/modules/exams/`, modificar). Excepción de 5 archivos; las pruebas van en los specs existentes del módulo, que también se modifican. |

**Contrato**
- `ExamsRepository.cohortFacts(certification, from, to)` devuelve los intentos terminados (con `userId`, `orientative` y `domainScores`) y los resultados reales del rango.
- `ExamsService.cohort(certification, from, to)` llama a `aggregateCohort`.
- La ruta es `GET /api/exams/:certification/cohort?from&to`, con `@Roles("INSTRUCTOR", "ADMIN")` y `@UseGuards(RolesGuard)`, como `analytics.controller.ts`.
- El rango se valida con el mismo criterio que `analytics-range.pipe.ts`: por defecto, los últimos 30 días.

**Criterios de aceptación**
- [ ] Un estudiante recibe `403`; prueba de metadatos de roles.
- [ ] El servicio devuelve la agregación con los hechos del adaptador en memoria.
- [ ] El `where` de Prisma filtra por certificación, rango y estado terminado.
- [ ] Verificación común en verde.

---

### S15-T12c — Vista del instructor

| Campo | Valor |
|-------|-------|
| **Depende de** | T12b |
| **Archivos** | `apps/web/src/lib/api-client.ts` (modificar: `examsApi.cohort`) · `apps/web/src/features/exams/components/ExamCohortView.tsx` (crear) · `apps/web/src/features/exams/components/ExamCohortView.spec.tsx` (crear) · `apps/web/src/app/(instructor)/instructor/exams/page.tsx` (crear) |

**Contrato**
- `<select>` de certificación.
- Tabla de dominios de más débil a más fuerte.
- Si `domains` viene vacío, el aviso «Hacen falta al menos 5 personas para mostrar dominios».
- Tabla 2×2 «listo para presentar» × «aprobó», con la nota de que los datos son voluntarios.

**Criterios de aceptación**
- [ ] Hay pruebas de las dos tablas y del aviso de privacidad.
- [ ] Verificación común en verde y `npm run build -w apps/web` en verde.

---

### S15-T13 — Verificación HTTP con dos usuarios

| Campo | Valor |
|-------|-------|
| **Depende de** | T1a–T12c |
| **Archivos** | ninguno en el repositorio (informe) |

**Secuencia**
1. Contenedor desechable en el puerto **5441**. Allí se ejecutan `migrate deploy` y `db:seed`, con `DATABASE_URL` apuntando a él.
2. Un script **fuera del repositorio** inserta 65 ejercicios `QUIZ` sintéticos `RESERVED` de CLF-C02:
   - reparto 16/19/22/8;
   - al menos 1 `multiple`;
   - `reviewedByHuman` en `true` salvo en uno;
   - en una unidad publicada de una etapa cualquiera;
   - más las formas A y B.
3. La API se arranca contra 5441 en otro puerto (`PORT=3101`). Se registran dos usuarios.
4. Con `curl`:
   1. A inicia `form-a`;
   2. B no puede leerlo ni responderlo (`404`);
   3. el intento no contiene ninguna clave de solución;
   4. A responde y marca;
   5. A entrega y obtiene un resultado por dominio;
   6. un segundo `submit` da `409`;
   7. la cola de repaso de A contiene las preguntas falladas con `priority` alta.
5. Para el plazo, se inicia otro intento y se adelanta su `deadlineAt` con `UPDATE` en 5441. Después, `PUT` da `409` y `GET` lo devuelve `expired`.
6. Se apaga la API, se comprueba que el puerto 3101 quedó libre y se borra el contenedor.

**Criterios de aceptación:** el reporte pega el código HTTP y un extracto de cada paso. No se toca 5433.

---

### S15-T14 — Documentación (Orquestador)

Al cerrar el sprint:
- `contratos-api.md`: nueva §4.13 «Simulacros (`/api/exams`)» y límites en §6;
- `modelo-datos.md`: los cuatro modelos, los dos enums y sus índices;
- `metodo-aws.md` §8–§9: el estado «Existe» y las decisiones (a)–(i);
- `curriculo-aws.md` §6: nota sobre las decisiones (b) y (c);
- `banco-ejercicios.md`: el formato de `aws/exam-forms/<CERT>.json`;
- el estado del sprint, el roadmap y el `README`.

---

## 5. Criterios de cierre

- [ ] Un intento no devuelve nunca respuestas ni explicaciones antes de entregar (prueba recursiva en T7a y comprobación HTTP en T13).
- [ ] El servidor rechaza respuestas fuera de plazo y cierra solo el intento vencido.
- [ ] Un usuario no puede leer ni responder intentos de otro (`404` indistinguible).
- [ ] El aleatorio respeta los pesos (±1 pregunta por dominio) y no repite preguntas de los tres últimos intentos cuando el banco alcanza.
- [ ] La regla de preparación tiene pruebas de los cuatro criterios por separado y combinados.
- [ ] Las preguntas falladas aparecen en el repaso con prioridad alta.
- [ ] Suite completa, typecheck, lint y build en verde; verificación HTTP con dos usuarios (T13).

## 6. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) §6
- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §8–§9
- [`sprint-14-preguntas-examen.md`](sprint-14-preguntas-examen.md) (H3, H4, T6, T8)

## 7. Orden de ejecución

Una tarea por sesión de Constructor. El Orquestador revisa cada una, con la suite completa, antes de abrir la siguiente.

| Paso | Tarea | Base de datos | Notas |
|------|-------|---------------|-------|
| 1 | **T1a** → **T1b** | No | Contratos |
| 2 | **T3a** | No | Reparto y validación de formas |
| 3 | **T2** | **Sí** (5433: respaldo, `--create-only`, revisar el SQL) | Después, `db:generate` con los puertos 3000 y 3001 libres |
| 4 | **T3b** | **Sí** (siembra y base desechable 5441) | |
| 5 | **T4a**, **T4b**, **T5** | No | Reglas puras; pueden ir en cualquier orden |
| 6 | **T6a** → **T6b** | No (`PrismaService` falso; necesita el cliente de T2) | |
| 7 | **T7a** → **T7b** → **T7c** | No | |
| 8 | **T8** | No | |
| 9 | **T9a** → **T9b** → **T9c** → **T9d** → **T10** → **T11a** → **T11b** | No | Cadena web |
| 10 | **T12a** → **T12b** → **T12c** | No | |
| 11 | **T13** | Base desechable 5441 | Verificación HTTP |
| 12 | **T14** | No | Orquestador |

Estas tareas comparten archivo y **no se ejecutan a la vez**:
- `exam.ts`: T1a, T1b y T12a;
- `exams.service.ts`: T7a, T7b y T12b;
- `api-client.ts`: T9a y T12c;
- `ExamHome.tsx`: T11a y T11b.
