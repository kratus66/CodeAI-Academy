# Modelo de datos

> Esquema Prisma como fuente de verdad. Cualquier cambio estructural requiere migración y actualización de este documento **en el mismo commit**.
>
> **Implementación incremental (S1 ✅ · S2 ✅):** `apps/api/prisma/schema.prisma` contiene el bloque de identidad (`User` y `RefreshToken`, migración `init_identity`) y el bloque de contenido (`Stage` → `Module` → `Unit` → `Lesson`, `Exercise`, `Resource` y `LessonResource`, migración `content_structure`). Los modelos de progreso y analítica se añaden en S4–S11 con sus relaciones y su propia migración: crear tablas sin contrato en vigor sería deuda, no avance.
>
> **Estado (2026-10-26):** ✅ identidad (`init_identity`) y contenido (`content_structure`) implementados y sembrados · ⬜ modelos de progreso y analítica (S4–S11).

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

---

## 6. Proyectos, entrevistas e IA

```prisma
model Project {
  id           String   @id @default(cuid())
  slug         String   @unique
  stageId      Int
  title        String
  brief        String
  requirements Json
  rubric       Json
  isPublished  Boolean  @default(false)

  submissions ProjectSubmission[]
}

model ProjectSubmission {
  id           String    @id @default(cuid())
  projectId    String
  userId       String
  repoUrl      String?
  deployUrl    String?
  notes        String?
  score        Float?
  rubricScores Json?
  reviewedAt   DateTime?
  createdAt    DateTime  @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model InterviewSession {
  id         String    @id @default(cuid())
  userId     String
  scenarioId String
  role       String
  language   String    @default("es")
  status     String    @default("in_progress")
  transcript Json?
  scores     Json?
  startedAt  DateTime  @default(now())
  finishedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
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

---

## 8. Índices y rendimiento

- Cola de repaso: `@@index([userId, dueAt])` — consulta principal del dashboard.
- Avance: `@@unique([userId, unitId])` evita filas duplicadas y `@@index([userId, state])` resuelve los contadores del overview sin recorrer todas las unidades.
- Historial: `@@index([userId, createdAt])` en `Submission`.
- Catálogo: `@@index([unitId, type])` para listar ejercicios por unidad.
- Coste IA: `@@index([module, createdAt])` para reportes mensuales.

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


