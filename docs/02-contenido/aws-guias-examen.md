# Guías oficiales de examen de la ruta AWS (S14-T0)

**Verificado por:** agente con fuente oficial (2026-11-09).
**Fecha de lectura de todas las fuentes:** 2026-11-09.
Una persona puede revisar este documento y confirmarlo contra las guías, pero el documento **no** afirma que esa revisión humana ya se haya hecho.

## 0. Método

- Cada dato lleva su fuente. **✅** = leído en una página o PDF oficial de AWS, con la URL exacta de abajo. **🔎** = sin fuente oficial leída (pendiente).
- No se completó nada de memoria. No se usó ninguna fuente de terceros para verificar.
- `docs.aws.amazon.com` (HTML) devolvió solo el título al lector automático (`WebFetch`). Los **PDF oficiales de las mismas guías**, publicados por AWS en `docs.aws.amazon.com/pdfs/...`, se descargaron con `curl` y se convirtieron a texto con `pdftotext`. Por eso las guías se leyeron completas.
- Los **minutos** no aparecen en las guías. Salen de la página oficial de cada certificación en `aws.amazon.com/certification/` (campo «Exam duration»).
- Las fechas de vigencia salen de las propias guías (apéndice de comparación o nota de «exam being updated»), del anuncio de septiembre de 2026 y de la página de certificación.
- Claves de fuente usadas en las tablas:
  - **G** = PDF de la guía de examen (URL en la sección de cada examen).
  - **P** = página de la certificación (URL en la sección de cada examen).
  - **A** = anuncio: <https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/>
- Todos los pesos son «% of scored content» tal como los da la guía. Todas las guías indican resultado aprobado/no aprobado con puntuación escalada de 100 a 1.000 y modelo compensatorio (no hay que aprobar cada dominio).

## 1. Tabla resumen

| Examen | Nombre oficial | Preguntas (puntuadas + no puntuadas) | Min | Aprobado | Tipos de ítem (guía) | Dominios | Vigencia | Estado |
|--------|----------------|--------------------------------------|-----|----------|----------------------|----------|----------|--------|
| CLF-C02 | AWS Certified Cloud Practitioner | 65 (50 + 15) | 90 | 700 | opción única, múltiple | 4 | Sin fecha de retiro indicada | ✅ |
| SAA-C03 | AWS Certified Solutions Architect - Associate | 65 (50 + 15) | 130 | 720 | opción única, múltiple | 4 | Sin fecha de retiro indicada | ✅ |
| DVA-C03 | AWS Certified Developer - Associate | 65 (50 + 15) | 130 | 720 | opción única, múltiple | 4 | En uso desde 2026-12-01; DVA-C02 hasta 2026-11-30 | ✅ |
| SOA-C03 | AWS Certified CloudOps Engineer - Associate | 65 (50 + 15) | 130 | 720 | opción única, múltiple | 5 | En uso desde 2025-09-30 (SOA-C02 hasta 2025-09-29) | ✅ |
| DOP-C02 | AWS Certified DevOps Engineer - Professional | 75 (65 + 10) | 180 | 750 | opción única, múltiple | 6 | Sin fecha de retiro indicada | ✅ |
| SAP-C03 | AWS Certified Solutions Architect - Professional | 75 (65 + 10) | 180 | 720 | opción única, múltiple | 5 | En uso desde 2026-11-17; SAP-C02 hasta 2026-11-16 | ✅ |
| AIF-C01 | AWS Certified AI Practitioner | 65 (50 + 15) | 90 | 700 | opción única, múltiple, ordenar, emparejar | 5 | Sin fecha de retiro indicada | ✅ |
| AIP-C01 | AWS Certified Generative AI Developer - Professional | 75 (65 + 10) | 180 | 750 | opción única, múltiple (ver nota en §2.8) | 5 | Sin fecha de retiro indicada | ✅ |
| SCS-C03 | AWS Certified Security - Specialty | 65 (50 + 15) | 170 | 750 | opción única, múltiple, ordenar, emparejar | 6 | En uso desde 2025-12-02 (SCS-C02 hasta 2025-12-01) | ✅ |
| DEA-C01 | AWS Certified Data Engineer - Associate | 65 (50 + 15) | 130 | 720 | opción única, múltiple | 4 | Sin fecha de retiro indicada | ✅ |
| MLA-C02 | AWS Certified Machine Learning Engineer - Associate | **Beta: 85** (reparto puntuadas/no puntuadas 🔎). Guía: 50 + 15 = 65 para la versión no beta | **Beta: 170**. GA: 🔎 | 720 | opción única, múltiple | 4 | Beta desde 2026-09-29; GA 2027-01-14 (se retira MLA-C01) | ✅ beta · 🔎 GA |

