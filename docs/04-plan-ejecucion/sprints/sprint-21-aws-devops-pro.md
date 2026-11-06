# Sprint 21 — Contenido AWS: A5, DevOps profesional (DOP-C02)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 50 sesiones · **Depende de:** S19 (A3) y S20 (A4).

---

## 1. Objetivo

Las 23 unidades de A5 con lección y paquete, banco reservado de DOP-C02 con tres formas de 75 preguntas, proyecto «Plataforma de entrega multi-cuenta» y su defensa.

## 2. Énfasis pedagógico

- **Escenarios largos de nivel profesional:** enunciados de hasta diez frases con varias restricciones; distractores que cumplen todo menos una. La unidad AWS-U5.7.1 entrena explícitamente a separar requisitos, restricciones y ruido.
- **Pipelines como código revisable:** `AUDIT` de `buildspec`, `appspec` y plantillas generadas por IA (secretos impresos, dependencias sin fijar, roles excesivos).
- **Reversión probada:** todo despliegue que se enseña tiene su condición de reversión (alarma asociada, hooks de validación).
- **Repaso acumulativo:** conceptos de A3 y A4 en la cola diaria.

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Recursos oficiales de A5 abiertos y leídos | `aws/course.seed.json` | Orquestador + persona |
| T2 | **Unidad molde AWS-U5.1.4** (despliegues avanzados) y revisión humana | `aws/units/AWS-U5.1.4.json` | Constructor + persona |
| T3–T24 | Resto de unidades (AWS-U5.1.1 … AWS-U5.7.2) | `aws/units/<código>.json` | Constructor |
| T25–T36 | Banco reservado DOP-C02: 3 × 75, lotes de ≤ 20 por dominio | `aws/exam-bank/DOP-C02-D<n>-<lote>.json` | Constructor |
| T37 | Formas A, B y C | `aws/exam-forms/DOP-C02.json` | Constructor |
| T38 | Proyecto de A5 con rúbrica | `aws/projects.seed.json` | Constructor |
| T39 | Escenario SIM de DevOps Engineer | semilla de entrevistas | Constructor |
| T40 | Revisión humana del lote y del banco | `revision-pedagogica.md` | Persona |

## 4. Criterios de cierre

- [ ] 23 unidades cargadas; guardas en verde.
- [ ] 225 preguntas reservadas con el reparto de la guía; enunciados de nivel profesional (≥ 2 restricciones) en el 100 % del banco reservado.
- [ ] Revisión humana registrada.

## 5. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A5)
