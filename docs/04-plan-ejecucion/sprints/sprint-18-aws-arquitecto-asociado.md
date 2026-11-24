# Sprint 18 — Contenido AWS: A2, Arquitectura de soluciones asociado (SAA-C03)

> **Estado:** 🔄 construido 2026-11-24 (45 unidades + banco de 195 + tres formas + proyecto, sin publicar); pendientes la defensa técnica, las revisiones humanas y la publicación · **Duración prevista:** ≈ 85 sesiones (en dos lotes) · **Depende de:** S17 (molde, guardas, proyectos por ruta), S16 (arnés `iam`, `network`, `cidr`, `cfn`, `dynamodb`, `s3access`, `events`, `asl`, `cost`), S15 (formas).
> **Ámbito:** contenido. Una unidad por sesión; las unidades con `LAB` de arnés usan una segunda sesión para los laboratorios.

---

## 1. Objetivo

A2 es la etapa central de la ruta: la mayoría de los roles reutiliza su arquitectura. Al cerrar el sprint, las 45 unidades tienen lección y paquete completo, el banco reservado de SAA-C03 tiene sus tres formas, y el proyecto «Aplicación web de tres capas altamente disponible» y su defensa técnica existen. Todo queda **sin publicar** hasta la revisión humana.

Referencia del examen (de `certification.ts`): etapa 102, 65 preguntas (50 puntúan), 130 min, nota 720/1000, dominios **D1 Secure 30 %**, **D2 Resilient 26 %**, **D3 High-Performing 24 %**, **D4 Cost-Optimized 20 %**. Guía oficial: `solutions-architect-associate-03.pdf`.

## 2. Decisiones del Orquestador (2026-11-15)

- **Molde de A2: AWS-U2.2.3** (security groups frente a NACL), con `LAB` de arnés `network`. Es la primera unidad con `QUIZ` reales de SAA-C03 y su forma será la referencia de las otras 44. **Se revisa antes de escalar** (T2 → puerta humana).
- **Énfasis en «decidir entre vecinos».** A diferencia de A1 (reconocer el servicio), en A2 cada módulo contrasta servicios parecidos bajo una restricción: SQS / SNS / EventBridge, Multi-AZ / réplica de lectura, gateway / interface endpoint, ALB / NLB / GWLB, Aurora / DynamoDB, Global Accelerator / CloudFront, Savings Plans / Spot. Esto se refleja en más `QUIZ` de respuesta múltiple y en `REFLECT` de comparación.
- **Reparto de la práctica con arnés** (12 unidades; el resto, la excepción `AUDIT` + 2 `DEBUG`), escogido para ejercitar cada evaluador en el dominio donde más pesa: `iam` en identidad (M2.1), `cidr`/`network` en redes (M2.2), `cfn` en cómputo y seguridad (M2.3, M2.7), `s3access` en almacenamiento (M2.4), `dynamodb` en datos (M2.5), `events` y `asl` en integración (M2.6), `cost` en costo (M2.9). Queda en §4.
- **Dominio por unidad.** Cada `QUIZ` lleva `exam: { certification: "SAA-C03", domain, task, pool: "unit" }`. El dominio de cada unidad está en §4; `task` sale de la guía oficial (se añade a `resources`), o `null` si el agente duda.
- **Banco reservado: 195 preguntas** con el peso de la guía. Por forma de 65: **D1 20, D2 17, D3 15, D4 13**. En total **D1 60, D2 51, D3 45, D4 39**. Lotes de ≤ 20 por dominio: D1 3×20, D2 3×17, D3 3×15, D4 20+19 (11 lotes). Un tercio como mínimo de respuesta múltiple. Guarda de similitud (S17-T1d) sin coincidencias con el banco de unidad **ni con el de A1**.
- **Proyecto y defensa.** El proyecto «Aplicación web de tres capas altamente disponible» pide diseño, IaC, un ADR por pilar del Well-Architected, costo fechado y plan de DR con RPO/RTO. La defensa es un escenario SIM con el rol de arquitecto asociado, en la semilla de entrevistas por ruta.

## 3. Énfasis pedagógico

