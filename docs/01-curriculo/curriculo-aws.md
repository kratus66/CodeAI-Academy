# Currículo de la ruta AWS Cloud

> **Fuente de verdad del contenido de la ruta AWS.** Define etapas, certificaciones objetivo, módulos, unidades, competencias, prerrequisitos, horas y criterios de dominio.
> Aplica la misma pedagogía que el currículo maestro ([`../00-vision/fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md)); cómo se adapta a la preparación de certificaciones está en [`../02-contenido/metodo-aws.md`](../02-contenido/metodo-aws.md).
> **Fecha de redacción:** 2026-11-06 · **Estado:** 📝 planificado; nada construido todavía (ver sprints S13–S26 en [`../04-plan-ejecucion/roadmap-sprints.md`](../04-plan-ejecucion/roadmap-sprints.md)).

---

## 1. Propósito y promesa

La ruta prepara a una persona para **aprobar los exámenes de certificación de AWS** de los roles de arquitectura y desarrollo, y para **hacer el trabajo** que esos exámenes describen. Las dos cosas se miden por separado:

| Se mide | Con qué | Por qué no basta lo otro |
|---------|---------|--------------------------|
| Preparación para el examen | Preguntas de escenario, simulacros cronometrados por dominio, criterio «listo para presentar» (§6) | Quien sólo hace laboratorios suele fallar preguntas de elección entre servicios parecidos |
| Capacidad profesional | Laboratorios con arnés, depuración de configuraciones, auditoría de código generado por IA, proyecto por etapa y defensa | Quien sólo memoriza preguntas aprueba y no sabe operar una VPC |

**Lo que la plataforma no promete:** no garantiza aprobar (AWS puntúa con su propio método escalado y cambia los exámenes), y **no está afiliada ni avalada por Amazon Web Services**. «AWS» y los nombres de los servicios son marcas de Amazon.com, Inc. o sus filiales; la ruta los usa sólo para describir el temario. Este aviso se muestra en la página de la ruta.

---

## 2. Certificaciones objetivo

Datos comprobados el **2026-11-06** contra las páginas oficiales de AWS ([anuncio de septiembre de 2026](https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/), [catálogo de exámenes](https://aws.amazon.com/certification/exams/) y las páginas de cada certificación). La columna «Verificado» distingue lo leído en una fuente oficial (✅, guías de examen verificadas el 2026-11-09 en S14-T0) de lo que sigue pendiente (🔎).

| Etapa | Certificación | Código objetivo | Nivel AWS | Preguntas / minutos | Estado al 2026-11-06 | Verificado |
|-------|---------------|-----------------|-----------|---------------------|----------------------|------------|
| A1 | Cloud Practitioner | CLF-C02 | Fundamental | 65 (50 puntuadas) / 90; aprobado 700 | Vigente | ✅ |
| A2 | Solutions Architect – Associate | SAA-C03 | Asociado | 65 (50 puntuadas) / 130; aprobado 720 | Vigente | ✅ |
| A3 | Developer – Associate | **DVA-C03** | Asociado | 65 (50 puntuadas) / 130; aprobado 720/1000 | DVA-C03 en GA desde **2026-12-01**; DVA-C02 hasta 2026-11-30 | ✅ |
| A4 | CloudOps Engineer – Associate (antes SysOps Administrator) | SOA-C03 | Asociado | 65 (50 puntuadas) / 130; aprobado 720 | SOA-C03 en uso desde 2025-09-30 | ✅ |
| A5 | DevOps Engineer – Professional | DOP-C02 | Profesional | 75 (65 puntuadas) / 180; aprobado 750 | Vigente | ✅ |
| A6 | Solutions Architect – Professional | **SAP-C03** | Profesional | 75 (65 puntuadas) / 180; aprobado 720 | SAP-C03 en GA desde **2026-11-17**; SAP-C02 hasta 2026-11-16 | ✅ |
| A7 | AI Practitioner | AIF-C01 | Fundamental | 65 (50 puntuadas) / 90; aprobado 700; incluye ordenar y emparejar | Vigente | ✅ |
| A8 | Generative AI Developer – Professional | AIP-C01 | Profesional | 75 (65 puntuadas) / 180; aprobado 750 | Vigente | ✅ |
| A9 | Security – Specialty | SCS-C03 | Especialidad | 65 (50 puntuadas) / 170; aprobado 750; incluye ordenar y emparejar | En uso desde 2025-12-02 (sustituyó a SCS-C02) | ✅ |
| A10 | Data Engineer – Associate | DEA-C01 | Asociado | 65 (50 puntuadas) / 130; aprobado 720 | Vigente | ✅ |
| A11 | Machine Learning Engineer – Associate | **MLA-C02** | Asociado | Beta: 85 / 170; aprobado 720 | Beta desde 2026-09-29; GA **2027-01-14** (ese día se retira MLA-C01) | ✅ beta · 🔎 GA y reparto de puntuadas de la beta |

Detalle, fuentes y URL de cada guía: [`../02-contenido/aws-guias-examen.md`](../02-contenido/aws-guias-examen.md).

**Excluidas a propósito**

| Certificación | Motivo |
|---------------|--------|
| Advanced Networking – Specialty (ANS-C01) | Se retira el **2026-12-31** ✅. Sus temas de redes se cubren en A2, A4 y A6 |
| Machine Learning – Specialty (MLS-C01) | Retirada (dato de terceros: 2026-03-31 🔎). Su sustituto práctico es MLA-C02 |
| AI Business Strategist (beta) | Perfil de negocio, no de desarrollo |

**Regla de vigencia:** cada ejercicio declara el código de examen al que apunta (`SAA-C03`, `DVA-C03`…). Cuando AWS anuncia una versión nueva, se abre una tarea de actualización (ver [`../02-contenido/metodo-aws.md`](../02-contenido/metodo-aws.md) §12). Ningún simulacro mezcla versiones.

---

## 3. Estructura de la ruta

13 etapas en 4 niveles. El **núcleo** (A0–A6 + A12) cubre arquitectura y los roles de desarrollo y operación; las **especializaciones** (A7–A11) son optativas y se abren según los prerrequisitos.

| Nivel | Nombre | Etapas | Rol que acredita |
|-------|--------|--------|------------------|
| **1** | Fundamentos cloud | A0, A1 | Base común |
| **2** | Asociado (núcleo de roles) | A2, A3, A4 | Arquitecto asociado · Desarrollador · CloudOps |
| **3** | Profesional | A5, A6 | DevOps Engineer · Arquitecto profesional |
| **4** | Especialización y profesionalización | A7–A12 | IA generativa · Seguridad · Datos · ML · Portafolio |

```
NIVEL 1 · FUNDAMENTOS CLOUD
  A0  Diagnóstico, cuenta segura y nivelación          [20–30 h]   sin examen
  A1  Fundamentos de la nube                           [30–45 h]   CLF-C02
NIVEL 2 · ASOCIADO
  A2  Arquitectura de soluciones (asociado)            [120–160 h] SAA-C03
  A3  Desarrollo en AWS                                [80–110 h]  DVA-C03
  A4  Operaciones en la nube (CloudOps)                [60–90 h]   SOA-C03
NIVEL 3 · PROFESIONAL
  A5  DevOps profesional                               [90–130 h]  DOP-C02
  A6  Arquitectura de soluciones profesional           [110–150 h] SAP-C03
NIVEL 4 · ESPECIALIZACIÓN Y PROFESIONALIZACIÓN
  A7  Fundamentos de IA en AWS                         [25–40 h]   AIF-C01
  A8  Desarrollo de IA generativa                      [70–100 h]  AIP-C01
  A9  Seguridad                                        [60–90 h]   SCS-C03
  A10 Ingeniería de datos                              [50–80 h]   DEA-C01
  A11 Ingeniería de ML                                 [50–80 h]   MLA-C02
  A12 Portafolio, entrevistas y vigencia               [30–50 h]   sin examen

NÚCLEO (A0–A6 + A12): 540–765 h · ESPECIALIZACIONES (A7–A11): 255–390 h
```

Las horas son **estimaciones de planificación**, no resultados medidos; se recalibran con los datos de las primeras cohortes. A 10 h/semana, el núcleo son unos 13–18 meses.

### 3.1 Identificadores en la plataforma

La ruta convive con el currículo maestro en la misma base de datos (sprint S13). Para que no choquen:

| Elemento | Currículo maestro | Ruta AWS | Regla |
|----------|-------------------|----------|-------|
| Ruta (`Course.slug`) | `fullstack-ia` | `aws-cloud` | — |
| Id de etapa | 0–11 | **100–112** | número de etapa en la ruta = id − 100 (A2 → 102) |
| Etiqueta visible | `E2` | `A2` | — |
| Slug de etapa | `e2-…` | `aws2-…` | — |
| Código de módulo | `M2.3` | `AWS-M2.3` | el número tras la `M` es el de la etapa en la ruta |
| Código de unidad | `U2.3.1` | `AWS-U2.3.1` | — |
| Competencias | `C1`–`C14` | `AWS-C1`–`AWS-C15` | §4 |

---

## 4. Mapa de competencias AWS

| Código | Competencia (capacidad observable) | Etapas principales | Nivel exigido al egreso |
|--------|------------------------------------|--------------------|-------------------------|
| **AWS-C1** | Explicar la nube, la infraestructura global, el modelo de responsabilidad compartida y los modelos de precio | A1 | 3 |
| **AWS-C2** | Diseñar y depurar identidades y permisos (IAM, Organizations, federación) con mínimo privilegio | A2, A9 | 3 |
| **AWS-C3** | Diseñar y diagnosticar redes (VPC, conectividad híbrida, DNS, entrega de contenido) | A2, A4, A6 | 3 |
| **AWS-C4** | Elegir, dimensionar y escalar cómputo (EC2, contenedores, serverless) | A2 | 3 |
| **AWS-C5** | Elegir y configurar almacenamiento y bases de datos según los patrones de acceso | A2, A3 | 3 |
| **AWS-C6** | Integrar servicios con mensajería, eventos, APIs y orquestación | A2, A3 | 3 |
| **AWS-C7** | Desarrollar con el SDK y serverless, probar y depurar aplicaciones | A3 | 3 |
| **AWS-C8** | Automatizar infraestructura y entrega (IaC, CI/CD, estrategias de despliegue) | A3, A5 | 3 |
| **AWS-C9** | Operar y observar cargas (métricas, logs, trazas, remediación automática) | A4, A5 | 3 |
| **AWS-C10** | Proteger datos y cargas (cifrado, secretos, detección, respuesta a incidentes) | A2, A9 | 3 |
| **AWS-C11** | Diseñar resiliencia, recuperación ante desastres y migraciones | A2, A4, A6 | 3 |
| **AWS-C12** | Optimizar costo y rendimiento con criterios de Well-Architected | A2, A6 | 3 |
| **AWS-C13** | Decidir y defender arquitecturas ante requisitos en conflicto (ADR, examen, entrevista) | A2, A6, A12 | 4 |
| **AWS-C14** | Construir y gobernar soluciones de IA y ML en AWS | A7, A8, A11 | 3 |
| **AWS-C15** | Construir y operar pipelines y almacenes de datos | A10, A11 | 3 |

### 4.1 Matriz etapa × competencia

● principal · ○ secundaria · · no se trabaja

| Etapa | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | C13 | C14 | C15 |
|-------|----|----|----|----|----|----|----|----|----|-----|-----|-----|-----|-----|-----|
| A0 | ○ | ○ | ○ | · | · | · | · | · | · | · | · | · | · | · | · |
| A1 | ● | ○ | · | · | · | · | · | · | · | ○ | · | ○ | · | · | · |
| A2 | · | ● | ● | ● | ● | ● | · | · | · | ○ | ● | ● | ● | · | · |
| A3 | · | · | · | ○ | ○ | ● | ● | ● | ○ | ○ | · | · | · | · | · |
| A4 | · | · | ○ | · | · | · | · | ○ | ● | ○ | ● | ○ | · | · | · |
| A5 | · | · | · | · | · | · | · | ● | ● | ○ | ○ | · | · | · | · |
| A6 | · | ○ | ● | · | · | · | · | · | · | · | ● | ● | ● | · | · |
| A7 | · | · | · | · | · | · | · | · | · | · | · | · | · | ○ | · |
| A8 | · | · | · | · | · | · | ○ | · | · | · | · | · | · | ● | · |
| A9 | · | ● | · | · | · | · | · | · | · | ● | · | · | · | · | · |
| A10 | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ● |
| A11 | · | · | · | · | · | · | · | · | · | · | · | · | · | ● | ○ |
| A12 | · | · | · | · | · | · | · | · | · | · | · | · | ● | · | · |

### 4.2 Competencias críticas por certificación

Para declarar a alguien «listo para presentar» (§6) se exige **nivel 3** en las competencias críticas de esa certificación.

| Certificación | Competencias críticas |
|---------------|-----------------------|
| CLF-C02 | AWS-C1 |
| SAA-C03 | AWS-C2, AWS-C3, AWS-C5, AWS-C11, AWS-C13 |
| DVA-C03 | AWS-C6, AWS-C7, AWS-C8 |
| SOA-C03 | AWS-C9, AWS-C11 |
| DOP-C02 | AWS-C8, AWS-C9 |
| SAP-C03 | AWS-C11, AWS-C12, AWS-C13 |
| AIF-C01 | AWS-C14 (nivel 2 basta: examen fundamental) |
| AIP-C01 | AWS-C14 |
| SCS-C03 | AWS-C2, AWS-C10 |
| DEA-C01 | AWS-C15 |
| MLA-C02 | AWS-C14, AWS-C15 |

---

## 5. Grafo de prerrequisitos

```
A0 ──► A1 ──► A2 ──┬──► A3 ──┐
                   │         ├──► A5 (DevOps Pro)
                   ├──► A4 ──┘
                   ├──► A6 (Arquitecto Pro; requiere A2 y uno de A3/A4)
                   ├──► A9 (Seguridad; requiere A2 y A4)
                   └──► A10 (Datos)
A1 ──► A7 ──► A8 (IA generativa; requiere también A3)
A7 + A10 ──► A11 (ML)
A5 o A6 ──► A12
```

**Reglas:**

- Una etapa se inicia con sus prerrequisitos **certificados** en la plataforma (unidades en `MASTERED`), igual que en el currículo maestro.
- **A3 y A4 pueden cursarse en paralelo** tras A2.
- **Prerrequisitos entre rutas (recomendación, no bloqueo en la primera versión):** A3 y A8 programan en TypeScript; se recomienda E2 del currículo maestro certificado o aprobar la sección de programación del diagnóstico de A0. La plataforma lo indica en la etapa, no lo bloquea (deuda declarada en S13).
- AWS no exige prerrequisitos para presentar sus exámenes; esta ruta sí los exige para **estudiar** porque cada nivel reutiliza el anterior (intercalado y repaso acumulativo).

---

## 6. Criterio «listo para presentar»

Una persona está lista para presentar el examen de una etapa cuando cumple **todo** lo siguiente:

1. **Dominio:** todas las unidades de la etapa en `MASTERED` (≥ 80 % en la evaluación de cada módulo y nivel 3 en las competencias críticas de §4.2).
2. **Simulacros:** al menos **dos formas distintas** del simulacro completo con **≥ 80 % de aciertos** y **ningún dominio por debajo del 70 %**, la última dentro de los 14 días previos.
3. **Repaso al día:** ningún ítem de la etapa con más de 7 días de retraso en la cola SM-2.
4. **Evidencia profesional:** proyecto de la etapa aprobado (≥ 70 en la rúbrica) y defensa técnica (SIM) realizada.

El 80 % es una **regla inicial con margen** sobre el corte de AWS, que es el aprobado de cada examen (puntuación escalada y compensatoria; ver [`../02-contenido/aws-guias-examen.md`](../02-contenido/aws-guias-examen.md)). La plataforma **no imita la puntuación escalada**: muestra porcentaje de aciertos por dominio. La regla se recalibra con los resultados reales que las personas registren voluntariamente (S15-T10).

Mientras las formas de un simulacro no tengan revisión humana (`reviewedByHuman`), su resultado se muestra como **orientativo** y no cuenta para el criterio 2.

**Aplicación en la plataforma (S15):**
- El criterio 1 exige hoy que todas las unidades **publicadas** de la etapa estén en `MASTERED`. El «nivel 3 en las competencias críticas» se añadirá cuando esas competencias existan en los datos.
- El criterio 4 se muestra «aún no disponible» hasta que existan los escenarios SIM de AWS (S26). Mientras tanto, nadie sale «listo para presentar».

---

## 7. Convenciones de esta especificación

Igual que el currículo maestro: cada etapa declara objetivo, certificación, competencias, horas, dominios del examen, módulos (con el dominio que cubren entre corchetes), unidades, ejercicios clave, proyecto y criterio de dominio. Cada unidad genera **una lección de 7 pasos y su paquete de ejercicios** (mínimos en [`../02-contenido/metodo-aws.md`](../02-contenido/metodo-aws.md) §6).

---

# NIVEL 1 · FUNDAMENTOS CLOUD

## A0 — Diagnóstico, cuenta segura y nivelación

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Tener una cuenta de estudio segura y con costos vigilados, conocer el formato de los exámenes y cerrar las lagunas de redes, Linux y formatos de configuración |
| **Certificación** | Ninguna (prepara todas) |
| **Competencias** | AWS-C1, AWS-C2, AWS-C3 (base) |
| **Horas** | 20–30 |
| **Prerrequisitos** | Ninguno |

### Módulos

**AWS-M0.1 — Cómo se certifica y cómo se estudia**
- AWS-U0.1.1 El mapa de certificaciones AWS, los roles que acreditan y sus versiones vigentes
- AWS-U0.1.2 Anatomía de una pregunta de examen: escenario, restricción y calificador («MOST cost-effective», «LEAST operational overhead»)
- AWS-U0.1.3 Método de estudio: repaso espaciado, simulacros y registro de errores
- AWS-U0.1.4 El día del examen: modalidades, políticas, idiomas y adaptación por idioma no nativo
- AWS-U0.1.5 Prueba diagnóstica sin ayuda (redes, Linux, HTTP, programación, bases de datos)

**AWS-M0.2 — Cuenta segura antes de construir**
- AWS-U0.2.1 Usuario raíz, MFA y contactos de seguridad
- AWS-U0.2.2 Presupuestos, alertas de facturación y condiciones vigentes de la capa gratuita
- AWS-U0.2.3 IAM Identity Center y credenciales temporales para la CLI
- AWS-U0.2.4 AWS CLI y CloudShell: perfiles, regiones y salida JSON
- AWS-U0.2.5 Desmontar lo que creas: etiquetas, Resource Groups y lista de limpieza

**AWS-M0.3 — Nivelación técnica**
- AWS-U0.3.1 Redes IP: direcciones, CIDR y cálculo de subredes
- AWS-U0.3.2 DNS, TCP/UDP, puertos y TLS
- AWS-U0.3.3 HTTP, APIs REST y JSON: leer peticiones y respuestas
- AWS-U0.3.4 Linux mínimo para servidores: SSH, permisos, procesos y logs
- AWS-U0.3.5 JSON y YAML: los formatos de políticas y plantillas

### Ejercicios clave
1. Clasificar enunciados por su calificador y descartar opciones que no lo cumplen (quiz de escenario).
2. Calcular subredes y direcciones utilizables con la reserva de AWS (lab con arnés `cidr`).
3. Corregir un JSON de política mal formado (debug de configuración).
4. Memory: herramienta de seguridad de cuenta ↔ riesgo que mitiga.
5. Laboratorio en tu cuenta: MFA, presupuesto con alerta y usuario de Identity Center (evidencia sin credenciales).

### Proyecto
**Cuenta de estudio segura:** lista de comprobación con evidencia (MFA en raíz, presupuesto con alerta, usuario de Identity Center, perfil de CLI con credenciales temporales, política de etiquetado y rutina de limpieza). Nunca se entregan credenciales ni identificadores de cuenta sin enmascarar.

### Criterio de dominio
- Lista de comprobación de la cuenta al 100 %.
- Diagnóstico completado sin asistencia (mide línea base; genera el plan individual).

---

## A1 — Fundamentos de la nube

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Explicar qué ofrece AWS, cómo se paga, quién es responsable de qué y qué servicio resuelve cada necesidad básica |
| **Certificación** | AWS Certified Cloud Practitioner (CLF-C02) |
| **Competencias** | AWS-C1 ● · AWS-C2, AWS-C10, AWS-C12 ○ |
| **Horas** | 30–45 |
| **Prerrequisitos** | A0 |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Conceptos de la nube | 24 % |
| D2 | Seguridad y cumplimiento | 30 % |
| D3 | Tecnología y servicios de la nube | 34 % |
| D4 | Facturación, precios y soporte | 12 % |

### Módulos

**AWS-M1.1 — Conceptos de la nube [D1]**
- AWS-U1.1.1 Beneficios de la nube y economía de escala
- AWS-U1.1.2 Modelos de servicio y de despliegue
- AWS-U1.1.3 Infraestructura global: regiones, zonas de disponibilidad, ubicaciones de borde y Local Zones
- AWS-U1.1.4 AWS Well-Architected Framework: los seis pilares
- AWS-U1.1.5 Estrategias de migración (las 7 R) y Cloud Adoption Framework

**AWS-M1.2 — Seguridad y cumplimiento [D2]**
- AWS-U1.2.1 Modelo de responsabilidad compartida
- AWS-U1.2.2 IAM: usuarios, grupos, roles, políticas y mínimo privilegio
- AWS-U1.2.3 Servicios de seguridad: GuardDuty, Inspector, Security Hub, Shield, WAF y Macie
- AWS-U1.2.4 Gobierno y cumplimiento: Organizations, SCP, CloudTrail, Config y Artifact
- AWS-U1.2.5 Cifrado y secretos: KMS, cifrado en reposo y en tránsito, Secrets Manager

**AWS-M1.3 — Tecnología y servicios [D3]**
- AWS-U1.3.1 Formas de usar AWS: consola, CLI, SDK e infraestructura como código
- AWS-U1.3.2 Cómputo: EC2, contenedores (ECS, EKS, Fargate) y Lambda
- AWS-U1.3.3 Almacenamiento: S3 y sus clases, EBS, EFS, Storage Gateway y AWS Backup
- AWS-U1.3.4 Bases de datos: RDS, Aurora, DynamoDB, ElastiCache y Redshift
- AWS-U1.3.5 Redes y entrega de contenido: VPC, Route 53, CloudFront, ELB, VPN y Direct Connect
- AWS-U1.3.6 Integración, analítica e IA: SQS, SNS, EventBridge, Kinesis, Athena, Glue, Bedrock y SageMaker AI

**AWS-M1.4 — Facturación, precios y soporte [D4]**
- AWS-U1.4.1 Modelos de precio de cómputo: bajo demanda, Savings Plans, instancias reservadas y Spot
- AWS-U1.4.2 Herramientas de costo: Pricing Calculator, Cost Explorer, Budgets, informes de costo y etiquetas de asignación
- AWS-U1.4.3 Planes de soporte, AWS Marketplace, Trusted Advisor y recursos de ayuda

**AWS-M1.5 — Preparación del examen**
- AWS-U1.5.1 Simulacros CLF-C02 y plan de refuerzo por dominio

### Ejercicios clave
1. Memory (modo unir): servicio ↔ problema que resuelve, por familia.
2. Quiz de escenario: ¿de quién es la responsabilidad? (cliente, AWS o compartida) con justificación.
3. Reto cronometrado por dominio: 20 preguntas en 30 minutos.
4. Reflexión: comparar dos modelos de precio para una carga con picos.

### Proyecto
**Propuesta de nube para una pyme:** elegir servicios para un caso dado, estimar costo con Pricing Calculator (precios con fecha de consulta), mapear la responsabilidad compartida y justificar con los pilares de Well-Architected.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para CLF-C02.

---

# NIVEL 2 · ASOCIADO

## A2 — Arquitectura de soluciones (asociado)

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Diseñar arquitecturas seguras, resilientes, de alto rendimiento y costo-eficientes, y elegir entre servicios parecidos según la restricción del caso |
| **Certificación** | AWS Certified Solutions Architect – Associate (SAA-C03) |
| **Competencias** | AWS-C2, C3, C4, C5, C6, C11, C12, C13 ● · AWS-C10 ○ |
| **Horas** | 120–160 |
| **Prerrequisitos** | A1 |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Diseñar arquitecturas seguras | 30 % |
| D2 | Diseñar arquitecturas resilientes | 26 % |
| D3 | Diseñar arquitecturas de alto rendimiento | 24 % |
| D4 | Diseñar arquitecturas optimizadas en costo | 20 % |

### Módulos

**AWS-M2.1 — Identidad y gobierno multi-cuenta [D1]**
- AWS-U2.1.1 Lógica de evaluación de políticas IAM: denegación explícita, permiso y denegación implícita
- AWS-U2.1.2 Roles, AssumeRole, perfiles de instancia y acceso entre cuentas
- AWS-U2.1.3 Políticas basadas en recursos, límites de permisos y condiciones
- AWS-U2.1.4 Organizations, SCP, Control Tower e IAM Identity Center
- AWS-U2.1.5 Identidades de aplicación: grupos de usuarios y de identidades de Cognito

**AWS-M2.2 — Redes en VPC [D1, D2, D3]**
- AWS-U2.2.1 Diseño de VPC: CIDR y subredes públicas y privadas por zona
- AWS-U2.2.2 Enrutamiento: Internet Gateway, NAT Gateway y tablas de rutas
- AWS-U2.2.3 Security groups frente a network ACL: con estado y sin estado
- AWS-U2.2.4 VPC endpoints (gateway e interface) y PrivateLink
- AWS-U2.2.5 Conectar redes: peering, Transit Gateway, Site-to-Site VPN y Direct Connect
- AWS-U2.2.6 Route 53: registros, políticas de enrutamiento y comprobaciones de estado

**AWS-M2.3 — Cómputo escalable [D2, D3]**
- AWS-U2.3.1 EC2: familias de instancia, AMI, almacenamiento de instancia y grupos de ubicación
- AWS-U2.3.2 Elastic Load Balancing: ALB, NLB y GWLB
- AWS-U2.3.3 Auto Scaling: políticas, comprobaciones de estado y ciclo de vida
- AWS-U2.3.4 Contenedores: ECS, EKS, Fargate y ECR
- AWS-U2.3.5 Serverless con Lambda: concurrencia, límites, Lambda en VPC y cuándo no usarlo

**AWS-M2.4 — Almacenamiento [D1, D3, D4]**
- AWS-U2.4.1 S3: clases de almacenamiento, ciclo de vida, versionado y replicación
- AWS-U2.4.2 S3 seguro: Block Public Access, políticas de bucket, cifrado, URL prefirmadas y Object Lock
- AWS-U2.4.3 Rendimiento de S3: prefijos, carga multiparte y Transfer Acceleration
- AWS-U2.4.4 Bloques y archivos: EBS (tipos de volumen, snapshots), EFS y FSx
- AWS-U2.4.5 Transferencia e híbrido: DataSync, Storage Gateway, Snow Family y Transfer Family

**AWS-M2.5 — Bases de datos [D2, D3]**
- AWS-U2.5.1 RDS: Multi-AZ frente a réplicas de lectura, copias y restauración
- AWS-U2.5.2 Aurora: almacenamiento distribuido, Global Database y Serverless v2
- AWS-U2.5.3 DynamoDB: claves, modos de capacidad, índices, DAX, streams y tablas globales
- AWS-U2.5.4 Caché con ElastiCache (Valkey, Redis OSS, Memcached) y estrategias de caché
- AWS-U2.5.5 Elegir la base de datos de propósito específico

**AWS-M2.6 — Desacoplamiento e integración [D2]**
- AWS-U2.6.1 SQS: estándar frente a FIFO, tiempo de visibilidad y colas de mensajes fallidos
- AWS-U2.6.2 SNS y fan-out; EventBridge: buses, reglas, Pipes y Scheduler
- AWS-U2.6.3 Step Functions: orquestación frente a coreografía
- AWS-U2.6.4 API Gateway: REST frente a HTTP API, limitación, caché y autorizadores
- AWS-U2.6.5 Streaming: Kinesis Data Streams, Amazon Data Firehose y MSK

**AWS-M2.7 — Seguridad y protección de datos [D1]**
- AWS-U2.7.1 KMS: claves, políticas de clave, cifrado envolvente y rotación
- AWS-U2.7.2 Secrets Manager frente a Parameter Store; ACM y certificados
- AWS-U2.7.3 Protección perimetral: WAF, Shield, CloudFront con OAC y Firewall Manager
- AWS-U2.7.4 Detección y auditoría: CloudTrail, Config, GuardDuty, Security Hub y Macie

**AWS-M2.8 — Resiliencia y recuperación ante desastres [D2]**
- AWS-U2.8.1 Alta disponibilidad multi-AZ y tolerancia a fallos
- AWS-U2.8.2 Estrategias de DR (copia y restauración, pilot light, warm standby, activo-activo) y RPO/RTO
- AWS-U2.8.3 AWS Backup, Elastic Disaster Recovery y replicación entre regiones

**AWS-M2.9 — Rendimiento, costo y migración [D3, D4]**
- AWS-U2.9.1 CloudFront y Global Accelerator: rendimiento en el borde
- AWS-U2.9.2 Costo de cómputo: dimensionamiento, Savings Plans, Spot y Graviton
- AWS-U2.9.3 Costo de almacenamiento, transferencia de datos y NAT
- AWS-U2.9.4 Analítica a escala: Athena, Glue, Lake Formation, Redshift, EMR y QuickSight (selección)
- AWS-U2.9.5 Migración y modernización: Application Migration Service, DMS y descubrimiento

**AWS-M2.10 — Preparación del examen**
- AWS-U2.10.1 Técnica: descartar distractores por la restricción del enunciado
- AWS-U2.10.2 Simulacros SAA-C03 y plan de refuerzo por dominio

### Ejercicios clave
1. Evaluar si una petición se permite a partir de políticas de identidad, de recurso y SCP (lab con arnés `iam`).
2. Diseñar subredes y rutas para tres zonas y comprobar alcanzabilidad (lab con arnés `network`).
3. Depurar por qué una instancia en subred privada no llega a S3 (debug de rutas y endpoints).
4. Auditar una plantilla CloudFormation generada por IA con un bucket público y una clave sin rotación (auditoría).
5. Memory: estrategia de DR ↔ RPO/RTO y costo relativo.
6. Reto cronometrado por dominio y simulacros completos.

### Proyecto
**Aplicación web de tres capas altamente disponible:** VPC en varias zonas, ALB con Auto Scaling o ECS en Fargate, RDS Multi-AZ, contenido estático en S3 con CloudFront y OAC, todo en IaC; ADR por pilar de Well-Architected, estimación de costo con fecha y plan de DR con RPO/RTO. Defensa técnica ante revisor.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para SAA-C03.

---

## A3 — Desarrollo en AWS

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Desarrollar, asegurar, probar, desplegar y depurar aplicaciones nativas de AWS con el SDK y servicios serverless |
| **Certificación** | AWS Certified Developer – Associate (**DVA-C03**, GA 2026-12-01) |
| **Competencias** | AWS-C6, C7, C8 ● · AWS-C4, C5, C9, C10 ○ |
| **Horas** | 80–110 |
| **Prerrequisitos** | A2 (recomendado: E2 del currículo maestro) |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Desarrollo con servicios de AWS | 30 % |
| D2 | Seguridad | 26 % |
| D3 | Pruebas y despliegue | 22 % |
| D4 | Resolución de problemas y optimización | 22 % |

DVA-C03 conserva los cuatro dominios y añade la **tarea 2.3** ✅: «Identify and mitigate security risks associated with using and integrating AI services». Tiene cinco habilidades: solicitar y gestionar el acceso a servicios de IA, controles de privacidad al enviar datos, filtrar y controlar entradas y salidas de modelos, asegurar las interacciones de agentes y proteger contenido sensible en los registros de monitoreo.

### Módulos

**AWS-M3.1 — Desarrollar con el SDK [D1]**
- AWS-U3.1.1 AWS SDK para JavaScript v3: clientes, comandos, paginadores y waiters
- AWS-U3.1.2 Cadena de credenciales, regiones y reintentos con espera exponencial
- AWS-U3.1.3 Errores: limitación de peticiones, idempotencia y reintentos seguros

**AWS-M3.2 — Lambda en profundidad [D1, D4]**
- AWS-U3.2.1 Modelos de invocación: síncrona, asíncrona y por mapeo de origen de eventos
- AWS-U3.2.2 Configuración: memoria, tiempo límite, variables, capas, versiones y alias
- AWS-U3.2.3 Concurrencia, arranques en frío, concurrencia reservada y aprovisionada
- AWS-U3.2.4 Destinos, colas de fallidos y reintentos; Lambda en VPC
- AWS-U3.2.5 Manejadores que se pueden probar: inyección de dependencias y eventos de prueba

**AWS-M3.3 — Datos para aplicaciones [D1]**
- AWS-U3.3.1 DynamoDB para desarrolladores: diseño por patrones de acceso y clave de partición
- AWS-U3.3.2 DynamoDB: Query frente a Scan, índices, expresiones condicionales, transacciones y TTL
- AWS-U3.3.3 DynamoDB Streams y procesamiento de eventos
- AWS-U3.3.4 S3 desde código: URL prefirmadas, notificaciones de eventos y carga multiparte
- AWS-U3.3.5 Caché en la aplicación: ElastiCache y DAX, carga diferida frente a escritura directa

**AWS-M3.4 — APIs e integración [D1]**
- AWS-U3.4.1 API Gateway: integraciones, etapas, variables y transformaciones
- AWS-U3.4.2 Mensajería desde código: SQS (lotes, sondeo largo, visibilidad), SNS y EventBridge
- AWS-U3.4.3 Step Functions en aplicaciones: flujos Standard y Express
- AWS-U3.4.4 AppSync y GraphQL: cuándo elegirlos

**AWS-M3.5 — Seguridad de aplicaciones [D2]**
- AWS-U3.5.1 Autenticación y autorización: Cognito y autorizadores JWT y Lambda
- AWS-U3.5.2 Roles de ejecución y mínimo privilegio para funciones y contenedores
- AWS-U3.5.3 Cifrado desde código: KMS (`GenerateDataKey`) y cifrado del lado del cliente
- AWS-U3.5.4 Secretos y configuración: Secrets Manager, Parameter Store y AppConfig
- AWS-U3.5.5 Seguridad al integrar servicios de IA en aplicaciones (tarea 2.3 de DVA-C03)

**AWS-M3.6 — Pruebas y despliegue [D3]**
- AWS-U3.6.1 Infraestructura como código para desarrolladores: SAM y CDK
- AWS-U3.6.2 Probar en local y en la nube: eventos de prueba, `sam local` y entornos efímeros
- AWS-U3.6.3 CodePipeline, CodeBuild (`buildspec`) y CodeDeploy (`appspec` y hooks)
- AWS-U3.6.4 Estrategias de despliegue: todo a la vez, canary, lineal, azul/verde y alias con tráfico ponderado
- AWS-U3.6.5 Contenedores para desarrolladores: imágenes en ECR y despliegue en ECS con Fargate

**AWS-M3.7 — Resolución de problemas y optimización [D4]**
- AWS-U3.7.1 Logs y métricas: CloudWatch Logs, Logs Insights, métricas personalizadas y formato EMF
- AWS-U3.7.2 Trazas distribuidas: X-Ray y AWS Distro for OpenTelemetry
- AWS-U3.7.3 Diagnóstico de errores típicos: `AccessDenied`, limitación, tiempos límite y cuotas
- AWS-U3.7.4 Optimizar costo y rendimiento de aplicaciones serverless

**AWS-M3.8 — Preparación del examen**
- AWS-U3.8.1 Simulacros DVA-C03 y plan de refuerzo por dominio

### Ejercicios clave
1. Manejador Lambda en TypeScript con dependencias inyectadas y pruebas con eventos de API Gateway y SQS (lab en sandbox).
2. Diseñar la clave de una tabla DynamoDB para cinco patrones de acceso sin `Scan` (lab con arnés `dynamodb`).
3. Depurar reintentos que duplican pedidos: falta de idempotencia (debug).
4. Auditar un manejador generado por IA que registra secretos y usa un rol con `*` (auditoría).
5. Reto cronometrado: elegir estrategia de despliegue según el riesgo descrito.

### Proyecto
**API serverless con CI/CD:** API Gateway + Lambda (TypeScript) + DynamoDB, autenticación con Cognito, pipeline con despliegue canary y reversión automática por alarma, trazas con X-Ray, pruebas automatizadas y documento de decisiones.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para DVA-C03.

---

## A4 — Operaciones en la nube (CloudOps)

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Operar cargas en producción: observarlas, automatizar su mantenimiento, recuperarlas y diagnosticar fallos de red y de configuración |
| **Certificación** | AWS Certified CloudOps Engineer – Associate (SOA-C03) |
| **Competencias** | AWS-C9, C11 ● · AWS-C3, C8, C10, C12 ○ |
| **Horas** | 60–90 |
| **Prerrequisitos** | A2 |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Monitoreo, registro, análisis, remediación y optimización del rendimiento | 22 % |
| D2 | Confiabilidad y continuidad del negocio | 22 % |
| D3 | Despliegue, aprovisionamiento y automatización | 22 % |
| D4 | Seguridad y cumplimiento | 16 % |
| D5 | Redes y entrega de contenido | 18 % |

### Módulos

**AWS-M4.1 — Monitoreo y observabilidad [D1]**
- AWS-U4.1.1 CloudWatch: métricas, alarmas compuestas, paneles y agente unificado
- AWS-U4.1.2 Logs centralizados: grupos, filtros de métricas, suscripciones y Logs Insights
- AWS-U4.1.3 EventBridge y remediación automática con Systems Manager Automation y Lambda
- AWS-U4.1.4 Rendimiento: Compute Optimizer, métricas de EBS y Performance Insights

**AWS-M4.2 — Flotas con Systems Manager [D1, D3]**
- AWS-U4.2.1 Session Manager, Run Command y Fleet Manager: operar sin SSH ni bastiones
- AWS-U4.2.2 Patch Manager, State Manager y ventanas de mantenimiento
- AWS-U4.2.3 Inventory, OpsCenter e Incident Manager

**AWS-M4.3 — Confiabilidad y continuidad [D2]**
- AWS-U4.3.1 Elasticidad operativa: Auto Scaling, cachés y réplicas
- AWS-U4.3.2 Copias y restauración: AWS Backup, snapshots, recuperación a un punto en el tiempo y versiones de S3
- AWS-U4.3.3 Probar la recuperación: simulacros de DR y Fault Injection Service

**AWS-M4.4 — Despliegue y automatización [D3]**
- AWS-U4.4.1 CloudFormation operativo: conjuntos de cambios, detección de deriva y StackSets
- AWS-U4.4.2 AMIs, EC2 Image Builder y plantillas de lanzamiento
- AWS-U4.4.3 Automatizar tareas operativas: documentos de SSM, tareas programadas y reglas de Config con remediación
- AWS-U4.4.4 Operación multi-cuenta y multi-región: Organizations, StackSets y Resource Access Manager

**AWS-M4.5 — Seguridad y cumplimiento operativo [D4]**
- AWS-U4.5.1 IAM operativo: Access Analyzer, credenciales sin uso y políticas de contraseña
- AWS-U4.5.2 Cumplimiento continuo: Config, Security Hub y Trusted Advisor
- AWS-U4.5.3 Protección de datos en operación: cifrado por defecto de EBS, RDS y S3, y rotación de claves

**AWS-M4.6 — Redes y entrega de contenido [D5]**
- AWS-U4.6.1 Diagnóstico de red: VPC Flow Logs, Reachability Analyzer y Network Access Analyzer
- AWS-U4.6.2 Route 53 operativo: comprobaciones de estado, conmutación por error, Resolver y DNS híbrido
- AWS-U4.6.3 CloudFront operativo: invalidaciones, comportamientos de caché, registros y errores de origen
- AWS-U4.6.4 Diagnóstico de conectividad: NAT, endpoints, VPN y Transit Gateway

**AWS-M4.7 — Preparación del examen**
- AWS-U4.7.1 Simulacros SOA-C03 y plan de refuerzo por dominio

### Ejercicios clave
1. Escribir el patrón de EventBridge que dispara una remediación sólo ante el evento correcto (lab con arnés `events`).
2. Leer VPC Flow Logs y localizar el rechazo (debug con registros).
3. Diagnosticar un despliegue de CloudFormation en `UPDATE_ROLLBACK_FAILED` (simulación con eventos del stack).
4. Laboratorio en tu cuenta: alarma de CloudWatch con acción de SNS y documento de SSM.

### Proyecto
**Operación con remediación automática:** alarmas y panel, runbook automatizado ante un fallo inyectado, parches programados, copia con restauración probada y post-mortem sin culpables.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para SOA-C03.

---

# NIVEL 3 · PROFESIONAL

## A5 — DevOps profesional

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Diseñar y operar entrega continua multi-cuenta, IaC a escala, resiliencia automatizada y respuesta a incidentes |
| **Certificación** | AWS Certified DevOps Engineer – Professional (DOP-C02) |
| **Competencias** | AWS-C8, C9 ● · AWS-C10, C11 ○ |
| **Horas** | 90–130 |
| **Prerrequisitos** | A3 y A4 |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Automatización del ciclo de vida del desarrollo | 22 % |
| D2 | Gestión de configuración e IaC | 17 % |
| D3 | Soluciones resilientes en la nube | 15 % |
| D4 | Monitoreo y registro | 15 % |
| D5 | Respuesta a incidentes y eventos | 14 % |
| D6 | Seguridad y cumplimiento | 17 % |

### Módulos

**AWS-M5.1 — Automatización del ciclo de vida [D1]**
- AWS-U5.1.1 Pipelines multi-etapa y multi-cuenta con CodePipeline
- AWS-U5.1.2 Builds reproducibles: CodeBuild, cachés, artefactos y CodeArtifact
- AWS-U5.1.3 Pruebas en el pipeline: unitarias, integración, carga y seguridad
- AWS-U5.1.4 Despliegues avanzados: azul/verde en ECS y EC2, canary con alarmas y reversión automática
- AWS-U5.1.5 Artefactos e imágenes: ECR, escaneo y firma de imágenes

**AWS-M5.2 — Configuración e IaC a escala [D2]**
- AWS-U5.2.1 CloudFormation avanzado: recursos personalizados, macros, hooks y stacks anidados
- AWS-U5.2.2 CDK avanzado: constructs, aspects y pruebas de infraestructura
- AWS-U5.2.3 Gobierno multi-cuenta: Control Tower, Account Factory, StackSets y Service Catalog
- AWS-U5.2.4 Configuración de aplicaciones y flotas: AppConfig y Systems Manager

**AWS-M5.3 — Soluciones resilientes [D3]**
- AWS-U5.3.1 Alta disponibilidad multi-región para aplicaciones
- AWS-U5.3.2 Escalado y autorrecuperación: Auto Scaling, escalado de servicios ECS y comprobaciones de estado
- AWS-U5.3.3 DR automatizado y pruebas de conmutación

**AWS-M5.4 — Monitoreo y registro [D4]**
- AWS-U5.4.1 Agregación de logs multi-cuenta: CloudWatch entre cuentas, OpenSearch y S3 con Athena
- AWS-U5.4.2 Métricas y alarmas a partir de logs; detección de anomalías
- AWS-U5.4.3 Observabilidad de aplicaciones distribuidas

**AWS-M5.5 — Respuesta a incidentes y eventos [D5]**
- AWS-U5.5.1 Arquitecturas orientadas a eventos para operación: EventBridge, SNS y Lambda
- AWS-U5.5.2 Diagnóstico de fallos de despliegue y de configuración
- AWS-U5.5.3 Runbooks automatizados e Incident Manager

**AWS-M5.6 — Seguridad y cumplimiento en DevOps [D6]**
- AWS-U5.6.1 Identidad para pipelines: roles entre cuentas y OIDC para CI externo
- AWS-U5.6.2 Seguridad en el pipeline: escaneo de código y dependencias, y gestión de secretos
- AWS-U5.6.3 Controles preventivos y detectivos: SCP, paquetes de conformidad de Config y Security Hub automatizado

**AWS-M5.7 — Preparación del examen**
- AWS-U5.7.1 Leer escenarios largos de nivel profesional
- AWS-U5.7.2 Simulacros DOP-C02 y plan de refuerzo por dominio

### Ejercicios clave
1. Validar una plantilla con reglas de seguridad propias antes del despliegue (lab con arnés `cfn`).
2. Depurar un despliegue azul/verde que no revierte porque la alarma no está asociada (debug).
3. Auditar un `buildspec` generado por IA que imprime secretos y descarga dependencias sin fijar versión (auditoría).
4. Simulación de incidente con registros y eventos de despliegue.

### Proyecto
**Plataforma de entrega multi-cuenta:** pipeline desde una cuenta de herramientas hacia desarrollo, preproducción y producción; azul/verde con reversión por alarma; IaC con pruebas; escaneo de seguridad; logs agregados y runbook de incidentes.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para DOP-C02.

---

## A6 — Arquitectura de soluciones profesional

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Diseñar para organizaciones complejas: multi-cuenta, híbrido, migraciones, DR multi-región y costo a escala, defendiendo compensaciones |
| **Certificación** | AWS Certified Solutions Architect – Professional (**SAP-C03**, GA 2026-11-17) |
| **Competencias** | AWS-C3, C11, C12, C13 ● · AWS-C2 ○ |
| **Horas** | 110–150 |
| **Prerrequisitos** | A2 y uno de A3/A4 |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Diseño e implementación de arquitecturas nativas de la nube | 25 % |
| D2 | Seguridad, cumplimiento y gobierno | 25 % |
| D3 | Diseño de arquitecturas optimizadas en costo | 15 % |
| D4 | Resiliencia, migración y continuidad del negocio | 15 % |
| D5 | Excelencia operativa y automatización | 20 % |

### Módulos

**AWS-M6.1 — Organizaciones complejas [D2, D5]**
- AWS-U6.1.1 Estrategia multi-cuenta: landing zone, unidades organizativas y Control Tower
- AWS-U6.1.2 Identidad federada a escala: Identity Center, ABAC y acceso entre cuentas
- AWS-U6.1.3 Redes multi-cuenta: Transit Gateway, RAM, VPC compartidas e inspección centralizada
- AWS-U6.1.4 Conectividad empresarial: Direct Connect resiliente, VPN de respaldo y DNS híbrido

**AWS-M6.2 — Arquitecturas nativas de la nube [D1]**
- AWS-U6.2.1 Microservicios y arquitecturas orientadas a eventos a escala
- AWS-U6.2.2 Serverless a escala: cuotas y patrones (fan-out, saga, claim check)
- AWS-U6.2.3 Contenedores a escala: ECS frente a EKS y VPC Lattice
- AWS-U6.2.4 Datos para arquitecturas nativas: persistencia políglota, consistencia y activo-activo multi-región
- AWS-U6.2.5 La IA generativa como componente: Bedrock, cuotas, costos y privacidad

**AWS-M6.3 — Seguridad, cumplimiento y gobierno [D2]**
- AWS-U6.3.1 Perímetros de datos: SCP, RCP, políticas de endpoint y de recurso
- AWS-U6.3.2 Claves y cifrado multi-cuenta y multi-región
- AWS-U6.3.3 Cumplimiento a escala: agregadores de Config, Audit Manager y Security Hub central

**AWS-M6.4 — Costo a escala [D3]**
- AWS-U6.4.1 Gobierno de costos: etiquetas, Cost Categories, presupuestos por unidad organizativa y facturación consolidada
- AWS-U6.4.2 Compromisos compartidos: Savings Plans y reservas en la organización
- AWS-U6.4.3 Arquitecturas costo-eficientes: transferencia de datos, almacenamiento por niveles y Spot a escala

**AWS-M6.5 — Resiliencia, migración y continuidad [D4]**
- AWS-U6.5.1 Evaluar el portafolio: Migration Hub, Application Discovery Service y Migration Evaluator
- AWS-U6.5.2 Migrar servidores y bases de datos: Application Migration Service, DMS, Snow y DataSync
- AWS-U6.5.3 Modernizar: re-plataforma, refactorización y patrón strangler
- AWS-U6.5.4 DR multi-región a escala: Elastic Disaster Recovery, Aurora Global, tablas globales y Application Recovery Controller

**AWS-M6.6 — Excelencia operativa y automatización [D5]**
- AWS-U6.6.1 Mejorar arquitecturas existentes: Well-Architected Tool y lentes
- AWS-U6.6.2 Automatización operativa empresarial: despliegues, parches y cumplimiento como código
- AWS-U6.6.3 Observabilidad empresarial y gestión de incidentes

**AWS-M6.7 — Preparación del examen**
- AWS-U6.7.1 Escenarios largos: separar requisitos, restricciones y distractores
- AWS-U6.7.2 Simulacros SAP-C03 y plan de refuerzo por dominio

### Ejercicios clave
1. Evaluar una petición entre cuentas con SCP, RCP, política de recurso y de endpoint (lab con arnés `iam`, modo perímetro).
2. Elegir estrategia de migración por aplicación de un portafolio con restricciones (reto cronometrado).
3. Auditar una propuesta de DR generada por IA que no cumple el RTO declarado (auditoría).
4. Defensa ante panel de una arquitectura con requisitos en conflicto (SIM).

### Proyecto
**Plataforma empresarial con migración:** caso con regulación, presupuesto y RTO en conflicto; landing zone, red híbrida, DR multi-región, plan de migración por olas, ADRs y defensa ante panel.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para SAP-C03.

---

# NIVEL 4 · ESPECIALIZACIÓN Y PROFESIONALIZACIÓN

## A7 — Fundamentos de IA en AWS

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Explicar ML e IA generativa, elegir el servicio de AWS adecuado y reconocer riesgos de IA responsable |
| **Certificación** | AWS Certified AI Practitioner (AIF-C01) |
| **Competencias** | AWS-C14 ○ |
| **Horas** | 25–40 |
| **Prerrequisitos** | A1 |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Fundamentos de IA y ML | 20 % |
| D2 | Fundamentos de IA generativa | 24 % |
| D3 | Aplicaciones de modelos fundacionales | 28 % |
| D4 | Lineamientos de IA responsable | 14 % |
| D5 | Seguridad, cumplimiento y gobierno de soluciones de IA | 14 % |

### Módulos

**AWS-M7.1 — Fundamentos de IA y ML [D1]**
- AWS-U7.1.1 IA, ML y aprendizaje profundo: tipos de aprendizaje y casos de uso
- AWS-U7.1.2 Ciclo de vida de ML y métricas de evaluación
- AWS-U7.1.3 Servicios de IA administrados y SageMaker AI: cuándo usar cada uno

**AWS-M7.2 — IA generativa [D2, D3]**
- AWS-U7.2.1 Modelos fundacionales, tokens, embeddings y ventana de contexto
- AWS-U7.2.2 Amazon Bedrock: catálogo de modelos, precio por tokens y modos de inferencia
- AWS-U7.2.3 Ingeniería de prompts y sus riesgos
- AWS-U7.2.4 RAG, agentes y ajuste fino: cuándo usar cada uno
- AWS-U7.2.5 Evaluar modelos fundacionales

**AWS-M7.3 — IA responsable, seguridad y gobierno [D4, D5]**
- AWS-U7.3.1 Sesgo, equidad, explicabilidad y transparencia
- AWS-U7.3.2 Seguridad y privacidad de datos en IA; Guardrails
- AWS-U7.3.3 Gobierno y cumplimiento de soluciones de IA

**AWS-M7.4 — Preparación del examen**
- AWS-U7.4.1 Simulacros AIF-C01 y plan de refuerzo por dominio

### Proyecto
**Evaluación de un caso de uso de IA:** elegir enfoque (servicio administrado, Bedrock con RAG o ajuste fino), riesgos de IA responsable y costo estimado por tokens.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para AIF-C01 (competencia crítica a nivel 2).

---

## A8 — Desarrollo de IA generativa

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Construir, asegurar, evaluar y operar aplicaciones de IA generativa sobre Amazon Bedrock |
| **Certificación** | AWS Certified Generative AI Developer – Professional (AIP-C01) |
| **Competencias** | AWS-C14 ● · AWS-C7 ○ |
| **Horas** | 70–100 |
| **Prerrequisitos** | A7 y A3 (enlaza con E9–E10 del currículo maestro) |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Integración de modelos fundacionales, gestión de datos y cumplimiento | 31 % |
| D2 | Implementación e integración | 26 % |
| D3 | Seguridad, protección y gobierno de IA | 20 % |
| D4 | Eficiencia operativa y optimización de aplicaciones de IA generativa | 12 % |
| D5 | Pruebas, validación y resolución de problemas | 11 % |

### Módulos

**AWS-M8.1 — Integración de modelos y datos [D1]**
- AWS-U8.1.1 Elegir modelos en Bedrock por tarea, costo, latencia y cuotas
- AWS-U8.1.2 APIs de Bedrock: Converse, streaming, uso de herramientas y salidas estructuradas
- AWS-U8.1.3 Knowledge Bases: ingesta, fragmentación, embeddings y almacenes vectoriales
- AWS-U8.1.4 Gobierno de datos para IA: calidad, linaje y datos personales
- AWS-U8.1.5 Personalización: gestión de prompts, ajuste fino e importación de modelos

**AWS-M8.2 — Implementación e integración [D2]**
- AWS-U8.2.1 Patrones de aplicación: RAG, resumen, extracción y clasificación
- AWS-U8.2.2 Agentes: Bedrock Agents y AgentCore, grupos de acciones y herramientas
- AWS-U8.2.3 Flujos de IA: Bedrock Flows y Step Functions
- AWS-U8.2.4 Integrar IA en aplicaciones: API Gateway, Lambda y streaming al cliente

**AWS-M8.3 — Seguridad y gobierno de IA [D3]**
- AWS-U8.3.1 Guardrails: filtros de contenido, temas denegados, datos personales y comprobación de fundamentación
- AWS-U8.3.2 Inyección de prompts y herramientas con mínimo privilegio
- AWS-U8.3.3 Privacidad, registro de invocaciones y cumplimiento

**AWS-M8.4 — Eficiencia operativa [D4]**
- AWS-U8.4.1 Costo y latencia: caché de prompts, inferencia por lotes, capacidad aprovisionada y enrutamiento
- AWS-U8.4.2 Observabilidad de aplicaciones de IA: métricas, trazas y consumo de tokens

**AWS-M8.5 — Pruebas, validación y resolución de problemas [D5]**
- AWS-U8.5.1 Evaluar RAG y agentes: conjuntos de referencia, modelo como juez y métricas
- AWS-U8.5.2 Diagnosticar alucinaciones, recuperación pobre y errores de cuota

**AWS-M8.6 — Preparación del examen**
- AWS-U8.6.1 Simulacros AIP-C01 y plan de refuerzo por dominio

### Proyecto
**Asistente RAG con guardrails y evaluación:** Knowledge Base, agente con una herramienta de mínimo privilegio, guardrails, conjunto de evaluación con métricas y costo medido por consulta.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para AIP-C01.

---

## A9 — Seguridad

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Detectar, responder, proteger infraestructura y datos, y gobernar la seguridad de una organización en AWS |
| **Certificación** | AWS Certified Security – Specialty (SCS-C03) |
| **Competencias** | AWS-C2, C10 ● |
| **Horas** | 60–90 |
| **Prerrequisitos** | A2 y A4 |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Detección | 16 % |
| D2 | Respuesta a incidentes | 14 % |
| D3 | Seguridad de la infraestructura | 18 % |
| D4 | Gestión de identidades y accesos | 20 % |
| D5 | Protección de datos | 18 % |
| D6 | Fundamentos de seguridad y gobierno | 14 % |

### Módulos

**AWS-M9.1 — Detección [D1]**
- AWS-U9.1.1 GuardDuty, Security Hub, Detective e Inspector: qué detecta cada uno
- AWS-U9.1.2 Registros de seguridad: CloudTrail de organización, eventos de datos, VPC Flow Logs y DNS
- AWS-U9.1.3 Analizar registros: Athena, Logs Insights y Security Lake

**AWS-M9.2 — Respuesta a incidentes [D2]**
- AWS-U9.2.1 Plan de respuesta: preparación, contención, erradicación y recuperación
- AWS-U9.2.2 Respuesta automatizada: aislar instancias y revocar credenciales comprometidas
- AWS-U9.2.3 Forense en la nube: snapshots y preservación de evidencia

**AWS-M9.3 — Seguridad de la infraestructura [D3]**
- AWS-U9.3.1 Seguridad de red: security groups, NACL, Network Firewall, WAF y Shield Advanced
- AWS-U9.3.2 Seguridad de cómputo: endurecimiento, IMDSv2, parches y contenedores
- AWS-U9.3.3 Seguridad en el borde y en la conectividad híbrida

**AWS-M9.4 — Identidades y accesos [D4]**
- AWS-U9.4.1 Evaluación de políticas a fondo: identidad, recurso, SCP, RCP, límites y políticas de sesión
- AWS-U9.4.2 ABAC, acceso entre cuentas y federación
- AWS-U9.4.3 Diagnosticar accesos denegados e IAM Access Analyzer

**AWS-M9.5 — Protección de datos [D5]**
- AWS-U9.5.1 KMS a fondo: políticas de clave, grants, claves multi-región, material importado y CloudHSM
- AWS-U9.5.2 Datos en S3, bases de datos y en tránsito: TLS, ACM y Private CA
- AWS-U9.5.3 Descubrir y clasificar datos con Macie; ciclo de vida y borrado

**AWS-M9.6 — Fundamentos de seguridad y gobierno [D6]**
- AWS-U9.6.1 Gobierno de seguridad multi-cuenta: cuentas de auditoría y de archivo de logs, administradores delegados
- AWS-U9.6.2 Cumplimiento: Config, Audit Manager y Artifact

**AWS-M9.7 — Preparación del examen**
- AWS-U9.7.1 Simulacros SCS-C03 y plan de refuerzo por dominio

### Proyecto
**Línea base de seguridad de una organización:** detección centralizada, respuesta automatizada a un hallazgo simulado, perímetro de datos y plan de respuesta a incidentes.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para SCS-C03.

---

## A10 — Ingeniería de datos

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Construir y operar pipelines de ingesta y transformación, almacenes de datos y su gobierno |
| **Certificación** | AWS Certified Data Engineer – Associate (DEA-C01) |
| **Competencias** | AWS-C15 ● |
| **Horas** | 50–80 |
| **Prerrequisitos** | A2 (recomendado: E6 del currículo maestro) |

### Dominios del examen (✅ guía oficial, ver aws-guias-examen.md)

| Dominio | Nombre | Peso |
|---------|--------|------|
| D1 | Ingesta y transformación de datos | 34 % |
| D2 | Gestión de almacenes de datos | 26 % |
| D3 | Operación y soporte de datos | 22 % |
| D4 | Seguridad y gobierno de datos | 18 % |

### Módulos

**AWS-M10.1 — Ingesta y transformación [D1]**
- AWS-U10.1.1 Ingesta por lotes y en streaming: Kinesis, Amazon Data Firehose, MSK, DMS y AppFlow
- AWS-U10.1.2 Transformar con Glue (ETL, marcadores de trabajo) y EMR
- AWS-U10.1.3 Orquestar pipelines: Step Functions, MWAA, flujos de Glue y EventBridge
- AWS-U10.1.4 Programar para datos: SQL y Spark

**AWS-M10.2 — Almacenes de datos [D2]**
- AWS-U10.2.1 Lago de datos en S3: formatos columnares, particiones y Apache Iceberg
- AWS-U10.2.2 Catálogo de datos: Glue Data Catalog y crawlers
- AWS-U10.2.3 Redshift: distribución, ordenación, Spectrum y modo serverless
- AWS-U10.2.4 Modelado y ciclo de vida de datos; elegir almacén

**AWS-M10.3 — Operación y soporte [D3]**
- AWS-U10.3.1 Consultar y visualizar: Athena y QuickSight
- AWS-U10.3.2 Calidad de datos y monitoreo de pipelines
- AWS-U10.3.3 Optimizar costo y rendimiento de pipelines

**AWS-M10.4 — Seguridad y gobierno de datos [D4]**
- AWS-U10.4.1 Lake Formation: permisos de grano fino
- AWS-U10.4.2 Cifrado, enmascaramiento, auditoría y privacidad de datos

**AWS-M10.5 — Preparación del examen**
- AWS-U10.5.1 Simulacros DEA-C01 y plan de refuerzo por dominio

### Proyecto
**Pipeline de datos de punta a punta:** ingesta en streaming y por lotes, lago en S3 con particiones e Iceberg, transformación con Glue, consultas con Athena, calidad de datos y permisos con Lake Formation.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para DEA-C01.

---

## A11 — Ingeniería de ML

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Preparar datos, entrenar, desplegar, monitorear y asegurar modelos de ML con SageMaker AI |
| **Certificación** | AWS Certified Machine Learning Engineer – Associate (**MLA-C02**, GA 2027-01-14) |
| **Competencias** | AWS-C14 ● · AWS-C15 ○ |
| **Horas** | 50–80 |
| **Prerrequisitos** | A7 y A10 |

### Dominios del examen

La guía oficial de MLA-C02 ✅ mantiene cuatro dominios, pero cambia sus nombres (ahora incluyen «y IA») y dos pesos respecto a MLA-C01. La guía es de la versión **beta**; se revisa cuando llegue la GA (2027-01-14):

| Dominio | Nombre | Peso |
|---------|--------|----------------|
| D1 | Preparación de datos para ML e IA | 28 % |
| D2 | Desarrollo de modelos de ML y de modelos fundacionales (FM) | 24 % |
| D3 | Despliegue y orquestación de flujos de trabajo de ML e IA | 24 % |
| D4 | Operación, monitoreo y seguridad de soluciones de ML e IA | 24 % |

### Módulos

**AWS-M11.1 — Preparación de datos [D1]**
- AWS-U11.1.1 Ingesta y almacenamiento para ML; formatos
- AWS-U11.1.2 Transformación e ingeniería de características: Data Wrangler y Feature Store
- AWS-U11.1.3 Calidad, sesgo e integridad de los datos

**AWS-M11.2 — Desarrollo de modelos [D2]**
- AWS-U11.2.1 Elegir enfoque: servicios de IA, algoritmos integrados, JumpStart o Bedrock
- AWS-U11.2.2 Entrenamiento y ajuste de hiperparámetros en SageMaker AI
- AWS-U11.2.3 Evaluar modelos: métricas, sobreajuste y explicabilidad

**AWS-M11.3 — Despliegue y orquestación [D3]**
- AWS-U11.3.1 Opciones de inferencia: tiempo real, serverless, asíncrona y por lotes
- AWS-U11.3.2 Infraestructura y escalado de endpoints
- AWS-U11.3.3 MLOps: SageMaker Pipelines, Model Registry y CI/CD de modelos

**AWS-M11.4 — Monitoreo, mantenimiento y seguridad [D4]**
- AWS-U11.4.1 Model Monitor: deriva de datos y de modelo
- AWS-U11.4.2 Costos de ML e infraestructura
- AWS-U11.4.3 Seguridad de soluciones de ML: aislamiento de red, cifrado y roles

**AWS-M11.5 — Preparación del examen**
- AWS-U11.5.1 Simulacros MLA-C02 y plan de refuerzo por dominio

### Proyecto
**Modelo en producción con MLOps:** pipeline de entrenamiento, registro de modelos, despliegue con la opción de inferencia justificada, monitoreo de deriva y costos.

### Criterio de dominio
- Criterio «listo para presentar» de §6 para MLA-C02.

---

## A12 — Portafolio, entrevistas y vigencia

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Convertir certificaciones y proyectos en evidencia contratable, superar entrevistas por rol y mantener las certificaciones vigentes |
| **Certificación** | Ninguna |
| **Competencias** | AWS-C13 ● |
| **Horas** | 30–50 |
| **Prerrequisitos** | A5 o A6 |

### Módulos

**AWS-M12.1 — Portafolio y evidencia**
- AWS-U12.1.1 Contar una arquitectura: diagramas, ADRs y costos en el portafolio
- AWS-U12.1.2 Proyecto integrador con requisitos en conflicto

**AWS-M12.2 — Entrevistas por rol**
- AWS-U12.2.1 Entrevista de arquitectura de soluciones: diseño de sistemas en AWS
- AWS-U12.2.2 Entrevista de desarrollo cloud y DevOps
- AWS-U12.2.3 Entrevista de CloudOps y respuesta a incidentes

**AWS-M12.3 — Vigencia**
- AWS-U12.3.1 Recertificación y vigencia de las certificaciones
- AWS-U12.3.2 Mantenerse al día: cambios de servicios, retiradas y nuevas versiones de examen

### Proyecto final
**Proyecto integrador:** el proyecto de A6 o A5 ampliado con una restricción nueva (regulación, recorte de presupuesto o región adicional), defendido en simulación de entrevista con panel.

### Criterio de dominio
- Proyecto integrador aprobado y defendido; simulaciones de entrevista de su rol con nota ≥ 70.

---

# Resumen de unidades y horas

| Etapa | Certificación | Módulos | Unidades | Horas |
|-------|---------------|---------|----------|-------|
| A0 | — | 3 | 15 | 20–30 |
| A1 | CLF-C02 | 5 | 20 | 30–45 |
| A2 | SAA-C03 | 10 | 45 | 120–160 |
| A3 | DVA-C03 | 8 | 32 | 80–110 |
| A4 | SOA-C03 | 7 | 22 | 60–90 |
| A5 | DOP-C02 | 7 | 23 | 90–130 |
| A6 | SAP-C03 | 7 | 24 | 110–150 |
| A7 | AIF-C01 | 4 | 12 | 25–40 |
| A8 | AIP-C01 | 6 | 17 | 70–100 |
| A9 | SCS-C03 | 7 | 18 | 60–90 |
| A10 | DEA-C01 | 5 | 14 | 50–80 |
| A11 | MLA-C02 | 5 | 13 | 50–80 |
| A12 | — | 3 | 7 | 30–50 |
| **Total** | **11 certificaciones** | **77** | **262** | **795–1.155** |

---

# Reglas permanentes de la ruta

1. **Cada concepto tiene ejercicios y al menos una pregunta de escenario.** Sin unidades puramente teóricas.
2. **Cada etapa produce un proyecto y una defensa.** Aprobar el examen no sustituye la evidencia profesional.
3. **Ninguna pregunta se copia.** Prohibido usar volcados de examen («dumps») o reproducir preguntas oficiales de muestra; todo es original y cita documentación oficial ([`../02-contenido/metodo-aws.md`](../02-contenido/metodo-aws.md) §11).
4. **La versión del examen manda.** Cada ejercicio declara el código de examen; un cambio de versión abre una tarea de actualización.
5. **El costo es parte del diseño.** Todo laboratorio en cuenta propia declara su costo esperado y su lista de limpieza.
6. **La IA se usa y se audita** igual que en el currículo maestro: las respuestas de un asistente sobre AWS se verifican contra la documentación con fecha.

---

## Documentos relacionados

- [`../02-contenido/metodo-aws.md`](../02-contenido/metodo-aws.md) — cómo se aplica la pedagogía a la preparación de certificaciones
- [`curriculo-maestro.md`](curriculo-maestro.md) — currículo de la ruta `fullstack-ia`
- [`../00-vision/fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md)
- [`../04-plan-ejecucion/roadmap-sprints.md`](../04-plan-ejecucion/roadmap-sprints.md) — sprints S13–S26
