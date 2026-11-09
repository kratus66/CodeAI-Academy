# Sprint 14 — Preguntas tipo examen y metadatos de certificación

> **Estado:** 🔄 fichas redactadas (2026-11-09); T0 hecha, el resto pendiente · **Duración prevista:** 12–14 sesiones · **Depende de:** S13 (multi-ruta), S6 (corrección de quizzes).
> **Ámbito:** `packages/shared`, `apps/api` (`exercises`, semilla) y `apps/web` (reproductores). Las fichas detalladas (§4) siguen la [plantilla](../../05-orquestacion/plantilla-tarea.md) y se revisaron contra el código el 2026-11-09; el orden de ejecución está en §7.
> **Por qué existe:** un examen de AWS tiene preguntas de respuesta múltiple («selecciona DOS»), cada pregunta pertenece a un dominio con peso, y su banco debe separarse en «para aprender» y «para simular». Hoy `QUIZ` sólo admite una respuesta entre 3–4 opciones y no sabe de certificaciones; `AUDIT` no tiene reproductor.

---

## 1. Objetivo

Al cerrar el sprint:

- existe un registro de certificaciones con versión, formato y dominios **comprobados en la guía oficial**;
- un `QUIZ` puede ser de respuesta única, múltiple, de ordenar o de emparejar, y se corrige en servidor;
- cada ejercicio de la ruta AWS declara certificación, dominio, tarea y banco (`unit` o `reserved`), y el banco reservado nunca aparece en unidades ni laboratorio;
- `AUDIT` se juega y se corrige (defectos reales, falsos positivos penalizados);
- una guarda de calidad aplica las reglas de redacción de [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §5 que se pueden comprobar por máquina.

## 2. Decisiones de diseño

**2.1 Las guías oficiales mandan.** Antes de codificar dominios, una persona abre cada guía de examen y registra versión, formato, dominios, pesos y tareas en `docs/02-contenido/aws-guias-examen.md` (T0). El registro de `shared` copia ese documento; nada se escribe de memoria. (`docs.aws.amazon.com` rechaza la lectura automatizada: la verificación es humana.)

**2.2 Respuesta múltiple: todo o nada.** Como en los exámenes de AWS, una pregunta «selecciona DOS» sólo es correcta si se eligen exactamente las correctas. Cada opción conserva su explicación propia.

**2.3 Metadatos como columnas, no dentro de `config`.** `certification`, `examDomain`, `examTask` y `examPool` se guardan en columnas indexadas de `Exercise`: el simulador (S15) arma formas por dominio con consultas, no leyendo JSON.

**2.4 El banco reservado es invisible hasta el simulacro.** Los endpoints de unidad, laboratorio y repaso excluyen `examPool = RESERVED`. Sólo el motor de S15 los lee.

**2.5 `AUDIT` se corrige con hallazgos declarados.** El estudiante marca líneas o hallazgos candidatos, elige severidad y decide (aceptar / corregir / descartar). La nota pondera defectos encontrados y penaliza falsos positivos; el elemento «correcto que parece sospechoso» es obligatorio en la semilla.

## 3. Contratos previstos (resumen; la ficha los fija al detalle)

```ts
// packages/shared/src/schemas/certification.ts
export const CERTIFICATION_CODES = ["CLF-C02", "SAA-C03", "DVA-C03", "SOA-C03", "DOP-C02", "SAP-C03",
  "AIF-C01", "AIP-C01", "SCS-C03", "DEA-C01", "MLA-C02"] as const;
export interface CertificationDefinition {
  code: CertificationCode; name: string; level: "foundational" | "associate" | "professional" | "specialty";
  stageId: number;                 // 101…111
  questionCount: number; durationMin: number; // formato oficial (T0)
  domains: readonly { id: number; name: string; weightPct: number | null }[]; // suma 100 si todos tienen peso
  availableFrom: string | null; retiresOn: string | null; // ISO, de la guía o del anuncio
  verifiedAt: string;              // fecha de la verificación humana (T0)
}

// Quiz en la semilla (compatibilidad: sin `kind` ⇒ "single")
type SeedQuiz =
  | { kind: "single"; options: Option[3..4]; correctOptionId: "a".."d" }
  | { kind: "multiple"; options: Option[5..6]; correctOptionIds: string[2..3]; selectCount: 2 | 3 }
  | { kind: "ordering"; items: { id; text }[3..6]; correctOrder: string[] }
  | { kind: "matching"; left: { id; text }[3..6]; right: { id; text }[3..6]; correctPairs: Record<string, string> };

// Metadatos de examen en el ejercicio sembrado
exam: { certification: CertificationCode; domain: number; task: string | null; pool: "unit" | "reserved" } | null
```

## 4. Tareas

> Fichas atómicas según [`../../05-orquestacion/plantilla-tarea.md`](../../05-orquestacion/plantilla-tarea.md), revisadas contra el código el 2026-11-09. **Orden obligatorio** en §7. T0 está hecha (commit 22da31e). T14 es del Orquestador.
>
> **Verificación común** (salvo que la ficha diga otra cosa), desde la raíz:
> ```bash
> npm run build -w packages/shared
> npm run typecheck
> npm run lint
> npm run test
> ```
> Resultado esperado: código de salida 0, 0 warnings y pruebas al 100 % en **todos** los workspaces. Antes de empezar cualquier tarea se anota la línea base (qué pasa y qué falla **antes** de tocar nada): hay tres archivos ajenos sin commit y pueden afectar a pruebas de la web. Si una prueba falla por algo ajeno a la tarea, se reporta y no se arregla. Si arreglar un fallo propio exige tocar un archivo fuera de la lista, **detenerse y reportar**.

### 4.0 Reglas fijas de todo el sprint

1. **Compatibilidad hacia atrás.** Los 1.662 quizzes de `fullstack-ia` no llevan `kind`. Sin `kind` ⇒ `single`. Un cuerpo `{ "optionId": "b" }` y una respuesta de quiz sin `kind` siguen siendo válidos hasta el final del sprint. Re-sembrar `fullstack-ia` debe dejar `config` y `solution` de esos quizzes **idénticos byte a byte**.
2. **Respuesta múltiple todo o nada.** Elegir una correcta de dos es fallar. El mismo criterio vale para ordenar y emparejar: sin crédito parcial.
3. **El banco `RESERVED` nunca sale** en unidad, laboratorio ni repaso (ni en el contexto del tutor de IA ni en el cálculo de «unidad completada»). Sólo lo leerá el motor de S15 con un método propio.
4. **Seguridad de la base de datos (T0b, T4 y toda verificación con base).** Sólo `localhost:5433`; nunca el puerto 5432 (es de otros proyectos); nunca `migrate reset`, `npm run db:reset`, `--force` ni aceptar un reset que `migrate dev` proponga; las migraciones se generan con `migrate dev --create-only` y se **revisa el SQL** antes de aplicarlas. Antes de cada comando de Prisma se comprueba el puerto de `DATABASE_URL`. Si el comando dice «modified after it was applied», **se detiene la tarea** y se reporta (ver `modelo-datos.md` §9).
5. **Cambios ajenos sin commit: no se tocan.** `apps/api/prisma/seed/content.seed.json`, `apps/web/src/features/lab/components/FlashcardPlayer.tsx` y `ReflectionPlayer.tsx` pertenecen a otra persona. Ninguna tarea los edita, los añade al índice, los restaura (`git checkout`/`stash`) ni los formatea. `git add` siempre por ruta explícita.
6. **Mensajes al usuario en español**, sin `any`, sin `TODO`, sin `console.log`.

### 4.1 Hallazgos al revisar el código (no estaban en el resumen)

| # | Hallazgo | Consecuencia |
|---|----------|--------------|
| H1 | `contentSeedQuizSchema` lo leen, además de `seed-lib.mts`, `apps/api/src/modules/ai/exercise-generator.service.ts` (`quizLengthProblems`, usa `quiz.correctOptionId`) y `apps/api/src/modules/content/seed-exercise-quality.spec.ts` (nueve usos). Al pasar a unión por `kind`, ambos dejan de compilar. | T2 declara excepción de 4 archivos. Entre T2 y T5, `npm run typecheck:seed -w apps/api` (y por tanto `db:seed`) no compila: T2, T3, T4 y T5 se hacen seguidas y no se siembra entre ellas. |
| H2 | `courseSeedUnitSchema` y `courseUnitFileSchema` usan `contentSeedExerciseSchema` tal cual. Sin tocarlos, `exam` se descartaría en silencio (Zod elimina claves desconocidas). | T3 crea `courseSeedExerciseSchema` y la usa en ambos. |
| H3 | `ZodValidationPipe` llama a `.strict()` si el esquema lo tiene; un esquema con `superRefine` (ZodEffects) no lo tiene y pasa tal cual. | El cuerpo de `quiz-answers` y de `audit-answers` se declara `.strict()` **dentro** del esquema. |
| H4 | `findPublished` lo usan también `UnitOpenGuard` y todos los endpoints de corrección. Si excluye `RESERVED`, el banco reservado queda inaccesible por id (bien en S14) pero S15 necesitará su propio método. | T8a lo documenta; S15 añade `findReserved`. |
| H5 | «Unidad completada» cuenta ejercicios publicados: `PrismaProgressRepository.countPublishedExercises` y `countCompletedExercises`. Un ejercicio `RESERVED` bloquearía para siempre la unidad. | T8b filtra también ahí. |
| H6 | El tutor de IA lee los ejercicios de la unidad con su solución (`prisma-ai.repository.ts`, `UNIT_SELECT`). Un `RESERVED` filtraría respuestas del simulacro. | T8c filtra ahí y en el repaso (`listDue`, `countDue`). |
| H7 | Un `AUDIT` hoy cae en el laboratorio de código (`ExercisePlayer` sólo despacha `QUIZ`, `FLASHCARD`, `MEMORY`, `REFLECT`). Y la semilla no escribe `config`/`solution` de `AUDIT`: `exerciseConfig` y `exerciseSolution` sólo conocen quiz, memoria y tarjeta. | T10b (nueva): `seed-lib.mts` para `AUDIT`, tras T5. |
| H8 | Los datos de examen no cubren «tareas» por dominio (el documento sólo cita la tarea 2.3 de DVA-C03). | `examTask` se valida por formato y por su número de dominio, no contra una lista. |
| H9 | `QuizAndFlashcardPlayers.spec.tsx` prueba a la vez `QuizPlayer` y `FlashcardPlayer` (uno de los archivos ajenos). | Ninguna tarea edita ese spec: `QuizPlayer` conserva su contrato actual y las pruebas nuevas van en archivos nuevos. |
| H10 | `apps/api/prisma/seed/aws/units/` aún no existe: la guarda de calidad (T13) correría en vacío. | T13 prueba sus funciones con ejemplos sintéticos dentro del propio spec. |

### 4.2 Índice

| ID | Tarea | Archivos | Depende de |
|----|-------|----------|------------|
| T0 | Verificar las 11 guías oficiales | `aws-guias-examen.md` | ✅ 2026-11-09 (commit 22da31e): 10/11 exámenes verificados; MLA-C02 sigue en beta |
| T0b | Finales de línea de las migraciones (investigación) | 0 (informe) | — |
| T1 | Registro de certificaciones en `shared` | 3 | T0 |
| T2 | Variantes de quiz en la semilla | 4 (excepción) | — |
| T3 | Metadatos `exam` en el ejercicio sembrado | 2 | T1, T2 |
| T4 | Columnas de examen y migración | 2 | T0b |
| T5 | La semilla escribe metadatos y variantes | 1 | T2, T3, T4 |
| T6 | Contrato de envío y resultado de quiz | 2 | T2 |
| T7a | Corrector puro de quizzes | 2 | T6 |
| T7b | Servicio y controlador usan el corrector | 3 | T7a |
| T8a | Banco reservado fuera de ejercicios y laboratorio | 4 (excepción) | T4 |
| T8b | Banco reservado fuera de unidad y progreso | 3 | T8a |
| T8c | Banco reservado fuera de repaso y tutor de IA | 3 | T8a |
| T9a | Cliente web: enviar cualquier quiz | 2 | T7b |
| T9b | `QuizPlayer`: respuesta múltiple | 3 | T9a |
| T9c | `QuizPlayer`: ordenar | 3 | T9b |
| T9d | `QuizPlayer`: emparejar | 3 | T9c |
| T10 | Esquema de `AUDIT` en la semilla | 2 | T2 |
| T10b | La semilla escribe `AUDIT` | 1 | T5, T10 |
| T11a | Contrato de `audit-answers` | 2 | T10 |
| T11b | Corrector puro de `AUDIT` | 2 | T11a |
| T11c | `POST /api/exercises/:id/audit-answers` | 3 | T11b, T8a |
| T12a | Cliente web: enviar una auditoría | 2 | T11c |
| T12b | `AuditPlayer` | 2 | T12a |
| T12c | `ExercisePlayer` despacha `AUDIT` | 2 | T12b |
| T13 | Guarda de calidad de preguntas AWS | 1 | T3, T5 |
| T14 | Documentación | docs | Orquestador |

---

### S14-T0b — Finales de línea de las migraciones (investigación con propuesta)

| Campo | Valor |
|-------|-------|
| **Depende de** | — (debe cerrarse **antes** de T4) |
| **Archivos** | Ninguno del repositorio. El entregable es un informe. Sólo si el Orquestador aprueba la propuesta se crea después `.gitattributes` (raíz), en un paso aparte |

**Contexto mínimo.** Es la deuda declarada en `sprint-13-multi-ruta.md` §6 («Finales de línea de las migraciones») y en `modelo-datos.md` §9. El repositorio tiene `core.autocrlf=true` y no tiene `.gitattributes`. Prisma (6.19.3 en este proyecto) guarda en `_prisma_migrations.checksum` el hash del `migration.sql` y `migrate dev` lo vuelve a comparar con el archivo. Estado actual del árbol (`git ls-files --eol apps/api/prisma/migrations`): todos los `migration.sql` tienen `i/lf`; en el disco, `20261028170000_interviews` está en `w/crlf` y el resto en `w/lf`. Según S13, en la base local `interviews` y `courses` se aplicaron con CRLF y las demás con LF; hoy `courses` está en LF en el disco. Hay que saber, con evidencia, si eso importa.

**Qué hay que averiguar**
1. ¿Prisma 6.19.3 calcula el checksum sobre los bytes tal cual (CRLF y LF dan hashes distintos) o normaliza los finales de línea?
2. Si no normaliza: ¿qué `.gitattributes` evita el problema sin romper las migraciones ya aplicadas en la base local?

**Procedimiento (todo en una base desechable; no se conecta a `localhost:5433` en ningún momento)**

```bash
# 0. Base desechable en el puerto 5441 (la de S13 usó 5440)
docker run -d --name codeai-t0b-pg -e POSTGRES_USER=t0b -e POSTGRES_PASSWORD=t0b -e POSTGRES_DB=t0b -p 5441:5432 postgres:16-alpine

# 1. Copia de trabajo FUERA del repositorio (carpeta temporal de la sesión)
mkdir -p "$SCRATCH/t0b" && cp -r apps/api/prisma/schema.prisma apps/api/prisma/migrations "$SCRATCH/t0b/"

# 2. En CADA comando de Prisma: URL de la base desechable, y se comprueba antes
export DATABASE_URL="postgresql://t0b:t0b@localhost:5441/t0b?schema=public"
case "$DATABASE_URL" in *":5441/"*) ;; *) echo "puerto equivocado"; exit 1;; esac
cd apps/api && npx prisma migrate status --schema "$SCRATCH/t0b/schema.prisma"   # debe nombrar localhost:5441
```

Experimentos mínimos (se registran la orden y la salida de cada uno):
- **A.** `migrate deploy` con todos los archivos en LF. Leer `select migration_name, checksum from _prisma_migrations order by 1` dentro del contenedor (`docker exec codeai-t0b-pg psql -U t0b -d t0b -c "…"`) y compararlo con `sha256sum` de cada archivo en LF y con `sha256sum` de su versión CRLF (`sed 's/$/\r/'` sobre una copia). Eso responde si el hash es de los bytes o del texto normalizado.
- **B.** Con la base de A aplicada, convertir en la copia `20261028170000_interviews/migration.sql` a CRLF y ejecutar `prisma migrate status`, `prisma migrate deploy` y `prisma migrate dev --create-only --name probe` (la base desechable sirve de sombra; borrar después la carpeta `probe` de la copia). Anotar si aparece «modified after it was applied» o no.
- **C.** El caso inverso: recrear el contenedor, aplicar `interviews` y `courses` en CRLF y el resto en LF (el estado local descrito por S13), pasar luego los dos a LF y repetir los tres comandos de B.
- **D.** Sólo si B o C fallan: probar el `.gitattributes` propuesto sobre una copia del árbol (clon temporal fuera del repositorio con `git clone`), comprobar con `git ls-files --eol` que los archivos quedan en el final de línea previsto y repetir B sobre el resultado.

**Entregable (en el reporte, sin crear archivos en `docs/`)**
1. Veredicto: «Prisma 6.19.3 **sí** / **no** normaliza los finales de línea», con la salida que lo prueba (checksums, mensajes).
2. Si **sí** normaliza: «no se necesita `.gitattributes`», y el texto exacto que el Orquestador pegará en `modelo-datos.md` §9 y en la deuda de S13.
3. Si **no** normaliza: el `.gitattributes` propuesto (candidato: `apps/api/prisma/migrations/**/migration.sql text eol=lf` y `apps/api/prisma/migrations/migration_lock.toml text eol=lf`), la demostración de D, y **qué le pasa a la base local real** si sus filas de `interviews` y `courses` guardan el hash de CRLF: lista de alternativas (excepciones `eol=crlf` por archivo para esas dos migraciones, o corregir el checksum de esas dos filas) con su riesgo. Incluye la consulta de **solo lectura** que una persona ejecutará contra la base local para decidirlo, junto con los `sha256sum` de los archivos actuales: `select migration_name, checksum from "_prisma_migrations" order by migration_name;`. El ejecutor **no** la lanza.
4. Limpieza hecha: `docker rm -f codeai-t0b-pg`, copia temporal borrada.

**Criterios de aceptación**
- [ ] Ningún comando de Prisma se ejecutó con `DATABASE_URL` distinto del puerto 5441; el reporte lo evidencia (salida de `migrate status` con `localhost:5441`).
- [ ] `git status` al terminar muestra exactamente los mismos tres archivos modificados de antes y nada más (no queda `.gitattributes` ni cambios en migraciones).
- [ ] El veredicto se apoya en los experimentos A y B (o C), con la salida pegada.
- [ ] El contenedor `codeai-t0b-pg` ya no existe (`docker ps -a`).

**Qué NO hacer:** no crear ni editar `.gitattributes` (lo hace otro paso, sólo con aprobación del Orquestador); no tocar `apps/api/prisma/migrations`; no conectar con `localhost:5433` ni `5432`; no ejecutar `migrate reset`; no modificar `core.autocrlf`; no ejecutar `git add --renormalize`.

**Aplicación posterior (sólo si hay aprobación).** Un paso aparte, con un único archivo: crear `.gitattributes` en la raíz con el contenido aprobado, comprobar `git ls-files --eol apps/api/prisma/migrations` y `git status` (sin migraciones modificadas), y confirmar con una persona que `npx prisma migrate status` contra la base local sigue diciendo «Database schema is up to date!» antes de hacer commit.

---

### S14-T1 — Registro de certificaciones en `shared`

| Campo | Valor |
|-------|-------|
| **Depende de** | T0 (ya hecha) |
| **Archivos** | `packages/shared/src/schemas/certification.ts` (crear) · `packages/shared/src/schemas/certification.spec.ts` (crear) · `packages/shared/src/index.ts` (modificar: una línea `export * from "./schemas/certification";` en orden alfabético, después de `./schemas/auth`) |

**Contexto mínimo.** `docs/02-contenido/aws-guias-examen.md` es la fuente única: ningún dato se escribe de memoria. Los 11 exámenes tienen datos oficiales verificados, salvo MLA-C02, que sigue en beta. Los identificadores de etapa 101–111 existen ya (`COURSE_REGISTRY["aws-cloud"]`, ids 100–112). El registro copia la tabla de abajo; si la tabla y el documento difieren, manda el documento y se reporta.

**Contrato**

```ts
import { z } from "zod";

export const CERTIFICATION_CODES = [
  "CLF-C02", "SAA-C03", "DVA-C03", "SOA-C03", "DOP-C02", "SAP-C03",
  "AIF-C01", "AIP-C01", "SCS-C03", "DEA-C01", "MLA-C02",
] as const;
export type CertificationCode = (typeof CERTIFICATION_CODES)[number];
export const certificationCodeSchema = z.enum(CERTIFICATION_CODES);

export const CERTIFICATION_LEVELS = ["foundational", "associate", "professional", "specialty"] as const;
export type CertificationLevel = (typeof CERTIFICATION_LEVELS)[number];

/** Tipos de ítem del examen real. */
export const EXAM_ITEM_TYPES = ["single", "multiple", "ordering", "matching"] as const;
export type ExamItemType = (typeof EXAM_ITEM_TYPES)[number];

export interface ExamDomain {
  readonly id: number;          // 1…6, como en la guía
  readonly name: string;        // nombre oficial en inglés, tal cual la guía
  readonly weightPct: number;   // % of scored content; los dominios de un examen suman 100
}

export interface CertificationDefinition {
  readonly code: CertificationCode;
  readonly name: string;                 // nombre oficial en inglés
  readonly level: CertificationLevel;
  readonly stageId: number;              // 101…111
  readonly status: "ga" | "beta";
  readonly questionCount: number;        // total del examen (puntuadas + no puntuadas)
  readonly scoredQuestionCount: number | null; // null = 🔎 (MLA-C02 beta)
  readonly durationMin: number;
  readonly passingScore: number;         // escala 100–1000
  readonly itemTypes: readonly ExamItemType[];            // los que lista la guía vigente
  readonly unconfirmedItemTypes: readonly ExamItemType[]; // AIP-C01: las dos fuentes oficiales difieren
  readonly availableFrom: string | null; // ISO; fecha de entrada en uso de esta versión, si la fuente la da
  readonly retiresOn: string | null;     // ISO; ninguna de las 11 versiones tiene fecha de retiro publicada
  readonly guideUrl: string;
  readonly verifiedAt: string;           // "2026-11-09"
  readonly domains: readonly ExamDomain[];
}

export const CERTIFICATION_REGISTRY: Readonly<Record<CertificationCode, CertificationDefinition>>;
export function certificationForStageId(stageId: number): CertificationDefinition | null;
export function isExamDomainOf(code: CertificationCode, domainId: number): boolean;
/** "2.3" pertenece al dominio 2. Formato: dos números enteros separados por un punto. */
export function examTaskBelongsToDomain(task: string, domainId: number): boolean;
```

**Datos que se copian** (prefijo de `guideUrl`: `https://docs.aws.amazon.com/pdfs/aws-certification/latest/`):

| Código | Etapa | Nivel | Preguntas (puntuadas) | Min | Aprobado | Tipos | `availableFrom` | Dominios (id · peso) | Fragmento final de `guideUrl` |
|--------|-------|-------|-----------------------|-----|----------|-------|-----------------|----------------------|-------------------------------|
| CLF-C02 | 101 | foundational | 65 (50) | 90 | 700 | single, multiple | null | 1·24 · 2·30 · 3·34 · 4·12 | `cloud-practitioner-02/cloud-practitioner-02.pdf` |
| SAA-C03 | 102 | associate | 65 (50) | 130 | 720 | single, multiple | null | 1·30 · 2·26 · 3·24 · 4·20 | `solutions-architect-associate-03/solutions-architect-associate-03.pdf` |
| DVA-C03 | 103 | associate | 65 (50) | 130 | 720 | single, multiple | 2026-12-01 | 1·30 · 2·26 · 3·22 · 4·22 | `developer-associate-03/developer-associate-03.pdf` |
| SOA-C03 | 104 | associate | 65 (50) | 130 | 720 | single, multiple | 2025-09-30 | 1·22 · 2·22 · 3·22 · 4·16 · 5·18 | `sysops-administrator-associate-03/sysops-administrator-associate-03.pdf` |
| DOP-C02 | 105 | professional | 75 (65) | 180 | 750 | single, multiple | null | 1·22 · 2·17 · 3·15 · 4·15 · 5·14 · 6·17 | `devops-engineer-professional-02/devops-engineer-professional-02.pdf` |
| SAP-C03 | 106 | professional | 75 (65) | 180 | 720 | single, multiple | 2026-11-17 | 1·25 · 2·25 · 3·15 · 4·15 · 5·20 | `solutions-architect-professional-03/solutions-architect-professional-03.pdf` |
| AIF-C01 | 107 | foundational | 65 (50) | 90 | 700 | single, multiple, ordering, matching | null | 1·20 · 2·24 · 3·28 · 4·14 · 5·14 | `ai-practitioner-01/ai-practitioner-01.pdf` |
| AIP-C01 | 108 | professional | 75 (65) | 180 | 750 | single, multiple; **sin confirmar:** ordering, matching | null | 1·31 · 2·26 · 3·20 · 4·12 · 5·11 | `ai-professional-01/ai-professional-01.pdf` |
| SCS-C03 | 109 | specialty | 65 (50) | 170 | 750 | single, multiple, ordering, matching | 2025-12-02 | 1·16 · 2·14 · 3·18 · 4·20 · 5·18 · 6·14 | `security-specialty-03/security-specialty-03.pdf` |
| DEA-C01 | 110 | associate | 65 (50) | 130 | 720 | single, multiple | null | 1·34 · 2·26 · 3·22 · 4·18 | `data-engineer-associate-01/data-engineer-associate-01.pdf` |
| MLA-C02 | 111 | associate | **beta: 85 (`null`)** | **beta: 170** | 720 | single, multiple | 2027-01-14 (GA) | 1·28 · 2·24 · 3·24 · 4·24 | `machine-learning-engineer-associate-02/machine-learning-engineer-associate-02.pdf` |

Los nombres de código, de examen y de dominio se copian **literalmente** de las secciones 2.1–2.11 del documento. `status` es `"beta"` sólo en MLA-C02. `retiresOn` es `null` en las 11 (ninguna fuente da retiro para estas versiones). `verifiedAt` es `"2026-11-09"` en las 11.

**Criterios de aceptación**
- [ ] `CERTIFICATION_REGISTRY` tiene exactamente las 11 claves de `CERTIFICATION_CODES`, y cada `stageId` es único y vale 100 + la posición del código (101…111).
- [ ] Cada examen suma 100 en sus `weightPct` (prueba por examen) y su número de dominios coincide con la columna «Dominios» de la tabla resumen del documento (4, 4, 4, 5, 6, 5, 5, 5, 6, 4, 4).
- [ ] Una prueba lee `docs/02-contenido/aws-guias-examen.md` con `node:fs` (ruta relativa a `__dirname`: `../../../../docs/02-contenido/aws-guias-examen.md`), extrae por sección `### 2.N CÓDIGO` las filas de la tabla de dominios y comprueba que **número de dominios y pesos** coinciden con el registro. Si `node:fs` no resuelve tipos en `packages/shared` (`npm run typecheck -w packages/shared`), **detenerse y reportar** (no se instala `@types/node`).
- [ ] `certificationForStageId(101)?.code === "CLF-C02"`, `certificationForStageId(100) === null`, `certificationForStageId(112) === null`, `certificationForStageId(2.5) === null`.
- [ ] `isExamDomainOf("CLF-C02", 4) === true`, `isExamDomainOf("CLF-C02", 5) === false`; `examTaskBelongsToDomain("2.3", 2) === true`, `("2.3", 3) === false`, `("x.y", 2) === false`, `("2", 2) === false`.
- [ ] MLA-C02: `status "beta"`, `questionCount 85`, `durationMin 170`, `scoredQuestionCount null`; AIP-C01: `unconfirmedItemTypes` contiene `ordering` y `matching`.
- [ ] Verificación común en verde.

**Qué NO hacer:** no traducir nombres de dominio; no inventar la fecha de retiro ni el reparto de MLA-C02 (queda `null`); no añadir campos de tareas por dominio (el documento no las registra); no tocar `docs/`.

---

### S14-T2 — Variantes de quiz en la semilla

| Campo | Valor |
|-------|-------|
| **Depende de** | — |
| **Archivos** | `packages/shared/src/schemas/content.ts` (modificar) · `packages/shared/src/schemas/content-exercise.spec.ts` (modificar) · `apps/api/src/modules/ai/exercise-generator.service.ts` (modificar) · `apps/api/src/modules/content/seed-exercise-quality.spec.ts` (modificar). **Excepción declarada:** 4 archivos, porque pasar `quiz` a unión rompe la compilación de los dos consumidores (H1) y arreglarlos es parte del mismo cambio de tipo |

**Contexto mínimo.** `contentSeedQuizSchema` (hoy un `z.object` con `options` de 3 a 4 y `correctOptionId`) alimenta `contentSeedExerciseSchema.quiz`, `exerciseRuleViolations` (rama `QUIZ`, líneas ~562–580), `exerciseDraftSchema` (autoría con IA) y `courseSeedSchema` vía `exerciseRuleViolations`. Los 1.662 quizzes de `content.seed.json` sólo traen `options` y `correctOptionId` (comprobado). `ContentSeedExercise` es la salida de `z.infer`: `kind` debe existir en la salida, nunca exigirse en la entrada.

**Contrato**

```ts
export const QUIZ_KINDS = ["single", "multiple", "ordering", "matching"] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];

// Entrada sin `kind` ⇒ "single" (z.preprocess que añade kind: "single" si la clave falta en un objeto plano)
export const contentSeedQuizSchema = z.preprocess(addDefaultQuizKind, z.discriminatedUnion("kind", [
  singleQuiz, multipleQuiz, orderingQuiz, matchingQuiz,
]));
export type ContentSeedQuiz = z.infer<typeof contentSeedQuizSchema>;
```

| `kind` | Campos (todo lo demás es error) | Límites |
|--------|---------------------------------|---------|
| `single` | `options: {id, text, explanation}[]`, `correctOptionId` | ids `/^[a-d]$/`, 3–4 opciones; **mensajes de error actuales sin cambios** («Un quiz ofrece de 3 a 4 opciones», «El id de opción es una letra a–d») |
| `multiple` | `options: {id, text, explanation}[]`, `selectCount: 2 \| 3`, `correctOptionIds: string[]` | ids `/^[a-f]$/`, 5–6 opciones («Un quiz de respuesta múltiple ofrece de 5 a 6 opciones»), 2–3 correctas |
| `ordering` | `items: {id, text, explanation}[]`, `correctOrder: string[]` | ids `/^[a-f]$/`, 3–6 elementos |
| `matching` | `left: {id, text, explanation}[]`, `right: {id, text}[]`, `correctPairs: Record<leftId, rightId>` | `left` ids `/^[a-f]$/` 3–6; `right` ids `/^[1-6]$/` 3–6 |

(Decisión de diseño sobre el resumen de §3: `ordering` y `matching` llevan `explanation` por elemento, para cumplir «explicación por opción» de `metodo-aws.md` §5.3; en `matching` la explicación va en el elemento de la izquierda y explica por qué su pareja es esa.)

**Reglas nuevas de `exerciseRuleViolations`** (cada una con su mensaje exacto; las de `single` no cambian):

| Variante | Mensajes |
|----------|----------|
| `multiple` | «las opciones repiten id» · «las opciones correctas deben existir» · «correctOptionIds repite opciones» · «selectCount debe coincidir con el número de opciones correctas» · «prohibido verdadero/falso» · «prohibido «todas/ninguna de las anteriores»» (sobre los textos de las opciones) |
| `ordering` | «los elementos repiten id» · «correctOrder debe contener cada elemento exactamente una vez» · «los elementos no pueden venir ya en el orden correcto» (el orden de `items` no puede ser igual a `correctOrder`: se serviría resuelto) |
| `matching` | «los elementos de la izquierda repiten id» · «los elementos de la derecha repiten id» · «debe haber tantos elementos a la derecha como a la izquierda» · «correctPairs debe emparejar cada elemento de la izquierda» · «las parejas deben apuntar a elementos de la derecha, sin repetir» · «las parejas no pueden venir ya alineadas» (que `left[i]` ↔ `right[i]` para todo `i` se serviría resuelto) |

Se mantiene «un QUIZ requiere quiz (opciones y respuesta)» y «solo un QUIZ declara quiz».

**Consumidores que se adaptan (mínimo cambio)**
- `exercise-generator.service.ts`, `quizLengthProblems`: tras `if (quiz === null) return [];` añadir `if (quiz.kind !== "single") return ["el generador sólo produce quizzes de respuesta única"];`. Nada más.
- `seed-exercise-quality.spec.ts`: en cada bucle que lee `exercise.quiz`, estrechar con `if (quiz === null || quiz.kind !== "single") continue;` (o el equivalente en el `filter`/`map` de «reparte la respuesta correcta»). Y una prueba nueva: «los quizzes de `fullstack-ia` son todos de respuesta única» (`kind === "single"` en todos y, como mínimo, 1.662 quizzes). El archivo **lee** `content.seed.json` (ajeno, modificado): no se edita.

**Criterios de aceptación**
- [ ] Un quiz sin `kind` (como los del seed) se parsea y su salida tiene `kind: "single"`; el mismo quiz con `kind: "single"` explícito también.
- [ ] Un ejemplo válido por variante pasa `contentSeedExerciseSchema` y `exerciseRuleViolations` devuelve `[]`.
- [ ] Una prueba por cada mensaje de la tabla de reglas.
- [ ] Un `multiple` con 4 opciones, uno con `selectCount: 4` y un `matching` con 7 elementos fallan en el esquema.
- [ ] Las pruebas existentes de `content-exercise.spec.ts` pasan **sin modificarlas** (si alguna necesita cambio, detenerse y reportar).
- [ ] `npm run test -w apps/api` pasa, incluida la prueba de que todo el seed sigue siendo `single`.
- [ ] `git diff --stat` no incluye `content.seed.json`, `FlashcardPlayer.tsx` ni `ReflectionPlayer.tsx`.
- [ ] Verificación común en verde, salvo `npm run typecheck:seed -w apps/api`, que queda **rojo hasta T5** (esperado, H1); el reporte lo dice.

**Qué NO hacer:** no tocar `seed-lib.mts` (es T5); no renombrar `correctOptionId`; no cambiar los mensajes actuales de `single`; no añadir `exam` ni `audit`.

---

### S14-T3 — Metadatos `exam` en el ejercicio sembrado

| Campo | Valor |
|-------|-------|
| **Depende de** | T1, T2 |
| **Archivos** | `packages/shared/src/schemas/course-seed.ts` (modificar) · `packages/shared/src/schemas/course-seed.spec.ts` (modificar) |

**Contexto mínimo.** `courseSeedUnitSchema` (hereda `exercises` de `contentSeedUnitSchema`) y `courseUnitFileSchema.exercises` usan `contentSeedExerciseSchema`, que descartaría `exam` en silencio (H2). `courseSeedSchema.superRefine` ya valida competencias de la ruta (`isCompetencyOfCourse`) y llama a `exerciseRuleViolations`: **no se duplica**. `contentSeedSchema` (la ruta por defecto) no cambia: `exam` es sólo de las rutas secundarias. Para el bucle `stage` → `exercise` ya se dispone de `stage.id`.

**Contrato**

```ts
import { certificationCodeSchema, certificationForStageId, isExamDomainOf, examTaskBelongsToDomain } from "./certification";

export const EXAM_POOLS = ["unit", "reserved"] as const;
export const courseSeedExamSchema = z.object({
  certification: certificationCodeSchema,
  domain: z.number().int().min(1).max(6),
  task: z.string().regex(/^\d{1,2}\.\d{1,2}$/, "La tarea es «dominio.tarea», por ejemplo 1.2").nullable().default(null),
  pool: z.enum(EXAM_POOLS).default("unit"),
}).strict();
export type CourseSeedExam = z.infer<typeof courseSeedExamSchema>;

export const courseSeedExerciseSchema = contentSeedExerciseSchema.extend({
  exam: courseSeedExamSchema.nullable().default(null),
});
export type CourseSeedExercise = z.infer<typeof courseSeedExerciseSchema>;
// courseSeedUnitSchema.exercises y courseUnitFileSchema.exercises pasan a z.array(courseSeedExerciseSchema).default([])
```

**Reglas nuevas en `courseSeedSchema.superRefine`** (cada una con `fail(mensaje, ruta del ejercicio)`; `X` = slug del ejercicio):

| # | Regla | Mensaje |
|---|-------|---------|
| 1 | Con `exam`, `certificationForStageId(stage.id)?.code === exam.certification` | `Ejercicio X: la certificación ${code} no corresponde a la etapa ${stage.id}` |
| 2 | Con `exam`, `isExamDomainOf(code, exam.domain)` | `Ejercicio X: el dominio ${d} no existe en ${code}` |
| 3 | Con `exam.task`, `examTaskBelongsToDomain(task, domain)` | `Ejercicio X: la tarea ${t} no pertenece al dominio ${d}` |
| 4 | Un `QUIZ` en una etapa con certificación (101–111) declara `exam` | `Ejercicio X: un QUIZ de la etapa ${stage.id} requiere exam` |
| 5 | Sólo un `QUIZ` declara `exam` | `Ejercicio X: solo un QUIZ declara exam` |

(Decisión: obligatorio para los `QUIZ` de las etapas 101–111; A0 y A12 no tienen certificación y sus ejercicios no declaran `exam`. Las tarjetas, memorias, etc. no son preguntas de examen. Si el Orquestador quiere ampliarlo, cambia la regla 4/5, no el contrato.)

**Criterios de aceptación**
- [ ] Un `QUIZ` de la etapa 102 con `exam: { certification: "SAA-C03", domain: 1, task: "1.2", pool: "unit" }` pasa; sin `exam`, falla con el mensaje de la regla 4.
- [ ] Una prueba por regla 1, 2, 3 y 5 con su mensaje exacto.
- [ ] `exam` sin `pool` queda en `"unit"`; sin `task`, en `null`.
- [ ] `mergeCourseSeed` conserva `exam` al fusionar un archivo de unidad (prueba con un archivo que lo trae).
- [ ] Un `QUIZ` de la etapa 100 sin `exam` pasa; con `exam`, falla por la regla 1.
- [ ] Las pruebas existentes de `course-seed.spec.ts` pasan sin modificarlas. Los quizzes de ejemplo que ya tengan en etapas 101–111 y rompan la regla 4 se actualizan **añadiendo `exam`** (lo reporta).
- [ ] Verificación común en verde, salvo `typecheck:seed` (rojo hasta T5).

**Qué NO hacer:** no tocar `content.ts`; no validar `task` contra una lista (H8); no exigir `exam` fuera de `QUIZ`; no duplicar la validación de competencias.

---

### S14-T4 — Columnas de examen y migración

| Campo | Valor |
|-------|-------|
| **Depende de** | T0b (resuelta) |
| **Archivos** | `apps/api/prisma/schema.prisma` (modificar) · `apps/api/prisma/migrations/<timestamp>_exam_metadata/migration.sql` (crear con `--create-only`) |

**Seguridad de la base de datos (obligatoria, antes de cualquier comando).**
1. `DATABASE_URL` apunta a `localhost:5433` (comprobarlo con `grep DATABASE_URL apps/api/.env`, **sin imprimir la contraseña** en el reporte). Si el puerto es otro, **detenerse**. Nunca 5432.
2. `npm run db:backup` y anotar el nombre del archivo.
3. `npx prisma migrate status` (desde `apps/api`) debe decir «Database schema is up to date!». Si dice «modified after it was applied» o propone un reset: **detenerse y reportar**. Nunca aceptar un reset.
4. Prohibido `migrate reset`, `npm run db:reset`, `--force`, `db push`, y borrar filas de `_prisma_migrations`.
5. Se genera con `npx prisma migrate dev --create-only --name exam_metadata` (desde `apps/api`), se **lee el SQL** y sólo entonces se aplica con `npm run db:migrate`.

**Contexto mínimo.** `model Exercise` (≈ línea 231 de `schema.prisma`) tiene `@@index([unitId, type])` y `@@index([isPublished])`. Ninguna migración anterior toca estas columnas. Las filas existentes (más de 3.200 ejercicios en `fullstack-ia` y los de la ruta AWS que existan) deben quedar con `examPool = 'UNIT'` y las otras tres columnas en `NULL`.

**Contrato (Prisma)**

```prisma
/// Banco al que pertenece una pregunta de examen. `RESERVED` sólo lo lee el motor de simulacros (S15).
enum ExamPool {
  UNIT
  RESERVED
}
```

En `model Exercise`, después de `reviewedByHuman`:

```prisma
  /// Código de la certificación ("SAA-C03"). Sólo en preguntas de examen de la ruta AWS.
  certification String?
  /// Dominio de la guía oficial (1…6).
  examDomain    Int?
  /// Tarea de la guía ("1.2"), si la guía la define.
  examTask      String?
  examPool      ExamPool @default(UNIT)
```

y junto a los índices existentes: `@@index([certification, examDomain, examPool])`.

**SQL esperado** (Prisma ordena las columnas alfabéticamente; se revisa que sea esto y nada más):

```sql
-- CreateEnum
CREATE TYPE "ExamPool" AS ENUM ('UNIT', 'RESERVED');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "certification" TEXT,
ADD COLUMN     "examDomain" INTEGER,
ADD COLUMN     "examPool" "ExamPool" NOT NULL DEFAULT 'UNIT',
ADD COLUMN     "examTask" TEXT;

-- CreateIndex
CREATE INDEX "Exercise_certification_examDomain_examPool_idx" ON "Exercise"("certification", "examDomain", "examPool");
```

**Criterios de aceptación**
- [ ] `npx prisma validate` y `npx prisma format` (sin diferencias) en `apps/api`.
- [ ] El SQL generado coincide con el esperado: no contiene `DROP`, `DELETE`, `UPDATE`, `TRUNCATE` ni cambios en otras tablas.
- [ ] `npm run db:migrate` aplica la migración sobre la base con datos; `npx prisma migrate status` dice «Database schema is up to date!» y lista una migración más que antes (13 aplicadas).
- [ ] Consulta de sólo lectura: `select "examPool", count(*) from "Exercise" group by 1;` devuelve una sola fila `UNIT` con el total anterior (`3203` en `fullstack-ia` más los de AWS si existen); `select count(*) from "Exercise" where certification is not null` devuelve 0.
- [ ] `npm run db:generate` regenera el cliente (si falla con `EPERM` porque el servidor de desarrollo tiene abierto el motor, se reporta; los tipos sí se regeneran).
- [ ] `npm run db:seed` sigue diciendo «12 etapas (12 publicadas), 48 módulos, 207 unidades, 3203 ejercicios» (si T2 ya está hecha y `typecheck:seed` está rojo, esta comprobación se hace en T5).
- [ ] Verificación común en verde (salvo `typecheck:seed`).
- [ ] Un solo commit para la migración (`modelo-datos.md` §9: «cada migración va en su propio commit»).

**Qué NO hacer:** no editar la migración generada salvo que el SQL difiera del esperado (entonces se detiene y se pregunta); no tocar otros modelos; no añadir `CHECK`; no aplicar la migración contra ninguna base que no sea `localhost:5433`; no tocar `.gitattributes` (es de T0b).

---

### S14-T5 — La semilla escribe los metadatos y la configuración de las variantes

| Campo | Valor |
|-------|-------|
| **Depende de** | T2, T3, T4 (y `npm run db:generate` ejecutado después de T4) |
| **Archivos** | `apps/api/prisma/seed/seed-lib.mts` (modificar) |

**Contexto mínimo** (líneas del archivo al 2026-11-09). `exerciseConfig(exercise)` (≈ 48) y `exerciseSolution(exercise)` (≈ 65) son funciones internas; `exerciseFields` (≈ 213) arma el `upsert` del ejercicio y se aplica igual en `create` y `update`. Los argumentos son `ContentSeedExercise`; las etapas AWS traen `CourseSeedExercise` (con `exam`). **Un quiz `single` debe producir exactamente lo mismo que hoy**, o se reescribirían los 1.662 quizzes (regla 1).

**Contrato**

```ts
type SeedExercise = ContentSeedExercise | CourseSeedExercise;

export function exerciseConfig(exercise: SeedExercise): Record<string, unknown>;   // pasa a exportarse
export function exerciseSolution(exercise: SeedExercise): Record<string, unknown> | undefined; // pasa a exportarse
export function examColumns(exercise: SeedExercise): {
  certification: string | null; examDomain: number | null; examTask: string | null; examPool: "UNIT" | "RESERVED";
};
```

| `quiz.kind` | `config` (se sirve al cliente) | `solution` (sólo servidor) |
|-------------|-------------------------------|----------------------------|
| `single` | `{ options: [{id, text}] }` — **sin `kind`**, igual que hoy | `{ correctOptionId, explanations: {id: explanation} }` — igual que hoy |
| `multiple` | `{ kind: "multiple", selectCount, options: [{id, text}] }` | `{ kind: "multiple", correctOptionIds, explanations }` |
| `ordering` | `{ kind: "ordering", items: [{id, text}] }` (en el orden del seed, que ya no es el correcto) | `{ kind: "ordering", correctOrder, explanations }` |
| `matching` | `{ kind: "matching", left: [{id, text}], right: [{id, text}] }` | `{ kind: "matching", correctPairs, explanations }` (`explanations` por id de `left`) |

`examColumns`: sin `exam` (o sin la clave `exam`, en `fullstack-ia`) → `{ certification: null, examDomain: null, examTask: null, examPool: "UNIT" }`; con `exam` → `certification`, `examDomain: exam.domain`, `examTask: exam.task`, `examPool: exam.pool === "reserved" ? "RESERVED" : "UNIT"`. Se lee `exam` con `"exam" in exercise`. `exerciseFields` añade `...examColumns(exercise)`.

**Criterios de aceptación**
- [ ] `npm run typecheck:seed -w apps/api` en 0 (vuelve a compilar tras T2).
- [ ] Un script temporal **fuera del repositorio** (carpeta temporal de la sesión) importa `seed-lib.mts`, llama a `exerciseConfig`, `exerciseSolution` y `examColumns` con un ejemplo de cada variante y de un `single` sin `kind`, e imprime los resultados; el reporte los pega y coinciden con la tabla. El script se borra.
- [ ] **Compatibilidad con la base real** (`localhost:5433`, ver regla 4): antes de tocar el código se guarda `select md5(string_agg(slug || config::text || coalesce(solution::text, ''), '' order by slug)) from "Exercise" where type = 'QUIZ' and certification is null;` y, tras `npm run db:seed` (dos veces), el valor es **idéntico**.
- [ ] `npm run db:seed` imprime «12 etapas (12 publicadas), 48 módulos, 207 unidades, 3203 ejercicios» y «Declarado en content.seed.json: 12 etapas, 48 módulos, 207 unidades.», sin el aviso de filas no declaradas.
- [ ] `npm run db:seed:aws` sigue en 13 etapas / 77 módulos / 262 unidades (sin cambios; la ruta no tiene ejercicios todavía).
- [ ] Verificación común en verde.

**Qué NO hacer:** no escribir `kind` en el `config` de los `single`; no añadir la rama de `AUDIT` (es T10b); no cambiar el orden de escritura, las claves de `upsert` ni los mensajes; no modificar `seed.mts`, `seed-course.mts` ni `content.seed.json`.

---

### S14-T6 — Contrato de envío y resultado de quiz

| Campo | Valor |
|-------|-------|
| **Depende de** | T2 |
| **Archivos** | `packages/shared/src/schemas/exercise.ts` (modificar) · `packages/shared/src/schemas/exercise.spec.ts` (modificar) |

**Contexto mínimo.** `quizAnswerSchema` (`{ optionId }`, letra a–d), `quizAnswerResultSchema` y `quizAnswerResponseSchema` los usan el controlador, el servicio y `exercisesApi.answerQuiz` de la web. **Esta tarea es aditiva**: esos tres nombres y sus tipos no cambian, para que API y web sigan compilando hasta T7b y T9a (H3: el esquema nuevo se declara `.strict()` por dentro).

**Contrato**

```ts
import { QUIZ_KINDS } from "./content";           // definido en T2
export const quizKindSchema = z.enum(QUIZ_KINDS);

/** Cuerpo de POST /api/exercises/:id/quiz-answers. Exactamente una clave. */
export const quizSubmissionSchema = z.object({
  optionId: z.string().regex(/^[a-d]$/, "La opción debe ser una letra de la a a la d").optional(), // single (idéntico al actual)
  optionIds: z.array(z.string().regex(/^[a-f]$/, "La opción debe ser una letra de la a a la f")).min(1).max(6).optional(), // multiple
  order: z.array(z.string().regex(/^[a-f]$/, "El elemento debe ser una letra de la a a la f")).min(3).max(6).optional(),   // ordering
  pairs: z.record(z.string().regex(/^[a-f]$/), z.string().regex(/^[1-6]$/)).optional(),                                  // matching
}).strict().superRefine(/* exactamente una de las cuatro claves; sin repetidos en optionIds ni en order */);
export type QuizSubmissionInput = z.infer<typeof quizSubmissionSchema>;

const explanationsSchema = z.record(z.string(), z.string().min(1));
export const quizGradeResultSchema = z.discriminatedUnion("kind", [
  quizAnswerResultSchema.extend({ kind: z.literal("single") }),
  z.object({ kind: z.literal("multiple"), correct: z.boolean(),
    correctOptionIds: z.array(z.string()).min(2).max(3), selectedOptionIds: z.array(z.string()).min(1).max(6),
    explanations: explanationsSchema }),   // explicación de cada opción elegida y de cada correcta
  z.object({ kind: z.literal("ordering"), correct: z.boolean(),
    correctOrder: z.array(z.string()).min(3).max(6), explanations: explanationsSchema }), // todos los elementos
  z.object({ kind: z.literal("matching"), correct: z.boolean(),
    correctPairs: z.record(z.string(), z.string()), explanations: explanationsSchema }),  // por id de la izquierda
]);
export type QuizGradeResult = z.infer<typeof quizGradeResultSchema>;
export const quizGradeResponseSchema = z.object({ result: quizGradeResultSchema });
export type QuizGradeResponse = z.infer<typeof quizGradeResponseSchema>;
```

Cuerpos válidos: `{"optionId":"b"}` · `{"optionIds":["b","e"]}` · `{"order":["c","a","b"]}` · `{"pairs":{"a":"2","b":"1","c":"3"}}`. Mensaje de la regla de «una sola clave»: «Envía exactamente una respuesta: optionId, optionIds, order o pairs».

**Criterios de aceptación**
- [ ] `quizAnswerSchema`, `quizAnswerResultSchema` y `quizAnswerResponseSchema` no cambian y sus pruebas actuales pasan sin modificarlas.
- [ ] `quizSubmissionSchema` acepta los cuatro cuerpos de arriba y `{ optionId: "b" }` produce el mismo objeto que `quizAnswerSchema`.
- [ ] Rechaza (cada uno con una prueba): cuerpo vacío, dos claves a la vez, `optionId: "e"`, `optionIds: ["a","a"]`, `order` con 2 elementos, `pairs` con valor `"7"`, una clave desconocida (`strict`).
- [ ] `quizGradeResultSchema` parsea un resultado de cada `kind` y rechaza uno sin `kind`.
- [ ] Verificación común en verde.

**Qué NO hacer:** no modificar el esquema actual de `optionId`; no tocar `apps/api` ni `apps/web`; no exigir `kind` en el cuerpo.

---

### S14-T7a — Corrector puro de quizzes

| Campo | Valor |
|-------|-------|
| **Depende de** | T6 |
| **Archivos** | `apps/api/src/modules/exercises/quiz-grading.ts` (crear) · `apps/api/src/modules/exercises/quiz-grading.spec.ts` (crear) |

**Contexto mínimo.** Hoy la corrección vive en `ExercisesService.answerQuiz` y en la función local `readQuiz` (`exercises.service.ts`, ≈ 120–160), que lee `exercise.config.options` y `exercise.solution.{correctOptionId, explanations}` y lanza `InternalServerErrorException("El ejercicio está mal configurado")` si algo no cuadra. T7a extrae esa lógica a una función pura y la extiende; **no toca el servicio** (T7b lo conecta). Formas de `config`/`solution`: la tabla de T5; sin `config.kind` ⇒ `single`.

**Contrato**

```ts
import type { QuizGradeResult, QuizSubmissionInput } from "@codeai/shared";

export const UNKNOWN_OPTION = "La opción no existe en este quiz";
export const WRONG_ANSWER_SHAPE = "La respuesta no corresponde al tipo de pregunta";
export const UNKNOWN_ITEM = "El elemento no existe en esta pregunta";
export const incompleteSelection = (count: number): string => `Selecciona exactamente ${count} opciones`;
export const INCOMPLETE_ORDER = "Ordena todos los elementos, sin repetir ninguno";
export const INCOMPLETE_PAIRS = "Empareja cada elemento con una opción distinta";

export type QuizGrading =
  | { readonly status: "graded"; readonly result: QuizGradeResult; readonly submissionCode: string }
  | { readonly status: "invalid-answer"; readonly message: string }   // el servicio responde 400 con este mensaje
  | { readonly status: "broken-content" };                            // el servicio responde 500 «El ejercicio está mal configurado»

export function gradeQuizAnswer(
  exercise: { readonly config: unknown; readonly solution: unknown },
  answer: QuizSubmissionInput,
): QuizGrading;
```

Reglas:
- **Todo o nada** en las cuatro variantes: `correct` sólo si el conjunto (múltiple), la secuencia (ordenar) o todas las parejas (emparejar) coinciden exactamente.
- `single`: igual que hoy. `result = { kind: "single", correct, correctOptionId, explanation: explanations[elegida], correctExplanation: explanations[correcta] }`.
- `multiple`: la respuesta debe traer `optionIds` con **exactamente** `selectCount` ids (si no: `invalid-answer` con `incompleteSelection(selectCount)`), todos existentes (si no: `UNKNOWN_OPTION`). `explanations` incluye las opciones elegidas **y** las correctas, ninguna más.
- `ordering`: `order` debe contener cada elemento exactamente una vez (si no: `INCOMPLETE_ORDER`; un id inexistente: `UNKNOWN_ITEM`). `explanations` incluye todos los elementos.
- `matching`: `pairs` debe tener una clave por cada elemento de la izquierda y valores distintos (si no: `INCOMPLETE_PAIRS`; ids inexistentes: `UNKNOWN_ITEM`). `explanations` por id de la izquierda.
- La respuesta debe corresponder al `kind` del ejercicio (`optionId` ↔ single, `optionIds` ↔ multiple, `order` ↔ ordering, `pairs` ↔ matching); si no: `WRONG_ANSWER_SHAPE`.
- `broken-content`: `config`/`solution` ausentes, ids de la solución que no están en `config`, o alguna explicación que falta.
- `submissionCode` (lo que se guarda en `Submission.code`): single `"b"`; multiple los ids ordenados unidos por coma `"b,e"`; ordering `"c>a>b"`; matching las parejas ordenadas por clave `"a=2,b=1,c=3"`.
- No se revela nada antes de corregir: la función sólo se llama con una respuesta ya recibida.

**Criterios de aceptación**
- [ ] Pruebas por variante: acierto, fallo, y **respuesta incompleta** (múltiple con una de dos, ordenar sin un elemento, emparejar sin una pareja) → `invalid-answer` con el mensaje exacto.
- [ ] Múltiple: elegir las 2 correctas ⇒ `correct: true`; elegir 1 correcta y 1 incorrecta ⇒ `correct: false` (todo o nada); elegir 3 cuando `selectCount` es 2 ⇒ `invalid-answer`.
- [ ] Un `single` con `config` sin `kind` se corrige igual que antes (mismas explicaciones, mismos campos).
- [ ] Una prueba por cada `broken-content` y por `WRONG_ANSWER_SHAPE`.
- [ ] La función no lanza excepciones ni importa Nest.
- [ ] Verificación común en verde.

**Qué NO hacer:** no tocar el servicio ni el controlador; no persistir nada; no importar `@nestjs/common`.

---

### S14-T7b — Servicio y controlador usan el corrector

| Campo | Valor |
|-------|-------|
| **Depende de** | T7a |
| **Archivos** | `apps/api/src/modules/exercises/exercises.service.ts` (modificar) · `apps/api/src/modules/exercises/exercises.controller.ts` (modificar) · `apps/api/src/modules/exercises/exercises.quiz-flashcard.spec.ts` (modificar: sólo añadir pruebas) |

**Contexto mínimo.** `answerQuiz(userId, exerciseId, body: QuizAnswerInput)` hace, en este orden: `requireExercise` → tipo `QUIZ` (si no, 400 «Este ejercicio no es un quiz») → `readQuiz` → opción existente (400 «La opción no existe en este quiz») → `assertAttemptsLeft` (409) → `createSubmission` → `reviews.scheduleFromSubmission` → `recordProgress` → resultado. El controlador valida con `quizAnswerSchema`.

**Contrato HTTP** (ruta, guardas y códigos no cambian):

```
POST /api/exercises/:id/quiz-answers
{ "optionId": "b" }                   → 200 { "result": { "kind": "single", "correct": true, "correctOptionId": "b", "explanation": "…", "correctExplanation": "…" } }
{ "optionIds": ["b", "e"] }           → 200 { "result": { "kind": "multiple", "correct": true, "correctOptionIds": ["b","e"], "selectedOptionIds": ["b","e"], "explanations": { "b": "…", "e": "…" } } }
{ "order": ["c", "a", "b"] }          → 200 { "result": { "kind": "ordering", "correct": false, "correctOrder": ["a","b","c"], "explanations": { "a": "…", "b": "…", "c": "…" } } }
{ "pairs": { "a": "2", "b": "1", "c": "3" } } → 200 { "result": { "kind": "matching", "correct": true, "correctPairs": { "a": "2", "b": "1", "c": "3" }, "explanations": { "a": "…", "b": "…", "c": "…" } } }
400 { error: { code: "VALIDATION_ERROR", … } }  cuerpo inválido (esquema) o respuesta que no corresponde al tipo (mensajes de T7a)
400 «Este ejercicio no es un quiz»
404 el ejercicio no existe o no está publicado
409 intentos agotados
500 «El ejercicio está mal configurado»
```

Cambios: el controlador valida con `quizSubmissionSchema` y su tipo de retorno es `QuizGradeResponse`; el servicio llama a `gradeQuizAnswer(exercise, body)` **antes** de `assertAttemptsLeft` (una respuesta inválida no gasta un intento) y mapea `invalid-answer` → `BadRequestException(message)` y `broken-content` → `InternalServerErrorException("El ejercicio está mal configurado")`. Se persiste `code: graded.submissionCode`, `outcome` `PASSED`/`FAILED`, `score` 100/0 y `achievedLevel: this.accreditedLevel(exercise, correct ? 1 : null)`, igual que hoy. Se eliminan `readQuiz`, `QuizSolution` y las constantes `UNKNOWN_OPTION` del servicio (ahora importadas de `quiz-grading`); `asRecord` se queda porque lo usa `readFlashcardBack`.

**Criterios de aceptación**
- [ ] Las pruebas actuales de `answerQuiz` (single) pasan **sin modificar sus expectativas**, salvo que el resultado ahora incluye `kind: "single"` (si alguna usa `toEqual` exacto, se añade `kind` y se reporta).
- [ ] Pruebas nuevas de servicio por variante: acierto y fallo registran `Submission` con `outcome`, `score` y `code` esperados (`"b,e"`, `"c>a>b"`, `"a=2,b=1,c=3"`), llaman a `scheduleFromSubmission` y a `recordProgress`.
- [ ] Una respuesta inválida (múltiple con una opción de dos) responde 400 y **no crea** envío ni consume un intento (`countSubmissions` sin cambios).
- [ ] Un cuerpo de `single` enviado a un ejercicio `multiple` responde 400 `La respuesta no corresponde al tipo de pregunta`.
- [ ] `maxAttempts` sigue aplicando (409) a las tres variantes nuevas.
- [ ] Verificación común en verde.

**Qué NO hacer:** no cambiar la ruta ni el prefijo; no devolver la solución en ninguna respuesta de error; no tocar el repositorio ni el mapper; no borrar `quizAnswerSchema` de `shared`.

---

### S14-T8a — Banco reservado fuera de ejercicios y laboratorio

| Campo | Valor |
|-------|-------|
| **Depende de** | T4 (con `db:generate` hecho) |
| **Archivos** | `apps/api/src/modules/exercises/exercises.repository.ts` (modificar) · `apps/api/src/modules/exercises/prisma-exercises.repository.ts` (modificar) · `apps/api/src/modules/exercises/in-memory-exercises.repository.ts` (modificar) · `apps/api/src/modules/exercises/exercises.exam-pool.spec.ts` (crear). **Excepción declarada:** 4 archivos, porque el puerto obliga a cambiar los dos adaptadores a la vez y el cuarto es sólo la prueba (misma razón que S13-T5) |

**Contexto mínimo.** `prisma-exercises.repository.ts` define `PUBLISHED_EXERCISE` (`isPublished` y toda la ascendencia publicada) y lo usa `listByUnit` (que además redefine `unit`) y `findPublished`. El listado del laboratorio (`GET /api/exercises/units/:code`), el detalle (`GET /api/exercises/:id`), `UnitOpenGuard`, y todas las correcciones salen de esos dos métodos (H4). `ExerciseRow` está en `exercises.repository.ts`; el dataset en memoria es `ExercisesDataset.exercises: readonly ExerciseRow[]`.

**Contrato**

```ts
// exercises.repository.ts — en ExerciseRow
/** Banco de la pregunta. Ausente = "UNIT". Los adaptadores no devuelven filas "RESERVED" (sólo el motor de S15 las lee, con su propio método). */
examPool?: "UNIT" | "RESERVED";
```

- Prisma: `PUBLISHED_EXERCISE` gana `examPool: "UNIT"`; `listByUnit` lo incluye explícitamente en su `where` (porque redefine `unit`). `findPublished` queda cubierto por la constante. El `total` del listado sale del mismo `where`.
- En memoria: `listByUnit`, `findPublished` y `listUnitSubmissions` ignoran las filas con `examPool === "RESERVED"`; `unitExists` no cambia.
- Documentar en el comentario de `findPublished`: «S15 añadirá `findReserved` para el motor de simulacros».

**Criterios de aceptación** (`exercises.exam-pool.spec.ts`)
- [ ] `InMemoryExercisesRepository` con tres ejercicios, uno `RESERVED`: `listByUnit` devuelve 2 y `total` 2; `findPublished` del reservado devuelve `null`.
- [ ] `ExercisesService.listByUnit` no incluye el reservado; `getDetail(idReservado)` lanza `NotFoundException`; `answerQuiz(userId, idReservado, …)` lanza `NotFoundException`.
- [ ] `getUnitProgress` no cuenta envíos de ejercicios reservados.
- [ ] Prueba del adaptador Prisma con un `PrismaService` falso (`{ exercise: { findMany, count, findFirst } }` con `vi.fn()` y conversión `as unknown as PrismaService`): los tres reciben `where` con `examPool: "UNIT"` (`expect(...).toMatchObject`).
- [ ] Verificación común en verde.

**Qué NO hacer:** no devolver `RESERVED` bajo ninguna bandera; no añadir endpoints; no tocar el servicio ni el mapper; no leer `examPool` desde `config`.

---

### S14-T8b — Banco reservado fuera de unidad y progreso

| Campo | Valor |
|-------|-------|
| **Depende de** | T8a |
| **Archivos** | `apps/api/src/modules/content/prisma-content.repository.ts` (modificar) · `apps/api/src/modules/progress/prisma-progress.repository.ts` (modificar) · `apps/api/src/modules/content/prisma-exam-pool.spec.ts` (crear) |

**Contexto mínimo.** `PrismaContentRepository.findUnit` incluye `exercises: { where: { isPublished: true }, … }` (≈ línea 164): así el detalle de unidad (`GET /api/content/units/:code`) lista los ejercicios. `PrismaProgressRepository.countPublishedExercises` (`where: { unitId, isPublished: true }`) y `countCompletedExercises` (`exercise: { unitId, isPublished: true }`) deciden cuándo una unidad queda completa (H5). El adaptador en memoria de contenido recibe `UnitDetail` ya armados, no tiene ejercicios que filtrar.

**Contrato**
- `findUnit`: `exercises.where` pasa a `{ isPublished: true, examPool: "UNIT" }`.
- `countPublishedExercises`: `where: { unitId, isPublished: true, examPool: "UNIT" }`.
- `countCompletedExercises`: `exercise: { unitId, isPublished: true, examPool: "UNIT" }`.

**Criterios de aceptación** (`prisma-exam-pool.spec.ts`, con `PrismaService` falso como en T8a)
- [ ] `findUnit` pasa a `unit.findFirst` un `include.exercises.where` que contiene `examPool: "UNIT"` y `isPublished: true`.
- [ ] `countPublishedExercises` llama a `exercise.count` con `where` que contiene `examPool: "UNIT"`.
- [ ] `countCompletedExercises` llama a `submission.findMany` con `where.exercise` que contiene `examPool: "UNIT"`.
- [ ] Las pruebas existentes de contenido y progreso pasan sin modificar.
- [ ] Verificación común en verde.

**Qué NO hacer:** no tocar los adaptadores en memoria ni los mappers; no cambiar el contrato público de `UnitDetail`.

---

### S14-T8c — Banco reservado fuera de repaso y tutor de IA

| Campo | Valor |
|-------|-------|
| **Depende de** | T8a |
| **Archivos** | `apps/api/src/modules/review/prisma-review.repository.ts` (modificar) · `apps/api/src/modules/ai/prisma-ai.repository.ts` (modificar) · `apps/api/src/modules/review/prisma-exam-pool.spec.ts` (crear) |

**Contexto mínimo.** El repaso lista `ReviewItem`s: `listDue` y `countDue` filtran por `userId` y `dueAt`. Hoy no puede haber ítems de un ejercicio reservado (no se puede corregir, T8a), pero S15 podrá crearlos y la regla de oro es que **nunca salgan en el repaso hasta que el simulacro lo permita**. El tutor de IA (`prisma-ai.repository.ts`, constante `UNIT_SELECT`) lee `exercises: { where: { isPublished: true } }` con su `solution` para el contexto de la lección y del envío (H6).

**Contrato**
- `listDue` y `countDue`: `where` añade `exercise: { examPool: "UNIT" }`.
- `UNIT_SELECT.exercises.where` pasa a `{ isPublished: true, examPool: "UNIT" }`.

**Criterios de aceptación** (`prisma-exam-pool.spec.ts`, con `PrismaService` falso)
- [ ] `listDue` pasa a `reviewItem.findMany` un `where` con `exercise: { examPool: "UNIT" }`, `userId` y `dueAt`.
- [ ] `countDue` pasa el mismo filtro a `reviewItem.count`.
- [ ] `findLessonContext` pasa `select.unit.select.exercises.where` con `examPool: "UNIT"`.
- [ ] Las pruebas existentes de repaso y de IA pasan sin modificar.
- [ ] Verificación común en verde.

**Qué NO hacer:** no tocar `findByExercise` ni `findOwned` (son de un ítem ya existente del usuario); no tocar el servicio de repaso.

---

### S14-T9a — Cliente web: enviar cualquier quiz

| Campo | Valor |
|-------|-------|
| **Depende de** | T7b |
| **Archivos** | `apps/web/src/lib/api-client.ts` (modificar) · `apps/web/src/lib/api-client.spec.ts` (modificar) |

**Contexto mínimo.** `exercisesApi.answerQuiz(id, optionId)` hace `POST /exercises/:id/quiz-answers` con `{ optionId }` y valida con `quizAnswerResponseSchema`; lo usa `QuizPlayer` y su spec (`QuizAndFlashcardPlayers.spec.tsx`).

**Contrato**

```ts
exercisesApi.submitQuiz(id: string, body: QuizSubmissionInput): Promise<QuizGradeResult>;
// POST /exercises/${encodeURIComponent(id)}/quiz-answers con `body`; valida con quizGradeResponseSchema y devuelve `.result`
// answerQuiz(id, optionId) NO cambia.
```

**Criterios de aceptación**
- [ ] Prueba: `submitQuiz("ex 1", { optionIds: ["b","e"] })` llama a `POST /exercises/ex%201/quiz-answers` con cuerpo `{ "optionIds": ["b","e"] }`.
- [ ] Prueba: devuelve el resultado de cada `kind` (cuatro casos) y falla con una respuesta sin `kind`.
- [ ] Las pruebas de `answerQuiz` pasan sin modificar.
- [ ] `npm run typecheck -w apps/web`, `lint` y `test` en verde.

**Qué NO hacer:** no cambiar `answerQuiz`; no tocar componentes.

---

### S14-T9b — `QuizPlayer`: respuesta múltiple

| Campo | Valor |
|-------|-------|
| **Depende de** | T9a |
| **Archivos** | `apps/web/src/features/lab/components/QuizMultiplePlayer.tsx` (crear) · `apps/web/src/features/lab/components/QuizMultiplePlayer.spec.tsx` (crear) · `apps/web/src/features/lab/components/QuizPlayer.tsx` (modificar) |

**Contexto mínimo.** `QuizPlayer` (props `exercise`, `answerQuiz`) pinta radios con `<form>`, `<fieldset>`/`<legend>`, estados de acierto/fallo y un bloque `role="status"` con «¡Correcto!» / «Todavía no.». **No se edita `QuizAndFlashcardPlayers.spec.tsx` (H9)**: `QuizPlayer` conserva su contrato y el spec debe pasar tal cual.

**Contrato**
- `QuizPlayer.tsx`: el componente actual se renombra internamente a `SingleQuizPlayer` (cuerpo sin cambios) y `QuizPlayer` pasa a ser un despachador con las mismas props más `submitQuiz?: SubmitQuiz` (`(id, body: QuizSubmissionInput) => Promise<QuizGradeResult>`, por defecto `exercisesApi.submitQuiz`). Lee `exercise.config.kind`: `"multiple"` → `QuizMultiplePlayer`; ausente o `"single"` → `SingleQuizPlayer`; cualquier otro valor no soportado aún (`ordering`, `matching` hasta T9c/T9d) → `role="alert"` «Este tipo de pregunta todavía no está disponible.».
- `QuizMultiplePlayer({ exercise, submitQuiz })`: `config = { kind: "multiple", selectCount, options }`.
  - `<legend>` = enunciado; debajo, texto «Selecciona DOS» / «Selecciona TRES» (según `selectCount`) en mayúsculas.
  - Casillas (`type="checkbox"`); cuando ya hay `selectCount` marcadas, las demás quedan deshabilitadas hasta desmarcar.
  - «Comprobar» sólo habilitado con exactamente `selectCount` marcadas; envía `{ optionIds }`.
  - Tras corregir: cada opción se pinta como acierto (elegida y correcta), «te faltó» (correcta no elegida) o fallo (elegida e incorrecta); el estado usa texto, no sólo color; se muestran las explicaciones de `result.explanations` junto a cada opción presente; el resumen dice «¡Correcto!» o «Todavía no. Una respuesta múltiple se corrige completa: hay que elegir todas las correctas y ninguna más.»
  - «Intentar de nuevo» reinicia. Errores de red: mismo patrón que `SingleQuizPlayer` (`role="alert"`).

**Criterios de aceptación** (`QuizMultiplePlayer.spec.tsx` más una prueba del despachador)
- [ ] «Comprobar» está deshabilitado con 0 y con 1 marcada (de 2), y habilitado con 2.
- [ ] Con 2 marcadas, las otras casillas están deshabilitadas.
- [ ] Envía `submitQuiz("ex-1", { optionIds: ["b","e"] })` y muestra «¡Correcto!» con las explicaciones.
- [ ] En fallo parcial muestra «Todavía no.» y marca la opción que faltó con el texto «te faltó».
- [ ] Antes de comprobar no aparece ninguna explicación.
- [ ] `QuizPlayer` con `config.kind` ausente se comporta como antes: `QuizAndFlashcardPlayers.spec.tsx` pasa **sin modificarlo**.
- [ ] `npm run typecheck -w apps/web`, `lint` y `test` en verde.

**Qué NO hacer:** no editar `QuizAndFlashcardPlayers.spec.tsx`, `FlashcardPlayer.tsx` ni `ReflectionPlayer.tsx`; no cambiar el comportamiento del quiz de respuesta única; no instalar librerías.

---

### S14-T9c — `QuizPlayer`: ordenar

| Campo | Valor |
|-------|-------|
| **Depende de** | T9b |
| **Archivos** | `apps/web/src/features/lab/components/QuizOrderingPlayer.tsx` (crear) · `apps/web/src/features/lab/components/QuizOrderingPlayer.spec.tsx` (crear) · `apps/web/src/features/lab/components/QuizPlayer.tsx` (modificar: una rama del despachador) |

**Contexto mínimo.** `MatchPlayer.tsx` (≈ 279–290) ya usa arrastre HTML5 nativo (`draggable`, `onDragStart`, `onDragEnd`); no hay librería de arrastre. El orden inicial es el de `config.items` (que ya no es el correcto, T2).

**Contrato**
- `QuizPlayer.tsx`: `"ordering"` → `QuizOrderingPlayer`.
- `QuizOrderingPlayer({ exercise, submitQuiz })`: `config = { kind: "ordering", items }`.
  - Lista ordenada `<ol>` con el enunciado como título accesible. Cada elemento muestra su posición, su texto y dos botones: «Subir» y «Bajar», con `aria-label` «Subir: {texto}» y «Bajar: {texto}»; «Subir» deshabilitado en el primero y «Bajar» en el último. Al mover, el foco se queda en el botón pulsado.
  - Además se puede arrastrar un elemento sobre otro (patrón de `MatchPlayer`); el teclado nunca depende del arrastre.
  - «Comprobar» siempre habilitado; envía `{ order: ids en el orden mostrado }`.
  - Tras corregir: se muestra el orden correcto (`result.correctOrder`) con la explicación de cada elemento; si fallaste, también tu orden; «¡Correcto!» / «Todavía no. Hay que ordenarlos todos bien.»; «Intentar de nuevo» reinicia al orden inicial.

**Criterios de aceptación** (`QuizOrderingPlayer.spec.tsx`)
- [ ] «Subir» del primero y «Bajar» del último están deshabilitados.
- [ ] Pulsar «Bajar: A» cambia el orden mostrado y lo que envía `submitQuiz` (`{ order: ["b","a","c"] }`).
- [ ] Un evento `dragStart` + `drop` entre dos elementos los reordena (con `dataTransfer` simulado).
- [ ] Muestra explicaciones sólo después de corregir.
- [ ] Las pruebas de T9b y `QuizAndFlashcardPlayers.spec.tsx` siguen pasando.
- [ ] `npm run typecheck -w apps/web`, `lint` y `test` en verde.

**Qué NO hacer:** no instalar librerías de arrastre; no tocar `MatchPlayer.tsx`; no revelar `correctOrder` antes de corregir.

---

### S14-T9d — `QuizPlayer`: emparejar

| Campo | Valor |
|-------|-------|
| **Depende de** | T9c |
| **Archivos** | `apps/web/src/features/lab/components/QuizMatchingPlayer.tsx` (crear) · `apps/web/src/features/lab/components/QuizMatchingPlayer.spec.tsx` (crear) · `apps/web/src/features/lab/components/QuizPlayer.tsx` (modificar: una rama del despachador) |

**Contrato**
- `QuizPlayer.tsx`: `"matching"` → `QuizMatchingPlayer`; con esto desaparece la rama «todavía no está disponible» (cualquier `kind` desconocido sigue mostrando ese `role="alert"`).
- `QuizMatchingPlayer({ exercise, submitQuiz })`: `config = { kind: "matching", left, right }`.
  - Una fila por elemento de la izquierda: su texto y un `<select>` con `aria-label` «Pareja de {texto}», opción vacía «Elige…» y los textos de `right`. Una opción de la derecha ya elegida en otra fila queda deshabilitada en las demás (la correspondencia es uno a uno).
  - «Comprobar» sólo habilitado con todas las filas elegidas; envía `{ pairs: { [leftId]: rightId } }`.
  - Tras corregir: cada fila muestra tu elección, la pareja correcta (`result.correctPairs`) y la explicación; resumen «¡Correcto!» / «Todavía no. Todas las parejas deben ser correctas.»; «Intentar de nuevo» reinicia.
  - Se usan `<select>` (accesibles por teclado y lector de pantalla) y no arrastre.

**Criterios de aceptación** (`QuizMatchingPlayer.spec.tsx`)
- [ ] «Comprobar» deshabilitado hasta elegir todas las parejas.
- [ ] Elegir una opción de la derecha la deshabilita en las demás filas.
- [ ] Envía `submitQuiz("ex-1", { pairs: { a: "2", b: "1", c: "3" } })`.
- [ ] Tras un fallo muestra la pareja correcta y su explicación; antes no.
- [ ] Las pruebas de T9b, T9c y `QuizAndFlashcardPlayers.spec.tsx` siguen pasando.
- [ ] `npm run typecheck -w apps/web`, `lint` y `test` en verde; `npm run build -w apps/web` en verde (restaurar `apps/web/next-env.d.ts` si `next build` lo reescribe).

**Qué NO hacer:** no usar arrastre; no tocar `MatchPlayer.tsx`.

---

### S14-T10 — Esquema de `AUDIT` en la semilla

| Campo | Valor |
|-------|-------|
| **Depende de** | T2 |
| **Archivos** | `packages/shared/src/schemas/content.ts` (modificar) · `packages/shared/src/schemas/content-exercise.spec.ts` (modificar) |

**Contexto mínimo.** `banco-ejercicios.md` §3.6: un `AUDIT` tiene defectos reales con severidad y al menos un aspecto correcto que parezca sospechoso; se penalizan los falsos positivos. `ExerciseType` ya incluye `AUDIT`; `contentSeedExerciseSchema` no tiene campo para él y `exerciseRuleViolations` no lo conoce. La respuesta correcta no puede viajar al cliente (decisión 2.5): el cliente recibe sólo candidatos neutros.

**Contrato**

```ts
export const AUDIT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const AUDIT_DECISIONS = ["accept", "fix", "discard"] as const;   // aceptar / corregir / descartar

export const contentSeedAuditSchema = z.object({
  artifact: z.object({
    language: z.enum(["json", "yaml", "typescript", "javascript", "python", "bash", "text"]),
    content: z.string().min(1).max(8000),   // se numera por líneas (1-based)
  }),
  findings: z.array(z.object({
    id: z.string().regex(/^f\d{1,2}$/),     // f1…f10
    lines: z.tuple([z.number().int().min(1), z.number().int().min(1)]), // [desde, hasta], inclusive
    label: z.string().min(1).max(120),      // descripción NEUTRA que ve el estudiante («Línea 12: acción comodín»)
    isDefect: z.boolean(),
    severity: z.enum(AUDIT_SEVERITIES).nullable().default(null),
    explanation: z.string().min(1),         // se revela después del intento
  })).min(3).max(10),
  verdict: z.enum(AUDIT_DECISIONS),         // decisión correcta para el artefacto completo
});
export type ContentSeedAudit = z.infer<typeof contentSeedAuditSchema>;
// contentSeedExerciseSchema: audit: contentSeedAuditSchema.nullable().default(null)
```

**Reglas nuevas de `exerciseRuleViolations`** (mensajes exactos):
- «un AUDIT requiere audit (artefacto y hallazgos)» · «solo un AUDIT declara audit»
- «un AUDIT declara al menos un defecto real» · «un AUDIT declara al menos un elemento correcto que parece sospechoso»
- «los hallazgos repiten id» · «los hallazgos van ordenados por línea» (por `lines[0]` ascendente; así el orden no delata cuáles son defectos)
- «cada defecto real declara severidad» · «la severidad solo se declara en defectos reales»
- «las líneas de un hallazgo salen del artefacto o están al revés» (`1 ≤ desde ≤ hasta ≤ número de líneas del `content`)
- «un artefacto con defectos críticos o altos no se acepta» (si algún defecto es `critical` o `high`, `verdict` no puede ser `accept`)

**Criterios de aceptación**
- [ ] Un `AUDIT` válido (3 hallazgos: 2 defectos con severidad y 1 correcto-sospechoso; `verdict: "fix"`) pasa con `[]`.
- [ ] Una prueba por cada mensaje.
- [ ] Un ejercicio que no es `AUDIT` con `audit` informa «solo un AUDIT declara audit»; uno `AUDIT` sin `audit` informa «un AUDIT requiere audit (artefacto y hallazgos)».
- [ ] Las pruebas existentes pasan sin modificar; los quizzes y las tarjetas no cambian.
- [ ] Verificación común en verde, salvo `typecheck:seed` si T5 aún no se hizo.

**Qué NO hacer:** no tocar `seed-lib.mts` (T10b); no añadir campos de pistas ni de sandbox; no usar `audit` para otros tipos.

---

### S14-T10b — La semilla escribe `AUDIT`

| Campo | Valor |
|-------|-------|
| **Depende de** | T5, T10 |
| **Archivos** | `apps/api/prisma/seed/seed-lib.mts` (modificar) |

**Contexto mínimo.** `exerciseConfig` y `exerciseSolution` no conocen `AUDIT` (H7): un `AUDIT` sembrado tendría `config` vacío y ninguna solución.

**Contrato**
- `exerciseConfig` (rama `exercise.audit !== null`): `{ artifact: { language, content }, candidates: [{ id, lines, label }] }` (en el orden del seed; sin `isDefect`, `severity` ni `explanation`).
- `exerciseSolution`: `{ findings: [{ id, isDefect, severity, explanation }], verdict }`.

**Criterios de aceptación**
- [ ] `npm run typecheck:seed -w apps/api` en 0.
- [ ] Script temporal fuera del repositorio: con un `AUDIT` de ejemplo imprime `config` (sin ninguna clave `isDefect`/`severity`/`explanation`) y `solution`; el reporte los pega.
- [ ] `npm run db:seed` dos veces: mismas cifras y mismo `md5` de los quizzes que en T5.
- [ ] Verificación común en verde.

**Qué NO hacer:** no cambiar las ramas de quiz, memoria ni tarjeta; no exponer `isDefect` en `config`.

---

### S14-T11a — Contrato de `audit-answers`

| Campo | Valor |
|-------|-------|
| **Depende de** | T10 |
| **Archivos** | `packages/shared/src/schemas/exercise.ts` (modificar) · `packages/shared/src/schemas/exercise.spec.ts` (modificar) |

**Contrato**

```ts
import { AUDIT_DECISIONS, AUDIT_SEVERITIES } from "./content";

/** POST /api/exercises/:id/audit-answers */
export const auditAnswerSchema = z.object({
  marks: z.array(z.object({
    findingId: z.string().regex(/^f\d{1,2}$/, "El hallazgo debe ser f1, f2…"),
    severity: z.enum(AUDIT_SEVERITIES),
  }).strict()).max(10),
  decision: z.enum(AUDIT_DECISIONS),
}).strict().superRefine(/* findingId sin repetir: «No marques dos veces el mismo hallazgo» */);
export type AuditAnswerInput = z.infer<typeof auditAnswerSchema>;

export const auditAnswerResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  outcome: z.enum(["PASSED", "PARTIAL", "FAILED"]),
  detectedDefects: z.number().int().nonnegative(),
  totalDefects: z.number().int().positive(),
  falsePositives: z.number().int().nonnegative(),
  decisionCorrect: z.boolean(),
  verdict: z.enum(AUDIT_DECISIONS),
  findings: z.array(z.object({
    id: z.string(),
    isDefect: z.boolean(),
    severity: z.enum(AUDIT_SEVERITIES).nullable(),
    marked: z.boolean(),
    chosenSeverity: z.enum(AUDIT_SEVERITIES).nullable(),
    severityCorrect: z.boolean().nullable(),   // null si no estaba marcado o no era defecto
    explanation: z.string().min(1),
  })),
});
export type AuditAnswerResult = z.infer<typeof auditAnswerResultSchema>;
export const auditAnswerResponseSchema = z.object({ result: auditAnswerResultSchema });
export type AuditAnswerResponse = z.infer<typeof auditAnswerResponseSchema>;
```

Cuerpo de ejemplo: `{"marks":[{"findingId":"f1","severity":"critical"},{"findingId":"f3","severity":"low"}],"decision":"fix"}` (marks vacío es válido: «no encontré nada»).

**Criterios de aceptación**
- [ ] Acepta el ejemplo y `marks: []`; rechaza `findingId` repetido, `severity: "urgent"`, `decision: "approve"`, `marks` con 11 elementos, y claves desconocidas (cuerpo y cada marca).
- [ ] `auditAnswerResultSchema` parsea un resultado completo y rechaza `score: 101`.
- [ ] Los esquemas de quiz de T6 siguen pasando sin modificar.
- [ ] Verificación común en verde.

**Qué NO hacer:** no tocar `apps/api` ni `apps/web`; no reutilizar `quizSubmissionSchema`.

---

### S14-T11b — Corrector puro de `AUDIT`

| Campo | Valor |
|-------|-------|
| **Depende de** | T11a |
| **Archivos** | `apps/api/src/modules/exercises/audit-grading.ts` (crear) · `apps/api/src/modules/exercises/audit-grading.spec.ts` (crear) |

**Contexto mínimo.** La `solution` sembrada de un `AUDIT` es `{ findings: [{id, isDefect, severity, explanation}], verdict }` (T10b). El estudiante marca los hallazgos que cree defectos, elige severidad para cada uno y decide.

**Contrato**

```ts
import type { AuditAnswerInput, AuditAnswerResult } from "@codeai/shared";