- **Decidir entre vecinos.** Cada módulo tiene preguntas que contrastan servicios parecidos bajo la restricción del enunciado (seguro, resiliente, alto rendimiento o costo).
- **Los cuatro calificadores del examen** aparecen en el banco con el peso de su dominio.
- **Ejecución con arnés:** evaluación de políticas (M2.1), subredes y alcanzabilidad (M2.2), plantillas (M2.3, M2.7), acceso público a S3 (M2.4), claves de DynamoDB (M2.5), patrones de EventBridge y máquinas de estado (M2.6), estimación de costo (M2.9).
- **Repaso acumulativo:** el 20 % de la cola diaria trae conceptos de A1.

## 4. Unidades

Título literal del currículo. Dominio = `exam.domain` de los `QUIZ` de la unidad. «Excepción» = 1 `AUDIT` + 2 `DEBUG` (sin `LAB`); «Arnés X» = `LAB` guiado + autónomo con ese evaluador.

| Código | Título | Dom. | Práctica | `MEMORY` |
|--------|--------|------|----------|----------|
| AWS-U2.1.1 | Lógica de evaluación de políticas IAM: denegación explícita, permiso y denegación implícita | D1 | **Arnés `iam`** (`evaluate`: Allow / ExplicitDeny / ImplicitDeny) | ✔ (efecto ↔ causa) |
| AWS-U2.1.2 | Roles, AssumeRole, perfiles de instancia y acceso entre cuentas | D1 | Excepción | ✔ (mecanismo ↔ uso) |
| AWS-U2.1.3 | Políticas basadas en recursos, límites de permisos y condiciones | D1 | **Arnés `iam`** (política de recurso + límite de permisos + condiciones) | |
| AWS-U2.1.4 | Organizations, SCP, Control Tower e IAM Identity Center | D1 | Excepción | ✔ (servicio ↔ gobierno) |
| AWS-U2.1.5 | Identidades de aplicación: grupos de usuarios y de identidades de Cognito | D1 | Excepción | ✔ (pool ↔ caso) |
| **AWS-U2.2.3** | Security groups frente a network ACL: con estado y sin estado | D1 | **Arnés `network`** · **molde de A2** | |
| AWS-U2.2.1 | Diseño de VPC: CIDR y subredes públicas y privadas por zona | D1 | **Arnés `cidr`** (plan de subredes) | |
| AWS-U2.2.2 | Enrutamiento: Internet Gateway, NAT Gateway y tablas de rutas | D1 | **Arnés `network`** (alcanzabilidad) | |
| AWS-U2.2.4 | VPC endpoints (gateway e interface) y PrivateLink | D1 | Excepción | ✔ (endpoint ↔ caso) |
| AWS-U2.2.5 | Conectar redes: peering, Transit Gateway, Site-to-Site VPN y Direct Connect | D2 | Excepción | ✔ (conexión ↔ caso) |
| AWS-U2.2.6 | Route 53: registros, políticas de enrutamiento y comprobaciones de estado | D2 | Excepción | ✔ (política ↔ caso) |
| AWS-U2.3.1 | EC2: familias de instancia, AMI, almacenamiento de instancia y grupos de ubicación | D3 | Excepción | ✔ (familia ↔ caso) |
| AWS-U2.3.2 | Elastic Load Balancing: ALB, NLB y GWLB | D2 | Excepción | ✔ (balanceador ↔ caso) |
| AWS-U2.3.3 | Auto Scaling: políticas, comprobaciones de estado y ciclo de vida | D2 | **Arnés `cfn`** (plantilla con ASG y launch template válida) | |
| AWS-U2.3.4 | Contenedores: ECS, EKS, Fargate y ECR | D3 | Excepción | ✔ (servicio ↔ caso) |
| AWS-U2.3.5 | Serverless con Lambda: concurrencia, límites, Lambda en VPC y cuándo no usarlo | D3 | Excepción | |
| AWS-U2.4.1 | S3: clases de almacenamiento, ciclo de vida, versionado y replicación | D4 | Excepción | ✔ (clase ↔ caso) |
| AWS-U2.4.2 | S3 seguro: Block Public Access, políticas de bucket, cifrado, URL prefirmadas y Object Lock | D1 | **Arnés `s3access`** | |
| AWS-U2.4.3 | Rendimiento de S3: prefijos, carga multiparte y Transfer Acceleration | D3 | Excepción | |
| AWS-U2.4.4 | Bloques y archivos: EBS (tipos de volumen, snapshots), EFS y FSx | D3 | Excepción | ✔ (almacenamiento ↔ caso) |
| AWS-U2.4.5 | Transferencia e híbrido: DataSync, Storage Gateway, Snow Family y Transfer Family | D3 | Excepción | ✔ (servicio ↔ caso) |
| AWS-U2.5.1 | RDS: Multi-AZ frente a réplicas de lectura, copias y restauración | D2 | Excepción | |
| AWS-U2.5.2 | Aurora: almacenamiento distribuido, Global Database y Serverless v2 | D2 | Excepción | |
| AWS-U2.5.3 | DynamoDB: claves, modos de capacidad, índices, DAX, streams y tablas globales | D3 | **Arnés `dynamodb`** (claves por patrones de acceso, sin `Scan`) | ✔ (patrón ↔ clave) |
| AWS-U2.5.4 | Caché con ElastiCache (Valkey, Redis OSS, Memcached) y estrategias de caché | D3 | Excepción | ✔ (estrategia ↔ caso) |
| AWS-U2.5.5 | Elegir la base de datos de propósito específico | D3 | Excepción | ✔ (base ↔ caso) |
| AWS-U2.6.1 | SQS: estándar frente a FIFO, tiempo de visibilidad y colas de mensajes fallidos | D2 | Excepción | |
| AWS-U2.6.2 | SNS y fan-out; EventBridge: buses, reglas, Pipes y Scheduler | D2 | **Arnés `events`** (`matches` de patrones) | ✔ (servicio ↔ caso) |
| AWS-U2.6.3 | Step Functions: orquestación frente a coreografía | D2 | **Arnés `asl`** (máquina de estados válida) | |
| AWS-U2.6.4 | API Gateway: REST frente a HTTP API, limitación, caché y autorizadores | D2 | Excepción | |
| AWS-U2.6.5 | Streaming: Kinesis Data Streams, Amazon Data Firehose y MSK | D2 | Excepción | ✔ (servicio ↔ caso) |
| AWS-U2.7.1 | KMS: claves, políticas de clave, cifrado envolvente y rotación | D1 | **Arnés `cfn`** (plantilla con clave KMS y su política, válida) | |
| AWS-U2.7.2 | Secrets Manager frente a Parameter Store; ACM y certificados | D1 | Excepción | ✔ (servicio ↔ caso) |
| AWS-U2.7.3 | Protección perimetral: WAF, Shield, CloudFront con OAC y Firewall Manager | D1 | Excepción | ✔ (servicio ↔ amenaza) |
| AWS-U2.7.4 | Detección y auditoría: CloudTrail, Config, GuardDuty, Security Hub y Macie | D1 | Excepción | ✔ (servicio ↔ señal) |
| AWS-U2.8.1 | Alta disponibilidad multi-AZ y tolerancia a fallos | D2 | Excepción | |
| AWS-U2.8.2 | Estrategias de DR (copia y restauración, pilot light, warm standby, activo-activo) y RPO/RTO | D2 | Excepción | ✔ (estrategia ↔ RPO/RTO) |
| AWS-U2.8.3 | AWS Backup, Elastic Disaster Recovery y replicación entre regiones | D2 | Excepción | |
| AWS-U2.9.1 | CloudFront y Global Accelerator: rendimiento en el borde | D3 | Excepción | ✔ (servicio ↔ caso) |
| AWS-U2.9.2 | Costo de cómputo: dimensionamiento, Savings Plans, Spot y Graviton | D4 | **Arnés `cost`** (estimación con tabla de precios DEL ENUNCIADO) | ✔ (modelo ↔ caso) |
| AWS-U2.9.3 | Costo de almacenamiento, transferencia de datos y NAT | D4 | Excepción | |
| AWS-U2.9.4 | Analítica a escala: Athena, Glue, Lake Formation, Redshift, EMR y QuickSight (selección) | D3 | Excepción | ✔ (servicio ↔ caso) |
| AWS-U2.9.5 | Migración y modernización: Application Migration Service, DMS y descubrimiento | D3 | Excepción | ✔ (7 R / servicio ↔ caso) |
| AWS-U2.10.1 | Técnica: descartar distractores por la restricción del enunciado | — | Técnica: 8 `QUIZ` de los 4 dominios que se resuelven por eliminación, 6 `FLASHCARD` y 1 `REFLECT`, sin `LAB` ni `AUDIT` | |
| AWS-U2.10.2 | Simulacros SAA-C03 y plan de refuerzo por dominio | — | Preparación: 8 `QUIZ` mixtos de los 4 dominios (con `exam`), 6 `FLASHCARD` y 1 `REFLECT` (plan de refuerzo), sin `LAB` ni `AUDIT` | |

