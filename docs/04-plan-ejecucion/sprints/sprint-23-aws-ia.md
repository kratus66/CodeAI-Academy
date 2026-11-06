# Sprint 23 — Contenido AWS: A7 (AIF-C01) y A8 (AIP-C01)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 60 sesiones · **Depende de:** S17 (A1) para A7; S19 (A3) y A7 para A8.
> **Atención:** el formato de AIP-C01 (preguntas, minutos y tipos de ítem) y sus pesos se confirman en S14-T0 antes de escribir el banco.

---

## 1. Objetivo

Las 12 unidades de A7 y las 17 de A8 con lección y paquete; bancos reservados de AIF-C01 y AIP-C01 con tres formas cada uno; proyectos «Evaluación de un caso de uso de IA» (A7) y «Asistente RAG con guardrails y evaluación» (A8).

## 2. Énfasis pedagógico

- **Conexión con el currículo maestro:** A8 reutiliza lo construido en E9 (RAG, evaluación) y E10 (agentes, herramientas limitadas). Las unidades citan esas lecciones como conocimiento previo, no lo repiten.
- **La IA se audita:** `AUDIT` de prompts, definiciones de herramientas y configuraciones de guardrails generadas por IA (herramienta con permisos excesivos, datos personales sin filtrar, ausencia de fundamentación).
- **Cuidado con la volatilidad:** catálogo de modelos, precios por token y cuotas de Bedrock cambian a menudo; las preguntas razonan con datos que da el enunciado, nunca con cifras de memoria.

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Recursos oficiales de A7–A8 abiertos y leídos | `aws/course.seed.json` | Orquestador + persona |
| T2 | **Unidad molde AWS-U7.2.4** (RAG, agentes o ajuste fino) y revisión humana | `aws/units/AWS-U7.2.4.json` | Constructor + persona |
| T3–T13 | Resto de unidades de A7 | `aws/units/<código>.json` | Constructor |
| T14–T23 | Banco reservado AIF-C01 (3 × 65) | `aws/exam-bank/AIF-C01-D<n>-<lote>.json` | Constructor |
| T24 | Formas A, B y C de AIF-C01 | `aws/exam-forms/AIF-C01.json` | Constructor |
| T25 | **Unidad molde AWS-U8.1.3** (Knowledge Bases) y revisión humana | `aws/units/AWS-U8.1.3.json` | Constructor + persona |
| T26–T41 | Resto de unidades de A8 | `aws/units/<código>.json` | Constructor |
| T42–T53 | Banco reservado AIP-C01 (3 formas con el formato de la guía) | `aws/exam-bank/AIP-C01-D<n>-<lote>.json` | Constructor |
| T54 | Formas A, B y C de AIP-C01 | `aws/exam-forms/AIP-C01.json` | Constructor |
| T55 | Proyectos de A7 y A8 con rúbrica | `aws/projects.seed.json` | Constructor |
| T56 | Revisión humana de ambos lotes y bancos | `revision-pedagogica.md` | Persona |

## 4. Criterios de cierre

- [ ] 29 unidades cargadas; guardas en verde.
- [ ] Bancos reservados completos con el formato y los pesos de cada guía.
- [ ] Ninguna cifra de precio, cuota o catálogo de modelos sin fuente fechada.
- [ ] Revisión humana registrada.

## 5. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A7, A8)
- [`../../01-curriculo/curriculo-maestro.md`](../../01-curriculo/curriculo-maestro.md) (E9, E10)
