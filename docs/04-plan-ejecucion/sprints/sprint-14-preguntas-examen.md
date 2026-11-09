# Sprint 14 — Preguntas tipo examen y metadatos de certificación

> **Estado:** ⬜ pendiente · **Duración prevista:** 12–14 sesiones · **Depende de:** S13 (multi-ruta), S6 (corrección de quizzes).
> **Ámbito:** `packages/shared`, `apps/api` (`exercises`, semilla) y `apps/web` (reproductores). Las fichas detalladas de cada tarea las redacta el Orquestador al abrir el sprint, con la [plantilla](../../05-orquestacion/plantilla-tarea.md); aquí se fijan objetivo, decisiones, lista de tareas y criterios.
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

| ID | Tarea | Archivos (máx. 3) | Responsable |
|----|-------|-------------------|-------------|
| T0 | Verificar las 11 guías oficiales y registrar versión, formato, dominios, pesos y tareas, con fecha y URL | `docs/02-contenido/aws-guias-examen.md` (crear) | Persona + Orquestador · ✅ 2026-11-09 (commit 22da31e): 10/11 exámenes verificados; MLA-C02 sigue en beta |
| T1 | Registro de certificaciones en `shared` a partir de T0 | `schemas/certification.ts`, `.spec.ts`, `index.ts` | Constructor |
| T2 | Variantes de quiz en la semilla (`single`/`multiple`/`ordering`/`matching`) con compatibilidad hacia atrás | `schemas/content.ts`, `content-exercise.spec.ts` | Constructor |
| T3 | Metadatos `exam` en el ejercicio sembrado; reglas: obligatorio en la ruta AWS, dominio existente en la certificación, competencias de la ruta | `schemas/course-seed.ts`, `course-seed.spec.ts` | Constructor |
| T4 | Columnas `certification`, `examDomain`, `examTask`, `examPool` (enum `UNIT`/`RESERVED`) e índice `[certification, examDomain, examPool]`; migración | `schema.prisma`, `migrations/<ts>_exam_metadata/migration.sql` | Constructor |
| T5 | La semilla escribe los metadatos y la configuración de las variantes | `seed-lib.mts` | Constructor |
| T6 | Contrato de envío de respuestas: `optionIds[]`, `order[]` o `pairs` según `kind` | `schemas/exercise.ts`, `exercise.spec.ts` | Constructor |
| T7 | Corrección en servidor de las variantes (todo o nada; explicación de cada opción elegida y de las correctas tras el intento) | módulo `exercises`: corrector de quiz + spec | Constructor |
| T8 | Exclusión del banco reservado en unidad, laboratorio y repaso | repositorio Prisma de contenido/ejercicios + spec | Constructor |
| T9 | `QuizPlayer`: respuesta múltiple («Selecciona DOS») con casillas, ordenar (arrastre y teclado) y emparejar | `QuizPlayer.tsx`, `QuizPlayer.spec.tsx` | Constructor |
| T10 | Esquema de `AUDIT` en la semilla: artefacto, hallazgos con `isDefect`/severidad/explicación, al menos un «correcto que parece sospechoso» | `schemas/content.ts`, spec | Constructor |
| T11 | Corrección de `AUDIT` en servidor: `POST /api/exercises/:id/audit-answers` (recall de defectos, penalización por falsos positivos, decisión) | módulo `exercises` + spec | Constructor |
| T12 | `AuditPlayer` en la web y despacho en `ExercisePlayer` | `AuditPlayer.tsx`, `.spec.tsx`, `ExercisePlayer.tsx` | Constructor |
| T13 | Guarda de calidad de preguntas AWS: calificador en mayúsculas en el enunciado, explicación por opción, ratio de longitud, reparto de la letra correcta por unidad, `exam` válido, sin «todas/ninguna de las anteriores» | `seed-course-quality.spec.ts` | Constructor |
| T14 | Documentación: `banco-ejercicios.md` §3.2 y §3.6, `contratos-api.md`, `modelo-datos.md` | docs | Orquestador |

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
