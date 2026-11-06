# Sprint 25 — Contenido AWS: A10 (DEA-C01) y A11 (MLA-C02)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 55 sesiones · **Depende de:** S18 (A2) para A10; A7 (S23) y A10 para A11.
> **Versión objetivo de A11:** **MLA-C02** (beta desde 2026-09-29; GA 2027-01-14, día en que se retira MLA-C01). El banco de A11 no se publica antes de que exista la guía GA o, si se publica con la guía beta, se marca como tal.

---

## 1. Objetivo

Las 14 unidades de A10 y las 13 de A11 con lección y paquete; bancos reservados de DEA-C01 (3 × 65) y MLA-C02 (3 formas con el formato GA); proyectos «Pipeline de datos de punta a punta» (A10) y «Modelo en producción con MLOps» (A11).

## 2. Énfasis pedagógico

- **SQL y Spark de verdad:** los `LAB` de A10 que transforman datos usan el lenguaje `sql` del sandbox existente sobre tablas pequeñas; Spark se trabaja con lectura de código y `DEBUG`.
- **Particiones y formatos como decisión de costo:** preguntas que comparan bytes escaneados por Athena según partición y formato (con datos del enunciado).
- **ML sin perder la ingeniería:** A11 trata entrenamiento y despliegue como cualquier otro despliegue (registro, aprobación, reversión, monitoreo de deriva).

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Recursos oficiales de A10–A11 abiertos y leídos | `aws/course.seed.json` | Orquestador + persona |
| T2 | **Unidad molde AWS-U10.2.1** (lago de datos en S3) y revisión humana | `aws/units/AWS-U10.2.1.json` | Constructor + persona |
| T3–T15 | Resto de unidades de A10 | `aws/units/<código>.json` | Constructor |
| T16–T25 | Banco reservado DEA-C01 (3 × 65) | `aws/exam-bank/DEA-C01-D<n>-<lote>.json` | Constructor |
| T26 | Formas A, B y C de DEA-C01 | `aws/exam-forms/DEA-C01.json` | Constructor |
| T27 | **Unidad molde AWS-U11.3.1** (opciones de inferencia) y revisión humana | `aws/units/AWS-U11.3.1.json` | Constructor + persona |
| T28–T39 | Resto de unidades de A11 | `aws/units/<código>.json` | Constructor |
| T40–T52 | Banco reservado MLA-C02 (3 formas con el formato GA) | `aws/exam-bank/MLA-C02-D<n>-<lote>.json` | Constructor |
| T53 | Formas A, B y C de MLA-C02 | `aws/exam-forms/MLA-C02.json` | Constructor |
| T54 | Proyectos de A10 y A11 con rúbrica | `aws/projects.seed.json` | Constructor |
| T55 | Revisión humana de ambos lotes y bancos | `revision-pedagogica.md` | Persona |

## 4. Criterios de cierre

- [ ] 27 unidades cargadas; guardas en verde; `LAB` de SQL con solución que pasa y código inicial que falla.
- [ ] Bancos reservados completos con el formato y los pesos de cada guía.
- [ ] Revisión humana registrada.

## 5. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A10, A11)
