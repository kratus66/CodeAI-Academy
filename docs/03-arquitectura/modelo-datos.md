# Modelo de datos

> Esquema Prisma como fuente de verdad. Cualquier cambio estructural requiere migración y actualización de este documento **en el mismo commit**.
>
> **Implementación incremental (S1–S6):** `apps/api/prisma/schema.prisma` contiene el bloque de identidad (`User` y `RefreshToken`, migración `init_identity`), el bloque de contenido (`Stage` → `Module` → `Unit` → `Lesson`, `Exercise`, `Resource` y `LessonResource`, migración `content_structure`), el de progreso (`UnitProgress`, migraciones `progress_tracking` y `unit_progress_lesson_ids`), el de ejercicios y envíos (`ExerciseHint`, `ExerciseTest`, `Submission`, `SubmissionTestResult`, migración `exercises_and_submissions`) y el de pistas pedidas (`HintRequest`, migración `hint_requests`). Los modelos de analítica se añaden en S7–S11 con sus relaciones y su propia migración: crear tablas sin contrato en vigor sería deuda, no avance.
>
> **Estado (2026-10-27):** ✅ identidad, contenido, progreso, ejercicios y `HintRequest` implementados y migrados · ⬜ analítica (S7–S11).

---

## 1. Visión general de entidades

```
                        ┌──────────┐
                        │   User   │
                        └────┬─────┘
        ┌────────────────────┼───────────────────────┬──────────────┐
        ▼                    ▼                       ▼              ▼
 ┌──────────────┐    ┌───────────────┐      ┌───────────────┐ ┌──────────┐
 │RefreshToken  │    │ UnitProgress  │      │ CompetencyProg│ │ReviewItem│
 └──────────────┘    └───────┬───────┘      └───────────────┘ └────┬─────┘
                             │                                     │
 ┌───────┐   ┌────────┐   ┌──▼───┐   ┌────────┐                    ▼
 │ Stage │──►│ Module │──►│ Unit │──►│ Lesson │              ┌──────────┐
 └───────┘   └────────┘   └──┬───┘   └────────┘              │ReviewLog │
                             │                                └──────────┘
                             ▼
                        ┌──────────┐      ┌──────────────┐
                        │ Exercise │─────►│  Submission  │
                        └────┬─────┘      └──────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              ┌──────────┐   ┌──────────────┐
              │  Hint    │   │ ExerciseTest │
              └──────────┘   └──────────────┘
```

`HintRequest` (S6) cuelga de `User` y de `Exercise`: registra qué niveles de pista pidió cada estudiante, sin duplicar filas.

Las entidades de S9 y S10 cuelgan de `User` además del contenido: `Project`/`ProjectSubmission` (una entrega por intento), `InterviewScenario`/`InterviewSession` (guion y transcripción por intento) y `AiInteraction` (auditoría de cada llamada real al proveedor). El detalle está en §6.

---

## 2. Esquema Prisma — núcleo de identidad y contenido

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────── IDENTIDAD ───────────────────────────

enum Role {
  STUDENT
  INSTRUCTOR
  ADMIN
}

