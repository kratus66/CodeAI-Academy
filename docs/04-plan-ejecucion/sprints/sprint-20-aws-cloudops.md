# Sprint 20 — Contenido AWS: A4, Operaciones en la nube (SOA-C03)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 45 sesiones · **Depende de:** S18 (A2), S16 (arnés `events`, `network`, `cfn`). Puede ejecutarse en paralelo con S19.

---

## 1. Objetivo

Las 22 unidades de A4 con lección y paquete, banco reservado de SOA-C03 con tres formas, proyecto «Operación con remediación automática» y su post-mortem.

## 2. Énfasis pedagógico

- **Diagnóstico con evidencia:** `DEBUG` y simulaciones a partir de registros (VPC Flow Logs, eventos de un stack de CloudFormation, métricas de una alarma) en lugar de código.
- **Automatizar la segunda vez:** cada tarea manual que se enseña tiene su versión automatizada (documento de SSM, regla de Config con remediación, patrón de EventBridge).
- **Laboratorio en tu cuenta** (opcional): alarma de CloudWatch con SNS y documento de SSM sobre recursos de costo cero o casi cero, con lista de limpieza.

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Recursos oficiales de A4 abiertos y leídos | `aws/course.seed.json` | Orquestador + persona |
| T2 | **Unidad molde AWS-U4.1.3** (EventBridge y remediación automática) y revisión humana | `aws/units/AWS-U4.1.3.json` | Constructor + persona |
| T3–T23 | Resto de unidades (AWS-U4.1.1 … AWS-U4.7.1) | `aws/units/<código>.json` | Constructor |
| T24–T33 | Banco reservado SOA-C03: 3 × 65, lotes de ≤ 20 por dominio | `aws/exam-bank/SOA-C03-D<n>-<lote>.json` | Constructor |
| T34 | Formas A, B y C | `aws/exam-forms/SOA-C03.json` | Constructor |
| T35 | Proyecto de A4 con rúbrica (incluye post-mortem sin culpables) | `aws/projects.seed.json` | Constructor |
| T36 | Escenario SIM de CloudOps (respuesta a un incidente con registros) | semilla de entrevistas | Constructor |
| T37 | Revisión humana del lote y del banco | `revision-pedagogica.md` | Persona |

## 4. Criterios de cierre

- [ ] 22 unidades cargadas; guardas en verde.
- [ ] 195 preguntas reservadas con el reparto de la guía.
- [ ] Todo `CLOUD_LAB` declara costo, región, etiqueta y limpieza.
- [ ] Revisión humana registrada.

## 5. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A4)
