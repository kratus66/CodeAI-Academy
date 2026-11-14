# Sprint 17 — Contenido AWS: A0 (cuenta segura y nivelación) y A1 (CLF-C02)

> **Estado:** ✅ construido (2026-11-14): las 35 unidades (A0 15, A1 20), el banco reservado de CLF-C02 (195 preguntas), las tres formas del simulacro y los dos proyectos están hechos, sin publicar, y la suite completa está en verde. Faltan las **revisiones humanas** (T4, T19b y T52) y la decisión de publicar, todas diferidas. Registro en §8 · **Depende de:** S13, S14, S15 y S16, todos cerrados.
> **Ámbito:** contenido de `apps/api/prisma/seed/aws/…` y cuatro tareas de plataforma (T1a–T1d). Cada tarea de unidad toca **un solo archivo** y sigue la ficha tipo de [`metodo-aws.md`](../../02-contenido/metodo-aws.md) §13.
> **Puertas humanas:** dos tareas son de una persona y paran el sprint hasta que se hacen:
> - **T4**: revisar el molde de A0 (AWS-U0.1.2);
> - **T19b**: revisar el molde de A1 (AWS-U1.2.1);
> - **T52**: revisar una muestra del lote y el 100 % del banco reservado.
>
> Las tres se **difirieron** por decisión del responsable: la construcción continuó sin ellas, con las dos correcciones que el Orquestador encontró en el molde de A0 aplicadas y convertidas en reglas para las demás unidades. Un defecto de método que se le escapara al Orquestador se habrá propagado; §8 lista los puntos señalados para esas revisiones.

---

## 1. Objetivo

Al cerrar el sprint:
- las 35 unidades de A0 y A1 tienen una lección de 7 pasos y su paquete completo de ejercicios;
- el banco reservado de CLF-C02 tiene 195 preguntas y sus tres formas;
- existen los proyectos de A0 y A1;
- una persona revisó los dos moldes y una muestra del lote.

Nada se publica: la publicación la decide el responsable después de la revisión.

## 2. Decisiones del Orquestador (2026-11-12)

Se ratifican o se cambian en la revisión de los moldes (T4 y T19b).

| # | Decisión |
|---|----------|
| a | **Paquete mínimo por unidad** de A0 y A1 (método §6). Lo exige la guarda T1b. Ver el detalle debajo de la tabla. |
| b | **Excepción declarada:** una unidad sin objeto evaluable por el arnés sustituye la pareja de `LAB` por **1 `AUDIT` + 1 `DEBUG` de configuración más**, es decir, 2 `DEBUG` en total. Un `DEBUG` de configuración es TypeScript que exporta un objeto (una política, una lista de etiquetas, una estimación…) con pruebas `assert`. Si encaja, usa `aws.*`. La columna «Práctica» de §4 dice qué unidades usan arnés y cuáles la excepción. |
| c | **`MEMORY` `match`:** uno por módulo, en la unidad marcada en §4. En los catálogos de servicios (M1.3) hay uno por unidad. |
| d | **`CHALLENGE` por dominio:** lo cubre el bloque por dominio del simulador (S15), que usa el banco reservado. No hay un ejercicio `CHALLENGE` aparte. |
| e | **Metadatos `exam`:** los `QUIZ` de A1 llevan `exam` con `certification: "CLF-C02"`, el dominio del módulo y `pool: "unit"` (reglas de S14). Los de A0 **no** llevan `exam`, porque A0 no tiene certificación. |
| f | **Banco reservado:** en archivos `aws/exam-bank/CLF-C02-D<n>-<lote>.json`. Cada pregunta indica la unidad del concepto, que es a la que enlaza el informe del simulacro. T1c hace que la semilla los lea. |
| g | **Unicidad de slugs:** los slugs son únicos en todo el curso. Los de cada unidad llevan su código como prefijo (`aws-u0-1-2-…`) y los del banco reservado, `clf-c02-r-…`. |
| h | **Fuentes:** solo URL oficiales que estén en el inventario `resources` (T2a/T2b), que se abrieron y leyeron con su `<title>` comprobado. Ningún ejercicio cita una URL que no esté en ese inventario. |
| i | **Datos volátiles:** ningún precio, cuota ni límite fuera del enunciado. Si el enunciado los da, llevan su fuente y su fecha. Prohibido usar volcados de preguntas y prohibido usar las preguntas de muestra oficiales. |