Arneses usados: `iam` (×2), `network` (×2, una el molde), `cidr`, `cfn` (×2), `s3access`, `dynamodb`, `events`, `asl`, `cost` → 12 unidades con `LAB`; 31 con la excepción; 2 de preparación/técnica.

**Mapeo para `PACKAGE_RULES` (guarda S18-T0a):** cada unidad lleva `practice` ∈ {`arnés`, `excepción`, `preparación`} y `memory` booleano. Las 12 con arnés → `arnés`; las de M2.10 (U2.10.1 y U2.10.2) → `preparación` (U2.10.1 modela la técnica con la misma forma: ≥8 `QUIZ` de ≥3 dominios, 6 `FLASHCARD`, 1 `REFLECT`); las 31 restantes → `excepción`. `memory: true` en las 26 marcadas con ✔. Recuentos de A2: arnés 12, preparación 2, excepción 31, memory 26. **Totales de la tabla completa (A0+A1+A2): 80 unidades, arnés 22, preparación 3, excepción 54, diagnóstico 1, memory 38.**

## 5. Tareas

> **Verificación común** (igual que S17):
> - `npm run build -w packages/shared` y `-w packages/aws-harness`;
> - `typecheck`, `lint` y `test` por workspace;
> - en contenido, además: `npm run db:seed:aws` en la base de trabajo (5442) y la huella de quizzes de fullstack por etapa `1662|8ca67124b00bae39a25ac73d1fb58d75`.

