# Sprint 17 — Contenido AWS: A0 (cuenta segura y nivelación) y A1 (CLF-C02)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 55 sesiones · **Depende de:** S13, S14 (preguntas tipo examen). Los `LAB` con arnés de A0 esperan a S16; las formas del simulacro se usan cuando exista S15.
> **Ámbito:** contenido (`apps/api/prisma/seed/aws/…`) y una tarea de plataforma (T1). Cada tarea de unidad toca **un solo archivo** y sigue la ficha tipo de [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §13.

---

## 1. Objetivo

Al cerrar el sprint, las 35 unidades de A0 y A1 tienen lección de 7 pasos y paquete completo de ejercicios, el banco reservado de CLF-C02 tiene sus tres formas, los proyectos de A0 y A1 existen, y una persona revisó la unidad molde y el lote.

## 2. Referencias

- Unidades, dominios y proyectos: [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md), A0 y A1.
- Formato y pesos de CLF-C02: `docs/02-contenido/aws-guias-examen.md` (S14-T0). **Ninguna pregunta se escribe antes de que exista.**
- Reglas de redacción y mínimos por unidad: [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §5–§6.

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Proyectos y entrevistas aceptan etapas de cualquier ruta y competencias AWS (`project.ts`, `interview.ts` con `isKnownStageId` y `competencyCodeSchema`); semilla de proyectos por ruta (`aws/projects.seed.json`) | `packages/shared/src/schemas/project.ts`, `interview.ts`, spec | Constructor |
| T2 | Recursos oficiales de A0–A1 abiertos y leídos (título, idioma, fecha de revisión) en `resources` del esqueleto | `aws/course.seed.json` | Orquestador + persona |
| T3 | **Unidad molde AWS-U0.1.2** (anatomía de una pregunta de examen) | `aws/units/AWS-U0.1.2.json` | Constructor |
| T4 | **Revisión humana del molde**; los defectos de método se corrigen en la ficha tipo antes de escalar | — | Persona |
| T5–T18 | Resto de unidades de A0 (AWS-U0.1.1 … AWS-U0.3.5), una por sesión | `aws/units/<código>.json` | Constructor |
| T19 | Unidad molde de A1: **AWS-U1.2.1** (responsabilidad compartida) y su revisión humana | `aws/units/AWS-U1.2.1.json` | Constructor + persona |
| T20–T38 | Resto de unidades de A1 (AWS-U1.1.1 … AWS-U1.5.1), una por sesión | `aws/units/<código>.json` | Constructor |
| T39–T48 | Banco reservado CLF-C02: 3 formas × 65 preguntas, en lotes de ≤ 20 preguntas de **un mismo dominio** por sesión | `aws/exam-bank/CLF-C02-D<n>-<lote>.json` | Constructor |
| T49 | Formas A, B y C de CLF-C02 con el reparto por dominio de la guía | `aws/exam-forms/CLF-C02.json` | Constructor |
| T50 | Proyectos de A0 («Cuenta de estudio segura») y A1 («Propuesta de nube para una pyme») con rúbrica | `aws/projects.seed.json` | Constructor |
| T51 | `LAB` con arnés de A0 (`cidr` en AWS-U0.3.1, depuración de JSON en AWS-U0.3.5) cuando S16 esté cerrado | `aws/units/<código>.json` | Constructor |
| T52 | Revisión humana del lote (muestra ≥ 20 % de preguntas por unidad y el 100 % del banco reservado) | `revision-pedagogica.md` | Persona |

**Unidades conceptuales de A0 y A1:** casi todas carecen de objeto evaluable por el arnés; su `LAB` guiado/autónomo se sustituye por `AUDIT` + `DEBUG` de configuración (excepción declarada en cada ficha, §6 del método).

## 4. Criterios de cierre

- [ ] `npm run db:seed:aws` carga 35 unidades con lección y paquete; `seed-course-quality` en verde.
- [ ] 195 preguntas reservadas de CLF-C02 repartidas por dominio según la guía; ninguna repetida del banco de unidad (comprobación de similitud por enunciado).
- [ ] Molde de A0 y A1 y lote revisados por una persona distinta de quien redactó (registro en `revision-pedagogica.md`).
- [ ] Ninguna pregunta con precios, cuotas o límites sin fuente fechada; ninguna tomada de volcados o de las muestras oficiales.
- [ ] Publicación de A0–A1 decidida por el responsable tras la revisión.

## 5. Documentos relacionados

- [`../../02-contenido/plan-poblado-banco-e0-e2.md`](../../02-contenido/plan-poblado-banco-e0-e2.md) (método de lotes y molde)
- [`sprint-18-aws-arquitecto-asociado.md`](sprint-18-aws-arquitecto-asociado.md)