**Detalle de la decisión (a): el paquete mínimo de cada unidad**
- 1 lección de 7 pasos con al menos un bloque `mermaid`. En A1, el paso de objetivo cita «CLF-C02» y el dominio;
- 8 `QUIZ` de escenario;
- 6 `FLASHCARD`;
- 1 `DEBUG`;
- 1 `REFLECT`;
- `LAB` guiado + `LAB` autónomo con arnés, **o** la excepción de la decisión (b).

## 3. Hallazgos al revisar el código (2026-11-12)

| # | Hallazgo | Consecuencia |
|---|----------|--------------|
| H1 | `stageIdSchema` (`project.ts`), `projectListQuerySchema.stage` y `seed-projects.mts` limitan la etapa a 0–11. `seed-projects.mts` solo lee `projects.seed.json`. Las competencias `AWS-C*` ya se aceptan (`competencyCodeSchema`). `interview.ts` no tiene etapa. | T1a: etapas con `isKnownStageId` (course.ts) y lectura de `aws/projects.seed.json`. |
| H2 | `seed-course.mts` solo lee `aws/course.seed.json`, `aws/units/*.json` y `aws/exam-forms/*.json`. `courseUnitFileSchema` exige al menos una lección. | T1c: carga y valida `aws/exam-bank/*.json` (decisión f). |
| H3 | La guarda `seed-course-quality` no exige el paquete mínimo en unidades sin publicar, porque la regla 7 solo mira las publicadas. `seed-lesson-quality` no se aplica a AWS. | T1b: una guarda de completitud del paquete y de la lección AWS. |
| H4 | La regla 6 (reparto de la letra correcta) cuenta todos los `single` de la unidad, sin distinguir el banco. | T1c: la regla se aplica por banco (`unit` por unidad, `reserved` por archivo del banco). |
| H5 | No existe ninguna comprobación de similitud entre el banco reservado y el de unidad (criterio de cierre). | T1d. |
| H6 | `resources` del esqueleto está vacío y el esquema de recurso no tiene campo de fecha. | T2a/T2b: la fecha de lectura va en `notes`. |
| H7 | Ya existen los pilotos AWS-U0.2.2 (`CLOUD_LAB`) y AWS-U0.3.1 (`LAB` `cidr`), cada uno con 1 lección y 1 ejercicio. | Sus tareas **completan** el paquete en el mismo archivo, sin rehacer lo que hay. |
| H8 | CLF-C02 solo tiene preguntas `single` y `multiple`: 65 preguntas, con el reparto 16/19/22/8 por forma (S15). | 3 formas × 65 = 195 preguntas: 48 de D1, 57 de D2, 66 de D3 y 24 de D4. |

## 4. Unidades

