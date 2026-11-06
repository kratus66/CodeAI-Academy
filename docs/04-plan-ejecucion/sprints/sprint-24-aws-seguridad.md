# Sprint 24 — Contenido AWS: A9, Seguridad (SCS-C03)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 40 sesiones · **Depende de:** S18 (A2) y S20 (A4); arnés `iam` en modo perímetro (S16).
> **Atención:** los dominios y pesos de SCS-C03 que figuran en el currículo vienen de fuentes de terceros; se reemplazan por los de la guía oficial (S14-T0) antes de escribir el banco.

---

## 1. Objetivo

Las 18 unidades de A9 con lección y paquete, banco reservado de SCS-C03 con tres formas, proyecto «Línea base de seguridad de una organización».

## 2. Énfasis pedagógico

- **Evaluación de políticas a fondo** con el arnés: identidad, recurso, SCP, RCP, límites de permisos, políticas de sesión y de endpoint en la misma petición.
- **Respuesta a incidentes como procedimiento:** contener sin destruir evidencia (snapshot antes de aislar), revocar sesiones de un rol comprometido, y su automatización.
- **Hallazgos verosímiles:** los `DEBUG` y `AUDIT` parten de hallazgos con la forma de GuardDuty, Security Hub o Access Analyzer (creados para el ejercicio, nunca copiados de cuentas reales).

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Recursos oficiales de A9 abiertos y leídos | `aws/course.seed.json` | Orquestador + persona |
| T2 | **Unidad molde AWS-U9.4.1** (evaluación de políticas a fondo) con `LAB` `iam`, y revisión humana | `aws/units/AWS-U9.4.1.json` | Constructor + persona |
| T3–T19 | Resto de unidades (AWS-U9.1.1 … AWS-U9.7.1) | `aws/units/<código>.json` | Constructor |
| T20–T29 | Banco reservado SCS-C03 (3 formas con el formato de la guía) | `aws/exam-bank/SCS-C03-D<n>-<lote>.json` | Constructor |
| T30 | Formas A, B y C | `aws/exam-forms/SCS-C03.json` | Constructor |
| T31 | Proyecto de A9 con rúbrica | `aws/projects.seed.json` | Constructor |
| T32 | Escenario SIM de respuesta a incidentes de seguridad | semilla de entrevistas | Constructor |
| T33 | Revisión humana del lote y del banco | `revision-pedagogica.md` | Persona |

## 4. Criterios de cierre

- [ ] 18 unidades cargadas; guardas en verde.
- [ ] Banco reservado con el formato y los pesos de la guía oficial (no los de terceros).
- [ ] Revisión humana registrada.

## 5. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A9)