model User {
  id             String    @id @default(cuid())
  email          String    @unique
  passwordHash   String
  name           String
  role           Role      @default(STUDENT)
  avatarUrl      String?
  locale         String    @default("es")
  isActive       Boolean   @default(true)
  lastLoginAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  refreshTokens  RefreshToken[]
  unitProgress   UnitProgress[]
  submissions    Submission[]
  hintRequests   HintRequest[]
  competency     CompetencyProgress[]
  reviewItems    ReviewItem[]
  projects       ProjectSubmission[]
  interviews     InterviewSession[]
  aiInteractions AiInteraction[]

  @@index([role])
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// ─────────────────────────── CONTENIDO ───────────────────────────

model Stage {
  id          Int      @id            // 0..11
  slug        String   @unique
  title       String
  objective   String
  level       Int                    // 1..4
  estimatedMin Int?
  order       Int
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  modules Module[]
}

model Module {
  id          String  @id @default(cuid())
  stageId     Int
  code        String  @unique         // "M2.3"
  title       String
  order       Int
  isPublished Boolean @default(false)

  stage     Stage    @relation(fields: [stageId], references: [id], onDelete: Cascade)
  units     Unit[]

  @@index([stageId])
}

model Unit {
  id             String  @id @default(cuid())
  moduleId       String
  code           String  @unique       // "U2.3.3"
  title          String
  objective      String
  estimatedMin   Int?
  order          Int
  isPublished    Boolean @default(false)
  prerequisiteIds String[]             // códigos de unidad previos

  module     Module     @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  lessons    Lesson[]
  exercises  Exercise[]
  progress   UnitProgress[]

  @@index([moduleId])
}

model Lesson {
  id        String   @id @default(cuid())
  unitId    String
  slug      String   @unique
  title     String
  // Contenido estructurado en bloques (JSON validado con Zod)
  content   Json
  // 7 pasos obligatorios de la microestructura
  steps     Json
  estimatedMin Int?
  order     Int
  isPublished Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  unit      Unit              @relation(fields: [unitId], references: [id], onDelete: Cascade)
  resources LessonResource[]

  @@index([unitId])
}

enum ResourceType {
  DOCUMENTATION
  VIDEO
  COURSE
  INTERACTIVE
  REPOSITORY
  DIAGRAM
  ANIMATION
}

enum ResourceStatus {
  VERIFIED
  NEEDS_REVIEW
  OBSOLETE
}

model Resource {
  id           String         @id @default(cuid())
  slug         String         @unique
  title        String
  provider     String
  url          String
  type         ResourceType
  language     String         @default("es")
  level        String?
  durationMin  Int?
  license      String?
  embedAllowed Boolean        @default(false)
  status       ResourceStatus @default(VERIFIED)
  reviewedAt   DateTime?
  notes        String?
  createdAt    DateTime       @default(now())

  lessons LessonResource[]

  @@index([status])
}

model LessonResource {
  lessonId   String
  resourceId String
  order      Int      @default(0)
  note       String?

  lesson   Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  resource Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  @@id([lessonId, resourceId])
}
```

---

## 3. Ejercicios y envíos

```prisma
enum ExerciseType {
  LAB
  QUIZ
  MEMORY
  FLASHCARD
  DEBUG
  AUDIT
  CHALLENGE
  SIM
  READING
  REFLECT
  PROJECT
}

enum Ladder {
  GUIDED
  SEMI
  AUTONOMOUS
}

model Exercise {
  id            String       @id @default(cuid())
  unitId        String
  slug          String       @unique
  type          ExerciseType
  title         String
  statement     String
  // Configuración específica del tipo (validada con Zod según `type`)
  config        Json
  // Solución oficial (nunca expuesta al cliente sin autorización)
  solution      Json?
  ladder        Ladder       @default(GUIDED)
  difficulty    Int          @default(2)
  concepts      String[]     // para SM-2 y analítica
  competencies  String[]     // ["C1", "C5"]
  estimatedMin  Int?
  language      String?
  sources       String[]
  maxAttempts   Int?
  isPublished   Boolean      @default(false)
  order         Int
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  unit        Unit             @relation(fields: [unitId], references: [id], onDelete: Cascade)
  hints       ExerciseHint[]
  tests       ExerciseTest[]
  submissions Submission[]
  hintRequests HintRequest[]

  @@index([unitId, type])
  @@index([isPublished])
}

model ExerciseHint {
  id         String @id @default(cuid())
  exerciseId String
  level      Int    // 1..3
  text       String

  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@unique([exerciseId, level])
}

model ExerciseTest {
  id         String  @id @default(cuid())
  exerciseId String
  name       String
  // Prueba ejecutable o aserción declarativa según el tipo
  spec       Json
  isHidden   Boolean @default(true)
  weight     Float   @default(1)

  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@index([exerciseId])
}

/// Solicitud de pista de un estudiante (S6). Una fila por usuario, ejercicio y
/// nivel: volver a pedir la misma pista no duplica el registro. `lastRequestedAt`
/// permite contar los niveles distintos usados desde el envío anterior.
model HintRequest {
  id              String   @id @default(cuid())
  userId          String
  exerciseId      String
  level           Int      // 1..3
  requests        Int      @default(1)
  lastRequestedAt DateTime @default(now())
  createdAt       DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@unique([userId, exerciseId, level])
  @@index([userId, exerciseId])
  @@index([exerciseId])
}

enum SubmissionOutcome {
  PASSED
  FAILED
  PARTIAL
  ERROR
  TIMEOUT
}

model Submission {
  id              String            @id @default(cuid())
  userId          String
  exerciseId      String
  code            String?
  // Respuesta para tipos que no son código (quiz, reflexión)
  answer          Json?
  outcome         SubmissionOutcome
  score           Float             @default(0)   // 0..100
  achievedLevel   Int?                             // 1..4
  hintsUsed       Int               @default(0)
  durationMs      Int?
  errorCategory   String?
  selfExplanation String?
  aiAssisted      Boolean           @default(false)
  aiInteractionId String?
  createdAt       DateTime          @default(now())

  user     User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  exercise Exercise              @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  results  SubmissionTestResult[]

  @@index([userId, createdAt])
  @@index([exerciseId])
}

model SubmissionTestResult {
  id           String @id @default(cuid())
  submissionId String
  testId       String
  passed       Boolean
  output       String?
  durationMs   Int?

  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@index([submissionId])
}
```

---

## 4. Progreso y competencias

```prisma
enum UnitState {
  LOCKED
  AVAILABLE
  IN_PROGRESS
  NEEDS_REVIEW
  MASTERED
}

model UnitProgress {
  id             String    @id @default(cuid())
  userId         String
  unitId         String
  state          UnitState @default(AVAILABLE)
  progressPct    Float     @default(0)     // 0..100
  lessonsDone    Int       @default(0)
  exercisesDone  Int       @default(0)
  bestScore      Float?
  lastActivityAt DateTime?
  completedAt    DateTime?
  completedLessonIds String[] @default([]) // idempotencia de complete-lesson
  updatedAt      DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  unit Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([userId, unitId])
  @@index([userId, state])
}

model CompetencyProgress {
  id            String   @id @default(cuid())
  userId        String
  competency    String   // "C1".."C14"
  level         Int      @default(0)   // 0..4
  evidenceCount Int      @default(0)
  lastEvaluated DateTime?
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, competency])
}
```

> **Regla crítica:** `level` y `state` se calculan **exclusivamente en el servidor**. Ningún endpoint permite que el cliente los fije directamente.
>
> **Idempotencia:** `completedLessonIds` guarda las lecciones vistas y `lessonsDone` se deriva de su tamaño. Marcar dos veces la misma lección no infla el avance (criterio de S4-T5), y la columna evita una tabla de uniones que el modelo no declara.

---

## 5. Repetición espaciada (SM-2)

```prisma
model ReviewItem {
  id             String    @id @default(cuid())
  userId         String
  exerciseId     String
  concept        String
  easeFactor     Float     @default(2.5)
  intervalDays   Int       @default(1)
  repetitions    Int       @default(0)
  dueAt          DateTime
  lastReviewedAt DateTime?
  priority       Int       @default(0)
  createdAt      DateTime  @default(now())

  user User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs ReviewLog[]

  @@unique([userId, exerciseId])
  @@index([userId, dueAt])
}