| Código | Título (literal del currículo) | Dominio | Práctica | `MEMORY` |
|--------|--------------------------------|---------|----------|----------|
| AWS-U0.1.1 | El mapa de certificaciones AWS, los roles que acreditan y sus versiones vigentes | — | Excepción | ✔ (certificación ↔ rol) |
| **AWS-U0.1.2** | Anatomía de una pregunta de examen: escenario, restricción y calificador («MOST cost-effective», «LEAST operational overhead») | — | Excepción · **molde de A0** | |
| AWS-U0.1.3 | Método de estudio: repaso espaciado, simulacros y registro de errores | — | Excepción | |
| AWS-U0.1.4 | El día del examen: modalidades, políticas, idiomas y adaptación por idioma no nativo | — | Excepción | |
| AWS-U0.1.5 | Prueba diagnóstica sin ayuda (redes, Linux, HTTP, programación, bases de datos) | — | Diagnóstico: 12 `QUIZ` multitema, 6 `FLASHCARD` y 1 `REFLECT` (plan de nivelación), sin `DEBUG` ni `AUDIT` | |
| AWS-U0.2.1 | Usuario raíz, MFA y contactos de seguridad | — | Excepción + `CLOUD_LAB` opcional (MFA en raíz, comprobado con `get-account-summary`) | |
| AWS-U0.2.2 | Presupuestos, alertas de facturación y condiciones vigentes de la capa gratuita | — | Excepción; ya tiene el `CLOUD_LAB` piloto | |
| AWS-U0.2.3 | IAM Identity Center y credenciales temporales para la CLI | — | Excepción | |
| AWS-U0.2.4 | AWS CLI y CloudShell: perfiles, regiones y salida JSON | — | Excepción | |
| AWS-U0.2.5 | Desmontar lo que creas: etiquetas, Resource Groups y lista de limpieza | — | Excepción | ✔ (herramienta ↔ riesgo) |
| AWS-U0.3.1 | Redes IP: direcciones, CIDR y cálculo de subredes | — | Arnés `cidr`: ya tiene el `LAB` guiado piloto; falta el autónomo | |
| AWS-U0.3.2 | DNS, TCP/UDP, puertos y TLS | — | Excepción | ✔ (puerto ↔ protocolo) |
| AWS-U0.3.3 | HTTP, APIs REST y JSON: leer peticiones y respuestas | — | Excepción | |
| AWS-U0.3.4 | Linux mínimo para servidores: SSH, permisos, procesos y logs | — | Excepción | |
| AWS-U0.3.5 | JSON y YAML: los formatos de políticas y plantillas | — | Arnés `iam`/`cfn`: `LAB` guiado + autónomo (política y plantilla válidas) | |
| AWS-U1.1.1 | Beneficios de la nube y economía de escala | D1 | Excepción | |
| AWS-U1.1.2 | Modelos de servicio y de despliegue | D1 | Excepción | ✔ (modelo ↔ responsabilidad) |
| AWS-U1.1.3 | Infraestructura global: regiones, zonas de disponibilidad, ubicaciones de borde y Local Zones | D1 | Excepción | |
| AWS-U1.1.4 | AWS Well-Architected Framework: los seis pilares | D1 | Excepción | |
| AWS-U1.1.5 | Estrategias de migración (las 7 R) y Cloud Adoption Framework | D1 | Excepción | |
| **AWS-U1.2.1** | Modelo de responsabilidad compartida | D2 | Excepción · **molde de A1** | |
| AWS-U1.2.2 | IAM: usuarios, grupos, roles, políticas y mínimo privilegio | D2 | Arnés `iam`: `LAB` guiado + autónomo | |
| AWS-U1.2.3 | Servicios de seguridad: GuardDuty, Inspector, Security Hub, Shield, WAF y Macie | D2 | Excepción | ✔ (servicio ↔ amenaza) |
| AWS-U1.2.4 | Gobierno y cumplimiento: Organizations, SCP, CloudTrail, Config y Artifact | D2 | Arnés `iam` (SCP): `LAB` guiado + autónomo | |
| AWS-U1.2.5 | Cifrado y secretos: KMS, cifrado en reposo y en tránsito, Secrets Manager | D2 | Excepción | |
| AWS-U1.3.1 | Formas de usar AWS: consola, CLI, SDK e infraestructura como código | D3 | Arnés `cfn`: `LAB` guiado + autónomo | ✔ |
| AWS-U1.3.2 | Cómputo: EC2, contenedores (ECS, EKS, Fargate) y Lambda | D3 | Excepción | ✔ |
| AWS-U1.3.3 | Almacenamiento: S3 y sus clases, EBS, EFS, Storage Gateway y AWS Backup | D3 | Arnés `s3access`: `LAB` guiado + autónomo | ✔ |
| AWS-U1.3.4 | Bases de datos: RDS, Aurora, DynamoDB, ElastiCache y Redshift | D3 | Arnés `dynamodb`: `LAB` guiado + autónomo | ✔ |
| AWS-U1.3.5 | Redes y entrega de contenido: VPC, Route 53, CloudFront, ELB, VPN y Direct Connect | D3 | Arnés `network`/`cidr`: `LAB` guiado + autónomo | ✔ |
| AWS-U1.3.6 | Integración, analítica e IA: SQS, SNS, EventBridge, Kinesis, Athena, Glue, Bedrock y SageMaker AI | D3 | Arnés `events`: `LAB` guiado + autónomo | ✔ |
| AWS-U1.4.1 | Modelos de precio de cómputo: bajo demanda, Savings Plans, instancias reservadas y Spot | D4 | Arnés `cost`: `LAB` guiado + autónomo | ✔ (modelo ↔ caso) |
| AWS-U1.4.2 | Herramientas de costo: Pricing Calculator, Cost Explorer, Budgets, informes de costo y etiquetas de asignación | D4 | Excepción | |
| AWS-U1.4.3 | Planes de soporte, AWS Marketplace, Trusted Advisor y recursos de ayuda | D4 | Excepción | |
| AWS-U1.5.1 | Simulacros CLF-C02 y plan de refuerzo por dominio | — | Preparación: 8 `QUIZ` mixtos de los 4 dominios (con `exam`) y 1 `REFLECT` (plan de refuerzo), sin `LAB` ni `AUDIT` | |

## 5. Tareas