«Caso práctico»: ninguna de las guías vigentes leídas lo lista como tipo de ítem (ver §3, copia antigua de AIF-C01).

Resultado: **10 exámenes con todos los datos ✅** (CLF-C02, SAA-C03, DVA-C03, SOA-C03, DOP-C02, SAP-C03, AIF-C01, AIP-C01, SCS-C03, DEA-C01) y **1 con 🔎 parciales** (MLA-C02, solo en beta).

## 2. Un examen por sección

### 2.1 CLF-C02 · AWS Certified Cloud Practitioner

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.pdf> ✅
- G (copia en awsstatic, mismos dominios y pesos): <https://d1.awsstatic.com/training-and-certification/docs-cloud-practitioner/AWS-Certified-Cloud-Practitioner_Exam-Guide.pdf> ✅
- P: <https://aws.amazon.com/certification/certified-cloud-practitioner/> ✅ (90 minutos; 65 preguntas, opción única o múltiple)
- Preguntas: 50 puntuadas + 15 no puntuadas ✅ G. Aprobado: 700 ✅ G. Tipos: opción única y múltiple ✅ G. Vigencia: la guía y la página no dan fecha de retiro ✅ (ausencia).

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Cloud Concepts | 24 % | G ✅ |
| 2 | Security and Compliance | 30 % | G ✅ |
| 3 | Cloud Technology and Services | 34 % | G ✅ |
| 4 | Billing, Pricing, and Support | 12 % | G ✅ |

### 2.2 SAA-C03 · AWS Certified Solutions Architect - Associate

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.pdf> ✅
- P: <https://aws.amazon.com/certification/certified-solutions-architect-associate/> ✅ (130 minutos; 65 preguntas, opción única o múltiple)
- Preguntas: 50 + 15 ✅ G. Aprobado: 720 ✅ G. Tipos: opción única y múltiple ✅ G. Vigencia: sin fecha de retiro indicada.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Design Secure Architectures | 30 % | G ✅ |
| 2 | Design Resilient Architectures | 26 % | G ✅ |
| 3 | Design High-Performing Architectures | 24 % | G ✅ |
| 4 | Design Cost-Optimized Architectures | 20 % | G ✅ |

### 2.3 DVA-C03 · AWS Certified Developer - Associate

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/developer-associate-03/developer-associate-03.pdf> ✅
- A: sección «Coming soon: AWS Certified Developer – Associate (DVA-C03)» ✅
- P: <https://aws.amazon.com/certification/certified-developer-associate/> ✅ (130 minutos; 65 preguntas)
- Preguntas: 50 + 15 ✅ G y A. Aprobado: 720 ✅ G y A. Tipos: opción única y múltiple ✅ G. Minutos: 130 ✅ A y P.
- Vigencia ✅ G y A: el registro se abrió el **2026-10-27**; DVA-C02 se puede rendir hasta el **2026-11-30**; DVA-C03 está en uso desde el **2026-12-01**.
- Tarea 2.3 (seguridad de IA) ✅ G: «Identify and mitigate security risks associated with using and integrating AI services». Tiene 5 habilidades: 2.3.1 solicitar y gestionar acceso a servicios de IA; 2.3.2 controles de privacidad de datos al enviar datos a servicios de IA; 2.3.3 filtrar y controlar entradas y salidas de modelos de IA; 2.3.4 asegurar las interacciones de agentes de IA; 2.3.5 proteger contenido sensible en los registros de monitoreo.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Development with AWS Services | 30 % | G ✅, A ✅ |
| 2 | Security | 26 % | G ✅, A ✅ |
| 3 | Testing and Deployment | 22 % | G ✅, A ✅ |
| 4 | Troubleshooting and Optimization | 22 % | G ✅, A ✅ |

