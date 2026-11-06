# Sprint 16 — Laboratorios AWS: arnés en el sandbox y laboratorio en tu cuenta

> **Estado:** ⬜ pendiente · **Duración prevista:** 14–16 sesiones · **Depende de:** S14, y del **sandbox `docker` como modo por defecto** (S11-T16). Sin sandbox real, los laboratorios con arnés no certifican nada (misma regla que E0–E2).
> **Ámbito:** biblioteca de evaluadores, integración con `sandbox`, tipo de ejercicio `CLOUD_LAB` y su reproductor. Fichas detalladas al abrir el sprint.
> **Por qué existe:** las preguntas entrenan la decisión; el trabajo exige escribir políticas, redes, plantillas y código que funcionen. El sandbox no puede ni debe llamar a AWS, así que los laboratorios se corrigen con **evaluadores puros y fieles** (arnés) y, de forma opcional y nunca certificante, con práctica en la cuenta propia.

---

## 1. Objetivo

Al cerrar el sprint:

- existe el **arnés AWS** con nueve evaluadores (`iam`, `cidr`, `network`, `events`, `cfn`, `dynamodb`, `s3access`, `asl`, `cost`), cada uno con su alcance declarado y pruebas doradas tomadas de ejemplos de la documentación oficial;
- un `LAB` o `DEBUG` con `config.harness` puede importar el arnés dentro del sandbox y sus pruebas ocultas lo usan;
- existe `CLOUD_LAB`: pasos guiados, costo esperado, lista de limpieza y validación de evidencia de solo lectura con enmascarado de identificadores;
- hay **cuatro laboratorios piloto** de punta a punta: AWS-U0.3.1 (`cidr`), AWS-U2.1.1 (`iam`), AWS-U2.2.3 (`network`) y un `CLOUD_LAB` de AWS-U0.2.2 (presupuesto con alerta).

## 2. Decisiones de diseño

**2.1 Fidelidad antes que alcance.** Cada evaluador modela un subconjunto **declarado** del comportamiento de AWS y lo prueba contra ejemplos documentados (URL en cada prueba dorada). Ningún ejercicio puede depender de lo no modelado; la guarda de calidad lo comprueba con la lista de capacidades del evaluador. Revisión humana obligatoria de cada evaluador antes de usarlo en contenido.

**2.2 Dónde vive el arnés.** Se decide en un ADR al abrir el sprint (T0), con dos opciones: (a) paquete del monorepo `packages/aws-harness` compilado e inyectado en la imagen del sandbox como módulo importable; (b) preludio de código que el adaptador antepone al del estudiante cuando `config.harness` está presente. Criterios: aislamiento, tamaño, que el estudiante no pueda modificar el arnés, y que la misma versión corra en pruebas de la API.

**2.3 Laboratorios en TypeScript.** El estudiante exporta un valor (`export const policy = {…}`, `export const template = {…}`) o una función (manejador Lambda con dependencias inyectadas). Así se reutilizan el lenguaje y el corrector existentes.

**2.4 `CLOUD_LAB` nunca certifica nivel 3** y nunca pide credenciales: la evidencia es la salida JSON de comandos `describe`/`get`; el servidor valida rutas JSON esperadas, enmascara números de cuenta y ARN, y no guarda la salida en bruto. Reglas completas en [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §4.2.

## 3. Tareas

| ID | Tarea | Responsable |
|----|-------|-------------|
| T0 | ADR: ubicación del arnés e integración con el sandbox (opciones de §2.2) | Orquestador |
| T1 | Evaluador `cidr` (solapes, división, 5 direcciones reservadas por subred) + pruebas doradas | Constructor |
| T2 | Evaluador `iam`: lógica de evaluación (denegación explícita, permisos de identidad y de recurso, SCP, RCP, límites de permisos, políticas de sesión), comodines y subconjunto declarado de condiciones | Constructor (2 sesiones: núcleo y condiciones) |
| T3 | Evaluador `network`: rutas por prefijo más largo, security groups con estado, NACL sin estado con orden de reglas y puertos efímeros | Constructor |
| T4 | Evaluador `events` (patrones de EventBridge documentados) | Constructor |
| T5 | Evaluador `cfn`: estructura, `Ref`/`Fn::GetAtt`, ciclos de dependencias, reglas de seguridad configurables | Constructor |
| T6 | Evaluadores `dynamodb` (patrones de acceso sin `Scan`) y `s3access` (Block Public Access + política de bucket) | Constructor |
| T7 | Evaluadores `asl` (estructura de Step Functions) y `cost` (tabla de precios del enunciado) | Constructor |
| T8 | Revisión humana de los evaluadores contra la documentación; registro en `docs/03-arquitectura/arnes-aws.md` | Persona + Orquestador |
| T9 | Integración con el sandbox según el ADR; prueba de que el estudiante no puede sustituir el arnés | Constructor |
| T10 | Semilla: `config.harness` en `LAB`/`DEBUG`; guarda que ejecuta la solución (pasa) y el código inicial (falla) con el arnés | Constructor |
| T11 | `CLOUD_LAB`: valor de enum y migración, esquema de semilla (pasos, costo, región, etiqueta, limpieza, comprobaciones de evidencia) | Constructor |
| T12 | API de evidencia: `POST /api/exercises/:id/cloud-evidence` con enmascarado y sin guardar la salida en bruto | Constructor |
| T13 | `CloudLabPlayer`: aviso de costo y seguridad, pasos, evidencia por comprobación, confirmación de limpieza | Constructor |
| T14 | Cuatro laboratorios piloto (uno por sesión) | Constructor |
| T15 | Documentación: `sandbox-ejecucion.md`, `banco-ejercicios.md`, `metodo-aws.md` §4 | Orquestador |

## 4. Criterios de cierre

- [ ] Cada evaluador declara su alcance y tiene pruebas doradas con URL de la documentación; T8 firmado.
- [ ] Los cuatro pilotos funcionan contra el sandbox `docker`; la solución pasa y el código inicial falla.
- [ ] La evidencia de `CLOUD_LAB` nunca se guarda en bruto y enmascara identificadores (prueba con una salida real anonimizada).
- [ ] Ningún `CLOUD_LAB` concede nivel 3 (prueba).
- [ ] Suite completa, typecheck, lint y build en verde.

## 5. Documentos relacionados

- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §4.1–§4.2
- [`../../03-arquitectura/sandbox-ejecucion.md`](../../03-arquitectura/sandbox-ejecucion.md)
- [`sprint-11-analitica-lanzamiento.md`](sprint-11-analitica-lanzamiento.md) (T16, sandbox `docker`)