### 5.0 Reglas fijas

1. **Base de trabajo:** `codeai-s16-db`, puerto **5442**, con `DATABASE_URL` exportado. La base del responsable (5433) no se toca. Nunca 5432.
2. **Contenido AWS:** método §3, §5, §6 y §13; títulos literales; objetivos que empiezan por infinitivo; solo fuentes del inventario; sin datos volátiles, sin volcados y sin preguntas de muestra oficiales; `isPublished: false`.
3. **Una tarea de unidad toca solo `aws/units/<código>.json`.** Si una guarda la rechaza por algo fuera de ese archivo, la tarea se detiene.
4. Git como siempre: los 3 archivos ajenos no se tocan, `git add` por ruta, nada de `--amend` ni de formatear archivos existentes.
5. **Reglas aprendidas del molde de S17** (obligatorias en cada unidad): la opción correcta tiene la misma estructura que los distractores y no repite el calificador ni añade coletillas que la delaten; cada afirmación técnica está respaldada por una URL del inventario; calificador en mayúsculas de la lista de la guarda; una sola respuesta defendible; letras correctas repartidas; longitudes equilibradas; cada pregunta se entiende sola.

### 5.1 Plataforma (extender las guardas a la etapa 102)

**S18-T0a — La guarda de completitud cubre la etapa 102.**
- **Archivo:** `apps/api/src/modules/content/seed-course-quality.spec.ts`.
- **Contrato:** `PACKAGE_RULES` incluye las 45 unidades de A2 según §4 (incluidas U2.10.1 y U2.10.2); la función de completitud se aplica también a las unidades de la etapa 102 con al menos un `QUIZ`. La coherencia `exam` se extiende a la etapa 102 / `SAA-C03` (como existe para 101 / `CLF-C02`).
- **Criterios:** ejemplos sintéticos a los dos lados; los pilotos de 102 sin `QUIZ` no se evalúan todavía; suite en verde.

**S18-T0b — Nada más de plataforma.** Proyectos de cualquier ruta (S17-T1a), banco reservado en la semilla (S17-T1c) y similitud (S17-T1d) ya sirven para A2 sin cambios. El proyecto de A2 solo se añade a `aws/projects.seed.json`.

### 5.2 Fuentes

**S18-T1 — Inventario de recursos oficiales de A2.**
- **Archivo:** `aws/course.seed.json`, solo `resources` y los `resources` de las unidades de la etapa 102.
- **Recursos:** por unidad, 1–4 páginas oficiales de `docs.aws.amazon.com`, `aws.amazon.com` o `skillbuilder.aws`, más la guía de SAA-C03. Cada recurso con `title` (el `<title>` real, comprobado con `curl`), `language`, `status: "VERIFIED"` y `notes` con «Leído por agente el AAAA-MM-DD; pendiente de revisión humana».
- **Criterios:** `db:seed:aws` en verde; ninguna URL repetida; reporte por unidad.