### 2.4 SOA-C03 · AWS Certified CloudOps Engineer - Associate

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03.pdf> ✅
- G (copia en awsstatic): <https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/certification/approved/pdfs/docs-cloudops-associate/AWS-Certified-CloudOps-Engineer-Associate_Exam-Guide.pdf> ✅ (misma información, versión 1.1)
- P: <https://aws.amazon.com/certification/certified-cloudops-engineer-associate/> ✅ (130 minutos; 65 preguntas)
- Preguntas: 50 + 15 ✅ G. Aprobado: 720 ✅ G. Tipos: opción única y múltiple ✅ G. Vigencia ✅ G: SOA-C02 en uso hasta 2025-09-29; SOA-C03 desde 2025-09-30.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Monitoring, Logging, Analysis, Remediation, and Performance Optimization | 22 % | G ✅ |
| 2 | Reliability and Business Continuity | 22 % | G ✅ |
| 3 | Deployment, Provisioning, and Automation | 22 % | G ✅ |
| 4 | Security and Compliance | 16 % | G ✅ |
| 5 | Networking and Content Delivery | 18 % | G ✅ |

### 2.5 DOP-C02 · AWS Certified DevOps Engineer - Professional

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02.pdf> ✅
- G (copia en awsstatic, versión 1.6, mismos dominios y pesos): <https://d1.awsstatic.com/training-and-certification/docs-devops-pro/AWS-Certified-DevOps-Engineer-Professional_Exam-Guide.pdf> ✅
- P: <https://aws.amazon.com/certification/certified-devops-engineer-professional/> ✅ (180 minutos; 75 preguntas)
- Preguntas: 65 + 10 ✅ G. Aprobado: 750 ✅ G. Tipos: opción única y múltiple ✅ G. Vigencia: sin fecha de retiro indicada.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | SDLC Automation | 22 % | G ✅ |
| 2 | Configuration Management and IaC | 17 % | G ✅ |
| 3 | Resilient Cloud Solutions | 15 % | G ✅ |
| 4 | Monitoring and Logging | 15 % | G ✅ |
| 5 | Incident and Event Response | 14 % | G ✅ |
| 6 | Security and Compliance | 17 % | G ✅ |

### 2.6 SAP-C03 · AWS Certified Solutions Architect - Professional

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/solutions-architect-professional-03/solutions-architect-professional-03.pdf> ✅
- A: sección «Coming soon: AWS Certified Solutions Architect – Professional (SAP-C03)» ✅ (180 minutos, 75 preguntas; nombres de dominio sin pesos)
- P: <https://aws.amazon.com/certification/certified-solutions-architect-professional/> ✅ (180 minutos; 75 preguntas)
- Preguntas: 65 + 10 ✅ G. Aprobado: **720** ✅ G (la copia antigua de SAP-C02 en awsstatic decía 750). Tipos: opción única y múltiple ✅ G.
- Vigencia ✅ G y A: registro desde 2026-10-27; SAP-C02 hasta **2026-11-16**; SAP-C03 en uso desde **2026-11-17**.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Architecture Design and Implementation Built for the Cloud | 25 % | G ✅ |
| 2 | Security, Compliance, and Governance | 25 % | G ✅ |
| 3 | Cost-Optimized Architecture Design | 15 % | G ✅ |
| 4 | Resilience, Migration, and Business Continuity | 15 % | G ✅ |
| 5 | Operational Excellence and Automation | 20 % | G ✅ |