> **Verificación común:**
> - `npm run build -w packages/shared`;
> - `npm run build -w packages/aws-harness`;
> - `typecheck` por workspace, `lint` y `test` por workspace.
>
> En las tareas de contenido, además: `npm run db:seed:aws` en la base de trabajo y huella de quizzes `1662|8ca67124b00bae39a25ac73d1fb58d75`.

### 5.0 Reglas fijas

1. **Base de trabajo:** `codeai-s16-db`, en el puerto **5442**, con `DATABASE_URL` exportado. La base del responsable (5433) no se toca. Nunca 5432.
2. **Contenido AWS:**
   - método §3, §5, §6 y §13;
   - títulos literales;
   - objetivos que empiezan por un infinitivo;
   - solo fuentes del inventario (decisión h);
   - sin datos volátiles, sin volcados de preguntas y sin preguntas de muestra oficiales;
   - `isPublished: false`.
3. **Una tarea de unidad toca solo `aws/units/<código>.json`.** Si una guarda la rechaza por algo fuera de ese archivo, la tarea se detiene.
4. Git como siempre: los 3 archivos ajenos no se tocan, `git add` por ruta y nada de formatear archivos existentes.

### 5.1 Plataforma

**S17-T1a — Proyectos de cualquier ruta.**
- **Archivos:** `packages/shared/src/schemas/project.ts` y `project.spec.ts`, y `apps/api/prisma/seed/seed-projects.mts`.
- **Contrato:**
  - `stageIdSchema` y `projectListQuerySchema.stage` aceptan cualquier etapa que valide `isKnownStageId` (`course.ts`), con el mensaje «La etapa no existe en ninguna ruta»;
  - `seed-projects.mts` lee además `aws/projects.seed.json` si existe, con el mismo esquema, y comprueba que la etapa existe en la base.
- **Criterios:** una prueba con la etapa 100 (válida), otra con la 50 (inválida) y otra con la 11 (sigue siendo válida). `db:seed:projects` sin el archivo AWS da las mismas cifras de antes.

**S17-T1b — Guarda de completitud de la unidad AWS.**
- **Archivo:** `apps/api/src/modules/content/seed-course-quality.spec.ts`.
- **Contrato:** una función pura `unitPackageProblems(unit, stageId, exceptions)` que se aplica a toda unidad de las etapas 100 y 101 **cuyo archivo tenga al menos un `QUIZ`**, es decir, cuyo paquete ya se empezó. Comprueba la decisión (a), con la excepción (b) según una tabla `PACKAGE_RULES` declarada en el spec y copiada de §4 (incluidas U0.1.5 y U1.5.1).
- **Lección:** se aplican también las reglas de lección AWS:
  - al menos un `mermaid`;
  - en A1, el paso `objective` cita la certificación;
  - al menos 2 «Error común» con causa y solución (modelo: `seed-lesson-quality.spec.ts`).
- **Criterios:**
  - hay ejemplos sintéticos completos y otros a los que les falta cada pieza;
  - los pilotos actuales, que no tienen `QUIZ`, no se evalúan todavía;
  - la suite sigue en verde.

**S17-T1c — Banco reservado en la semilla.**
- **Archivos:** `packages/shared/src/schemas/course-seed.ts` y su spec, `apps/api/prisma/seed/seed-lib.mts` y `seed-course.mts`, y `seed-course-quality.spec.ts`. Es una excepción de 5 archivos.
- **Esquema:** `examBankFileSchema = { certification, domain, questions: [{ unitCode, exercise }] }`, estricto. Cada `exercise` es un `QUIZ` con `exam.pool: "reserved"`, de esa certificación y ese dominio.
- **Semilla:** lee `aws/exam-bank/*.json` y fusiona cada pregunta en su unidad antes de validar el curso. La unidad debe existir en el esqueleto, aunque no tenga archivo.
- **Regla 6** (reparto de la letra correcta): se aplica por banco, al de unidad por unidad y al reservado por archivo del banco.
- **Criterios:**
  - un archivo de banco sintético válido se fusiona;
  - una pregunta con `pool: "unit"` o de otro dominio se rechaza con un mensaje claro;
  - sin carpeta, nada cambia.

**S17-T1d — Similitud entre el banco reservado y el de unidad.**
- **Archivo:** `seed-course-quality.spec.ts`.
- **Contrato:** una función pura `statementSimilarity(a, b)`, Jaccard de trigramas de palabras normalizadas, sin tildes ni signos. La guarda falla si una pregunta reservada tiene una similitud ≥ 0,6 con una de unidad de la misma certificación, nombrando los dos slugs.
- **Criterios:** hay ejemplos sintéticos de los dos lados del umbral.