model ReviewLog {
  id           String   @id @default(cuid())
  reviewItemId String
  quality      Int      // 0..5
  intervalDays Int
  easeFactor   Float
  reviewedAt   DateTime @default(now())

  reviewItem ReviewItem @relation(fields: [reviewItemId], references: [id], onDelete: Cascade)

  @@index([reviewItemId, reviewedAt])
}
```

> **Implementación (S7).** Un único `ReviewItem` por `[userId, exerciseId]`: cada
> envío corregido lo reprograma y añade su `ReviewLog`, nunca crea otro. `concept`
> es `Exercise.concepts[0]` (`"general"` si el ejercicio no declara ninguno) y
> agrupa la cola intercalada. `priority` sube a `1` cuando `q < 3` para que un
> fallo vuelva antes, y baja a `0` con un acierto. La cola consulta
> `[userId, dueAt]` y el límite diario de 30 se aplica en el servicio, no en la
> tabla. `ReviewLog` es la evidencia de aciertos y errores por concepto; la
> duración declarada por el cliente se valida en HTTP pero no tiene columna aquí
> (su análisis es de S11).

---

## 6. Proyectos, entrevistas e IA

```prisma
model Project {
  id           String   @id @default(cuid())
  slug         String   @unique
  stageId      Int
  title        String
  brief        String
  /// Enunciado del entregable: al menos un requisito (`string[]` en la API).
  requirements String[]
  /// Rúbrica validada con `projectRubricSchema`: 5 criterios, pesos que suman 100.
  rubric       Json
  /// Competencias C1–C14 que reciben evidencia al aprobar con nota ≥ 80.
  competencies String[]
  isPublished  Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  stage       Stage               @relation(fields: [stageId], references: [id], onDelete: Cascade)
  submissions ProjectSubmission[]

  @@index([stageId, isPublished])
}