### 2.7 AIF-C01 · AWS Certified AI Practitioner

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.pdf> ✅
- G (copia en awsstatic, versión 1.4): <https://d1.awsstatic.com/training-and-certification/docs-ai-practitioner/AWS-Certified-AI-Practitioner_Exam-Guide.pdf> ✅
- P: <https://aws.amazon.com/certification/certified-ai-practitioner/> ✅ (90 minutos; 65 preguntas)
- Preguntas: 50 + 15 ✅ G. Aprobado: 700 ✅ G. Tipos ✅ G: opción única, múltiple, **ordenar** (3 a 5 respuestas) y **emparejar** (3 a 7 prompts). Vigencia: sin fecha de retiro indicada.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Fundamentals of AI and ML | 20 % | G ✅ |
| 2 | Fundamentals of GenAI (en la copia awsstatic: «Fundamentals of Generative AI») | 24 % | G ✅ |
| 3 | Applications of Foundation Models | 28 % | G ✅ |
| 4 | Guidelines for Responsible AI | 14 % | G ✅ |
| 5 | Security, Compliance, and Governance for AI Solutions | 14 % | G ✅ |

### 2.8 AIP-C01 · AWS Certified Generative AI Developer - Professional

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/ai-professional-01/ai-professional-01.pdf> ✅
- G (copia en awsstatic, versión 1.0): <https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/certification/approved/pdfs/docs-aip/AWS-Certified-Generative-AI-Developer-Pro_Exam-Guide.pdf> ✅
- P: <https://aws.amazon.com/certification/certified-generative-ai-developer-professional/> ✅ (180 minutos; 75 preguntas)
- Preguntas: 65 + 10 ✅ G (la nota 1 de la guía dice que el reparto no se aplica a la versión beta). Aprobado: 750 ✅ G.
- Tipos: la guía en `docs.aws.amazon.com` lista solo opción única y múltiple ✅. La copia en awsstatic (v1.0) lista además ordenar y emparejar ✅. **Las dos fuentes oficiales difieren**: el simulacro debe tratar ordenar y emparejar como posibles, no como seguros (ver §4).
- Vigencia: sin fecha de retiro indicada.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Foundation Model Integration, Data Management, and Compliance | 31 % | G ✅ |
| 2 | Implementation and Integration | 26 % | G ✅ |
| 3 | AI Safety, Security, and Governance | 20 % | G ✅ |
| 4 | Operational Efficiency and Optimization for GenAI Applications | 12 % | G ✅ |
| 5 | Testing, Validation, and Troubleshooting | 11 % | G ✅ |

### 2.9 SCS-C03 · AWS Certified Security - Specialty

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/security-specialty-03/security-specialty-03.pdf> ✅
- G (copia en awsstatic, versión 1.0): <https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/certification/approved/pdfs/docs-security-spec/AWS-Certified-Security-Specialty_Exam-Guide-03.pdf> ✅
- P: <https://aws.amazon.com/certification/certified-security-specialty/> ✅ (170 minutos; 65 preguntas)
- Preguntas: 50 + 15 ✅ G (nota: no aplica a la versión beta). Aprobado: 750 ✅ G. Tipos ✅ G: opción única, múltiple, ordenar y emparejar.
- Vigencia ✅ G: SCS-C02 en uso hasta 2025-12-01; SCS-C03 desde 2025-12-02.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Detection | 16 % | G ✅ |
| 2 | Incident Response | 14 % | G ✅ |
| 3 | Infrastructure Security | 18 % | G ✅ |
| 4 | Identity and Access Management | 20 % | G ✅ |
| 5 | Data Protection | 18 % | G ✅ |
| 6 | Security Foundations and Governance | 14 % | G ✅ |

### 2.10 DEA-C01 · AWS Certified Data Engineer - Associate

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01.pdf> ✅ (historial de la guía: v1.1 del 2025-12-12)
- G (copia en awsstatic, versión 1.0): <https://d1.awsstatic.com/training-and-certification/docs-data-engineer-associate/AWS-Certified-Data-Engineer-Associate_Exam-Guide.pdf> ✅
- P: <https://aws.amazon.com/certification/certified-data-engineer-associate/> ✅ (130 minutos; 65 preguntas)
- Preguntas: 50 + 15 ✅ G. Aprobado: 720 ✅ G. Tipos: opción única y múltiple ✅ G. Vigencia: sin fecha de retiro indicada.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Data Ingestion and Transformation | 34 % | G ✅ |
| 2 | Data Store Management | 26 % | G ✅ |
| 3 | Data Operations and Support | 22 % | G ✅ |
| 4 | Data Security and Governance | 18 % | G ✅ |