### 5.2 Fuentes

**S17-T2a/T2b — Inventario de recursos oficiales de A0 (T2a) y de A1 (T2b).**
- **Archivo:** `aws/course.seed.json`, solo `resources` y los `resources` de las unidades de su etapa. Cada recurso queda referenciado desde la unidad que lo usa.
- **Recursos:** por unidad, entre 1 y 4 páginas oficiales de `docs.aws.amazon.com`, `aws.amazon.com` o `skillbuilder.aws`. Para A1, la guía de CLF-C02 también. Cada recurso lleva `title` (el `<title>` real, comprobado con `curl`), `language` y `notes` con «Leído por agente el AAAA-MM-DD; pendiente de revisión humana».
- **Estado:** `status: "VERIFIED"` solo si la página respondió y su título corresponde. En otro caso, no se añade.
- **Criterios:** `db:seed:aws` en verde; ninguna URL repetida; el reporte da la lista por unidad.

### 5.3 Unidades

**S17-T3 — Molde de A0: AWS-U0.1.2.** Se aplica la ficha tipo de §13 con la fila de §4. Es la primera unidad con `QUIZ` AWS reales, así que su forma será la referencia para todas las demás.

**S17-T4 — Revisión humana del molde (persona).** La persona revisa:
- las 7 secciones de la lección;
- cada pregunta frente al método §5: distractor plausible, una sola respuesta defendible, explicación que nombra la restricción, sin datos volátiles;
- la excepción (b) y si los `DEBUG` de configuración tienen sentido.

Los defectos de método se corrigen **en esta ficha y en el método** antes de seguir. **El sprint se detiene aquí hasta que haya revisión.**

**S17-T5…T18 — El resto de A0**, una unidad por sesión, en el orden de §4. AWS-U0.2.2 y AWS-U0.3.1 completan su piloto.

**S17-T19a — Molde de A1: AWS-U1.2.1.** **S17-T19b — Su revisión humana (persona).** Es la segunda puerta.

**S17-T20…T38 — El resto de A1**, una unidad por sesión.

### 5.4 Banco reservado, formas y proyectos

**S17-T39.1…T39.12 — Banco reservado de CLF-C02.**
- Hay 12 lotes de un solo dominio cada uno: D1 3×16, D2 3×19, D3 4×16–17 y D4 2×12. En total, 195 preguntas.
- **Archivo:** `aws/exam-bank/CLF-C02-D<n>-<lote>.json`.
- **Contenido:** preguntas `single` y `multiple`, con un **tercio de `multiple`** como mínimo, y las tareas de la guía repartidas.
- **Guarda:** T1d sin coincidencias.

**S17-T49 — Formas A, B y C.**
- **Archivo:** `aws/exam-forms/CLF-C02.json`.
- **Contenido:** tres formas disjuntas de 65 preguntas, con el reparto 16/19/22/8 (validado por `examFormViolations`).

**S17-T50 — Proyectos.**
- **Archivo:** `aws/projects.seed.json`.
- **Proyectos:** «Cuenta de estudio segura» (A0) y «Propuesta de nube para una pyme» (A1), con las rúbricas y los requisitos del currículo.

**S17-T51 — Absorbida.** Los `LAB` con arnés de A0 están en las tareas de AWS-U0.3.1 y AWS-U0.3.5.

**S17-T52 — Revisión del lote (persona).** Una muestra de al menos el 20 % de las preguntas de cada unidad y el 100 % del banco reservado. Se registra en `revision-pedagogica.md`, en una sección AWS nueva.

### 5.5 Orden

T1a → T1b → T1c → T1d → T2a → T2b → T3 → **T4 (persona)** → T5…T18 → T19a → **T19b (persona)** → T20…T38 → T39.1…T39.12 → T49 → T50 → **T52 (persona)** → documentación (Orquestador).

## 6. Criterios de cierre

