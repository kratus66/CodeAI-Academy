# Sprint 13 — Multi-ruta: la plataforma sirve más de un curso

> **Estado:** ✅ cerrado (2026-11-09; 23/23 tareas y T18). Recorrido visual en navegador pendiente de una persona.
> **Ámbito:** `packages/shared`, `apps/api` (contenido y semilla) y `apps/web` (catálogo). No toca ejercicios, repaso, IA, proyectos ni entrevistas.
> **Por qué este sprint existe:** la ruta AWS ([`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md)) no cabe en el modelo actual: las etapas van de 0 a 11 (`CURRICULUM_STAGE_COUNT = 12`), los códigos son `M0.1`/`U0.1.1` sin espacio de nombres, las competencias son `C1`–`C14` y la semilla exige exactamente 12 etapas en un único JSON de 8 MB. Este sprint introduce la **ruta** (`Course`) como contenedor de etapas sin romper nada de lo que existe.

---

## 1. Objetivo

Al cerrar el sprint:

- la base de datos tiene la tabla `Course` y cada `Stage` pertenece a una ruta (`fullstack-ia` por defecto);
- la API lista rutas (`GET /api/content/courses`) y filtra etapas por ruta (`GET /api/content/stages?course=aws-cloud`), y **todo lo existente responde igual** cuando no se pasa `course`;
- los códigos `AWS-M2.3`, `AWS-U2.3.1` y `AWS-C4`, y las etapas 100–112, son válidos en contratos y rutas;
- la ruta AWS se siembra con `npm run db:seed:aws` desde un esqueleto (`aws/course.seed.json`) y **un archivo por unidad** (`aws/units/AWS-U*.json`), de modo que cada tarea de contenido de S17–S26 toque un solo archivo;
- la web muestra un catálogo de rutas y el catálogo de etapas de cada ruta con su etiqueta (`E2` / `A2`) y, en AWS, el aviso de no afiliación.

## 2. Alcance

**Incluye:** registro de rutas en `shared`, relajación de validaciones de id y código, competencias `AWS-C1`–`AWS-C15`, modelo y migración `Course`, repositorio/servicio/controlador de contenido, esquema de semilla por ruta, carga de semilla por unidad, esqueleto de la ruta AWS, guarda de calidad, cliente web y vistas de catálogo.

**No incluye:** preguntas de examen y metadatos de certificación (S14), simulacros (S15), arnés de laboratorios (S16), contenido de unidades (S17+), proyectos y entrevistas de AWS (S17-T1 y S26), prerrequisitos entre rutas.

## 3. Decisiones de diseño

**3.1 La ruta se deduce del id de etapa.** Las etapas conservan su id entero global: `fullstack-ia` usa 0–11 y `aws-cloud` 100–112. Un registro estático en `packages/shared` (`COURSE_REGISTRY`) es la única fuente de rangos, prefijos y patrones; la tabla `Course` guarda lo editable (título, objetivo, aviso, publicación) y la columna `Stage.courseSlug` permite filtrar en SQL. Así **no hay que cambiar ningún contrato existente** (los fixtures de `StageSummary` de la web siguen válidos): el cliente deduce la ruta con `courseForStageId(id)`.

**3.2 Espacio de nombres por prefijo.** Los códigos de la ruta por defecto no cambian. La ruta AWS antepone `AWS-` a módulos, unidades y competencias. El número tras la `M` o la `U` es el **número de etapa dentro de la ruta** (id − 100), para que `AWS-U2.3.1` se lea igual que `U2.3.1`.

**3.3 Compatibilidad hacia atrás.** Sin `course`, `GET /api/content/stages` devuelve `fullstack-ia`. `content.seed.json` y `contentSeedSchema` no cambian de forma: siguen exigiendo 12 etapas 0–11 y códigos sin prefijo. La ruta AWS tiene su propio esquema (`courseSeedSchema`).

**3.4 Semilla por unidad.** El contenido de AWS no se escribe en un JSON monolítico: un esqueleto declara ruta, etapas, módulos y unidades (sin lecciones) y cada unidad vive en `aws/units/<código>.json`. El cargador fusiona, valida todo antes de tocar la base de datos y aplica `upsert` como la semilla actual.

**3.5 Prerrequisitos sólo en Y.** El modelo de desbloqueo exige **todos** los prerrequisitos de una unidad. Los «uno de» del currículo AWS (A6 requiere A3 **o** A4; A12 requiere A5 **o** A6) se modelan con el más común y se declaran como deuda (§6).

---

## 4. Tareas

> Fichas atómicas según [`../../05-orquestacion/plantilla-tarea.md`](../../05-orquestacion/plantilla-tarea.md). **Orden obligatorio:** T1 → T2 → T3 → T3b → T3c → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17. T18 es del Orquestador. **Ajuste del 2026-11-08:** la cadena web (T13 → T17) sólo depende de T6, así que avanza mientras T8–T11 esperan a que la base de datos vuelva a estar disponible. Se añaden **T12b** (etapa de una unidad a partir de su código, antes de T15) y **T16b** (analítica del estudiante), tras descubrir que la web deducía la etapa con una expresión que sólo entiende `U<n>`. Orden web: T13 → T19 → T12b → T14 → T15 → T16 → T16b → T17. **T19** arregla la prueba intermitente de `InterviewRoom`, que ya entorpecía cada verificación. **Esqueleto sin base de datos:** T10 → T10b → T11 → T12 se validan con `courseSeedSchema`. La siembra real (T8 → T9) se verifica cuando la base vuelva a estar disponible.
>
> **Verificación común** (salvo que la ficha diga otra cosa), desde la raíz:
> ```bash
> npm run build -w packages/shared
> npm run typecheck
> npm run lint
> npm run test
> ```
> Resultado esperado: código de salida 0, 0 warnings y pruebas al 100 % en **todos** los workspaces (un cambio en `shared` puede romper `api` o `web`: si pasa, la tarea no está terminada; si arreglarlo exige tocar un archivo fuera de la lista, **detenerse y reportar**).

---

### S13-T1 — Registro de rutas en `shared`

| Campo | Valor |
|-------|-------|
| **Depende de** | — |
| **Archivos** | `packages/shared/src/schemas/course.ts` (crear) · `packages/shared/src/schemas/course.spec.ts` (crear) · `packages/shared/src/index.ts` (modificar: `export * from "./schemas/course";`) |

**Contexto mínimo.** Hoy no existe el concepto de ruta. Esta tarea crea el registro estático del que dependerán todas las demás. **No modifica** `content.ts` ni ningún otro esquema (eso es T2 y T3). `course.ts` no puede importar de `content.ts` (T2 hará el import inverso).

**Contrato** (nombres, tipos y valores exactos):

```ts
import { z } from "zod";

import { paginatedSchema } from "./common";

export const COURSE_SLUGS = ["fullstack-ia", "aws-cloud"] as const;
export type CourseSlug = (typeof COURSE_SLUGS)[number];
export const DEFAULT_COURSE_SLUG: CourseSlug = "fullstack-ia";
export const courseSlugSchema = z.enum(COURSE_SLUGS);

export interface CourseDefinition {
  readonly slug: CourseSlug;
  /** Primer y último id de etapa de la ruta (inclusive). */
  readonly stageIdMin: number;
  readonly stageIdMax: number;
  /** Prefijo de módulos y unidades: "" → "M2.3"/"U2.3.1"; "AWS-" → "AWS-M2.3"/"AWS-U2.3.1". */
  readonly codePrefix: "" | "AWS-";
  /** Prefijo del slug de etapa: "e" → "e2-…"; "aws" → "aws2-…". */
  readonly stageSlugPrefix: "e" | "aws";
  /** Letra de la etiqueta visible de la etapa: "E2" / "A2". */
  readonly stageLabelPrefix: "E" | "A";
  /** Prefijo de competencias: "C" → "C4"; "AWS-C" → "AWS-C4". */
  readonly competencyPrefix: "C" | "AWS-C";
  /** Número máximo de competencia (C1…C14; AWS-C1…AWS-C15). */
  readonly competencyMax: number;
}

export const COURSE_REGISTRY: Readonly<Record<CourseSlug, CourseDefinition>> = {
  "fullstack-ia": {
    slug: "fullstack-ia", stageIdMin: 0, stageIdMax: 11, codePrefix: "",
    stageSlugPrefix: "e", stageLabelPrefix: "E", competencyPrefix: "C", competencyMax: 14,
  },
  "aws-cloud": {
    slug: "aws-cloud", stageIdMin: 100, stageIdMax: 112, codePrefix: "AWS-",
    stageSlugPrefix: "aws", stageLabelPrefix: "A", competencyPrefix: "AWS-C", competencyMax: 15,
  },
};

/** Aviso legal que la web muestra en la ruta (null = ninguno). */
export const COURSE_NOTICES: Readonly<Record<CourseSlug, string | null>> = {
  "fullstack-ia": null,
  "aws-cloud":
    "Ruta independiente de preparación. No está afiliada ni avalada por Amazon Web Services. AWS y los nombres de sus servicios son marcas de Amazon.com, Inc. o sus filiales.",
};

/** Patrones válidos en cualquier ruta. */
export const MODULE_CODE_PATTERN = /^(?:AWS-)?M\d{1,2}\.\d{1,2}$/;
export const UNIT_CODE_PATTERN = /^(?:AWS-)?U\d{1,2}\.\d{1,2}\.\d{1,2}$/;
export const COMPETENCY_CODE_PATTERN = /^(?:C(?:[1-9]|1[0-4])|AWS-C(?:[1-9]|1[0-5]))$/;

export function courseForStageId(stageId: number): CourseDefinition | null;
export function isKnownStageId(stageId: number): boolean;
export function stageNumberInCourse(stageId: number): number | null;
export function stageLabel(stageId: number): string | null;
export function courseForCode(code: string): CourseDefinition | null;
export function moduleCodePrefix(stageId: number): string | null;
export function unitCodePrefix(moduleCode: string): string | null;
export function stageSlugMatchesCourse(slug: string, stageId: number): boolean;
export function isCompetencyOfCourse(code: string, course: CourseSlug): boolean;

export const courseSummarySchema = z.object({
  slug: courseSlugSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  stageLabelPrefix: z.enum(["E", "A"]),
  order: z.number().int().nonnegative(),
  stageCount: z.number().int().nonnegative(),
  notice: z.string().min(1).nullable(),
});
export type CourseSummary = z.infer<typeof courseSummarySchema>;

export const courseListResponseSchema = paginatedSchema(courseSummarySchema);
export type CourseListResponse = z.infer<typeof courseListResponseSchema>;
```

**Comportamiento exacto de las funciones:**

| Función | Entrada → salida |
|---------|------------------|
| `courseForStageId` | `0`…`11` → `fullstack-ia`; `100`…`112` → `aws-cloud`; `12`, `99`, `113`, `-1`, `1.5`, `NaN` → `null` |
| `isKnownStageId` | `courseForStageId(id) !== null` |
| `stageNumberInCourse` | `id − stageIdMin` de su ruta (`102` → `2`, `7` → `7`); id desconocido → `null` |
| `stageLabel` | `stageLabelPrefix + número` (`2` → `"E2"`, `102` → `"A2"`, `100` → `"A0"`); desconocido → `null` |
| `courseForCode` | Empieza por `AWS-` → `aws-cloud`; si no, empieza por `M`, `U` o `C` seguido de dígito → `fullstack-ia`; otro → `null`. No valida el formato completo |
| `moduleCodePrefix` | `codePrefix + "M" + número + "."` (`2` → `"M2."`, `102` → `"AWS-M2."`); desconocido → `null` |
| `unitCodePrefix` | Código de módulo válido según `MODULE_CODE_PATTERN` → mismo prefijo con `U` y punto final (`"M2.3"` → `"U2.3."`, `"AWS-M2.3"` → `"AWS-U2.3."`); inválido → `null` |
| `stageSlugMatchesCourse` | `true` si el slug empieza por `stageSlugPrefix + número + "-"` de la ruta del id (`"aws2-arquitectura"`, 102 → `true`; `"e2-js"`, 102 → `false`) |
| `isCompetencyOfCourse` | `true` si cumple `COMPETENCY_CODE_PATTERN`, empieza por el `competencyPrefix` de la ruta (en `fullstack-ia`, `"AWS-C4"` es `false`) y su número es ≤ `competencyMax` |

**Criterios de aceptación**
- [x] Todas las filas de la tabla tienen al menos una prueba, incluidos los casos `null`/`false`.
- [x] `courseSummarySchema` acepta un ejemplo válido y rechaza `slug` desconocido y `stageCount` negativo.
- [x] `COURSE_REGISTRY` no tiene rangos solapados (prueba que recorre los ids 0–200).
- [x] Verificación común en verde.

**Revisión (2026-11-06): ✅ aprobada.** Contrato copiado literalmente; `course.ts` sólo importa `zod` y `./common`. Verificación repetida por el Orquestador: build de `shared`, `typecheck` y `lint` en 0; pruebas shared 301 (38 nuevas) · api 872 (8 omitidas, preexistentes) · web 407.

**Qué NO hacer:** no modificar `content.ts`, `progress.ts` ni otros esquemas; no añadir rutas al registro; no exportar nada que no esté en el contrato.

---

### S13-T2 — Contratos de contenido aceptan ids y códigos de cualquier ruta

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T1 |
| **Archivos** | `packages/shared/src/schemas/content.ts` (modificar) · `packages/shared/src/schemas/content.spec.ts` (modificar) |

**Contexto mínimo.** Los contratos públicos de contenido validan ids de etapa con `0…CURRICULUM_STAGE_COUNT−1` y códigos de unidad con `/^U\d…$/`. Con eso, `GET /api/content/stages/102` respondería `400` en vez de `404`. Esta tarea relaja **sólo los contratos públicos**; la semilla de la ruta por defecto sigue estricta.

**Contrato:**

1. Importar de `./course`: `courseSlugSchema`, `isKnownStageId`, `UNIT_CODE_PATTERN`.
2. En estos cuatro lugares, sustituir `min(0).max(CURRICULUM_STAGE_COUNT − 1)` por `.refine(isKnownStageId, STAGE_ID_MESSAGE)`, con
   `const STAGE_ID_MESSAGE = "La etapa debe pertenecer a una ruta (0–11 o 100–112)";`
   - `resourceListQuerySchema.stage`
   - `stageIdParamsSchema.id` (conserva el mensaje de tipo entero)
   - `stageSummarySchema.id`
   - `unitSummarySchema.stageId`
3. `unitCodeParamsSchema.code` usa `UNIT_CODE_PATTERN` con el mensaje `"Formato esperado: U<etapa>.<módulo>.<unidad> o AWS-U<etapa>.<módulo>.<unidad>"`.
4. `stageListQuerySchema` añade `course: courseSlugSchema.optional()` (sigue `.strict()`).
5. Nuevo export: `export const courseListQuerySchema = pageQuerySchema.strict();` y `export type CourseListQuery = z.infer<typeof courseListQuerySchema>;`
6. **Sin cambios:** `CURRICULUM_STAGE_COUNT`, `contentSeedStageSchema`, `contentSeedSchema` y los patrones de la semilla (`stageSlugPattern`, `moduleCodePattern`, `unitCodePattern` locales).

**Criterios de aceptación**
- [x] `stageIdParamsSchema` acepta `"102"` y `"0"`; rechaza `"12"`, `"99"`, `"113"` y `"abc"` con `VALIDATION_ERROR`-compatible (issue de Zod).
- [x] `unitCodeParamsSchema` acepta `U2.3.1` y `AWS-U2.3.1`; rechaza `aws-U2.3.1`, `AWS-M2.3` y `X2.3.1`.
- [x] `stageListQuerySchema` acepta `{ course: "aws-cloud" }` y rechaza `{ course: "gcp" }`.
- [x] `contentSeedSchema` sigue rechazando una etapa con id 100 (prueba nueva). *Ver observación.*
- [x] Las pruebas existentes de `content.spec.ts` siguen pasando o se ajustan **sólo** en el texto de los mensajes cambiados.
- [x] Verificación común en verde (incluidas `apps/api` y `apps/web` sin tocarlas).

**Qué NO hacer:** no añadir `courseSlug` a `StageSummary` (decisión 3.1); no tocar la semilla.

**Revisión (2026-11-06): ✅ aprobada con observación.** Cambios exactos al contrato; se eliminó `stageIdRangeMessage` porque quedaba sin uso (correcto). Verificación repetida: build, `typecheck` y `lint` en 0; pruebas shared 307 · api 872 · web 407. **Observación:** la prueba «rechaza una etapa con id 100» pasa por tres motivos (el rango del id y 18 issues de prefijo de módulo y unidad, comprobado con la semilla real), así que seguiría pasando si alguien relajara el rango. Se refuerza en S13-T3b exigiendo un issue en la ruta `["stages", 0, "id"]`.

---

### S13-T3 — Competencias por ruta y etapa actual del progreso

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T2 |
| **Archivos** | `packages/shared/src/schemas/progress.ts` (modificar) · `packages/shared/src/schemas/progress.spec.ts` (modificar) |

**Contexto mínimo.** `competencyCodeSchema` (progress.ts) sólo acepta `C1`–`C14`, y la etapa actual del resumen de progreso sólo acepta 0–11. Lo usan los contratos de progreso, ejercicios, proyectos y entrevistas, que importan `competencyCodeSchema`. La parte de la semilla (`content.ts`) va aparte, en S13-T3b.

**Contrato:**

1. `competencyCodeSchema` usa `COMPETENCY_CODE_PATTERN` de `./course` con el mensaje `"La competencia debe ser C1–C14 o AWS-C1–AWS-C15"` (conserva su `invalid_type_error`).
2. En `progressOverviewSchema.currentStage`, el `.min(0, …)` y el `.max(CURRICULUM_STAGE_COUNT - 1, …)` (ambos con el mensaje «entre 0 y 11») se sustituyen por un único `.refine(isKnownStageId, "La etapa actual debe pertenecer a una ruta")`. Se conservan el `invalid_type_error` y el `.int(…)`. El import de `CURRICULUM_STAGE_COUNT` desde `./content` se elimina porque queda sin uso.

**Criterios de aceptación**
- [x] `competencyCodeSchema` acepta `C1`, `C14`, `AWS-C1`, `AWS-C15`; rechaza `C0`, `C15`, `AWS-C16` y `aws-c1`, con el mensaje nuevo.
- [x] La etapa actual acepta 0, 11, 100 y 112; rechaza 12 y 99, con el mensaje nuevo.
- [x] Las pruebas existentes de `progress.spec.ts` siguen pasando o se ajustan **sólo** en el texto de los mensajes cambiados.
- [x] Verificación común en verde (si `apps/api` o `apps/web` fijan el texto viejo de un mensaje en un spec, detenerse y reportar).

**Qué NO hacer:** no tocar `content.ts` (es S13-T3b), `project.ts` ni `interview.ts` (sus ids de etapa para AWS llegan en S17-T1).

**Revisión (2026-11-06): ✅ aprobada.** Diff exacto al contrato; las pruebas nuevas comprueban el mensaje y no sólo el fallo. Verificación repetida: build, `typecheck` y `lint` en 0; pruebas shared 311 · api 872 · web 407. El Constructor dejó anotados, sin tocarlos, dos comentarios JSDoc desactualizados de `progress.ts` («C1–C14», «0–11»): se corrigen en S13-T3c.

---

### S13-T3b — Competencias de la semilla por ruta y refuerzo de la prueba del id 100

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T3 |
| **Archivos** | `packages/shared/src/schemas/content.ts` (modificar) · `packages/shared/src/schemas/content.spec.ts` (modificar) · `packages/shared/src/schemas/content-exercise.spec.ts` (modificar) |

**Contexto mínimo.** `content.ts` tiene su propio patrón local `COMPETENCY_CODE` (línea ~440, sólo `C1`–`C14`) para los ejercicios de la semilla, con el mensaje «…entre C1 y C14». `content-exercise.spec.ts` (línea ~45) espera ese texto con `toThrow(/C1 y C14/)` y debe actualizarse al mensaje nuevo. Además, la prueba de S13-T2 «rechaza una etapa con un id de una ruta secundaria» (en `content.spec.ts`) pasa por tres motivos a la vez (el rango del id y los prefijos de módulo y unidad), así que no protege el rango del id.

**Contrato:**

1. El patrón local `COMPETENCY_CODE` se elimina y su uso pasa a `COMPETENCY_CODE_PATTERN` de `./course`, con el mensaje `"La competencia debe ser C1–C14 o AWS-C1–AWS-C15"`.
2. En `contentSeedSchema.superRefine`, dentro del bucle de ejercicios que ya existe (usa su `exercisePath`): toda competencia debe cumplir `isCompetencyOfCourse(code, "fullstack-ia")`; si no, issue `` `La competencia ${code} no pertenece a la ruta fullstack-ia` `` con la ruta `[...exercisePath, "competencies", c]`.
3. La prueba existente «rechaza una etapa con un id de una ruta secundaria» (`content.spec.ts`) pasa a exigir que **entre los issues haya uno cuya ruta sea exactamente `["stages", 0, "id"]`**. No basta con `success === false`.
4. `content-exercise.spec.ts`: la expectativa `toThrow(/C1 y C14/)` pasa a comprobar el mensaje nuevo del punto 1 (sin cambiar qué se prueba).

**Criterios de aceptación**
- [x] Prueba nueva: `contentSeedSchema` rechaza un ejercicio con competencia `AWS-C2` con el mensaje y la ruta del punto 2.
- [x] Una competencia `C15` sigue rechazándose, ahora con el mensaje del punto 1 (prueba existente actualizada, punto 4).
- [x] La prueba del id 100 comprueba la ruta `["stages", 0, "id"]` (punto 3).
- [x] `content.seed.json` real sigue validando (lo comprueban las guardas existentes de `apps/api`).
- [x] Verificación común en verde.

**Qué NO hacer:** no cambiar `contentSeedStageSchema` ni el resto de `contentSeedSchema`; no tocar `progress.ts` (sus comentarios son S13-T3c).

**Revisión (2026-11-06): ✅ aprobada.** Diff exacto al contrato; el patrón local quedó eliminado sin referencias residuales; la regla nueva usa el `exercisePath` existente. Verificación repetida: build, `typecheck` y `lint` en 0; pruebas shared 312 · api 872 · web 407. El Constructor reportó con transparencia un fallo intermitente ajeno en `InterviewRoom.spec.tsx` (ver §6).

---

### S13-T3c — Comentarios de `progress.ts` al día

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T3b |
| **Archivos** | `packages/shared/src/schemas/progress.ts` (modificar: **sólo comentarios**) |

**Contexto mínimo.** S13-T3 cambió el código pero dejó dos comentarios JSDoc que describen sólo la ruta por defecto. Microtarea de una sesión corta.

**Contrato** (ninguna línea de código cambia):
- Sobre `competencyCodeSchema`: `/** Competencias del perfil profesional: C1–C14 (\`mapa-competencias.md\`) y de la ruta AWS: AWS-C1–AWS-C15 (\`curriculo-aws.md\` §4). */`
- En el comentario de `progressOverviewSchema`, «la etapa en curso (0–11)» pasa a «la etapa en curso (0–11 en `fullstack-ia`, 100–112 en `aws-cloud`)»; el resto del comentario no cambia.

**Criterios de aceptación**
- [x] `git diff` de `progress.ts` sólo muestra líneas de comentario.
- [x] Verificación común en verde.

**Revisión (2026-11-06): ✅ aprobada.** Como S13-T3 aún no tenía commit, el diff contra `HEAD` mezclaba ambas tareas; filtrando los comentarios, las líneas de código restantes son exactamente las aprobadas en S13-T3, así que T3c sólo cambió comentarios. Verificación: build, `typecheck` y `lint` en 0; shared 312 · api 872 · web 407. En una corrida, `QuizAndFlashcardPlayers.spec.tsx` no cargó por `UNKNOWN: unknown error, read` (bloqueo de lectura de Windows); el archivo solo (11/11) y la suite web completa (407/407) pasaron al repetir.

---

### S13-T4 — Modelo `Course` y `Stage.courseSlug`

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T3b |
| **Archivos** | `apps/api/prisma/schema.prisma` (modificar) · `apps/api/prisma/migrations/<timestamp>_courses/migration.sql` (crear) |

**Contexto mínimo.** Las etapas no pertenecen a ninguna ruta en la base de datos.

**Contrato (Prisma):**

```prisma
/// Ruta formativa (`docs/01-curriculo/curriculo-aws.md` §3.1). Rangos y prefijos viven en `COURSE_REGISTRY` de @codeai/shared.
model Course {
  slug        String   @id // "fullstack-ia" | "aws-cloud"
  title       String
  objective   String
  notice      String?
  order       Int
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  stages Stage[]
}
```

En `model Stage` añadir:

```prisma
  courseSlug String @default("fullstack-ia")
  course     Course @relation(fields: [courseSlug], references: [slug], onDelete: Restrict)

  @@index([courseSlug])
```

**Migración:** generar con `npx prisma migrate dev --create-only --name courses` (desde `apps/api`) y **editar el SQL** para que, en este orden: (1) cree la tabla `Course`; (2) inserte la ruta por defecto **antes** de la clave foránea:

```sql
INSERT INTO "Course" ("slug", "title", "objective", "notice", "order", "isPublished", "updatedAt")
VALUES ('fullstack-ia', 'Desarrollo de software con IA', 'Comprender, diseñar, construir, probar, desplegar y mantener software con inteligencia artificial, sin depender ciegamente de ella.', NULL, 0, true, CURRENT_TIMESTAMP);
```

(3) añada `Stage.courseSlug` con `DEFAULT 'fullstack-ia'`, el índice y la clave foránea `ON DELETE RESTRICT`.

**Criterios de aceptación**
- [x] `npx prisma validate` y `npx prisma format --check` (o `format` sin diferencias) en `apps/api`.
- [x] `npm run db:migrate` aplica la migración sobre una base con datos existentes sin error; todas las etapas quedan con `courseSlug = 'fullstack-ia'`.
- [x] `npm run db:seed` sigue funcionando y reporta 12 etapas, 48 módulos, 207 unidades.
- [x] Verificación común en verde.

**Revisión (2026-11-06): ✅ aprobada (reintento 3).** Migración `20261106160012_courses` en el orden de la ficha (tabla → `INSERT` literal → columna, índice y FK `RESTRICT`). Comprobado en la base: 12 etapas en `fullstack-ia`, una fila en `Course` (publicada, sin aviso), 12 filas de historial sin revertidas, `Stage_courseSlug_fkey` con `confdeltype = r`; `migrate status` al día. Verificación repetida: build, `typecheck` y `lint` en 0; shared 312 · api 872 · web 407. **Notas:** (1) `prisma generate` no pudo reemplazar el binario del motor (`EPERM`) porque el servidor de desarrollo del responsable lo tiene abierto; los tipos sí se regeneraron (el motor es de la misma versión). Tras parar `npm run dev`, conviene ejecutar `npm run db:generate -w apps/api`. (2) El Constructor borró tres temporales `query_engine-*.tmp*` de `node_modules/.prisma/client` que dejaron los reintentos: está fuera de su lista de archivos, pero es inocuo. (3) Riesgo de finales de línea registrado en §6.

**Qué NO hacer:** no insertar la ruta `aws-cloud` en la migración (la crea su semilla en T9); no tocar otros modelos.

**Incidencia (2026-11-06): 🔴 bloqueo bien reportado por el Constructor.** `prisma migrate dev --create-only` respondió «The migration `20261028170000_interviews` was modified after it was applied» y propuso un reset. No es drift de esquema (`migrate status`: «up to date»). La base local guarda dos filas de esa migración en `_prisma_migrations`: un intento fallido de S10 (checksum `429abb9f8784…`, `applied_steps_count = 0`, **`rolled_back_at` = 2026-10-28 19:47:05**) y la aplicación buena de dos segundos después (checksum `0ba3d5b7adca…`, que coincide con el archivo). `migrate dev` compara también el checksum de la fila revertida. **Resolución:** respaldo con `npm run db:backup` y borrado de esa única fila revertida, que no cambia el esquema (lo ejecuta una persona; el Orquestador no tiene permiso para escribir en la base). Sin esto, toda migración futura (S14, S15, S16) chocaría igual. Tras la resolución, T4 se reintenta partiendo del `schema.prisma` ya modificado, que el Orquestador revisó y coincide con el contrato. En el reintento se actualiza también el comentario `// 0..11` de `Stage.id` a `// 0..11 en fullstack-ia · 100..112 en aws-cloud`.

**Reintento 1 (2026-11-06): 🔴 bloqueado otra vez, por la misma causa.** El prompt de reintento se envió antes de borrar la fila. El Constructor se detuvo sin tocar la base y dejó hecho el comentario de `Stage.id`. Respaldo tomado por el Orquestador: `backups/2026-11-06T15-48-34-978Z.sql.gz`. Falta el borrado de la fila, a cargo de una persona. El siguiente reintento empieza **comprobando** el historial y se detiene si la fila sigue ahí.

**Reintento 2 (2026-11-06):** el Constructor se detuvo en el paso 0 (12 filas, 1 revertida), como se le pidió. **Resolución aplicada:** con autorización explícita del responsable, el Orquestador borró la fila por su checksum completo (`DELETE 1`). Historial: 11 filas, 0 revertidas; `prisma migrate status`: «11 migrations found… Database schema is up to date!». T4 queda lista para el reintento 3.

---

### S13-T5 — Repositorio de contenido: rutas y filtro por ruta

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T4 |
| **Archivos** | `apps/api/src/modules/content/content.repository.ts` (modificar) · `apps/api/src/modules/content/prisma-content.repository.ts` (modificar) · `apps/api/src/modules/content/in-memory-content.repository.ts` (modificar) · `apps/api/src/modules/content/in-memory-content.repository.spec.ts` (crear). **Excepción declarada:** 4 archivos, porque el puerto obliga a cambiar los dos adaptadores a la vez y el cuarto es sólo la prueba |

**Contrato** (revisado contra el código el 2026-11-06):

```ts
// content.repository.ts
export interface StageListFilter extends PageWindow {
  level?: number;          // ya existe
  /** Ruta de las etapas. Opcional para no romper al servicio actual: sin valor, el adaptador usa DEFAULT_COURSE_SLUG. S13-T6 lo pasa siempre. */
  course?: CourseSlug;
}

export interface ContentRepository {
  // …métodos existentes sin cambios…
  listCourses(window: PageWindow): Promise<Page<CourseSummary>>;
}
```

```ts
// in-memory-content.repository.ts
/** Ruta del conjunto en memoria: como el resto del conjunto, publicada por definición. */
export interface InMemoryCourse {
  slug: CourseSlug;
  title: string;
  objective: string;
  notice: string | null;
  order: number;
}
// ContentDataset gana `courses?: readonly InMemoryCourse[]` (opcional; ausente = []).
// EMPTY_CONTENT_DATASET no necesita cambiar si el campo es opcional.
```

- **Prisma, `listStages`:** añade `courseSlug: filter.course ?? DEFAULT_COURSE_SLUG` al `where` (el filtro `isPublished` y el de `level` siguen igual).
- **Prisma, `listCourses`:** `where: { isPublished: true, slug: { in: [...COURSE_SLUGS] } }` (así el `total` cuadra con los elementos), orden `[{ order: "asc" }, { slug: "asc" }]`, `skip`/`take` de la ventana y `_count` de etapas **publicadas**. Cada fila se convierte en `CourseSummary` con `stageLabelPrefix = COURSE_REGISTRY[slug].stageLabelPrefix` y `notice` de la fila, mediante una función local del archivo (el mapper no está en la lista).
- **En memoria** (el conjunto ya es publicado por definición, ver el comentario de `ContentDataset`): `listStages` filtra además por `courseForStageId(stage.id)?.slug === (filter.course ?? DEFAULT_COURSE_SLUG)`; `listCourses` toma `dataset.courses ?? []`, ordena por `order` y `slug`, pagina con el `paginate` existente y calcula `stageCount` como el número de etapas de `dataset.stages` que pertenecen a esa ruta.

**Criterios de aceptación**
- [x] `in-memory-content.repository.spec.ts`: `listStages` sin `course` y con `"fullstack-ia"` devuelve sólo etapas 0–11; con `"aws-cloud"`, sólo 100–112.
- [x] `listCourses` en memoria respeta el orden (`order`, luego `slug`), pagina y cuenta las etapas de cada ruta (prueba con etapas de las dos rutas en el conjunto).
- [x] Verificación común en verde, sin tocar el servicio (el servicio actual sigue funcionando porque `course` es opcional).

**Qué NO hacer:** no tocar servicio, controlador ni mapper.

**Revisión (2026-11-06): ✅ aprobada.** Diff exacto a la ficha revisada; `toCourseSummary` usa una guarda de tipo en lugar de `as` y el orden en memoria replica el de Prisma sin mutar el conjunto. 9 pruebas nuevas (incluidos el desempate por `slug` y el conjunto sin rutas). Verificación repetida: build, `typecheck` y `lint` en 0; api 881 · web 407 · shared 312. El Constructor ejecutó además una consulta de humo de solo lectura contra la base con un script temporal que luego borró: está fuera de su lista de archivos, pero no tuvo efecto y lo reportó.

---

### S13-T6 — Servicio y controlador: `GET /api/content/courses` y `?course=`

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T5 |
| **Archivos** | `apps/api/src/modules/content/content.service.ts` (modificar) · `apps/api/src/modules/content/content.controller.ts` (modificar) · `apps/api/src/modules/content/content.service.spec.ts` (modificar) |

**Contrato HTTP:**

```
GET /api/content/courses?page=1&pageSize=20
200 { "data": CourseSummary[], "meta": { page, pageSize, total, totalPages } }   // mismo formato paginado que /stages

GET /api/content/stages?course=aws-cloud&page=1&pageSize=20
200 { "data": StageSummary[], "meta": … }   // sin `course` ⇒ "fullstack-ia"
400 VALIDATION_ERROR si course no está en COURSE_SLUGS
```

- `listStages` pasa `course: query.course ?? DEFAULT_COURSE_SLUG` al repositorio y **la clave de caché incluye la ruta**: `` `stages:${course}:${page}:${pageSize}:${level ?? "all"}` ``.
- `listCourses` usa la caché con la clave `` `courses:${page}:${pageSize}` ``.
- El controlador valida con `courseListQuerySchema` y `stageListQuerySchema` mediante `ZodValidationPipe`, como el resto.

**Criterios de aceptación**
- [x] Prueba: sin `course` el servicio pide `fullstack-ia`; con `aws-cloud` pide `aws-cloud`; dos rutas distintas no comparten entrada de caché.
- [x] Prueba: `listCourses` devuelve el formato paginado.
- [x] `GET /api/content/stages/102` y `GET /api/content/units/AWS-U2.3.1` responden `404` (no `400`) mientras no existan o no estén publicados (comprobación HTTP manual descrita en el reporte).
- [x] Verificación común en verde.

**Revisión (2026-11-06): ✅ aprobada.** La ruta se resuelve una sola vez y alimenta a la vez la clave de caché y el filtro. La prueba de caché demuestra también que «sin `course`» y `fullstack-ia` comparten entrada. Verificación repetida: build, `typecheck` y `lint` en 0; api 887 · web 407 · shared 312. HTTP contra la API de desarrollo, repetido por el Orquestador: `courses` 200 (sólo `fullstack-ia`), `stages` 200 (ids 0–11), `?course=aws-cloud` 200 vacío, `?course=gcp` 400, `stages/102` 404, `units/AWS-U2.3.1` 404.

---

### S13-T7 — Esquema de semilla por ruta y fusión de archivos de unidad

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T3b |
| **Archivos** | `packages/shared/src/schemas/course-seed.ts` (crear) · `packages/shared/src/schemas/course-seed.spec.ts` (crear) · `packages/shared/src/index.ts` (modificar) |

**Contrato:**

```ts
export const courseSeedCourseSchema = z.object({
  slug: courseSlugSchema.refine((slug) => slug !== DEFAULT_COURSE_SLUG,
    "La ruta por defecto se siembra con content.seed.json"),
  title: z.string().min(1),
  objective: z.string().min(1),
  notice: z.string().min(1).nullable(),
  order: z.number().int().nonnegative(),
  isPublished: z.boolean(),
});

/** Reutiliza los esquemas de content.ts cambiando sólo códigos, ids y slugs. */
export const courseSeedUnitSchema = contentSeedUnitSchema.extend({
  code: z.string().regex(UNIT_CODE_PATTERN),
  prerequisiteIds: z.array(z.string().regex(UNIT_CODE_PATTERN)).default([]),
});
export const courseSeedModuleSchema = contentSeedModuleSchema.extend({
  code: z.string().regex(MODULE_CODE_PATTERN),
  units: z.array(courseSeedUnitSchema),
});
export const courseSeedStageSchema = contentSeedStageSchema.extend({
  id: z.number().int().refine(isKnownStageId, "La etapa debe pertenecer a una ruta"),
  slug: z.string().regex(/^[a-z]+\d{1,2}-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  modules: z.array(courseSeedModuleSchema).min(1),
});

export const courseSeedSchema = z.object({
  course: courseSeedCourseSchema,
  resources: z.array(contentSeedResourceSchema).default([]),
  stages: z.array(courseSeedStageSchema).min(1),
}).superRefine(/* reglas de abajo */);
export type CourseSeed = z.infer<typeof courseSeedSchema>;
export type CourseSeedStage = z.infer<typeof courseSeedStageSchema>;
export type CourseSeedModule = z.infer<typeof courseSeedModuleSchema>;
export type CourseSeedUnit = z.infer<typeof courseSeedUnitSchema>;

/** Contenido de `aws/units/<código>.json`. */
export const courseUnitFileSchema = z.object({
  code: z.string().regex(UNIT_CODE_PATTERN),
  lessons: z.array(contentSeedLessonSchema).min(1),
  exercises: z.array(contentSeedExerciseSchema).default([]),
}).strict();
export type CourseUnitFile = z.infer<typeof courseUnitFileSchema>;

export interface CourseUnitFileEntry { readonly fileName: string; readonly unit: CourseUnitFile; }

/** Inserta lecciones y ejercicios de cada archivo en su unidad. No valida el resultado: el llamador lo vuelve a pasar por courseSeedSchema. */
export function mergeCourseSeed(
  skeleton: CourseSeed,
  files: readonly CourseUnitFileEntry[],
): { seed: CourseSeed; problems: string[] };
```

**Reglas de `courseSeedSchema.superRefine`** (cada una con su issue y su `path`):
1. Cada `stage.id` pertenece a `course.slug` (`courseForStageId`) y `stageSlugMatchesCourse(slug, id)`.
2. Únicos: ids y slugs de etapa, códigos de módulo y unidad, slugs de lección, de ejercicio y de recurso; `order` único entre hermanos.
3. `module.code` empieza por `moduleCodePrefix(stage.id)`; `unit.code` empieza por `unitCodePrefix(module.code)`.
4. Cada prerrequisito apunta a una unidad declarada en la **misma** semilla.
5. Cada recurso enlazado por una lección existe en `resources`.
6. Toda competencia cumple `isCompetencyOfCourse(code, course.slug)`.
7. `exerciseRuleViolations(exercise)` de `content.ts` vacío para cada ejercicio.

**Reglas de `mergeCourseSeed`** (cada incumplimiento añade un texto a `problems` y el archivo se ignora):
- `fileName` debe ser exactamente `` `${unit.code}.json` ``.
- La unidad debe existir en el esqueleto.
- Dos archivos no pueden declarar la misma unidad.
- La unidad del esqueleto no puede traer ya lecciones ni ejercicios (una sola fuente por unidad).

**Criterios de aceptación**
- [x] Una semilla mínima válida de `aws-cloud` (1 etapa 100, 1 módulo `AWS-M0.1`, 1 unidad `AWS-U0.1.1`) pasa.
- [x] Una prueba por regla 1–7 que falla con su mensaje.
- [x] Una prueba por regla de `mergeCourseSeed`, y una de fusión correcta que conserva el orden de las unidades.
- [x] Verificación común en verde.

**Qué NO hacer:** no modificar `content.ts`; no leer archivos (eso es del cargador, T9).

**Revisión (2026-11-08): ✅ aprobada.** El código lo escribió DeepSeek el 2026-11-06, en una sesión que no llegó a reportarse. El Constructor de esta sesión (Sonnet 5.5) lo encontró en el árbol, lo revisó contra la ficha y sólo quitó líneas en blanco; el Orquestador lo leyó entero. Cumple las 7 reglas y las 4 de fusión. Además exige `order` único entre etapas, lecciones y ejercicios hermanos, que es coherente con la regla 2. 17 pruebas (el reporte habló de «doce para la regla 2»: son dos, y el total sí cuadra). Verificación repetida: build, `typecheck` y `lint` en 0; shared 329 · api 887 · web 407. **Laguna de la ficha:** la regla 4 no impide que una unidad sea su propio prerrequisito ni los ciclos; queda cubierto en la guarda de S13-T12 (regla 6).

---

### S13-T8 — Biblioteca de semilla compartida y conteo por ruta

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T7 |
| **Archivos** | `apps/api/prisma/seed/seed-lib.mts` (crear) · `apps/api/prisma/seed/seed.mts` (modificar) · `apps/api/prisma/tsconfig.seed.json` (modificar: sólo `"allowImportingTsExtensions": true`) |

**Contexto mínimo** (revisado contra el código el 2026-11-08). `seed.mts` mezcla lectura, validación y escritura en una sola función `main`, y la semilla de AWS necesita la misma escritura. Tres detalles del código actual condicionan el contrato:

1. **Prerrequisitos por defecto.** Si una unidad no declara prerrequisitos, `main` le asigna la unidad anterior en el orden global del currículo (etapa → módulo → unidad, por `order`), con un mapa `previousUnitCode` calculado sobre **todas** las etapas antes de escribir. Una función que reciba una sola etapa no puede calcularlo, así que el mapa se calcula aparte y se le pasa.
2. **Conteo final.** Hoy cuenta sin filtro (`prisma.stage.count()`…). En cuanto exista otra ruta en la base, `seed.mts` mostraría cifras mezcladas y el aviso de «filas no declaradas».
3. **Imports locales.** La semilla se ejecuta con el *type stripping* nativo de Node 24 (`node prisma/seed/seed.mts`), que exige la extensión explícita: `import … from "./seed-lib.mts"`. El `tsc` de la semilla (`prisma/tsconfig.seed.json`, `noEmit`) sólo la acepta con `"allowImportingTsExtensions": true`.

**Contrato:** `seed-lib.mts` exporta, **moviendo el código existente sin cambiar su comportamiento** (mismos campos, mismas claves de `upsert`, mismo orden de escritura y mismas reconciliaciones de pistas, pruebas y enlaces de recursos):

```ts
/** Carga `.env` (raíz o apps/api) y aplica DATABASE_URL_FALLBACK si falta: lo que hoy hacen las dos primeras líneas de `main`. */
export function prepareDatabaseEnv(): void;
export function describeIssues(issues: readonly { path: (string | number)[]; message: string }[]): string;
/** Mapa unidad → unidad anterior en el orden etapa → módulo → unidad (por `order`) de las etapas dadas. */
export function previousUnitCodes(stages: readonly (ContentSeedStage | CourseSeedStage)[]): ReadonlyMap<string, string>;
export async function upsertResources(prisma: PrismaClient, resources: readonly ContentSeedResource[]): Promise<ReadonlyMap<string, string>>; // slug → id
export async function upsertStageTree(
  prisma: PrismaClient,
  stage: ContentSeedStage | CourseSeedStage,
  context: {
    courseSlug: CourseSlug;
    resourceIdsBySlug: ReadonlyMap<string, string>;
    previousUnitCode: ReadonlyMap<string, string>;
  },
): Promise<void>; // etapa (con courseSlug en create y update) → módulos → unidades → ejercicios (+pistas, +pruebas) → lecciones (+recursos)
export async function countCourse(
  prisma: PrismaClient,
  courseSlug: CourseSlug,
): Promise<{ stages: number; publishedStages: number; modules: number; units: number; exercises: number }>;
```

- `exerciseConfig`, `exerciseSolution` y `unitPrerequisites` pasan a `seed-lib.mts` como funciones internas, con el tipo `ContentSeedExercise` de `@codeai/shared` en lugar del tipo derivado de `readSeed`.
- `countCourse` filtra por ruta a través de las relaciones: `stage: { courseSlug }` para módulos, `module: { stage: { courseSlug } }` para unidades, `unit: { module: { stage: { courseSlug } } }` para ejercicios.
- `CourseSeedStage` lo exporta `@codeai/shared` desde S13-T7.

`seed.mts` queda así: `prepareDatabaseEnv()` → leer y validar con `contentSeedSchema` (su `readSeed` y su mensaje de error no cambian) → `upsertResources` → `previousUnitCodes(seed.stages)` → `upsertStageTree(…, { courseSlug: "fullstack-ia", … })` por etapa → `countCourse(prisma, "fullstack-ia")` → **los mismos dos `console.log` y el mismo aviso** que hoy.

**Criterios de aceptación**
- [x] `npm run db:seed` (desde la raíz) dos veces seguidas imprime exactamente: «Semilla aplicada: 12 etapas (12 publicadas), 48 módulos, 207 unidades, 3203 ejercicios.» y «Declarado en content.seed.json: 12 etapas, 48 módulos, 207 unidades.», sin el aviso de filas no declaradas.
- [x] Tras sembrar, una consulta de solo lectura confirma que los prerrequisitos no cambiaron. Antes de tocar el código se guarda la salida de `SELECT code, "prerequisiteIds" FROM "Unit" ORDER BY code;` en un archivo del directorio temporal del sistema (fuera del repositorio), y al terminar la salida es idéntica.
- [x] `npm run typecheck:seed -w apps/api` en verde.
- [x] Verificación común en verde.

**Qué NO hacer:** no cambiar el orden de escritura, las claves de `upsert` ni los mensajes; no añadir la semilla de AWS (T9); en `tsconfig.seed.json`, nada más que la opción indicada.

**Estado (2026-11-08): 🟡 verificación estática ✅, pendiente de la base.** Docker Desktop estaba apagado. El Constructor se detuvo antes de tocar nada; después se le autorizó a hacer el refactor sin la base, porque la foto previa de prerrequisitos describe lo que dejó la semilla antigua (última siembra: 2026-11-06; `content.seed.json` sin cambios desde el 2026-11-04) y sigue siendo válida mientras nadie siembre con el código nuevo. El Orquestador comparó el código movido con el original línea a línea: es idéntico salvo `courseSlug` en la etapa y el conteo por ruta. `typecheck:seed`, build, `typecheck` y `lint` en 0; api 887 · web 407 · shared 329. **Falta**, en este orden: foto previa (207 líneas), `npm run db:seed` dos veces, foto posterior y `diff` idéntico. Hasta entonces T8 no se da por aprobada ni se hace su commit.

**Revisión (2026-11-09): ✅ aprobada (verificada contra la base junto con T9).** Con Docker de nuevo en marcha, el Orquestador hizo:
- foto previa de prerrequisitos: 207 líneas;
- `npm run db:generate`, pendiente desde el `EPERM` de T4;
- `npm run db:seed` dos veces, con «12 etapas (12 publicadas), 48 módulos, 207 unidades, 3203 ejercicios» en ambas y sin aviso;
- foto posterior: `diff` **idéntico**;
- tras sembrar AWS, otra corrida de `db:seed` con las mismas cifras, porque el conteo filtra por ruta.

---

### S13-T9 — Cargador de la semilla de una ruta y script `db:seed:aws`

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T8 |
| **Archivos** | `apps/api/prisma/seed/seed-course.mts` (crear) · `apps/api/package.json` (modificar) · `package.json` (raíz, modificar) |

**Contrato:**

- `node prisma/seed/seed-course.mts aws-cloud` (el argumento se valida con `courseSlugSchema`; `fullstack-ia` o vacío → error claro y código de salida 1).
- Directorio por ruta: `const COURSE_DIRS = { "aws-cloud": "aws" } as const;` → lee `prisma/seed/aws/course.seed.json` y todos los `prisma/seed/aws/units/*.json` en orden alfabético (si la carpeta no existe, cero archivos).
- Orden: parsear esqueleto con `courseSeedSchema` → parsear cada archivo con `courseUnitFileSchema` → `mergeCourseSeed` → si hay `problems`, imprimirlos y salir con 1 **sin tocar la base** → volver a validar el resultado con `courseSeedSchema` → `prepareDatabaseEnv()` → `upsert` de `Course` por `slug` → `upsertResources` → `previousUnitCodes(seed.stages)` → `upsertStageTree(…, { courseSlug: course.slug, resourceIdsBySlug, previousUnitCode })` por etapa → `countCourse(prisma, course.slug)` y comparación con lo declarado. Importa de `./seed-lib.mts` con la extensión explícita.
- Scripts: en `apps/api/package.json`, `"db:seed:aws": "npm run typecheck:seed && node prisma/seed/seed-course.mts aws-cloud"`; en la raíz, `"db:seed:aws": "npm run db:seed:aws -w apps/api"`.

**Ajuste del 2026-11-08.** El esqueleto real ya existe (T10, T10b y T11), así que la prueba usa ese esqueleto y no uno temporal. Con la base apagada, la tarea se divide en dos partes:
- **ahora:** código y verificación estática;
- **cuando haya base de datos:** la verificación contra ella, junto con la de T8, en una sola sesión.

T8 y T9 se aprueban y se commitean juntas tras esa verificación.

**Criterios de aceptación**
- [x] *(estático)* `npm run typecheck:seed -w apps/api` incluye el archivo nuevo y está en verde; verificación común en verde.
- [x] *(estático)* `node prisma/seed/seed-course.mts` sin argumento o con `fullstack-ia` termina con un mensaje claro y código 1 **antes** de conectarse a la base.
- [x] *(base de datos)* `npm run db:seed:aws` dos veces seguidas: «13 etapas, 77 módulos, 262 unidades» (0 publicadas) y las mismas cifras en la segunda ejecución.
- [x] *(base de datos)* Un archivo de unidad con nombre equivocado en `aws/units/` (temporal, se borra después) detiene la carga sin escribir nada: las cifras no cambian.
- [x] *(base de datos)* `npm run db:seed` (ruta por defecto) sigue dando sus cifras (12/48/207/3203).

**Estado (2026-11-08): 🟡 parte estática ✅, pendiente de la base.** El Orquestador revisó el código. Valida el argumento, lee y fusiona la semilla, y sólo entonces carga el entorno y crea el `PrismaClient`; un argumento, un archivo o una fusión inválidos terminan antes de conectarse. Comprobado: sin argumento, `fullstack-ia` y `gcp` salen con código 1 y un mensaje claro. `typecheck:seed`, `typecheck` y `lint` de la api en 0; suite del Constructor en verde (api 896 · web 422 · shared 341). **T8 y T9 se verifican juntas contra la base, y se aprueban y commitean juntas.**

**Revisión (2026-11-09): ✅ aprobada.** Resultados en la base:
- `npm run db:seed:aws` dos veces: «13 etapas (0 publicadas), 77 módulos, 262 unidades, 0 ejercicios».
- La base queda con `aws-cloud` 13/0 publicadas y `fullstack-ia` 12/12, y la fila `aws-cloud` en `Course` sin publicar y con su aviso.
- Los prerrequisitos de las 262 unidades AWS en la base son idénticos a los del esqueleto.
- Un archivo `AWS-U0.1.1-copia.json`, válido y armado con una lección real, detuvo la carga en la fusión con «El archivo AWS-U0.1.1-copia.json no corresponde a la unidad AWS-U0.1.1…», con código 1 y 0 lecciones AWS en la base. La carpeta temporal se eliminó.

Verificación completa: `typecheck:seed`, build de todos los workspaces, `typecheck` y `lint` en 0; api 896 · web 422 · shared 341.

---

### S13-T10 — Esqueleto de la ruta AWS (A0–A2)

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T7 (esquema). **No** depende de T8/T9 ni de la base de datos: ver «Ajuste del 2026-11-08» |
| **Archivos** | `apps/api/prisma/seed/aws/course.seed.json` (crear) |

**Ajuste del 2026-11-08.** La ficha original pedía sembrar con `npm run db:seed:aws` (T9), pero la base estaba apagada. El esqueleto se escribe y se valida ahora **sin base de datos**, con `courseSeedSchema` (S13-T7), y la siembra pasa a la verificación de T9. Para que cada sesión sea manejable, el antiguo «A0–A6» se divide en **T10 (A0–A2, 80 unidades)** y **T10b (A3–A6, 101 unidades)**.

**Contexto mínimo.** Primer tercio del esqueleto. La fuente de verdad es [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md): títulos de etapa, módulos y unidades se copian **literalmente**.

**Contrato:**
- `course`: `{ "slug": "aws-cloud", "title": "Ruta AWS Cloud: arquitectura y desarrollo", "objective": "Preparar para los exámenes de certificación de AWS de arquitectura y desarrollo, y para hacer el trabajo que esos exámenes describen.", "notice": "<texto exacto de COURSE_NOTICES['aws-cloud'] en packages/shared/src/schemas/course.ts>", "order": 1, "isPublished": false }`.
- `estimatedMin` de cada etapa (límite inferior de horas × 60): 100 → 1200 · 101 → 1800 · 102 → 7200 · 103 → 4800 · 104 → 3600 · 105 → 5400 · 106 → 6600 · 107 → 1500 · 108 → 4200 · 109 → 3600 · 110 → 3000 · 111 → 3000 · 112 → 1800.
- Esta tarea escribe las etapas **A0, A1 y A2** (ids 100–102). T10b añade A3–A6 y T11, A7–A12.
- `resources`: `[]`.
- Etapas A0–A6 (ids 100–106): `slug` exacto de esta tabla (también vale para T11);

  | Id | Slug | Id | Slug |
  |----|------|----|------|
  | 100 | `aws0-diagnostico-cuenta-segura-nivelacion` | 107 | `aws7-fundamentos-ia` |
  | 101 | `aws1-fundamentos-nube` | 108 | `aws8-desarrollo-ia-generativa` |
  | 102 | `aws2-arquitectura-soluciones-asociado` | 109 | `aws9-seguridad` |
  | 103 | `aws3-desarrollo-aws` | 110 | `aws10-ingenieria-datos` |
  | 104 | `aws4-operaciones-nube` | 111 | `aws11-ingenieria-ml` |
  | 105 | `aws5-devops-profesional` | 112 | `aws12-portafolio-entrevistas-vigencia` |
  | 106 | `aws6-arquitectura-soluciones-profesional` | | |

  `title` = título de la etapa; `objective` = campo **Objetivo** de su tabla; `level` = nivel del currículo (A0–A1 → 1, A2–A4 → 2, A5–A6 → 3); `estimatedMin` = límite inferior de horas × 60; `order` = n + 1; `isPublished: false`.
- Módulos y unidades: `code`, `title` y `order` del currículo; `isPublished: false`; unidades con `lessons: []`, `exercises: []`, `estimatedMin: null` y `objective` = **una capacidad observable que empieza por un verbo en infinitivo** derivada del título (p. ej., AWS-U2.2.3 → «Decidir si un flujo de red se permite combinando security groups y network ACL»).
- `prerequisiteIds`, **siempre declarados de forma explícita** y sólo con Y:
  - Cada unidad depende de la anterior de su módulo.
  - La primera unidad de un módulo depende de la última del módulo anterior de su etapa.
  - La primera unidad de una etapa depende de la última unidad de cada etapa prerrequisito (grafo del currículo §5): A1 ← AWS-U0.3.5; A2 ← AWS-U1.5.1; A3 y A4 ← AWS-U2.10.2; A5 ← AWS-U3.8.1 y AWS-U4.7.1; A6 ← AWS-U2.10.2.
  - La primera unidad de A0 (AWS-U0.1.1) no tiene prerrequisitos.

**Validación sin base de datos.** Con un script temporal **fuera del repositorio** (en el directorio temporal del sistema), que importe `packages/shared/dist/index.js` tras `npm run build -w packages/shared`:
1. `courseSeedSchema.safeParse` del archivo sin issues;
2. recuento de etapas, módulos y unidades;
3. comparación automática de cada título de etapa, módulo y unidad con los de `curriculo-aws.md` (extraídos del Markdown).

**Criterios de aceptación**
- [x] `courseSeedSchema` valida el archivo sin issues: 3 etapas (100–102), 18 módulos, 80 unidades, todo sin lecciones ni ejercicios.
- [x] La comparación automática de títulos con el currículo da 0 diferencias.
- [x] Todos los `objective` de unidad empiezan por un verbo en infinitivo (`/^[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:ar|er|ir)\b/`).
- [x] Ningún elemento con `isPublished: true`.
- [x] Verificación común en verde (la guarda `seed-course-quality` llega en T12).

**Revisión (2026-11-08): ✅ aprobada tras corregir tres objetivos.** Validación independiente del Orquestador con un script propio fuera del repositorio. 0 problemas en esquema, totales (3/18/80), títulos de etapa, módulo y unidad, objetivo de etapa, slugs, `level`, `estimatedMin`, `order` y publicados. Sólo AWS-U0.1.1 queda sin prerrequisitos, no hay autorreferencias ni ciclos, y A1 empieza en AWS-U0.3.5 y A2 en AWS-U1.5.1. En la lectura de los 80 objetivos se corrigieron tres: AWS-U2.3.4 (presentaba ECR y Fargate como alternativas a ECS/EKS), AWS-U2.6.2 (metía Pipes y Scheduler en un fan-out) y AWS-U1.2.2 (redacción forzada). Tras la corrección se comprobó que los otros 77 objetivos no cambiaron. Verificación: `typecheck` y `lint` en 0; api 887 · web 422 · shared 341. **La siembra en la base queda para la verificación de T9.**

**Qué NO hacer:** no escribir lecciones ni ejercicios; no inventar unidades; no añadir recursos; no dejar el script de validación dentro del repositorio.

---

### S13-T10b — Esqueleto de la ruta AWS (A3–A6)

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T10 |
| **Archivos** | `apps/api/prisma/seed/aws/course.seed.json` (modificar: añadir etapas al final del arreglo `stages`) |

**Contrato:** mismas reglas que T10 para las etapas **A3, A4, A5 y A6** (ids 103–106; `level` A3–A4 → 2, A5–A6 → 3), con sus slugs, `estimatedMin` y prerrequisitos de la ficha de T10. Lo ya escrito (curso y A0–A2) no cambia.

**Criterios de aceptación**
- [x] `courseSeedSchema` valida el archivo completo: 7 etapas (100–106), 47 módulos, 181 unidades.
- [x] La comparación automática de títulos con el currículo da 0 diferencias para A0–A6.
- [x] Objetivos en infinitivo y nada publicado, como en T10.
- [x] El diff no modifica el curso ni las etapas A0–A2.

**Revisión (2026-11-08): ✅ aprobada tras corregir tres objetivos.** La validación independiente del Orquestador da 0 problemas, con prerrequisitos entre etapas según el grafo (A3, A4 y A6 ← AWS-U2.10.2; A5 ← AWS-U3.8.1 y AWS-U4.7.1) y sin ciclos. Diff +1594/−0 respecto al commit de T10. El Constructor señaló seis objetivos dudosos y los seis estaban bien resueltos. El Orquestador corrigió otros tres: AWS-U3.2.3 (la concurrencia reservada no evita arranques en frío), AWS-U4.4.1 (la detección de deriva no despliega) y AWS-U6.2.4 (redacción repetida). Verificación: `typecheck` y `lint` en 0; api 887 · web 422 · shared 341.

---

### S13-T11 — Esqueleto de la ruta AWS (A7–A12)

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T10b |
| **Archivos** | `apps/api/prisma/seed/aws/course.seed.json` (modificar: añadir etapas al final del arreglo `stages`) |

**Contrato:** mismas reglas que T10 para las etapas A7–A12 (ids 107–112; `level` 4). Prerrequisitos (sólo Y): A7 ← AWS-U1.5.1; A8 ← AWS-U7.4.1 y AWS-U3.8.1; A9 ← AWS-U2.10.2 y AWS-U4.7.1; A10 ← AWS-U2.10.2; A11 ← AWS-U7.4.1 y AWS-U10.5.1; A12 ← AWS-U6.7.2. Lo ya escrito no cambia.

**Criterios de aceptación** (sin base de datos, como T10)
- [x] `courseSeedSchema` valida el archivo completo: 13 etapas, 77 módulos, 262 unidades.
- [x] La comparación automática de títulos con el currículo da 0 diferencias para A0–A12.
- [x] Objetivos en infinitivo y nada publicado.
- [ ] La siembra (`npm run db:seed:aws` dos veces con las mismas cifras: 13 / 77 / 262) se comprueba en la verificación de T9, cuando haya base de datos.

**Revisión (2026-11-08): ✅ aprobada (la siembra sigue pendiente de T9).** La validación independiente del Orquestador sobre el archivo completo da 0 problemas. Prerrequisitos entre etapas según el grafo: A7 ← U1.5.1; A8 ← U7.4.1 + U3.8.1; A9 ← U2.10.2 + U4.7.1; A10 ← U2.10.2; A11 ← U7.4.1 + U10.5.1; A12 ← U6.7.2. Una sola raíz (AWS-U0.1.1), sin ciclos. Diff +1368/−0 respecto a T10b. El Orquestador leyó los 81 objetivos nuevos sin encontrar inexactitudes. Las dudas del Constructor estaban bien resueltas: WAF y Shield «en capas» con los controles de red; el papel de CloudHSM respecto a KMS; Bedrock Agents y AgentCore sin atribuirles funciones concretas.

---

### S13-T12 — Guarda de calidad de la semilla AWS

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T11 |
| **Archivos** | `apps/api/src/modules/content/seed-course-quality.spec.ts` (crear) |

**Contrato:** la prueba lee `prisma/seed/aws/course.seed.json` y `prisma/seed/aws/units/*.json` del disco (como hacen las guardas existentes con `content.seed.json`), los fusiona con `mergeCourseSeed` y comprueba:

1. `problems` vacío y `courseSeedSchema` válido.
2. 13 etapas con ids 100–112 y módulos por etapa `[3, 5, 10, 8, 7, 7, 7, 4, 6, 7, 5, 5, 3]`; 262 unidades.
3. Cada `objective` de unidad empieza por un verbo en infinitivo: `/^[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:ar|er|ir)\b/`.
4. Toda URL de `sources` de un ejercicio pertenece a un dominio permitido: `docs.aws.amazon.com`, `aws.amazon.com`, `skillbuilder.aws` o sus subdominios.
5. Ningún ejercicio de la ruta AWS está publicado (`isPublished: false`) mientras no exista S14 (esta regla se retira en S14 con su propia guarda).
6. Ninguna unidad es su propio prerrequisito y el grafo de prerrequisitos no tiene ciclos. `courseSeedSchema` (S13-T7) sólo comprueba que el prerrequisito exista, y una autorreferencia o un ciclo dejarían unidades bloqueadas para siempre.

**Criterios de aceptación**
- [x] La guarda pasa con el esqueleto actual y falla (prueba de mutación manual descrita en el reporte) si se cambia un objetivo a «Entender…» por «Comprensión de…».
- [x] Verificación común en verde.

**Revisión (2026-11-08): ✅ aprobada.** 9 pruebas, una por regla, con mensajes que nombran la unidad, la URL o el ciclo que incumple. Las reglas 4 y 6 se prueban además con datos de ejemplo, para que no pasen sólo en vacío. El dominio se compara con el `hostname` (rechaza `aws.amazon.com.evil.com` y `notskillbuilder.aws`) y los ciclos se buscan en profundidad con pila de camino. Si falta `aws/units/`, hay cero archivos. Mutaciones del Constructor: objetivo «Comprensión de…» y autorreferencia; cada una falla sólo su regla. Mutación del Orquestador: ciclo AWS-U0.1.1 ↔ AWS-U0.1.2, que falla sólo la regla 6b. Todas restauradas con `git checkout`. Verificación repetida: build, `typecheck` y `lint` en 0; api 896 (+9) · web 422 · shared 341.

---

### S13-T12b — Etapa de una unidad a partir de su código

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T1 |
| **Archivos** | `packages/shared/src/schemas/course.ts` (modificar) · `packages/shared/src/schemas/course.spec.ts` (modificar) |

**Contexto mínimo** (descubierto el 2026-11-08 al revisar T14–T15 contra el código). La web deduce la etapa de cada unidad leyendo su código con `/^U(\d+)(?:\.|$)/` en dos sitios: `stageIndexOf` de `StageCatalog.tsx` y `summarizeStages` de `StudentInsights.tsx`. Con la ruta AWS falla: `AWS-U2.3.1` no encaja en la expresión, y aunque encajara daría 2 y no 102. La API no tiene el problema, porque usa `Unit.stageId` de la base. Esta tarea pone la regla en un único sitio; T15 y T16b la usan.

**Contrato** (añadido a `course.ts`, sin cambiar nada de lo existente):

```ts
/** Id de etapa de un código de unidad o de módulo de cualquier ruta: "U2.3.1" → 2, "AWS-U2.3.1" → 102, "AWS-M0.1" → 100. Código mal formado, o número fuera del rango de su ruta → null. */
export function stageIdOfCode(code: string): number | null;
```

Regla: el código debe cumplir `UNIT_CODE_PATTERN` o `MODULE_CODE_PATTERN`; la ruta sale de `courseForCode`; el id es `stageIdMin + número de etapa` y debe quedar dentro de `[stageIdMin, stageIdMax]`.

**Criterios de aceptación**
- [x] Pruebas: `U0.1.1` → 0, `U11.2.3` → 11, `AWS-U2.3.1` → 102, `AWS-U12.3.2` → 112, `M2.3` → 2, `AWS-M0.1` → 100.
- [x] Pruebas de `null`: `U12.1.1` (fuera de rango), `AWS-U13.1.1` (fuera de rango), `X2.3.1`, `aws-U2.3.1`, `U2`, cadena vacía.
- [x] Verificación común en verde.

**Revisión (2026-11-08): ✅ aprobada.** El diff sólo añade líneas: la función con el JSDoc literal y 12 casos de `it.each`. El número de etapa se extrae igual que en `unitCodePrefix`; no hace falta límite inferior porque el patrón sólo admite dígitos. Verificación repetida: build, `typecheck` y `lint` en 0; api 887 · web 410 · shared 341.

---

### S13-T13 — Cliente web: rutas y etapas por ruta

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T6 |
| **Archivos** | `apps/web/src/lib/api-client.ts` (modificar) · `apps/web/src/lib/api-client.spec.ts` (modificar) |

**Contrato:**

```ts
export interface CourseCatalogPage { readonly courses: readonly CourseSummary[]; readonly meta: PaginationMeta; }

contentApi.listCourses(signal?: AbortSignal): Promise<CourseCatalogPage>; // GET /content/courses, validado con courseListResponseSchema de @codeai/shared
contentApi.listStages(signal?: AbortSignal, options?: { course?: CourseSlug }): Promise<StageCatalogPage>;
// sin options o sin course → "/content/stages" (URL idéntica a la actual); con course → "/content/stages?course=<slug>" (con encodeURIComponent)
```

(`PaginationMeta` es el tipo de `meta` que ya usa `StageCatalogPage` en `api-client.ts`; se reutiliza. La petición usa el `requestParsed` existente.)

**Criterios de aceptación**
- [x] Prueba: `listStages()` llama exactamente a la URL actual (no rompe llamadas existentes).
- [x] Prueba: `listStages(undefined, { course: "aws-cloud" })` añade `?course=aws-cloud`.
- [x] Prueba: `listCourses` valida la respuesta y falla con una forma inválida.
- [x] `npm run typecheck -w apps/web`, `lint` y `test` en verde.

**Revisión (2026-11-08): ✅ aprobada tras una corrección.** En la primera entrega, el cambio quitó el espacio de `const stagePageSchema = …`, una línea fuera del contrato; el Constructor la restauró cuando se le pidió. 3 pruebas nuevas (la URL sin filtro ya la cubría una prueba existente). Verificación: build, `typecheck` y `lint` en 0; api 887 · shared 329 · web 410. La primera corrida de web falló en `InterviewRoom.spec.tsx` («inicia la sesión…»), la prueba intermitente de §6; al repetir, 410/410. Como ya entorpece cada verificación, pasa a ser la microtarea **S13-T19**.

---

### S13-T14 — Catálogo de rutas en `/learn/courses`

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T13 |
| **Archivos** | `apps/web/src/app/(learning)/learn/courses/page.tsx` (crear) · `apps/web/src/features/learning/components/CourseCatalog.tsx` (crear) · `apps/web/src/features/learning/components/CourseCatalog.spec.tsx` (crear) |

**Contrato visual:** una tarjeta por ruta publicada con título, objetivo, número de etapas («13 etapas») y, si `notice` no es `null`, el aviso en texto secundario. Cada tarjeta enlaza a `/learn/stages?course=<slug>`. Estados de carga, error y vacío con el **mismo patrón que `StageCatalog`** (revisado el 2026-11-08): `useContentLoader(load)` con un `load` que recibe `signal`; carga con `role="status"` y tarjetas de esqueleto `animate-pulse` (no existe un componente `Skeleton`); error con `role="alert"` y botón «Reintentar» que llama a `reload`. El componente recibe `loadCourses?` inyectable, por defecto `contentApi.listCourses`, igual que `loadStages` en `StageCatalog`. Mismos tokens de tema y clases de tarjeta.

**Criterios de aceptación**
- [x] Prueba con dos rutas (una con aviso) y enlaces correctos.
- [x] Prueba de error con reintento y de lista vacía.
- [x] `npm run build -w apps/web` compila la ruta nueva.

**Revisión (2026-11-08): ✅ aprobada.** Tres archivos nuevos que calcan el patrón de `StageCatalog`, incluidos sus `<h3>` de tarjeta y el `aria-label` del enlace. 4 pruebas: carga, dos rutas con aviso y singular «1 etapa», vacío, y error con reintento. Verificación repetida: build, `typecheck` y `lint` en 0; api 887 · web 414 · shared 341; `next build` lista `○ /learn/courses`. `next build` reescribe `apps/web/next-env.d.ts` (rutas de `.next/dev/types` a `.next/types`); se restauró a la versión del commit para no colarlo.

---

### S13-T15 — Catálogo de etapas filtrado por ruta

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T14 |
| **Archivos** | `apps/web/src/app/(learning)/learn/stages/page.tsx` (modificar) · `apps/web/src/features/learning/components/StageCatalog.tsx` (modificar) · `apps/web/src/features/learning/components/StageCatalog.spec.tsx` (modificar) |

**Contrato** (revisado contra el código el 2026-11-08):
- **Página.** En Next 16, `searchParams` llega como promesa: `export default async function LearnStagesPage({ searchParams }: { searchParams: Promise<{ course?: string | string[] }> })`. Si `course` no es una cadena que cumpla `courseSlugSchema`, se usa `DEFAULT_COURSE_SLUG`. Pasa `course` a `StageCatalog`. `metadata` y cabecera no cambian.
- **Loader.** El tipo `LoadStages` pasa a `(signal?: AbortSignal, options?: { readonly course?: CourseSlug }) => Promise<StageCatalogPage>`, compatible con `contentApi.listStages`. `StageCatalog` llama `loadStages(signal)` si `course` es el de por defecto (la llamada actual no cambia) y `loadStages(signal, { course })` si no; `course` entra en las dependencias del `useCallback`.
- **Etiqueta.** Hoy la tarjeta y su `aria-label` muestran `Etapa {stage.order}`. Como E0 tiene `order: 1`, la web dice «Etapa 1» para la que el currículo llama E0. Pasan a `Etapa {stageLabel(stage.id) ?? stage.order} · Nivel {stage.level}` y `` `Etapa ${stageLabel(stage.id) ?? stage.order}: ${stage.title}` `` («Etapa E0», «Etapa A2»), en la tarjeta abierta y en la bloqueada (`StageHeading`).
- **Aviso y navegación.** `COURSE_NOTICES[course]` se muestra en texto secundario cuando no es `null`, y un enlace «Cambiar de ruta» lleva a `/learn/courses`.
- **Coherencia de la etiqueta** (añadido tras la primera entrega). Los otros dos textos del componente que nombran una etapa por su `order` (la etiqueta del anillo «Avance de la etapa N» y el aviso de bloqueo «Domina antes la etapa N: …») usan también `stageLabel(id) ?? order`. Si no, una tarjeta diría a la vez «Etapa E1» y «Domina antes la etapa 1».
- La función local `stageIndexOf` (regex `/^U(\d+)…/`) se elimina; la agrupación del avance por etapa usa `stageIdOfCode` de `@codeai/shared` (S13-T12b), para que las unidades `AWS-U…` cuenten en su etapa 100–112.

**Criterios de aceptación**
- [x] Las pruebas existentes de la ruta por defecto pasan sin cambios de comportamiento; sólo se ajustan los textos «Etapa N» a «Etapa EN», y el reporte lista cada uno.
- [x] Prueba nueva: con `course="aws-cloud"`, el loader inyectado recibe `{ course: "aws-cloud" }`, la tarjeta del id 102 dice «Etapa A2», se ve el aviso y el enlace «Cambiar de ruta».
- [x] Prueba nueva: unidades `AWS-U2.3.1` en el progreso cuentan en la etapa 102 (agrupación con `stageIdOfCode`).
- [x] Prueba nueva: sin `course`, el loader se llama sólo con `signal` (sin segundo argumento).

**Revisión (2026-11-08): ✅ aprobada tras una ampliación.** La primera entrega cumplía el contrato; el Orquestador amplió la ficha con la «Coherencia de la etiqueta» (anillo de avance y aviso de bloqueo) y el Constructor la aplicó en sus mismos archivos. Textos de prueba ajustados: «Etapa 1 · Nivel 1» → «Etapa E0 · Nivel 1»; «Avance de la etapa 1/2/3» → «E0/E1/E2»; «Domina antes la etapa 2: …» → «Domina antes la etapa E1: …». La búsqueda de la etapa anterior sigue usando `order`, que es correcto dentro de una ruta. Verificación repetida: build, `typecheck` y `lint` en 0; api 887 · web 417 · shared 341; `next build` en 0 y `next-env.d.ts` restaurado.
- [ ] `npm run build -w apps/web` en verde.

---

### S13-T16 — Etiquetas de etapa en el outline y en la unidad

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T15 |
| **Archivos** | `apps/web/src/features/learning/components/StageOutline.tsx` (modificar) · `apps/web/src/features/learning/components/StageOutline.spec.tsx` (modificar) |

**Contexto** (revisado contra el código el 2026-11-08). `UnitView.tsx` **sale de la tarea**: no muestra el número de etapa (su miga de pan usa `stage.title`). `StageOutline` tiene dos cosas que arreglar: la cabecera dice `Etapa {stage.order} · Nivel …` (el mismo desfase que T15) y el enlace «← Catálogo» va siempre a `/learn/stages`, así que desde una etapa de AWS devolvería al catálogo de la otra ruta.

**Contrato:**
- La cabecera pasa a `Etapa {stageLabel(stage.id) ?? stage.order} · Nivel {stage.level}`.
- El enlace «← Catálogo» lleva a `/learn/stages` si la etapa es de la ruta por defecto, y a `/learn/stages?course=<slug>` si es de otra ruta (`courseForStageId(stage.id)`).
- Si `COURSE_NOTICES[slug]` de la ruta de la etapa no es `null`, se muestra al pie del outline en texto secundario.
- Nada más cambia.

**Criterios de aceptación**
- [x] Prueba: el outline de la etapa 102 muestra «Etapa A2», el aviso y el enlace a `/learn/stages?course=aws-cloud`.
- [x] Prueba: el outline de la etapa 2 muestra «Etapa E2», ningún aviso y el enlace a `/learn/stages`.
- [x] Las pruebas existentes de `StageOutline` sólo se ajustan en el texto «Etapa N»; las de `UnitView` siguen en verde sin tocarlas.

**Revisión (2026-11-08): ✅ aprobada.** Diff exacto al contrato; las pruebas nuevas usan un `order` distinto del id, así que demuestran que la etiqueta sale del id. Ninguna prueba existente fijaba «Etapa N». El enlace «Volver al catálogo» del estado de error sigue en `/learn/stages`, porque sin etapa cargada no hay ruta que deducir. Verificación repetida: build, `typecheck` y `lint` en 0; api 887 · web 419 · shared 341; `next build` en 0.

---

### S13-T16b — Analítica del estudiante con etapas de cualquier ruta

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T12b |
| **Archivos** | `apps/web/src/features/analytics/components/StudentInsights.tsx` (modificar) · `apps/web/src/features/analytics/components/StudentInsights.spec.tsx` (modificar) |

**Contexto mínimo.** `summarizeStages` agrupa el avance por etapa con `/^U(\d+)(?:\.|$)/`, así que descarta las unidades `AWS-U…` (ver S13-T12b).

**Contrato** (revisado contra el código el 2026-11-08):
- `summarizeStages` usa `stageIdOfCode(unit.unitCode)` y descarta sólo los códigos para los que devuelve `null`. El comentario del campo `stage` («Índice de etapa que codifica el `unitCode`…») pasa a decir que es el id de etapa de cualquier ruta.
- Hoy la vista escribe la letra a mano en dos sitios: `Etapa E{stage.stage}` y `` aria-label={`Avance de la etapa E${stage.stage}`} ``. Con AWS diría «Etapa E102». Ambos pasan a `stageLabel(stage.stage) ?? String(stage.stage)` («Etapa E1», «Etapa A2»).
- La nota `` `Etapa en curso: ${overview.currentStage}` `` pasa a `` `Etapa en curso: ${stageLabel(overview.currentStage) ?? overview.currentStage}` `` («Etapa en curso: E2»).
- El resto no cambia.

**Criterios de aceptación**
- [x] Prueba: con unidades `U0.1.1`, `U0.1.2` y `AWS-U2.3.1`, `summarizeStages` devuelve las etapas 0 y 102, cada una con su media.
- [x] Prueba: una barra de la etapa 102 se nombra «Avance de la etapa A2» y su texto dice «Etapa A2».
- [x] La prueba existente que espera «Etapa en curso: 2» pasa a esperar «Etapa en curso: E2» (único texto ajustado esperado; el reporte lista cualquier otro).
- [x] Verificación de `apps/web` en verde.

**Revisión (2026-11-08): ✅ aprobada tras una corrección menor.** Diff exacto al contrato; sólo se ajustó «Etapa en curso: 2» → «E2». El Constructor avisó de que el JSDoc de `summarizeStages` seguía describiendo la regla antigua, y lo reescribió a petición del Orquestador sin tocar código. Verificación repetida: build, `typecheck` y `lint` en 0; api 887 · web 421 · shared 341.

---

### S13-T17 — Acceso a las rutas desde el panel de inicio

| Campo | Valor |
|-------|-------|
| **Depende de** | S13-T14 |
| **Archivos** | `apps/web/src/features/learning/components/StudentDashboard.tsx` (modificar) · `apps/web/src/features/learning/components/StudentDashboard.spec.tsx` (modificar) |

**Cambio de enfoque (2026-11-08, revisado contra el código).** La ficha original añadía «Rutas» a `LearnNav`, pero cada destino de la navegación lleva una pieza de Tetris propia, `TetrominoId` sólo tiene siete (`I O T S Z J L`) y las siete están en uso (también en `MobileTabBar`). Un octavo destino rompería el sistema visual de la rama. Además, `/learn/courses` ya queda bajo «Aprender», porque `activeHref` resuelve por prefijo `/learn`. **La navegación no se toca.** El acceso va en el panel de inicio (`/learn`), donde el alumno decide qué estudiar, junto a los accesos que ya tiene.

**Contrato:** en el bloque `<nav aria-label="Accesos del área de aprendizaje">` de `StudentDashboard`, un enlace nuevo «Rutas de aprendizaje →» a `/learn/courses`, el primero del bloque, con las mismas `SECONDARY_LINK_CLASSES` y el mismo `<span aria-hidden="true"> →</span>` que los demás. Nada más cambia.

**Criterios de aceptación**
- [x] Prueba: el bloque «Accesos del área de aprendizaje» contiene un enlace «Rutas de aprendizaje» a `/learn/courses`, además de los dos que ya había.
- [x] Las pruebas existentes del panel siguen pasando sin cambios.
- [x] `LearnNav.tsx` y `MobileTabBar.tsx` sin cambios.
- [x] Verificación de `apps/web` en verde.

**Revisión (2026-11-08): ✅ aprobada.** El diff añade sólo el enlace, primero del bloque. La prueba fija los tres enlaces y sus destinos. Verificación repetida: build, `typecheck` y `lint` en 0; api 887 · web 422 · shared 341; `next build` en 0.

---

### S13-T19 — Prueba intermitente de `InterviewRoom`

| Campo | Valor |
|-------|-------|
| **Depende de** | — |
| **Archivos** | `apps/web/src/features/interviews/components/InterviewRoom.spec.tsx` (modificar) |

**Contexto mínimo.** La prueba «inicia la sesión y muestra fase, turnos restantes y cronómetro» falla una vez de cada pocas corridas completas de `apps/web` (§6). Espera el título del escenario, que llega con `loadScenario`, y justo después comprueba de forma síncrona que se llamó a `startSession` y que ya se ven la fase, los turnos y el cronómetro. Esas tres cosas dependen de que `startSession` haya resuelto, que puede ocurrir un instante después. Es una carrera de la prueba, no del componente.

**Contrato:** sólo esa prueba. Las expectativas que dependen de la sesión (la llamada a `startSession`, «1 de 6 · Presentación», «40» y el `timer`) se esperan con `await waitFor(…)` o con consultas `findBy…`, con el mismo estilo que el resto del archivo. Lo que se comprueba no cambia: ni se quita ni se relaja ninguna expectativa. El componente no se toca.

**Criterios de aceptación**
- [x] `git diff` sólo toca esa prueba.
- [x] `npx vitest run src/features/interviews/components/InterviewRoom.spec.tsx` (desde `apps/web`) pasa 10 veces seguidas.
- [x] `npm run test -w apps/web` pasa 3 veces seguidas sin fallos.
- [x] Verificación común en verde.

**Revisión (2026-11-08): ✅ aprobada.** El Constructor confirmó la causa en el componente: `startSession` se llama desde un `useEffect` posterior al render que pinta el título, y su resultado llega por `.then(setSession)`. Es la misma aserción que había fallado (`toHaveBeenCalledWith({ scenarioSlug: "backend-junior" })`), y ahora espera con `waitFor`. No se quitó ninguna expectativa y no hay otras pruebas con la misma carrera. Repeticiones: Constructor 10/10 del archivo y 3/3 de la suite web; Orquestador 5/5 del archivo y 2 suites completas en verde (api 887 · web 410 · shared 329).

---

### S13-T18 — Documentación (Orquestador)

No es tarea del Constructor. Al aprobar T1–T17, el Orquestador actualiza en el mismo commit de cierre: [`../../03-arquitectura/contratos-api.md`](../../03-arquitectura/contratos-api.md) §3 (rutas `courses` y `?course=`), [`../../03-arquitectura/modelo-datos.md`](../../03-arquitectura/modelo-datos.md) (`Course`, `Stage.courseSlug`, semilla por unidad), `README.md` (estado y comando `db:seed:aws`) y [`../roadmap-sprints.md`](../roadmap-sprints.md).

**Revisión (2026-11-09): ✅ hecha.** Documentos actualizados: `contratos-api.md` §3, `modelo-datos.md`, `README.md` (estado y comando `db:seed:aws`), `roadmap-sprints.md` y esta ficha.

---

## 5. Criterios de cierre del sprint

- [x] T1–T17, T3b, T3c, T10b, T12b, T16b y T19 aprobadas; T18 hecha.
- [x] `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` en verde en todos los workspaces.
- [x] `npm run db:migrate`, `npm run db:seed` (12/48/207) y `npm run db:seed:aws` (13/77/262) desde una base vacía, dos veces cada semilla, con las mismas cifras. Cumplido en una base desechable `postgres:16-alpine` (puerto 5440), borrada después.
- [x] Sin `course`, `GET /api/content/stages` devuelve exactamente lo mismo que antes del sprint (comparación de la respuesta).
- [x] Con `aws-cloud` marcada como publicada **en una base local de prueba**, `/learn/courses` muestra las dos rutas y `/learn/stages?course=aws-cloud` las etapas A0–A12 publicadas. Cumplido por API y pruebas de componentes; recorrido visual en navegador: pendiente de una persona.
- [x] Ninguna unidad, lección ni ejercicio de AWS publicado.

## 6. Deuda declarada al abrir el sprint

- **Prerrequisitos entre rutas** (A3 recomienda E2): se muestran como recomendación en S26; no bloquean.
- **Prerrequisitos en O** (A6 ← A3 o A4; A12 ← A5 o A6): el modelo sólo admite Y; se usó el prerrequisito común (A2 para A6, A6 para A12).
- **Proyectos y entrevistas** validan etapas 0–11 (`project.ts`, `interview.ts`): se amplían en S17-T1, antes del primer proyecto de AWS.
- **Panel «Continuar» y analítica** mezclan rutas: se separan por ruta en S15 (preparación por certificación) y S26.
- `contentSeedSchema` y `courseSeedSchema` duplican reglas de árbol; unificarlas es refactor posterior, no bloquea.
- **Finales de línea de las migraciones (descubierto en S13-T4):** el repositorio tiene `core.autocrlf=true` y no tiene `.gitattributes`. Prisma guarda el checksum de cada `migration.sql` tal como estaba en disco al aplicarlo. En la base local, `20261028170000_interviews` y `20261106160012_courses` se aplicaron con CRLF y el resto con LF (`git ls-files --eol`). Si una operación de Git reescribe uno de esos archivos con otros finales de línea, `migrate dev` podría volver a decir «modified after it was applied». **Antes de la primera migración de S14** se comprueba si la versión de Prisma del proyecto compara checksums sin importar el final de línea; si no lo hace, se añade un `.gitattributes` para `apps/api/prisma/migrations/**` y se documenta en `modelo-datos.md`.
- ✅ **Resuelta en S13-T19 (2026-11-08).** **Prueba intermitente descubierta durante S13-T3b (no planificada):** `apps/web/src/features/interviews/components/InterviewRoom.spec.tsx`, prueba «inicia la sesión y muestra fase, turnos restantes y cronómetro», línea ~89. Comprueba `startSession` en cuanto aparece el título, pero el título depende de `loadScenario` y el arranque de sesión puede resolverse después; con carga en paralelo falla una vez de cada varias. Corrección probable: envolver esa expectativa en `await waitFor(…)`. Es código de S10; por la regla 4 del roadmap pasa al sprint siguiente salvo que bloquee el cierre de este, en cuyo caso se convierte en una microtarea de un archivo.

## 7. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md)
- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md)
- [`../../05-orquestacion/plantilla-tarea.md`](../../05-orquestacion/plantilla-tarea.md)
- [`../../05-orquestacion/guia-constructor-deepseek.md`](../../05-orquestacion/guia-constructor-deepseek.md)
- [`../../03-arquitectura/modelo-datos.md`](../../03-arquitectura/modelo-datos.md)