### 2.11 MLA-C02 · AWS Certified Machine Learning Engineer - Associate (beta)

- G: <https://docs.aws.amazon.com/pdfs/aws-certification/latest/machine-learning-engineer-associate-02/machine-learning-engineer-associate-02.pdf> ✅ (guía de MLA-C02; la nota 1 dice que el reparto 50 + 15 y el resultado «pass or fail» no aplican a la versión beta)
- A: sección «Beta registration now open: AWS Certified Machine Learning Engineer – Associate (MLA-C02)» ✅
- P: <https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/> ✅ (tabla: MLA-C02 beta 170 minutos, 85 preguntas, opción única y múltiple, 3 años de validez; MLA-C01 130 minutos, 65 preguntas)
- Estado: **beta**, no GA. Beta: registro y guía el 2026-09-01; último día de MLA-C01 en inglés 2026-09-28; entrega de la beta desde 2026-09-29; GA de MLA-C02 el **2027-01-14** en todos los idiomas, y ese día se retira MLA-C01 (A ✅).
- Preguntas beta: 85; minutos beta: 170 ✅ A y P. Aprobado: 720 ✅ G. Tipos: opción única y múltiple ✅ G y P.
- 🔎 Reparto puntuadas/no puntuadas de la beta (la guía solo da 50 + 15 para la versión no beta). 🔎 Minutos y número de preguntas del examen GA: ninguna fuente oficial leída los da para MLA-C02 GA.

| Dominio | Nombre oficial (inglés) | Peso | Fuente |
|---------|-------------------------|------|--------|
| 1 | Data Preparation for ML and AI | 28 % | G ✅ |
| 2 | ML Model and Foundation Model (FM) Development | 24 % | G ✅ |
| 3 | Deployment and Orchestration of ML and AI Workflows | 24 % | G ✅ |
| 4 | Operating, Monitoring, and Securing ML and AI Solutions | 24 % | G ✅ |

La misma guía (apéndice «Comparison of MLA-C01 and MLA-C02») da los pesos de MLA-C01: 28 / 26 / 22 / 24.

## 3. Copias antiguas en awsstatic

Las copias de `d1.awsstatic.com` que se descargaron no siempre son la versión vigente. Se leyeron y se compararon, pero **las guías de `docs.aws.amazon.com` mandan**:

| Examen | Copia awsstatic leída | Diferencia con la guía vigente |
|--------|-----------------------|--------------------------------|
| DVA | DVA-C02 v1.3 (32/26/24/18) | Es el examen anterior. Se usa DVA-C03 |
| SAP | SAP-C02 v1.2 (26/29/25/20, 4 dominios, aprobado 750) | Es el examen anterior. Se usa SAP-C03 |
| SCS | SCS-C02 v1.1 (14/18/20/16/18/14, otros nombres) | Es el examen anterior. Se usa SCS-C03 |
| AIF | AIF-C01 v1.4 | Lista además «Case study» como tipo de ítem; la guía vigente de `docs.aws.amazon.com` no lo lista |
| AIP | AIP-C01 v1.0 | Lista ordenar y emparejar; la guía de `docs.aws.amazon.com` no |
| SOA, MLA | `d1.awsstatic.com/training-and-certification/...` devolvió 403 | Se leyó la copia de `onedam/...` (SOA) y la guía de `docs.aws.amazon.com` (MLA) |

## 4. Diferencias con `curriculo-aws.md`

Se compararon las tablas de «Dominios del examen» de las etapas A1 a A11 y la tabla de la sección 2 del currículo.

### 4.1 Diferencias reales (corregir el currículo)

| Examen | Dominio | Currículo | Oficial |
|--------|---------|-----------|---------|
| MLA-C02 | D2 | «Desarrollo de modelos de ML», 26 % (peso de C01) | ML Model and Foundation Model (FM) Development, **24 %** |
| MLA-C02 | D3 | «Despliegue y orquestación de flujos de ML», 22 % (peso de C01) | Deployment and Orchestration of ML and AI Workflows, **24 %** |
| MLA-C02 | D1 | «Preparación de datos para ML», 28 % | Data Preparation for ML **and AI**, 28 % (el peso coincide; el nombre cambió) |
| MLA-C02 | D4 | «Monitoreo, mantenimiento y seguridad de soluciones de ML», 24 % | Operating, Monitoring, and Securing ML **and AI** Solutions, 24 % (el peso coincide; el nombre cambió) |