- [x] `npm run db:seed:aws` carga las 35 unidades con su lección y su paquete, y `seed-course-quality` está en verde (incluidas T1b, T1c y T1d).
- [x] Hay 195 preguntas reservadas de CLF-C02 repartidas por dominio (D1 48, D2 57, D3 66, D4 24), ninguna parecida a una del banco de unidad (guarda de similitud), y las tres formas son válidas (`examFormViolations` sin problemas; «Formas de simulacro: 3»).
- [ ] Los moldes de A0 y A1 y el lote los revisó una persona distinta de quien los redactó. **Diferido (T4, T19b, T52).**
- [x] Ninguna pregunta tiene precios, cuotas ni límites sin fuente fechada, y ninguna sale de volcados ni de las muestras oficiales. Cada ejercicio cita solo URLs oficiales del inventario; la revisión humana (T52) confirma la fidelidad.
- [ ] La publicación de A0–A1 la decide el responsable tras la revisión. **Pendiente.** Todo el contenido está con `isPublished: false`.

## 7. Documentos relacionados

- [`../../02-contenido/plan-poblado-banco-e0-e2.md`](../../02-contenido/plan-poblado-banco-e0-e2.md) (método de molde y lotes)
- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §3, §5, §6 y §13
- [`sprint-18-aws-arquitecto-asociado.md`](sprint-18-aws-arquitecto-asociado.md)

## 8. Registro de construcción (Orquestador, 2026-11-14)

El contenido lo construyeron subagentes de Claude Sonnet 5.5, una tarea por agente; primero DeepSeek hizo diez unidades de A0 y una corrección de guarda, y el resto lo hicieron agentes Sonnet tras agotarse los créditos de DeepSeek. El Orquestador (Claude Opus) revisó cada commit, una muestra del contenido y pasó la suite completa al cerrar cada bloque.

**Plataforma y fuentes:** T1a `ba57fcb` (proyectos de cualquier ruta), T1b `599a54e` (guarda de completitud del paquete), T1c `1ac17a3` (banco reservado en la semilla), T1d `7673b6e` (similitud reservado/unidad), T2a `d47bd03` y T2b `086c1ed` y T2c `b38ef47` (inventario de 133 fuentes oficiales, cada una abierta y con su `<title>` comprobado).

**Molde de A0 (T3):** `9383fa3` + correcciones `2dd4d1c` y `f6c6397`. El Orquestador encontró dos defectos y los corrigió: una opción correcta que repetía el calificador y se delataba, y una afirmación sobre Aurora sin fuente en el catálogo (se cambió por Redshift, que sí la tiene). Esas dos reglas se añadieron a los encargos de las demás unidades.

**Unidades:** A0 completa (15) y A1 completa (20). Cada unidad: 1 lección de 7 pasos con diagrama y «Error común», 8 `QUIZ` de escenario, 6 `FLASHCARD`, 1 `REFLECT`, y o bien `LAB` guiado+autónomo con el arnés AWS, o la excepción `AUDIT` + 2 `DEBUG`; las unidades de catálogo llevan `MEMORY`. Los `QUIZ` de A1 llevan metadatos `exam` de CLF-C02. La guarda de completitud (T1b) obliga a ese paquete y la de laboratorios comprueba que la solución pasa y el código inicial falla.

**Banco reservado (T39.1–T39.12):** 195 preguntas en 12 lotes, con el reparto por dominio que piden las formas. Ninguna supera 0,21 de similitud (Jaccard de trigramas) con las preguntas de unidad; el umbral de rechazo es 0,6.

**Formas (T49) `473263a`:** tres formas disjuntas de 65, reparto 16/19/22/8, validadas por `examFormViolations`. **Proyectos (T50) `4b6f9ba`:** «Cuenta de estudio segura» (A0) y «Propuesta de nube para una pyme» (A1).

**Puntos señalados para las revisiones humanas (T4, T19b, T52):**
- la lista de calificadores en mayúsculas de la guarda es corta para las unidades de seguridad (molde de A1);
- varias preguntas citan servicios o detalles al límite de lo que cubre su fuente del catálogo (p. ej. herramientas de migración en D1, servicios de D4 en preguntas de seguridad, S3 Express One Zone); conviene confirmar cada afirmación contra su página;
- algunas unidades de nivelación de A0 (p. ej. U0.3.3 sobre HTTP) tienen preguntas más avanzadas de lo que sugiere su título, por ceñirse a las fuentes oficiales disponibles;
- una fecha de retirada de planes de soporte (1-ene-2027) en U1.4.3, fechada y con fuente;
- la cobertura de tareas de la guía (`exam.task`) la dedujeron los agentes de las subpáginas de dominio de la guía, que no están en el catálogo; conviene verificar los números.

**Lo que queda, todo de una persona:** las tres revisiones (T4, T19b, T52), el registro en `revision-pedagogica.md` y la decisión de publicar A0–A1.