export const UNKNOWN_FINDING = (id: string): string => `El hallazgo ${id} no existe en esta auditoría`;

export type AuditGrading =
  | { readonly status: "graded"; readonly result: AuditAnswerResult; readonly submissionCode: string }
  | { readonly status: "invalid-answer"; readonly message: string }   // 400
  | { readonly status: "broken-content" };                            // 500

export function gradeAudit(solution: unknown, answer: AuditAnswerInput): AuditGrading;
```

Fórmula (D = defectos reales; `detected` = marcados que son defectos; `fp` = marcados que no lo son):

```
severityPoints = Σ sobre detected de (severidad elegida == real ? 1 : 0.5)
findingsRatio  = severityPoints / D
decisionPoints = (detected ≥ 1 y decision == verdict) ? 1 : 0     // sin hallazgos no hay crédito por decidir
raw            = 0.8 * findingsRatio + 0.2 * decisionPoints - 0.15 * fp
score          = round(100 * min(1, max(0, raw)))
outcome        = score ≥ 70 ? "PASSED" : score > 0 ? "PARTIAL" : "FAILED"
```

`submissionCode`: `JSON.stringify({ marks: marks ordenadas por findingId, decision })`. `findings` del resultado incluye **todos** los hallazgos de la solución (se revelan tras el intento).

**Criterios de aceptación**
- [ ] Todos los defectos con su severidad, sin falsos positivos y decisión correcta ⇒ `score 100`, `PASSED`.
- [ ] Un falso positivo baja la nota: el mismo caso con un hallazgo correcto-sospechoso marcado ⇒ `score 85`, `PASSED`; con dos ⇒ `70`, `PASSED`; con tres ⇒ `55`, `PARTIAL`.
- [ ] Severidad equivocada en un defecto de dos, resto perfecto ⇒ `round(100 * (0.8 * 0.75 + 0.2))` = `80`.
- [ ] Sin marcas ⇒ `score 0`, `FAILED`, `decisionCorrect` informado pero sin crédito.
- [ ] Un `findingId` inexistente ⇒ `invalid-answer` con `UNKNOWN_FINDING("f9")`.
- [ ] `solution` malformada o sin defectos ⇒ `broken-content`.
- [ ] No lanza excepciones ni importa Nest.
- [ ] Verificación común en verde.

**Qué NO hacer:** no persistir; no cambiar la fórmula (si parece mal, preguntar); no usar los `hints`.

---

### S14-T11c — `POST /api/exercises/:id/audit-answers`

| Campo | Valor |
|-------|-------|
| **Depende de** | T11b, T8a |
| **Archivos** | `apps/api/src/modules/exercises/exercises.service.ts` (modificar) · `apps/api/src/modules/exercises/exercises.controller.ts` (modificar) · `apps/api/src/modules/exercises/exercises.audit.spec.ts` (crear) |

**Contrato HTTP** (mismas guardas del controlador: `JwtAuthGuard` y `UnitOpenGuard`)

```
POST /api/exercises/:id/audit-answers
{ "marks": [{ "findingId": "f1", "severity": "critical" }], "decision": "fix" }
200 { "result": { …AuditAnswerResult de T11a… } }
400 VALIDATION_ERROR              cuerpo inválido
400 «Este ejercicio no es una auditoría»
400 «El hallazgo f9 no existe en esta auditoría»
404 el ejercicio no existe, no está publicado o es RESERVED
409 intentos agotados
500 «El ejercicio está mal configurado»
```

Servicio `answerAudit(userId, exerciseId, body: AuditAnswerInput): Promise<AuditAnswerResponse>`: mismo orden que `answerQuiz` (`requireExercise` → tipo `AUDIT` → `gradeAudit` → `assertAttemptsLeft` → `createSubmission` → `reviews.scheduleFromSubmission` → `recordProgress`). Se persiste `code: submissionCode`, `outcome` y `score` del resultado, `achievedLevel: this.accreditedLevel(exercise, outcome === "PASSED" ? 3 : null)`, `hintsUsed: 0`, `results: []`. (Decisión pendiente de ratificar por el Orquestador: `banco-ejercicios.md` sitúa las auditorías en el nivel 3–4; se acredita 3 al aprobar.)

**Criterios de aceptación** (`exercises.audit.spec.ts`, con repositorio en memoria)
- [ ] Acierto total registra un `Submission` `PASSED`, `score 100`, y llama a `scheduleFromSubmission` y `recordProgress`.
- [ ] Un falso positivo baja la nota por debajo de la del caso sin él (misma prueba en servicio).
- [ ] Un ejercicio que no es `AUDIT` ⇒ 400; hallazgo inexistente ⇒ 400 sin crear envío ni consumir intento.
- [ ] `maxAttempts` aplica (409).
- [ ] El `config` que devuelve `getDetail` de un `AUDIT` no contiene `isDefect`, `severity` ni `explanation`.
- [ ] Verificación común en verde.

**Qué NO hacer:** no tocar `quiz-answers`; no modificar repositorios ni mapper; no devolver la solución en errores.

---

### S14-T12a — Cliente web: enviar una auditoría

| Campo | Valor |
|-------|-------|
| **Depende de** | T11c |
| **Archivos** | `apps/web/src/lib/api-client.ts` (modificar) · `apps/web/src/lib/api-client.spec.ts` (modificar) |

**Contrato:** `exercisesApi.submitAudit(id: string, body: AuditAnswerInput): Promise<AuditAnswerResult>` → `POST /exercises/${encodeURIComponent(id)}/audit-answers`, validado con `auditAnswerResponseSchema`, devuelve `.result`.

**Criterios de aceptación**
- [ ] Prueba: URL y cuerpo exactos.
- [ ] Prueba: respuesta válida devuelta; forma inválida rechazada.
- [ ] Las pruebas existentes de `api-client.spec.ts` (incluidas las de T9a) pasan sin modificar.
- [ ] `npm run typecheck -w apps/web`, `lint` y `test` en verde.

**Qué NO hacer:** no tocar componentes ni `answerQuiz`/`submitQuiz`.

---

### S14-T12b — `AuditPlayer`

| Campo | Valor |
|-------|-------|
| **Depende de** | T12a |
| **Archivos** | `apps/web/src/features/lab/components/AuditPlayer.tsx` (crear) · `apps/web/src/features/lab/components/AuditPlayer.spec.tsx` (crear) |

**Contrato**
- Props: `{ exercise: ExerciseDetail; submitAudit?: (id: string, body: AuditAnswerInput) => Promise<AuditAnswerResult> }` (por defecto `exercisesApi.submitAudit`).
- `config = { artifact: { language, content }, candidates: [{ id, lines, label }] }`. Si falta o no es válido: `role="alert"` «Esta auditoría no tiene artefacto disponible.».
- Pantalla: enunciado; el artefacto en un `<pre>` con números de línea (copiable); lista de candidatos, cada uno con su `label`, el rango «líneas 12–14», una casilla «Es un defecto» y, si está marcada, un `<select>` de severidad (Crítica / Alta / Media / Baja); al final tres opciones de decisión (radios: «Aceptar», «Corregir», «Descartar»).
- «Enviar auditoría» habilitado sólo con una decisión elegida y severidad en cada candidato marcado; envía `{ marks, decision }`.
- Resultado: nota y estado (texto «Aprobada» / «Parcial» / «No aprobada»), «Defectos encontrados: X de Y», «Falsos positivos: N» con la aclaración «Cada falso positivo resta nota», si la decisión fue correcta, y por cada hallazgo (todos): si era defecto, severidad real, lo que marcaste y su `explanation`. «Intentar de nuevo» reinicia.
- Antes de enviar no aparece ninguna explicación ni indicio de cuáles son defectos.

**Criterios de aceptación** (`AuditPlayer.spec.tsx`)
- [ ] El botón está deshabilitado sin decisión y con un candidato marcado sin severidad.
- [ ] Envía el cuerpo esperado (`marks` sólo de los marcados).
- [ ] Muestra «Falsos positivos: 1» y la nota tras una corrección con un falso positivo.
- [ ] No hay explicaciones antes de enviar; sí después, de todos los hallazgos.
- [ ] Configuración inválida muestra el `alert`.
- [ ] `npm run typecheck -w apps/web`, `lint` y `test` en verde.

**Qué NO hacer:** no tocar `ExercisePlayer.tsx` (T12c); no incluir resaltado de sintaxis ni librerías nuevas.

---

### S14-T12c — `ExercisePlayer` despacha `AUDIT`

| Campo | Valor |
|-------|-------|
| **Depende de** | T12b |
| **Archivos** | `apps/web/src/features/lab/components/ExercisePlayer.tsx` (modificar) · `apps/web/src/features/lab/components/ExercisePlayer.spec.tsx` (modificar: sólo añadir pruebas) |

**Contexto mínimo.** `CLIENT_TYPES = ["QUIZ", "FLASHCARD", "MEMORY", "REFLECT"]` y `TYPE_LABEL` (≈ líneas 31–46): un ejercicio fuera de esa lista cae en el laboratorio de código, con su aviso de práctica (H7).

**Contrato:** `AUDIT` entra en `CLIENT_TYPES`; `TYPE_LABEL.AUDIT = "Auditoría"`; la cadena de condicionales renderiza `<AuditPlayer exercise={exercise} />` para `AUDIT` antes de la rama final de `REFLECT`.

**Criterios de aceptación**
- [ ] Prueba: un ejercicio `AUDIT` renderiza el `AuditPlayer` (no el editor de código ni el aviso «Modo de práctica»).
- [ ] Las pruebas existentes de `ExercisePlayer.spec.tsx` pasan sin modificar (si fallan por los cambios ajenos en `FlashcardPlayer`/`ReflectionPlayer`, se compara con la línea base y se reporta).
- [ ] `npm run typecheck -w apps/web`, `lint`, `test` y `build -w apps/web` en verde (restaurar `apps/web/next-env.d.ts` si `next build` lo reescribe).

**Qué NO hacer:** no cambiar el despacho de los demás tipos; no tocar `LabHub.tsx`.

---

### S14-T13 — Guarda de calidad de preguntas AWS

| Campo | Valor |
|-------|-------|
| **Depende de** | T3, T5 |
| **Archivos** | `apps/api/src/modules/content/seed-course-quality.spec.ts` (modificar) |

**Contexto mínimo.** El spec ya fusiona el esqueleto con `aws/units/*.json` y expone `exercises` (con `unitCode`). `aws/units/` aún no existe: las reglas correrían en vacío (H10). Por eso cada regla es una **función pura** definida en el propio spec, se prueba con ejemplos sintéticos (que sí fallan) y luego se aplica al contenido real. Las reglas de `metodo-aws.md` §5 que no son comprobables por máquina (distractor plausible, una sola respuesta defendible, originalidad, servicios vigentes, datos volátiles) quedan para la revisión humana y **no** se simulan con heurísticas.

**Contrato: reglas** (se aplican a los `QUIZ` con `exam` ≠ `null`; mensaje de fallo `` `${slug}: ${motivo}` ``):

| # | Regla (fuente) | Comprobación exacta |
|---|----------------|---------------------|
| 1 | Calificador en mayúsculas (§5.1) — `single` y `multiple` | El `statement` contiene al menos una palabra de `["MENOR","MENOS","MÁS","MAYOR","MEJOR","MÍNIMO","MÁXIMO","PRIMERO","ÚNICAMENTE","DOS","TRES"]` en mayúsculas, como palabra completa (`ordering` y `matching` quedan exentos). Las siglas (`AWS`, `IAM`, `VPC`…) no cuentan |
| 2 | Explicación por opción (§5.3) | Cada `explanation` tiene ≥ 25 caracteres (todas las variantes) |
| 3 | Longitud equilibrada (§5.5) — `single` y `multiple` | Ninguna correcta supera 2× la media ni 2× la más larga de las incorrectas (en `multiple`, se compara cada correcta) |
| 4 | Sin «todas/ninguna de las anteriores» ni verdadero/falso (§5.2) | Sobre los textos de opciones, elementos y parejas (repite la regla del esquema para todas las variantes) |
| 5 | `exam` válido (§5.7) | La certificación corresponde a la etapa de la unidad, el dominio existe y la tarea pertenece al dominio |
| 6 | Reparto de la letra correcta (§5.5) | En cada unidad con ≥ 6 `single`, ninguna letra es la correcta en más de la mitad |
| 7 | Reparto de tipos (§6) | Sólo en unidades con `isPublished: true`: ≥ 8 `QUIZ` con `exam` y, de A2 en adelante (etapa ≥ 102), ≥ 2 de `kind: "multiple"` |

**Criterios de aceptación**
- [ ] Cada una de las reglas 1–7 tiene una prueba con un ejemplo **malo** que la dispara y uno bueno que no.
- [ ] Con `aws/units` vacío o inexistente, el spec pasa (cero ejercicios reales).
- [ ] Si se añade una unidad AWS que incumple una regla, el spec falla nombrando el `slug` (comprobación manual con un archivo temporal fuera del repositorio, reportada).
- [ ] No duplica reglas ya cubiertas por el esquema salvo las listadas.
- [ ] Verificación común en verde.

**Qué NO hacer:** no crear archivos de unidad AWS; no tocar `seed-exercise-quality.spec.ts` (guarda de `fullstack-ia`); no añadir heurísticas para la plausibilidad de distractores ni para «datos volátiles».

---

### S14-T14 — Documentación (Orquestador)

No es del Constructor. Al cerrar el sprint:
- `banco-ejercicios.md` §3.2 (variantes de `QUIZ`, formato `kind`) y §3.6 (esquema real de `AUDIT`).
- `contratos-api.md`: cuerpo y resultado de `POST /exercises/:id/quiz-answers` (cuatro variantes) y nueva ruta `audit-answers`.
- `modelo-datos.md`: columnas `certification`, `examDomain`, `examTask`, `examPool` y el índice; veredicto de T0b en §9.
- `sprint-13-multi-ruta.md` §6: marcar resuelta la deuda de los finales de línea.
- `metodo-aws.md` §4: estados «Existe» de las variantes de quiz y de `AUDIT`; `aws-guias-examen.md`: referencia al registro de `shared`.
- Estado del sprint y `README`.

---

---

## 5. Criterios de cierre

- [ ] `aws-guias-examen.md` firmado por una persona con fecha; el registro de `shared` coincide con él (prueba que compara pesos y número de dominios).
- [ ] Las cuatro variantes de quiz se corrigen en servidor con pruebas de acierto, fallo y respuesta incompleta; la respuesta múltiple es todo o nada.
- [ ] Ningún endpoint de unidad, laboratorio o repaso devuelve un ejercicio `RESERVED` (prueba por endpoint).
- [ ] `AUDIT` jugable de punta a punta con un ejercicio de prueba; un falso positivo baja la nota.
- [ ] Los quizzes existentes de `fullstack-ia` (1.662) siguen funcionando sin migrar datos.
- [ ] Suite completa, typecheck, lint y build en verde.

## 6. Documentos relacionados

- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §4–§5
- [`../../02-contenido/banco-ejercicios.md`](../../02-contenido/banco-ejercicios.md)
- [`sprint-15-simulador-examen.md`](sprint-15-simulador-examen.md)

## 7. Orden de ejecución

El orden respeta las dependencias de cada ficha y los hallazgos de §4.1. Una tarea por sesión de Constructor; el Orquestador revisa cada una antes de abrir la siguiente.

| Paso | Tarea | Necesita base de datos | Notas |
|------|-------|------------------------|-------|
| 1 | **T0b** | No toca la real; necesita Docker para una base **desechable** en el puerto 5441 | Va primero: su veredicto decide si T4 es seguro. El `.gitattributes`, si procede, lo aprueba el Orquestador |
| 2 | **T1** | No | Registro de certificaciones |
| 3 | **T2** | No | Rompe `typecheck:seed` a propósito hasta T5 |
| 4 | **T3** | No | |
| 5 | **T4** | **Sí**: `localhost:5433` (respaldo, `--create-only`, revisar el SQL) | Tras T4, ejecutar `npm run db:generate -w apps/api` |
| 6 | **T5** | **Sí** para la comprobación con `db:seed`; el resto es estático | Vuelve a poner `typecheck:seed` en verde |
| 7 | **T6** | No | Aditiva: no rompe API ni web |
| 8 | **T7a**, **T7b** | No | Servicio con repositorio en memoria |
| 9 | **T8a**, luego **T8b** y **T8c** | No (pruebas con `PrismaService` falso); sí necesitan el cliente Prisma regenerado de T4 | |
| 10 | **T9a** → **T9b** → **T9c** → **T9d** | No | Cadena web; sólo depende de T7b |
| 11 | **T10**, luego **T10b** | T10 no; T10b **sí** (siembra) | T10b va tras T5 |
| 12 | **T11a** → **T11b** → **T11c** | No | |
| 13 | **T12a** → **T12b** → **T12c** | No | |
| 14 | **T13** | No | Funciona en vacío mientras `aws/units` no exista |
| 15 | **T14** | No | Orquestador |

**Qué se puede hacer sin base de datos** (si Docker o PostgreSQL no están disponibles): T1, T2, T3, T6, T7a, T7b, T8a (parte en memoria y prueba con `PrismaService` falso: necesita el cliente regenerado, es decir, T4 hecha), T9a–T9d, T10, T11a–T11c, T12a–T12c y T13. Lo que **exige** la base real son T4, la comprobación de siembra de T5 y T10b. T0b exige Docker, no la base del proyecto.

**Cadenas que avanzan en paralelo** (sin tocar los mismos archivos): `T1 → T3`, `T2`, `T6 → T7a → T7b → T9a → T9b → T9c → T9d` y `T10 → T11a → T11b → T11c → T12a → T12b → T12c`. `exercises.service.ts`, `exercises.controller.ts`, `api-client.ts` y `exercise.ts` se modifican en varias tareas: esas tareas **no se ejecutan a la vez** (T7b y T11c comparten servicio y controlador; T9a y T12a comparten `api-client.ts`; T6 y T11a comparten `exercise.ts`; T2 y T10 comparten `content.ts`; T5 y T10b comparten `seed-lib.mts`).

**Puntos de control**
1. Tras T5: `npm run db:seed` dos veces con las mismas cifras (12/48/207/3203) y el `md5` de los quizzes de `fullstack-ia` idéntico al de antes de T2 (regla 1 de §4.0).
2. Tras T8c: ninguna consulta de unidad, laboratorio, repaso ni tutor devuelve un ejercicio reservado (pruebas de T8a–T8c).
3. Tras T12c: un recorrido de punta a punta con un `QUIZ` múltiple y un `AUDIT` de prueba en una base de desarrollo (por una persona), y `npm run build` en verde.
