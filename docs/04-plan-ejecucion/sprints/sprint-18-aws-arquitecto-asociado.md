# Sprint 18 — Contenido AWS: A2, Arquitectura de soluciones asociado (SAA-C03)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 85 sesiones (en dos lotes) · **Depende de:** S17 (molde y proyectos por ruta), S16 (arnés `iam`, `network`, `cidr`, `cfn`, `dynamodb`, `s3access`), S15 (formas).
> **Ámbito:** contenido. Una unidad por sesión; las unidades con `LAB` de arnés usan una segunda sesión para los laboratorios.

---

## 1. Objetivo

A2 es la etapa central de la ruta: la mayoría de los roles reutiliza su arquitectura. Al cerrar el sprint, las 45 unidades tienen lección y paquete completo, el banco reservado de SAA-C03 tiene sus tres formas, y el proyecto «Aplicación web de tres capas altamente disponible» y su defensa existen.

## 2. Énfasis pedagógico

- **Decidir entre vecinos.** Cada módulo tiene preguntas que contrastan servicios parecidos: SQS frente a SNS frente a EventBridge; Multi-AZ frente a réplica de lectura; gateway frente a interface endpoint; ALB frente a NLB; Aurora frente a DynamoDB; Global Accelerator frente a CloudFront.
- **Los cuatro calificadores del examen** (seguro, resiliente, alto rendimiento, costo) aparecen en el banco con el peso de su dominio.
- **Ejecución con arnés:** evaluación de políticas (M2.1), subredes y alcanzabilidad (M2.2), acceso público a S3 (M2.4), diseño de claves de DynamoDB (M2.5), revisión de plantillas (M2.7).
- **Repaso acumulativo:** el 20 % de la cola diaria trae conceptos de A1.

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Recursos oficiales de A2 abiertos y leídos | `aws/course.seed.json` | Orquestador + persona |
| T2 | **Unidad molde AWS-U2.2.3** (security groups frente a NACL) con `LAB` de arnés `network`, y su revisión humana | `aws/units/AWS-U2.2.3.json` | Constructor + persona |
| T3–T27 | **Lote 1:** AWS-M2.1 a AWS-M2.5 (26 unidades; 25 sin el molde) | `aws/units/<código>.json` | Constructor |
| T28 | Revisión humana del lote 1 | `revision-pedagogica.md` | Persona |
| T29–T47 | **Lote 2:** AWS-M2.6 a AWS-M2.10 (19 unidades) | `aws/units/<código>.json` | Constructor |
| T48–T57 | Banco reservado SAA-C03: 3 formas × 65, lotes de ≤ 20 por dominio | `aws/exam-bank/SAA-C03-D<n>-<lote>.json` | Constructor |
| T58 | Formas A, B y C | `aws/exam-forms/SAA-C03.json` | Constructor |
| T59 | Proyecto de A2 con rúbrica (diseño, IaC, ADR por pilar, costo fechado, plan de DR) | `aws/projects.seed.json` | Constructor |
| T60 | Escenario de defensa técnica de A2 (SIM, rol arquitecto asociado) | semilla de entrevistas por ruta | Constructor |
| T61 | Revisión humana del lote 2 y del 100 % del banco reservado | `revision-pedagogica.md` | Persona |

## 4. Criterios de cierre

- [ ] 45 unidades cargadas; `seed-course-quality` en verde; toda unidad desde M2.1 con ≥ 2 preguntas de respuesta múltiple.
- [ ] Cada `LAB` con arnés: la solución pasa y el código inicial falla en el sandbox `docker`.
- [ ] 195 preguntas reservadas con el reparto de pesos de la guía.
- [ ] Molde, lotes y banco revisados por una persona distinta de quien redactó.
- [ ] Simulacro A de SAA-C03 jugable de punta a punta.

## 5. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A2)
- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md)