### 5.3 Unidades

**S18-T2 — Molde de A2: AWS-U2.2.3** (ficha tipo de método §13 con la fila de §4). Primera unidad con `QUIZ` reales de SAA-C03.

**S18-T2b — Revisión humana del molde (persona).** Igual que S17-T4: las 7 secciones de la lección; cada pregunta frente al método §5; la excepción y los `LAB` de arnés. Los defectos de método se corrigen **en esta ficha y en el método** antes de seguir. **El sprint se detiene aquí hasta que haya revisión** (como en S17; si el responsable decide diferirla, el Orquestador aplica sus propias correcciones y las convierte en reglas, y las señala para la revisión posterior).

**S18-T3…T27 — Lote 1: AWS-M2.1 a AWS-M2.5** (26 unidades; 25 sin el molde), una por sesión, en el orden de §4.

**S18-T28 — Revisión humana del lote 1 (persona),** en `revision-pedagogica.md`.

**S18-T29…T47 — Lote 2: AWS-M2.6 a AWS-M2.10** (19 unidades), una por sesión.

### 5.4 Banco reservado, formas, proyecto y defensa

**S18-T48…T58 — Banco reservado de SAA-C03** (11 lotes de un solo dominio): D1 3×20, D2 3×17, D3 3×15, D4 20+19 = 195.
- **Archivo:** `aws/exam-bank/SAA-C03-D<n>-<lote>.json`.
- **Contenido:** `single` y `multiple`, un tercio como mínimo de `multiple`, tareas de la guía repartidas, `exam.pool: "reserved"`.
- **Guarda:** S17-T1d sin coincidencias con el banco de unidad ni con el de A1.

**S18-T59 — Formas A, B y C.**
- **Archivo:** `aws/exam-forms/SAA-C03.json`.
- **Contenido:** tres formas disjuntas de 65 con el reparto 20/17/15/13 (validado por `examFormViolations`).

**S18-T60 — Proyecto de A2.**
- **Archivo:** `aws/projects.seed.json` (se añade al que ya existe).
- **Proyecto:** «Aplicación web de tres capas altamente disponible» con rúbrica por pilar: diseño, IaC, un ADR por pilar del Well-Architected, costo fechado y plan de DR con RPO/RTO.

**S18-T61 — Defensa técnica de A2.**
- **Archivo:** semilla de entrevistas por ruta (escenario SIM, rol arquitecto asociado).

**S18-T62 — Revisión del lote 2 y del 100 % del banco reservado (persona),** en `revision-pedagogica.md`.

### 5.5 Orden

S18-T0a → S18-T1 → S18-T2 → **S18-T2b (persona)** → T3…T27 → **T28 (persona)** → T29…T47 → T48…T58 → T59 → T60 → T61 → **T62 (persona)** → documentación de cierre (Orquestador).

## 6. Criterios de cierre

- [ ] 45 unidades cargadas con lección y paquete; `seed-course-quality` en verde (con S18-T0a); toda unidad desde M2.1 con ≥ 2 preguntas de respuesta múltiple.
- [ ] Cada `LAB` con arnés: la solución pasa y el código inicial falla en el sandbox `docker`.
- [ ] 195 preguntas reservadas con el reparto 60/51/45/39, ninguna parecida a una del banco de unidad ni de A1, y las tres formas válidas.
- [ ] Molde, lotes y banco revisados por una persona distinta de quien los redactó (o diferido por decisión del responsable, con las correcciones del Orquestador aplicadas y señaladas).
- [ ] El proyecto de A2 y su defensa existen.
- [ ] Simulacro A de SAA-C03 jugable de punta a punta.
- [ ] La publicación de A2 la decide el responsable tras la revisión. Todo el contenido con `isPublished: false`.

## 7. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) (A2)
- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md)
- [`sprint-17-aws-fundamentos.md`](sprint-17-aws-fundamentos.md) (molde, guardas y registro de construcción de A0–A1)

## 8. Registro de construcción (Orquestador, 2026-11-24)

