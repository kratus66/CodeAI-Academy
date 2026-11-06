# Sprint 22 — Contenido AWS: A6, Arquitectura de soluciones profesional (SAP-C03)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 52 sesiones · **Depende de:** S18 (A2) y uno de S19/S20.
> **Versión objetivo:** **SAP-C03** (GA 2026-11-17; SAP-C02 hasta 2026-11-16). Los cinco dominios son nuevos respecto a SAP-C02: **no se reutiliza material organizado por los dominios de C02**. Los pesos no venían en el anuncio: se toman de la guía (S14-T0).

---

## 1. Objetivo

Las 24 unidades de A6 con lección y paquete, banco reservado de SAP-C03 con tres formas de 75 preguntas, proyecto «Plataforma empresarial con migración» y su defensa ante panel.

## 2. Énfasis pedagógico

- **Requisitos en conflicto:** cada módulo tiene al menos un caso donde cumplir una restricción empeora otra (RTO frente a costo, regulación frente a operación, latencia frente a residencia de datos). La reflexión ADR pide la compensación explícita.
- **Escala organizativa:** multi-cuenta, perímetros de datos (SCP, RCP, políticas de endpoint), redes compartidas y gobierno de costos.
- **IA generativa como componente** (AWS-U6.2.5): cuotas, costos por token y privacidad como factores de arquitectura, no como tema de IA.
- **Lectura de escenarios largos** (AWS-U6.7.1) y simulacros con gestión de tiempo de 180 minutos.

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Recursos oficiales de A6 abiertos y leídos (incluida la guía SAP-C03) | `aws/course.seed.json` | Orquestador + persona |
| T2 | **Unidad molde AWS-U6.1.3** (redes multi-cuenta) y revisión humana | `aws/units/AWS-U6.1.3.json` | Constructor + persona |
| T3–T25 | Resto de unidades (AWS-U6.1.1 … AWS-U6.7.2) | `aws/units/<código>.json` | Constructor |
| T26–T37 | Banco reservado SAP-C03: 3 × 75, lotes de ≤ 20 por dominio | `aws/exam-bank/SAP-C03-D<n>-<lote>.json` | Constructor |
| T38 | Formas A, B y C | `aws/exam-forms/SAP-C03.json` | Constructor |
| T39 | Proyecto de A6 con rúbrica y requisitos en conflicto | `aws/projects.seed.json` | Constructor |
| T40 | Escenario SIM de defensa ante panel (arquitecto profesional) | semilla de entrevistas | Constructor |
| T41 | Revisión humana del lote y del banco | `revision-pedagogica.md` | Persona |

## 4. Criterios de cierre

- [ ] 24 unidades cargadas; guardas en verde.
- [ ] 225 preguntas reservadas repartidas por los pesos de la guía SAP-C03.
- [ ] Ninguna pregunta organizada por dominios de SAP-C02.
- [ ] Revisión humana registrada.

## 5. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A6)