model ProjectSubmission {
  id           String                  @id @default(cuid())
  projectId    String
  userId       String
  status       ProjectSubmissionStatus @default(SUBMITTED)
  /// Obligatorio: una entrega sin repositorio no es evaluable.
  repoUrl      String
  deployUrl    String?
  notes        String?
  /// 0–100 con dos decimales; `null` mientras no hay revisión.
  score        Float?
  /// Niveles 0–4 por criterio, validados con `projectRubricScoresSchema`.
  rubricScores Json?
  feedback     String?
  /// Última revisión: no hay historial de notas (deuda declarada en S9).
  reviewedById String?
  reviewedAt   DateTime?
  isPublic     Boolean                 @default(false)
  publishedAt  DateTime?
  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt

  project    Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user       User    @relation("ProjectSubmissions", fields: [userId], references: [id], onDelete: Cascade)
  reviewedBy User?   @relation("ProjectSubmittedReviews", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([userId, isPublic, publishedAt])
  @@index([projectId, status])
}

enum ProjectSubmissionStatus {
  SUBMITTED
  REVIEWED
}

enum InterviewSessionStatus {
  IN_PROGRESS
  COMPLETED
  REVIEWED
  ABANDONED
}

/// Escenario del catálogo (S10). `phases` y `rubric` son `Json` validados con
/// `interviewScenarioSchema`; la solución de referencia **no** se sirve al cliente.
model InterviewScenario {
  id                String   @id @default(cuid())
  slug              String   @unique
  title             String
  role              String   // backend | frontend | fullstack | data | qa
  level             String   // junior | semi-senior | senior
  language          String   // ts | py | java | go
  competencies      String[]
  phases            Json     // [{ phase, maxTurns, objective }]
  rubric            Json     // pesos §2.6, suman 100
  referenceSolution String
  estimatedMinutes  Int      @default(45)
  isPublished       Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  sessions InterviewSession[]

  @@index([isPublished, role, level, language])
}

/// Sesión de entrevista con transcripción completa. Los tres `Json` se validan
/// al leer (`readTranscript`, `readInterviewScores`, `readSelfReview`): una fila
/// corrupta responde `422` de dominio, no tumba el proceso.
/// `scores` guarda `{ rubric, levels, score }` y conserva la rúbrica aplicada.
model InterviewSession {
  id           String                 @id @default(cuid())
  userId       String
  scenarioId   String
  status       InterviewSessionStatus @default(IN_PROGRESS)
  phase        String                 @default("warmup")
  turns        Int                    @default(0) // 0..40
  transcript   Json                   @default("[]")
  scores       Json?
  selfScores   Json? // { scores, score, reflection }
  feedback     String?
  degraded     Boolean                @default(false)
  reviewedById String?
  startedAt    DateTime               @default(now())
  lastTurnAt   DateTime?
  finishedAt   DateTime?
  reviewedAt   DateTime?
  updatedAt    DateTime               @updatedAt

  user       User              @relation("InterviewSessions", fields: [userId], references: [id], onDelete: Cascade)
  scenario   InterviewScenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  reviewedBy User?             @relation("InterviewReviews", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([scenarioId, status])
  @@index([userId, startedAt])
}

model AiInteraction {
  id           String   @id @default(cuid())
  userId       String?
  module       String              // "tutor" | "review" | "hint" | "interview"
  provider     String
  model        String
  promptTokens Int      @default(0)
  outputTokens Int      @default(0)
  costUsd      Float    @default(0)
  latencyMs    Int?
  success      Boolean  @default(true)
  errorCode    String?
  createdAt    DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([module, createdAt])
}
```

---

## 7. Reglas de integridad

| Regla | Implementación |
|-------|----------------|
| Idempotencia del seed de contenido | `upsert` por `slug` y `code` |
| Borrado de contenido | `onDelete: Cascade` en jerarquía Stage→Module→Unit→Exercise |
| Protección de usuarios | `onDelete: Cascade` solo en datos propios; nunca borrar `User` desde la app |
| Auditoría IA | `AiInteraction` es *append-only*; sin updates ni deletes |
| Intentos | Un `Submission` nunca se modifica; solo se crean nuevos |
| Unicidad de repaso | `@@unique([userId, exerciseId])` garantiza un ítem por ejercicio |
| Pistas pedidas | `@@unique([userId, exerciseId, level])`: repetir un nivel incrementa `requests` y `lastRequestedAt` sin crear fila |
| Entregas de proyecto | Acumulables: cada envío crea una fila; `repoUrl` obligatorio y `@@unique([slug])` en `Project` |
| Privacidad del portafolio | `isPublic` y `publishedAt` son estado explícito y reversible; lo privado nunca sale en `/api/portfolio/:userId` |
| Evidencia por proyecto | Una revisión con nota ≥ 80 sube `CompetencyProgress.level` a 3 como mínimo e incrementa `evidenceCount`, sin bajar el nivel ya alcanzado |
| Sesión de entrevista | Una sola `IN_PROGRESS` por usuario y escenario; la fase y los turnos los decide el servidor; `transcript`, `scores` y `selfScores` se validan al leer |
| Evidencia por entrevista | La revisión humana con nota ≥ 80 acredita **C10** en el autor; una invalidación escribe nota 0 y no deja evidencia |

---

## 8. Índices y rendimiento

- Cola de repaso: `@@index([userId, dueAt])` — consulta principal del dashboard.
- Avance: `@@unique([userId, unitId])` evita filas duplicadas y `@@index([userId, state])` resuelve los contadores del overview sin recorrer todas las unidades.
- Historial: `@@index([userId, createdAt])` en `Submission`.
- Pistas: `@@index([userId, exerciseId])` en `HintRequest` — calcular `hintsUsed` desde el envío anterior sin recorrer la tabla.
- Catálogo: `@@index([unitId, type])` para listar ejercicios por unidad.
- Proyectos: `@@index([stageId, isPublished])` para el catálogo y `@@index([projectId, status])` para la bandeja de revisión.
- Portafolio: `@@index([userId, isPublic, publishedAt])` resuelve la vista pública y la propia sin recorrer entregas ajenas.
- Coste IA: `@@index([module, createdAt])` para reportes mensuales.
- Entrevistas: `@@index([isPublished, role, level, language])` para el catálogo, `@@index([userId, status])` para la sesión abierta y el historial, `@@index([scenarioId, status])` para los intentos y la bandeja de revisión, y `@@index([userId, startedAt])` para el orden comparativo.

**Regla:** toda consulta nueva sobre más de 10 000 filas potenciales debe justificar su índice.

---

## 9. Migraciones y versionado

```bash
# crear migración en desarrollo
npm run db:migrate -- --name add_review_schedule

# aplicar en producción (nunca `migrate dev`)
npx prisma migrate deploy
```

**Reglas:**
- Cada migración va en su propio commit.
- Nunca se edita una migración ya aplicada.
- Los cambios destructivos (borrar columna) se hacen en dos pasos: primero dejar de usar, luego eliminar.

---

## Documentos relacionados

- [`contratos-api.md`](contratos-api.md)
- [`../01-curriculo/prerequisitos-y-progreso.md`](../01-curriculo/prerequisitos-y-progreso.md)
- [`../02-contenido/banco-ejercicios.md`](../02-contenido/banco-ejercicios.md)


