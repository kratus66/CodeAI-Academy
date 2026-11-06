# Sprint 19 — Contenido AWS: A3, Desarrollo en AWS (DVA-C03)

> **Estado:** ⬜ pendiente · **Duración prevista:** ≈ 60 sesiones · **Depende de:** S18 (A2 publicada), S16 (arnés `dynamodb`, `events`, `asl`, `cfn`).
> **Versión objetivo:** **DVA-C03** (GA 2026-12-01; DVA-C02 se puede presentar hasta 2026-11-30). Dominios y pesos ✅ del anuncio oficial; la tarea 2.3 (seguridad de IA) se escribe sólo con el texto de la guía (S14-T0).

---

## 1. Objetivo

Las 32 unidades de A3 con lección y paquete, banco reservado de DVA-C03 con tres formas, proyecto «API serverless con CI/CD» y su defensa.

## 2. Énfasis pedagógico

- **Se programa de verdad:** los `LAB` de A3 son manejadores Lambda en TypeScript con dependencias inyectadas (clientes de DynamoDB, SQS o S3 sustituidos por dobles del arnés), probados con eventos de API Gateway, SQS y DynamoDB Streams. Reutiliza E2 y E7 del currículo maestro.
- **Errores reales del desarrollador:** reintentos sin idempotencia, `Scan` en lugar de `Query`, secretos en variables o logs, tiempo de visibilidad menor que la duración del proceso, permisos `*` en roles de ejecución.
- **Despliegue como decisión:** preguntas y retos que eligen estrategia (canary, lineal, azul/verde) según el riesgo descrito.

## 3. Tareas

| ID | Tarea | Archivo | Responsable |
|----|-------|---------|-------------|
| T1 | Recursos oficiales de A3 abiertos y leídos | `aws/course.seed.json` | Orquestador + persona |
| T2 | Dobles de prueba del arnés para el SDK (DynamoDB, SQS, S3, Secrets Manager) con la misma forma de comando que el SDK v3, si el ADR de S16 los ubica en el arnés | según ADR de S16 | Constructor |
| T3 | **Unidad molde AWS-U3.2.5** (manejadores que se pueden probar) y revisión humana | `aws/units/AWS-U3.2.5.json` | Constructor + persona |
| T4–T34 | Resto de unidades (AWS-U3.1.1 … AWS-U3.8.1) | `aws/units/<código>.json` | Constructor |
| T35–T44 | Banco reservado DVA-C03: 3 × 65, lotes de ≤ 20 por dominio | `aws/exam-bank/DVA-C03-D<n>-<lote>.json` | Constructor |
| T45 | Formas A, B y C | `aws/exam-forms/DVA-C03.json` | Constructor |
| T46 | Proyecto de A3 con rúbrica | `aws/projects.seed.json` | Constructor |
| T47 | Escenario SIM de desarrollador cloud | semilla de entrevistas | Constructor |
| T48 | Revisión humana del lote y del banco | `revision-pedagogica.md` | Persona |

## 4. Criterios de cierre

- [ ] 32 unidades cargadas; guardas en verde; `LAB` con solución que pasa y código inicial que falla.
- [ ] 195 preguntas reservadas con pesos 30/26/22/22.
- [ ] Ninguna pregunta de DVA-C02 retirada mezclada en las formas de C03.
- [ ] Revisión humana registrada.

## 5. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A3)