Nota sobre MLA-C02: el anuncio dice que la estructura de dominios no cambia, y es cierto que siguen siendo cuatro dominios. La guía oficial de C02 sí cambia dos pesos y los cuatro nombres respecto a C01. Los 24 / 24 / 24 / 28 suman 100.

### 4.2 Datos del currículo que quedan confirmados (sin diferencia)

- CLF-C02, SAA-C03, DVA-C03, SOA-C03, DOP-C02, AIF-C01, AIP-C01, SCS-C03 y DEA-C01: los nombres de dominio (traducidos) y los pesos del currículo coinciden con la guía oficial.
- SAP-C03: los cinco nombres coinciden. Los pesos, que el currículo tenía en 🔎, son **25 / 25 / 15 / 15 / 20** (D1 a D5 en el orden del currículo).
- Formato: CLF-C02 65/90, SAA-C03 65/130, DVA-C03 65 (50 puntuadas)/130 con 720, SOA-C03 65/130, DOP-C02 75/180, SAP-C03 75/180, AIF-C01 65/90, DEA-C01 65/130 y MLA-C02 beta 85/170 coinciden.

### 4.3 Datos «por confirmar» del currículo que ya tienen valor oficial

| Examen | Currículo | Oficial |
|--------|-----------|---------|
| AIP-C01 | Formato «por confirmar» | 75 preguntas (65 + 10), 180 min, aprobado 750 |
| SCS-C03 | Formato «por confirmar» | 65 preguntas (50 + 15), 170 min, aprobado 750; incluye ordenar y emparejar |
| DVA-C03 tarea 2.3 | «alcance por confirmar» | «Identify and mitigate security risks associated with using and integrating AI services», 5 habilidades (§2.3) |

### 4.4 Matices a tener en cuenta (no son errores del currículo)

- Aprobado distinto según examen: 700 (CLF-C02, AIF-C01), 720 (SAA-C03, DVA-C03, SOA-C03, SAP-C03, DEA-C01, MLA-C02) y 750 (DOP-C02, AIP-C01, SCS-C03). SAP-C03 bajó a 720; la copia antigua de SAP-C02 decía 750.
- «Ordenar» y «emparejar» solo aparecen en las guías de AIF-C01 y SCS-C03 (y en la copia antigua de AIP-C01). Ninguna guía vigente lista «caso práctico».

## 5. Pendientes (🔎)

1. **MLA-C02:** reparto de preguntas puntuadas y no puntuadas de la beta. Solo se sabe que son 85 en total.
2. **MLA-C02 GA:** minutos y número de preguntas. La guía da 50 + 15 = 65 para la versión no beta y ningún minuto. Revisar la página de la certificación después del 2027-01-14.
3. **AIP-C01:** las dos fuentes oficiales difieren en tipos de ítem (con y sin ordenar y emparejar). Una persona debe abrir la guía vigente en `docs.aws.amazon.com` (HTML) y confirmar.
4. **Sin fecha de retiro indicada** en ninguna fuente leída: CLF-C02, SAA-C03, DOP-C02, AIF-C01, AIP-C01, SCS-C03, DEA-C01 y SOA-C03. Es ausencia de dato, no confirmación de que no vayan a retirarse.
5. **Versión de la guía:** el historial de versiones del PDF de `docs.aws.amazon.com` es ambiguo en varios exámenes. Antes de copiar un número de versión a `shared`, confirmarlo en la guía HTML.
6. **Revisión humana:** abrir en el navegador las páginas HTML de `docs.aws.amazon.com` de los 11 exámenes (el lector automático solo obtuvo el título). Los PDF coinciden con ellas por construcción, pero esa comprobación no se hizo.

## 6. Fuentes de terceros

Ninguna se usó como verificación. No se registra ninguna pista de terceros: todos los datos pendientes de §5 quedan sin dato.