Las unidades M2.1–M2.5 las construyeron subagentes de Claude Sonnet 5.5 (una tarea por agente); DeepSeek no llegó a intervenir en A2 por agotarse sus créditos. Al llegar Sonnet a su límite semanal, el Orquestador construyó directamente U2.6.5 (Opus 4.8) y de M2.7 a M2.10, el banco, las formas y el proyecto (sesión Sonnet 5.5), por indicación del responsable. Cada unidad pasó la guarda `seed-course-quality` (53 pruebas) con prueba negativa de los `DEBUG` y `LAB` (solución pasa y código inicial falla, ejecutados en proceso), y la semilla en la base de trabajo 5442.

**Unidades:** 45 de 45 en A2 (M2.1–M2.10), todas `isPublished: false`. Arneses usados: `iam`, `network`, `cidr`, `cfn` (U2.3.3, U2.7.1), `s3access` (U2.4.2), `dynamodb` (U2.5.3), `events` (U2.6.2), `asl` (U2.6.3), `cost` (U2.9.2). M2.10 (U2.10.1 y U2.10.2) es de preparación: 8 `QUIZ` de cuatro dominios, 6 `FLASHCARD` y 1 `REFLECT`.

**Banco reservado (T48–T58):** 195 preguntas en 11 archivos `aws/exam-bank/SAA-C03-D<n>-<lote>.json` (D1 60, D2 51, D3 45, D4 39), cada una enlazada a la unidad que enseña el concepto, con al menos un tercio de respuesta múltiple por lote, y la guarda en verde (letras, longitud de opciones, calificadores, similitud con el banco de unidad). El `order` de cada pregunta es único por unidad (`1000 + (dominio − 1)·400 + lote·100 + n`).

**Formas (T59):** `aws/exam-forms/SAA-C03.json`, tres formas disjuntas de 65 con el reparto 20/17/15/13, repartidas por turnos dentro de cada dominio y barajadas; la semilla las valida con `examFormViolations`.

**Proyecto (T60):** «Aplicación web de tres capas altamente disponible» (`aws/projects.seed.json`, etapa 102, sin publicar).

**No hecho (decisión del responsable):**
- **Defensa técnica de A2 (T61):** el catálogo de entrevistas solo admite los roles `backend`, `frontend`, `fullstack`, `data` y `qa` y los lenguajes `ts`, `py`, `java` y `go`; un escenario de arquitecto asociado exige ampliar el contrato compartido (y, si procede, la interfaz) o declarar un rol nuevo. Es un cambio de plataforma, no de contenido, y queda diferido.
- **`LAB` en el sandbox `docker` y simulacro A jugable de punta a punta:** la guarda ejecuta los laboratorios en proceso; no se ha repetido la comprobación en el sandbox `docker` ni se ha jugado el simulacro A en la interfaz.

**Puntos señalados para las revisiones humanas (T28, T62):**
- los números de tarea de la guía (`exam.task`) los dedujeron los autores del dominio y de la unidad, porque la guía oficial no expone el texto de las tareas por `curl`; hay que verificarlos todos, también los de las 195 preguntas del banco;
- el banco se redactó a partir de las fuentes de las unidades y de conocimiento general de los servicios; no cada afirmación se contrastó con una página oficial concreta (p. ej. tarifa de Direct Connect, precio de gp3 frente a gp2, instancias reservadas de RDS, requisito de versionado de la replicación); conviene confirmarlas con su fuente antes de publicar, como pide T62;
- Snowball Edge (U2.4.5) y AWS Application Discovery Service (U2.9.5) avisan en su página de que ya no están abiertos a clientes nuevos; decidir si se conservan como contenido de examen;
- los evaluadores `events` (rechazo de `$or` junto a otros campos) y `cfn` (valida la forma de la plantilla, no las propiedades) simplifican la realidad; los LAB lo declaran como convención del arnés;
- competencias: M2.6 usa `AWS-C6` y M2.7 usa `AWS-C10` por coherencia temática, aunque el currículo las marca como secundarias en A2; unificar o mantener es decisión pendiente;
- URL de recursos registrados por subagentes en M2.4–M2.6 sin barrer: un `200` no basta, hay que comprobar que la página tenga texto (se corrigió una en M2.8);
- nombres vigentes que cambiaron: QuickSight figura como «AWS Quick Sight», Application Migration Service como «AWS Transform MGN».

**Lo que queda, todo de una persona:** las revisiones del molde y del lote 1 (T28), la del lote 2 y del 100 % del banco (T62), la decisión sobre la defensa técnica y la decisión de publicar A2.
