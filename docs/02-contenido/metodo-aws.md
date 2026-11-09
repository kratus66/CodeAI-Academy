# Método de la ruta AWS

> Cómo se aplica la pedagogía de CodeAI Academy ([`../00-vision/fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md)) a la preparación de certificaciones de AWS. Qué se enseña está en [`../01-curriculo/curriculo-aws.md`](../01-curriculo/curriculo-aws.md); este documento dice **cómo** se enseña, se practica y se mide.
> **Fecha:** 2026-11-06 · **Estado:** 📝 norma de autoría vigente para S17–S26.

---

## 1. Principio rector

> **Aprobar el examen y saber hacer el trabajo se miden por separado, y la ruta exige las dos cosas.**

Un examen de AWS evalúa sobre todo **decisiones**: entre cuatro servicios que funcionan, cuál cumple la restricción del caso («el más barato», «con menos operación», «sin exponer a internet»). Un trabajo de AWS exige además **ejecutar y depurar**. Por eso cada unidad combina preguntas de escenario (entrenan la decisión) con laboratorios, depuración y auditoría (entrenan la ejecución), y cada etapa cierra con simulacros **y** con un proyecto defendido.

La advertencia epistemológica del método general aplica íntegra: si la plataforma sólo midiera aciertos en preguntas, certificaría memorización. Por eso el criterio «listo para presentar» (currículo §6) pide simulacros **con formas que la persona no ha visto** y evidencia profesional.

---

## 2. Las seis estrategias, traducidas a AWS

| Estrategia | Traducción en la ruta AWS | Mecanismo |
|------------|---------------------------|-----------|
| **Práctica espaciada** | Las decisiones clave (SQS frente a SNS, Multi-AZ frente a réplica de lectura) vuelven a aparecer al día siguiente, a la semana y en etapas posteriores con otro contexto | SM-2 + ítems fallados en simulacros que entran en la cola con prioridad |
| **Recuperación activa** | La persona elige y justifica antes de ver la explicación; en simulacros, sin retroalimentación hasta entregar | Bloqueo de revelación + simulacro sin feedback |
| **Intercalado** | Las preguntas de módulo y los simulacros mezclan dominios sin anunciar el tema; desde A3, una parte del repaso trae preguntas de etapas anteriores | Banco por dominio + repaso acumulativo entre etapas |
| **Elaboración** | Toda decisión se justifica con la restricción que la decide y el pilar de Well-Architected que la sostiene | `REFLECT` con formato ADR (§4.9) |
| **Ejemplos concretos** | Cada servicio se presenta con un caso de negocio y con el error real que provoca su mal uso | Paso 2 de la lección |
| **Representación dual** | Cada arquitectura se dibuja; las redes se ven como subredes, rutas y flujos | Bloque `mermaid` obligatorio por familia (§3.1) |

---

## 3. Los 7 pasos de una lección AWS

La microestructura no cambia; cambia su contenido.

| Paso | Contenido en la ruta AWS | Ejemplo (AWS-U2.2.3, security groups frente a NACL) |
|------|--------------------------|------------------------------------------------------|
| 1. Objetivo medible | Capacidad observable + **referencia al examen** (código, dominio y tarea) | «Decidir si un flujo se permite combinando security groups y NACL, y elegir cuál usar para bloquear una IP» · SAA-C03 D1 |
| 2. Explicación y ejemplo resuelto | Caso real, diagrama, **trampas típicas de examen** y errores comunes | NACL sin reglas de puertos efímeros de salida: la respuesta se pierde |
| 3. Práctica guiada | Laboratorio con arnés y pistas, o recorrido guiado en la consola | Completar reglas para que el flujo de la web llegue a la base de datos |
| 4. Práctica independiente | Laboratorio autónomo o escenario nuevo sin pistas | Bloquear una IP concreta sin cortar el resto del tráfico |
| 5. Depuración y revisión con IA | Pedir a un asistente una configuración y **auditarla contra la documentación con fecha** | El asistente propone bloquear la IP con un security group (no admite reglas de denegación) |
| 6. Recuperación y evaluación | Preguntas de escenario sin apuntes | 8 preguntas tipo examen |
| 7. Transferencia | Pregunta de entrevista o tarea real | «Un cliente reporta que llega la petición pero no la respuesta. ¿Qué revisas?» |

### 3.1 Material visual obligatorio por familia

| Familia | Representación requerida |
|---------|--------------------------|
| Redes (VPC, rutas, conectividad) | Diagrama de subredes por zona con rutas y flujos |
| Identidad y permisos | Diagrama de la evaluación de políticas (orden de decisión) |
| Integración y eventos | Diagrama de secuencia productor → servicio → consumidor, con reintentos |
| Resiliencia y DR | Diagrama multi-AZ o multi-región con RPO/RTO anotados |
| Datos | Diagrama de patrones de acceso o de pipeline |
| CI/CD | Diagrama de etapas del pipeline y del cambio de tráfico |

Los diagramas son bloques `mermaid` de la lección; no se usan iconos oficiales de AWS embebidos en la plataforma salvo que su licencia lo permita y se registre en el catálogo de recursos.

---

## 4. Tipos de ejercicio en la ruta AWS

Se reutiliza la taxonomía de [`banco-ejercicios.md`](banco-ejercicios.md). Lo nuevo se construye en S14–S16.

| Tipo | Uso en AWS | Nivel típico | Estado en la plataforma |
|------|------------|--------------|-------------------------|
| `QUIZ` de escenario, respuesta única | Pregunta tipo examen con cuatro opciones | 1–2 | Existe (S5–S6). Desde S14 lleva metadatos `exam` (certificación, dominio, tarea y banco), obligatorios en los `QUIZ` de las etapas 101–111 |
| `QUIZ` de respuesta múltiple | «Selecciona DOS/TRES» con cinco o seis opciones | 2 | Existe (S14): `kind: "multiple"`, todo o nada |
| `QUIZ` de ordenar y de emparejar | Ordenar pasos (p. ej., migración) o emparejar servicio ↔ caso | 1–2 | Existe (S14): `kind: "ordering"` y `kind: "matching"`, con explicación por elemento. Aparecen en AIF-C01 y SCS-C03 ([aws-guias-examen.md](aws-guias-examen.md)); en AIP-C01, pendiente de confirmar |
| `FLASHCARD` | Límites conceptuales, diferencias entre servicios, definiciones | 1–3 | Existe |
| `MEMORY` modo `match` | Servicio ↔ problema que resuelve; estrategia ↔ RPO/RTO | 1–2 | Existe |
| `LAB` con arnés | La persona escribe una política, una plantilla, un patrón de eventos o un manejador; pruebas ocultas lo evalúan con el arnés AWS | 2–3 | Nuevo en S16 |
| `DEBUG` de configuración | Una política, plantilla o código con **un** defecto real y frecuente | 3 | Existe; con arnés en S16 |
| `AUDIT` | Configuración generada por IA con defectos reales y un elemento correcto que parece sospechoso | 3–4 | Existe (S14): esquema en la semilla, corrección en servidor con penalización de falsos positivos y `AuditPlayer`. Aprobar acredita el nivel 3 |
| `CHALLENGE` por dominio | Bloque cronometrado de 15–20 preguntas de un dominio | 3 | Motor de simulacro en S15 |
| Simulacro completo | Examen completo cronometrado con las preguntas y el tiempo oficiales | 3 | Nuevo en S15 |
| `CLOUD_LAB` (laboratorio en tu cuenta) | Práctica guiada en la cuenta propia con evidencia de solo lectura | 2 (nunca certifica 3) | Nuevo en S16 |
| `REFLECT` (ADR) | Decisión, alternativa descartada, consecuencia y pilar de Well-Architected | 2–4 | Existe |
| `PROJECT` | Proyecto de etapa con rúbrica | 4 | Existe (S9) |
| `SIM` | Entrevista por rol o defensa ante panel | 4 | Existe (S10); escenarios AWS en S26 |

### 4.1 Laboratorios con arnés (`LAB`, S16)

El sandbox no tiene acceso a AWS y no lo tendrá: un laboratorio que dependiera de una cuenta real no se podría corregir de forma reproducible ni sin costo. En su lugar, el **arnés AWS** es una biblioteca de evaluadores puros en TypeScript que se ejecuta dentro del sandbox:

| Evaluador | Qué decide | Fidelidad exigida |
|-----------|------------|-------------------|
| `iam` | Si una petición se permite con políticas de identidad, de recurso, SCP, RCP, límites de permisos y de sesión | Lógica de evaluación documentada por AWS; subconjunto declarado de operadores de condición |
| `cidr` | Solapamientos, división en subredes, direcciones utilizables (AWS reserva 5 por subred) | Exacta |
| `network` | Si un flujo llega: tablas de rutas (prefijo más largo), security groups (con estado), NACL (sin estado, orden de reglas, puertos efímeros) | Subconjunto declarado, sin Transit Gateway en la primera versión |
| `events` | Si un evento coincide con un patrón de EventBridge | Operadores de patrón documentados (prefijo, `anything-but`, numérico, `exists`…) |
| `cfn` | Estructura de una plantilla de CloudFormation y reglas de seguridad propias (cifrado, acceso público, `*` en políticas) | Subconjunto declarado de tipos de recurso; no sustituye a cfn-lint |
| `dynamodb` | Si cada patrón de acceso se resuelve con `Query`/`GetItem` sobre la tabla o un índice, sin `Scan` | Exacta para el modelo declarado |
| `s3access` | Si un objeto es público dadas Block Public Access y la política del bucket | Subconjunto declarado |
| `asl` | Validez estructural de una máquina de estados (estados, `Next`/`End`, `Retry`/`Catch`) | Subconjunto declarado |
| `cost` | Cálculo con **la tabla de precios que da el enunciado** | Exacta; nunca precios reales embebidos |

Reglas: cada evaluador tiene **pruebas doradas** construidas con ejemplos de la documentación oficial (con URL); lo que el evaluador no modela se declara en su cabecera y **ningún ejercicio puede depender de ello**. Un evaluador infiel enseña mal en cientos de ejercicios: por eso su revisión humana es obligatoria antes de usarlo en contenido.

### 4.2 Laboratorio en tu cuenta (`CLOUD_LAB`, S16)

Práctica real en la cuenta de estudio de la persona. Nunca certifica nivel 3 (la evidencia se puede fabricar) y siempre es **opcional**.

Obligatorio en cada `CLOUD_LAB`:

1. **Costo esperado** con fecha y fuente, y si cabe en la capa gratuita vigente (cuyas condiciones cambiaron para cuentas nuevas en 2025 🔎: se comprueban en cada revisión).
2. **Prerrequisito de seguridad:** el proyecto de A0 completado (MFA, presupuesto con alerta, Identity Center).
3. **Región fija** declarada y recursos con la etiqueta `codeai-lab=<slug>`.
4. **Lista de limpieza** con la comprobación final (p. ej., «`aws resourcegroupstaggingapi get-resources` con la etiqueta devuelve vacío»).
5. **Evidencia de solo lectura:** la persona pega la salida JSON de un comando `describe`/`get`; el servidor valida campos esperados, **enmascara identificadores de cuenta y ARN** y no guarda la salida en bruto.
6. Prohibido pedir o aceptar claves de acceso, secretos o capturas con datos de facturación.
7. Prohibidos en laboratorios recursos de costo por hora sin necesidad pedagógica (NAT Gateway, endpoints de interfaz, clústeres): si son el tema, se enseñan con el arnés y, como mucho, se crean y destruyen en el mismo paso con su costo declarado.

---

## 5. Cómo se escribe una pregunta tipo examen

Las preguntas son el corazón de la preparación. Reglas (se verifican con la guarda de calidad de S14 cuando son comprobables por máquina, y en la revisión humana cuando no):

1. **Escenario + restricción + calificador.** Dos a cinco frases de contexto (asociado) o hasta diez (profesional), una restricción que decide («sin exponer las instancias a internet») y un calificador explícito en mayúsculas («con la MENOR sobrecarga operativa», «la opción MÁS rentable»).
2. **Distractores plausibles.** Cada opción incorrecta es un servicio o configuración real que resolvería un problema vecino, no un invento. Prohibido «ninguna de las anteriores», «todas las anteriores» y verdadero/falso.
3. **Explicación por opción** que nombra **la restricción que la descarta**, no sólo «es incorrecta».
4. **Una sola respuesta defendible.** Si dos opciones cumplen el calificador, la pregunta se reescribe.
5. **Longitud equilibrada:** la correcta no puede duplicar la longitud media ni la del distractor más largo (guarda existente) y la letra correcta se reparte entre posiciones.
6. **Sin datos volátiles:** nada de precios, cuotas o límites numéricos que AWS cambia con frecuencia, salvo que el enunciado los dé. Si un hecho depende de la fecha, se cita la fuente con fecha de consulta.
7. **Metadatos de examen:** código (`SAA-C03`), dominio (`D1`) y, si la guía la define, tarea (`1.2`). Sin ellos no entra al banco.
8. **Nivel del examen:** asociado = una o dos restricciones; profesional = varias restricciones, multi-cuenta o migración, y distractores que cumplen todo menos una restricción.
9. **Original.** Ver §11.
10. **Servicios vigentes.** No se enseña como recomendación un servicio retirado o cerrado a clientes nuevos; se comprueba su estado en la documentación antes de escribir.

### 5.1 Ejemplo bien escrito (respuesta única, SAA-C03 · D1)

> Una empresa ejecuta una aplicación web en instancias EC2 detrás de un Application Load Balancer, en dos zonas de disponibilidad. Las instancias están en subredes privadas y deben descargar parches desde un repositorio público en internet, pero no deben poder recibir conexiones iniciadas desde internet. ¿Qué solución cumple el requisito con la MENOR sobrecarga operativa?
>
> a) Crear un NAT Gateway en una subred pública de cada zona y enrutar `0.0.0.0/0` de cada subred privada al NAT de su zona. ✅
> b) Lanzar una instancia NAT administrada por el equipo en una subred pública y enrutar hacia ella el tráfico de salida.
> c) Asignar direcciones IP públicas a las instancias y restringir el security group de entrada al balanceador.
> d) Crear un VPC endpoint de tipo gateway hacia el repositorio de parches.

| Opción | Explicación |
|--------|-------------|
| a | Servicio administrado y redundante por zona: da salida a internet sin permitir conexiones entrantes iniciadas desde fuera |
| b | También da salida, pero el equipo debe parchearla, escalarla y hacerla redundante: incumple «menor sobrecarga operativa» |
| c | Una IP pública más una ruta a internet hace a la instancia alcanzable si el security group cambia; además las subredes privadas no tienen ruta al Internet Gateway |
| d | Los endpoints de tipo gateway sólo existen para S3 y DynamoDB; no dan acceso a un repositorio en internet |

---

## 6. Distribución mínima por unidad

Para que una unidad AWS sea publicable:

| Tipo | Mínimo | Nota |
|------|--------|------|
| Lección de 7 pasos | 1 | Con referencia al examen en el paso 1 y diagrama de su familia |
| `QUIZ` de escenario | 8 | Desde A2: al menos 2 de respuesta múltiple; todas con metadatos de examen y en el banco **de unidad** |
| `FLASHCARD` | 6 | Reverso breve con fuente |
| `MEMORY` modo `match` | 1 por módulo (1 por unidad en unidades de catálogo de servicios) | 6–10 pares |
| `LAB` guiado + `LAB` autónomo | 1 + 1 cuando la unidad tiene un objeto evaluable por el arnés | Si no lo tiene (unidad conceptual), se sustituyen por un `AUDIT` y un `DEBUG` de configuración y se declara la excepción en la ficha |
| `DEBUG` de configuración | 1 | Un defecto principal, real y frecuente |
| `AUDIT` | 1 por módulo | Con un elemento correcto que parece sospechoso |
| `CHALLENGE` por dominio | 1 por módulo | 15–20 preguntas del banco de unidad, cronometradas |
| `REFLECT` (ADR) | 1 | Formato de §4.9 del método general |
| `CLOUD_LAB` | Opcional, 1 por módulo como máximo | Sólo si es seguro y barato (§4.2) |

**Por etapa con examen**, además: banco reservado de **tres formas completas** (§8), `PROJECT` con rúbrica y `SIM` de defensa.

### 6.1 Escalera de dificultad aplicada

| Escalón | En la ruta AWS | Nivel certificable |
|---------|----------------|--------------------|
| Guiado | Laboratorio con arnés con plantilla parcial, pistas y pruebas visibles; preguntas con pista conceptual | 2 |
| Semi-autónomo | Escenario completo, pistas limitadas, pruebas ocultas | 2–3 |
| Autónomo | Sólo criterios de aceptación; preguntas y simulacros sin pistas | 3 |

Regla de oro del método general: **no se certifica nivel 3 con el escalón guiado.**

---

## 7. Volumen previsto

| Concepto | Cifra aproximada |
|----------|------------------|
| Unidades | 262 |
| Preguntas de unidad (8 × unidad) | ≈ 2.100 |
| Tarjetas (6 × unidad) | ≈ 1.570 |
| Banco reservado (3 formas por certificación) | ≈ 2.300 preguntas |
| Laboratorios con arnés, debug y auditorías | ≈ 700 |

La producción sigue el método de [`plan-poblado-banco-e0-e2.md`](plan-poblado-banco-e0-e2.md): **una unidad molde revisada por una persona antes de escalar** cada etapa, y lotes pequeños.

---

## 8. Banco reservado y simulacros

1. **Dos bancos separados.** El banco **de unidad** se usa para aprender (quizzes, retos, repaso). El banco **reservado** sólo se usa en simulacros; sus preguntas nunca aparecen en unidades ni en el repaso antes de que la persona haya hecho el simulacro.
2. **Tres formas fijas por certificación (A, B, C)** con el número de preguntas y minutos oficiales y el reparto de dominios según los pesos de la guía (redondeo por mayor resto).
3. **Simulacro aleatorio** opcional que se arma del banco reservado sin repetir preguntas vistas en los últimos intentos.
4. **Condiciones de examen:** cronómetro en servidor, sin retroalimentación hasta entregar, marcar para revisar, pantalla de revisión antes de entregar y opción de **+30 minutos** que imita la adaptación de AWS para quien no presenta en su lengua materna (🔎 confirmar condiciones vigentes).
5. **Puntuación honesta:** porcentaje de aciertos global y por dominio. **No se muestra una puntuación escalada inventada.** La respuesta múltiple se corrige todo o nada.
6. **Cierre del ciclo de error:** cada pregunta fallada muestra la explicación de cada opción, enlaza a la unidad del concepto y entra en la cola SM-2 con prioridad alta.
7. **Formas sin revisión humana = orientativas** (no cuentan para «listo para presentar»).

---

## 9. Criterio «listo para presentar»

Definido en el currículo ([`../01-curriculo/curriculo-aws.md`](../01-curriculo/curriculo-aws.md) §6). La plataforma lo calcula con una función pura (S15) y lo muestra por certificación con lo que falta, nunca sólo «sí/no».

---

## 10. Repaso acumulativo entre etapas

Desde A3, el 20 % de la cola diaria de repaso se reserva a conceptos de etapas anteriores de la ruta (p. ej., IAM y VPC de A2 mientras se cursa A5). Así la arquitectura asociada sigue fresca cuando llega el examen profesional, que la da por sabida.

---

## 11. Fuentes, derechos y ética

1. **Fuentes válidas:** documentación oficial (`docs.aws.amazon.com`), páginas oficiales de AWS (`aws.amazon.com`, incluidas las guías de examen y los whitepapers), y AWS Skill Builder para recursos enlazados. Cada ejercicio cita al menos una URL oficial **abierta y leída** por quien la cita.
2. **Prohibido** usar o parafrasear preguntas de volcados de examen («dumps»). Además de no enseñar, viola el acuerdo del programa de certificación de AWS y puede costar la certificación a quien los usa.
3. **Prohibido** reproducir las preguntas de muestra oficiales; se enlazan como recurso.
4. **Marcas:** se nombran servicios para describir el temario; la ruta muestra el aviso de no afiliación (currículo §1).
5. **Generación con IA:** el modelo que redacta (DeepSeek u otro) puede inventar características, cuotas o nombres de servicio. Toda afirmación técnica de una pregunta se contrasta con la fuente citada antes de publicar; la revisión humana es obligatoria y no la hace quien redactó.

---

## 12. Vigencia de los exámenes y del contenido

| Evento | Acción |
|--------|--------|
| AWS anuncia una versión nueva de un examen | Tarea de actualización: comparar guías, marcar ejercicios afectados, crear formas nuevas; las formas viejas dejan de estar disponibles el día que la versión vieja se retira |
| AWS retira un servicio o lo cierra a clientes nuevos | Se revisan las unidades que lo enseñan; deja de presentarse como recomendación |
| Revisión trimestral | Una persona comprueba las guías de examen de la ruta y el estado de los servicios citados; se registra la fecha |
| Una pregunta recibe ≥ 3 reportes de error | Se despublica hasta revisarla |

Fechas ya conocidas al 2026-11-06: SAP-C02 → SAP-C03 (2026-11-17), DVA-C02 → DVA-C03 (2026-12-01), retiro de ANS-C01 (2026-12-31) y MLA-C01 → MLA-C02 (2027-01-14).

---

## 13. Ficha tipo: paquete de unidad AWS

El Orquestador copia esta ficha por unidad, rellena los campos `‹…›` y la entrega al Constructor. **Una unidad por sesión.**

```markdown
## Metadatos
| Campo | Valor |
|-------|-------|
| ID | S‹NN›-T‹n› |
| Unidad | AWS-U‹e›.‹m›.‹u› — ‹título› |
| Certificación y dominio | ‹SAA-C03› · ‹D1› (tareas ‹1.1, 1.2› si la guía las define) |
| Competencias | ‹AWS-C2, AWS-C3› |
| Archivo | `apps/api/prisma/seed/aws/units/AWS-U‹e›.‹m›.‹u›.json` (crear) |
| Depende de | S13 (carga por unidad), S14 (preguntas de examen), S16 si hay LAB con arnés |

## 1. Contexto mínimo
Objetivo de la unidad, lo que ya se vio en unidades previas (códigos) y las trampas de examen que debe cubrir.

## 2. Contrato
El archivo valida con `courseUnitFileSchema` (`packages/shared/src/schemas/course-seed.ts`) y contiene:
- 1 lección con los 7 pasos y bloque `mermaid` de la familia ‹redes/identidad/…›.
- 8 QUIZ de escenario (≥ 2 de respuesta múltiple desde A2) con `exam.pool = "unit"`.
- 6 FLASHCARD · ‹1 MEMORY match› · 1 DEBUG · 1 REFLECT · ‹LAB guiado + autónomo con arnés `‹iam›` o la excepción declarada›.
- `isPublished: false` y `sources` con URLs oficiales que la ficha ya trae verificadas:
  - ‹https://docs.aws.amazon.com/…›

## 3. Criterios de aceptación
- [ ] `npm run test -w apps/api -- seed-course-quality` en verde.
- [ ] Cada pregunta cumple §5 de `metodo-aws.md` (escenario, calificador, explicación por opción que nombra la restricción).
- [ ] Ninguna afirmación técnica fuera de las fuentes listadas; si hace falta otra fuente, detenerse y pedirla.
- [ ] Sin precios, cuotas ni límites numéricos salvo que el enunciado los dé.

## 4. Qué NO hacer
- No inventar servicios, características ni límites.
- No copiar ni parafrasear preguntas de volcados ni las preguntas de muestra oficiales.
- No publicar (`isPublished: true`): lo decide la revisión humana.
- No tocar otros archivos.
```

---

## 14. Lista de comprobación del diseñador (AWS)

Además de la lista de [`../00-vision/fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md) §7:

- [ ] El objetivo cita código de examen, dominio y una capacidad observable.
- [ ] Cada pregunta tiene escenario, restricción, calificador y explicación por opción.
- [ ] Las opciones incorrectas son servicios reales que resuelven un problema vecino.
- [ ] Ningún dato volátil sin fuente fechada.
- [ ] La unidad tiene su diagrama de familia.
- [ ] Hay un ejercicio que entrena la ejecución (LAB, DEBUG o AUDIT), no sólo la decisión.
- [ ] Los servicios enseñados como recomendación están vigentes.
- [ ] Las fuentes son oficiales y se abrieron.
- [ ] Ninguna pregunta viene de un volcado ni de las muestras oficiales.

---

## Documentos relacionados

- [`../01-curriculo/curriculo-aws.md`](../01-curriculo/curriculo-aws.md)
- [`banco-ejercicios.md`](banco-ejercicios.md)
- [`plan-poblado-banco-e0-e2.md`](plan-poblado-banco-e0-e2.md)
- [`catalogo-recursos.md`](catalogo-recursos.md)
- [`../04-plan-ejecucion/sprints/sprint-14-preguntas-examen.md`](../04-plan-ejecucion/sprints/sprint-14-preguntas-examen.md)
