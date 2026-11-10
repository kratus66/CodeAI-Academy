# Sprint 16 — Laboratorios AWS: arnés en el sandbox y laboratorio en tu cuenta

> **Estado:** 🔄 fichas redactadas (2026-11-10), contrastadas con el código; T0 (ADR) hecho · **Depende de:** S14 y del sandbox `docker` (S11). En desarrollo, el modo `docker` funciona con el Docker del host. Su despliegue en producción es deuda de S11 y queda fuera de este sprint.
> **Ámbito:** paquete nuevo `packages/aws-harness` (los evaluadores), integración con `sandbox`, el tipo de ejercicio `CLOUD_LAB` con su reproductor y cuatro laboratorios piloto. El ADR y el registro de revisión están en [`../../03-arquitectura/arnes-aws.md`](../../03-arquitectura/arnes-aws.md).
> **Por qué existe:** las preguntas entrenan la decisión, pero el trabajo exige escribir políticas, redes, plantillas y código que funcionen. El sandbox no llama a AWS, así que los laboratorios se corrigen con **evaluadores puros y fieles** y, de forma opcional y sin certificar nunca, con práctica en la cuenta propia.

---

## 1. Objetivo

Al cerrar el sprint:
- existe `@codeai/aws-harness` con nueve evaluadores (`cidr`, `iam`, `network`, `events`, `cfn`, `dynamodb`, `s3access`, `asl` y `cost`). Cada uno declara su alcance y tiene pruebas doradas con la URL oficial;
- un `LAB` o `DEBUG` con `config.harness = "aws"` corre en el sandbox `docker` con el arnés montado, congelado y vigilado por el canario;
- existe `CLOUD_LAB`, con pasos, costo, región, etiqueta, limpieza y evidencia de solo lectura enmascarada, y nunca concede nivel 3;
- hay cuatro pilotos **sin publicar**: AWS-U0.3.1 (`cidr`), AWS-U2.1.1 (`iam`), AWS-U2.2.3 (`network`) y un `CLOUD_LAB` en AWS-U0.2.2.

## 2. Decisiones

**2.1 Fidelidad antes que alcance.** Cada evaluador modela un subconjunto declarado (`capabilities.modeled` y `notModeled`). Las pruebas doradas reproducen ejemplos de la documentación oficial, con `// Fuente: <URL>`. Ningún ejercicio depende de lo no modelado.

**2.2 Arnés como paquete montado.** Es la opción (a) del ADR S16-T0 ([`arnes-aws.md`](../../03-arquitectura/arnes-aws.md) §1): en el archivo de comprobación, `const aws = await import("./harness/index.js")` se congela antes del código del estudiante, y `aws.selfTest()` se ejecuta antes de las pruebas.

**2.3 Laboratorios en TypeScript.** El estudiante exporta un valor (`export const policy = {…}`) o una función. Las pruebas ocultas usan `aws.<evaluador>`.

**2.4 `CLOUD_LAB`:**
- nunca concede nivel 3 (`achievedLevel` vale como máximo 2) y nunca pide credenciales;
- la evidencia es la salida JSON de comandos de solo lectura (`describe`/`get`);
- el servidor valida rutas JSON, enmascara cuentas y ARN, y **no guarda la salida en bruto** ([`metodo-aws.md`](../../02-contenido/metodo-aws.md) §4.2).

**2.5 Fuentes oficiales.** `docs.aws.amazon.com` no se deja leer en HTML de forma automatizada. Las guías se descargan en PDF desde `https://docs.aws.amazon.com/pdfs/...` con `curl` y se convierten con `pdftotext`, ambos disponibles. Las pruebas citan la URL **HTML** de la página del ejemplo.
- Si una URL de PDF de esta ficha no responde con un PDF, se busca el enlace «PDF» de la guía.
- Si tampoco aparece, se **detiene** la tarea. Nada se escribe de memoria.

**2.6 Revisión humana (T8): diferida.** Los evaluadores y los pilotos quedan sin publicar hasta que una persona firme el registro de [`arnes-aws.md`](../../03-arquitectura/arnes-aws.md) §4.

## 3. Hallazgos al revisar el código (2026-11-10)

| # | Hallazgo | Consecuencia |
|---|----------|--------------|
| H1 | Solo existe `packages/shared`. Los scripts raíz usan `--workspaces --if-present`. | Un paquete nuevo con `build`, `typecheck`, `lint` y `test` entra solo en la verificación común (T1). |
| H2 | El sandbox `docker` monta `/work` en solo lectura e inlinea el archivo de entrada en `check.mjs`/`.mts`. Las pruebas ven el ámbito del módulo, con `assert`, `require`, `module` y `exports`. | El arnés se copia en `.codeai/harness/` con su propio `package.json` `{"type":"module"}` (T5a). |
| H3 | `SandboxRunRequest` no tiene campo de arnés (`packages/shared/src/schemas/sandbox.ts`). | T5a añade `harness: z.enum(["aws"]).optional()`. |
| H4 | `toSandboxTest` serializa `spec` y el adaptador extrae `.code`. `exerciseConfig` de un `LAB` devuelve `{ starterCode }`. | T6a escribe `harness` en `config`. T6b lo pasa al sandbox. |
| H5 | `seed-exercise-quality.spec.ts` ejecuta en el proceso la solución y el código inicial, solo en JavaScript y solo para `content.seed.json`. No existe esa guarda para AWS. | T7 la crea en `seed-course-quality.spec.ts`, con TypeScript sin tipos (`stripTypeScriptTypes`) y el arnés importado. |
| H6 | `ExerciseType` (Prisma y `shared/enums/exercise.ts`) no tiene `CLOUD_LAB`. `ExercisePlayer` envía cualquier tipo desconocido a `ExerciseLab`. `seed-exercise-quality.spec.ts:158` limita los tipos publicables. | T9a añade el enum, la migración y lo que pida el compilador. T11b añade el reproductor. |
| H7 | `aws/units/` no existe y las cuatro unidades piloto existen sin publicar y sin ejercicios. `courseUnitFileSchema` exige `code`, `lessons` (mínimo 1) y `exercises`. | Cada piloto (T12a–T12d) crea su archivo de unidad, con una lección y su ejercicio, sin publicar. |
| H8 | Docker no ejecuta SQL, y el modo `mock` no ejecuta nada. | Los pilotos son TypeScript. La prueba con Docker real va con `SANDBOX_DOCKER_TESTS=1` (T5b y T13). |

## 4. Tareas

> **Verificación común**, desde la raíz:
> - `npm run build -w packages/shared`;
> - `npm run build -w packages/aws-harness`, cuando ya exista;
> - `typecheck` **por workspace**, `lint` y `test` **por workspace**.
>
> Si la base ya está en rojo, la tarea se detiene.

### 4.0 Reglas fijas

1. **Evaluadores puros.**
   - Sin dependencias de ejecución, sin E/S, sin `Date.now()` ni `Math.random()`.
   - Deterministas, y no lanzan ante entradas inválidas.
   - Los textos de problemas van en español.
   - Cada evaluador exporta `capabilities` (contrato de [`arnes-aws.md`](../../03-arquitectura/arnes-aws.md) §2) y `canary(): boolean`.
2. **Pruebas doradas.**
   - Van en `src/<evaluador>/<evaluador>.golden.spec.ts`.
   - Cada caso lleva `// Fuente: <URL HTML oficial>` y reproduce un ejemplo documentado, leído del PDF descargado en esa sesión.
   - El reporte lista las URL usadas.
   - Las pruebas propias, con casos límite, van en `<evaluador>.spec.ts`.
3. **Prohibido escribir de memoria** valores, reglas o ejemplos de AWS. Si la documentación no aclara un comportamiento, se declara en `notModeled`.
4. **Base de datos** (solo T9a): mismas reglas que S15 §4.0.5. Huella de los quizzes `1662|8ca67124b00bae39a25ac73d1fb58d75`. La consulta se copia literalmente de S15-T2.
5. **Contenido AWS** (T12):
   - títulos literales del currículo y objetivos que empiezan por un infinitivo;
   - solo fuentes oficiales de AWS;
   - `isPublished: false` y `reviewedByHuman: false`;
   - nunca preguntas de «dumps».
6. **Cambios ajenos y git:** igual que siempre. Los 3 archivos ajenos no se tocan, y `git add` siempre por ruta. Prohibido formatear archivos existentes con prettier.

### 4.1 Índice y orden

| Paso | ID | Tarea | Archivos principales |
|------|----|-------|---------------------|
| 1 | T1 | Paquete `@codeai/aws-harness`: esqueleto, `selfTest`, `deepFreeze` y registro de capacidades | `packages/aws-harness/*` y `package-lock.json` |
| 2 | T2 | Evaluador `cidr` | `src/cidr/*` |
| 3 | T3a | `iam` núcleo: lógica de evaluación y comodines | `src/iam/*` |
| 4 | T3b | `iam`: condiciones | `src/iam/conditions.ts` y specs |
| 5 | T4 | Evaluador `network` | `src/network/*` |
| 6 | T5a | Sandbox: `harness` en el contrato, copia y preludio | `shared/schemas/sandbox.ts` y `docker-sandbox.service.ts` |
| 7 | T5b | Sandbox con Docker real: arnés, congelado y canario | `docker-sandbox.integration.spec.ts` |
| 8 | T6a | Semilla: `harness` en el esquema y en `config` | `shared/schemas/content.ts` y `seed-lib.mts` |
| 9 | T6b | Corrección: `ExercisesService` pasa `harness` al sandbox | `exercises.service.ts` y su spec |
| 10 | T7 | Guarda: la solución pasa y el código inicial falla con el arnés | `seed-course-quality.spec.ts` |
| 11 | T9a | `CLOUD_LAB`: enum, migración y exhaustividad | `schema.prisma`, migración y `shared/enums/exercise.ts` |
| 12 | T9b | `CLOUD_LAB`: esquema de semilla y reglas | `shared/schemas/content.ts` |
| 13 | T9c | `CLOUD_LAB`: la semilla escribe `config` y `solution` | `seed-lib.mts` |
| 14 | T10a | Evidencia: contrato y evaluación pura con enmascarado | `shared/schemas/exercise.ts` y `cloud-evidence.ts` |
| 15 | T10b | `POST /api/exercises/:id/cloud-evidence` | servicio, controlador y spec |
| 16 | T11a | Cliente web `submitCloudEvidence` | `api-client.ts` |
| 17 | T11b | `CloudLabPlayer` y su despacho | `CloudLabPlayer.tsx` y `ExercisePlayer.tsx` |
| 18 | T12a | Piloto `cidr`: AWS-U0.3.1 | `aws/units/AWS-U0.3.1.json` |
| 19 | T12b | Piloto `iam`: AWS-U2.1.1 | `aws/units/AWS-U2.1.1.json` |
| 20 | T12c | Piloto `network`: AWS-U2.2.3 | `aws/units/AWS-U2.2.3.json` |
| 21 | T12d | Piloto `CLOUD_LAB`: AWS-U0.2.2 (presupuesto con alerta) | `aws/units/AWS-U0.2.2.json` |
| 22 | T13 | Los tres pilotos con arnés contra Docker real | `aws-pilots.docker.integration.spec.ts` |
| 23–28 | T14a–f | Evaluadores `events`, `cfn`, `dynamodb`, `s3access`, `asl` y `cost` | `src/<evaluador>/*` |
| — | T8 | Revisión humana de los evaluadores (persona) | **diferida** |
| 29 | T15 | Documentación (Orquestador) | docs |

Los evaluadores que usan los pilotos (`cidr`, `iam` y `network`) van primero. Los otros seis (T14) van al final y no bloquean a los pilotos.

---

### S16-T1 — Paquete `@codeai/aws-harness`

**Archivos (excepción):** en `packages/aws-harness/`, `package.json`, `tsconfig.json`, `tsconfig.build.json`, la configuración de lint que use `packages/shared` (si es por paquete), `src/index.ts`, `src/core.ts` y `src/core.spec.ts`. También `package-lock.json`, que actualiza `npm install` sin dependencias nuevas.

**Contrato**
- **`package.json`:**
  - `"name": "@codeai/aws-harness"`, `"private": true` y `"type": "module"`;
  - `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"` y `"files": ["dist"]`;
  - scripts `build`, `typecheck`, `lint` y `test`, como en `packages/shared`;
  - **sin** `dependencies`; las `devDependencies` son las mismas versiones que en `shared`.
- **`tsconfig.build.json`:** ESM (`module`/`moduleResolution` `NodeNext`, `target` ES2022), con `declaration`. Los imports internos llevan `.js`.
- **`src/core.ts`:**
  - `EvaluatorCapabilities` (ADR §2);
  - `deepFreeze<T>(value: T): T`;
  - `HARNESS_VERSION = "0.1.0"`;
  - `registerEvaluator({ capabilities, canary })`;
  - `selfTest(): boolean`, que es verdadero si todos los `canary()` registrados devuelven `true` sin lanzar. Sin evaluadores, es verdadero;
  - `listCapabilities()`.
- **`src/index.ts`:** exporta `aws`, un objeto con los evaluadores (por ahora `{}`), `selfTest`, `listCapabilities` y `HARNESS_VERSION`. Cada evaluador nuevo se añade a `aws` y a `registerEvaluator`.

**Criterios**
- [ ] `npm run build -w packages/aws-harness` genera `dist/index.js` (ESM) y `dist/index.d.ts`.
- [ ] La verificación común incluye el paquete: aparece en `npm run typecheck`, `lint` y `test`.
- [ ] Hay pruebas de `deepFreeze` (anidado, arrays, mutación rechazada en modo estricto) y de `selfTest`: verdadero sin evaluadores, falso si un canario devuelve falso o lanza.
- [ ] `git diff --numstat package-lock.json` solo añade el workspace.

**Qué NO hacer:** no añadir dependencias; no tocar `packages/shared`.

---

### S16-T2 — Evaluador `cidr`

**Archivos:** `packages/aws-harness/src/cidr/{index.ts,cidr.spec.ts,cidr.golden.spec.ts}` · `src/index.ts` (registrar).
**Fuentes:** guía de usuario de Amazon VPC (PDF `https://docs.aws.amazon.com/pdfs/vpc/latest/userguide/vpc-ug.pdf`), secciones de bloques CIDR de VPC y subredes. Incluyen las **5 direcciones reservadas** por subred y los tamaños permitidos.

**Contrato** (solo IPv4):

```ts
parse(cidr: string): { network: string; prefix: number; first: string; last: string; size: number } | null
contains(outer: string, inner: string): boolean
overlaps(a: string, b: string): boolean
split(cidr: string, newPrefix: number): string[]          // [] si no se puede
reservedAddresses(subnet: string): string[]               // las 5 de AWS, en orden
usableAddresses(subnet: string): number
validateVpcCidr(cidr: string): string[]                   // tamaños permitidos por AWS según la guía
validateSubnetPlan(plan: { vpc: string; subnets: { name: string; cidr: string }[] }): string[]
```

**Criterios**
- [ ] Hay como mínimo 8 casos dorados con su URL, entre ellos las 5 reservadas de un ejemplo de la guía y los límites de tamaño.
- [ ] Casos propios: CIDR mal formado (`null` o problema, sin lanzar), base no alineada, `split` imposible, solapes parciales y totales.
- [ ] `capabilities.notModeled` incluye IPv6, CIDR secundarios y restricciones de rangos que no estén en la guía leída.

---

### S16-T3a — `iam`: lógica de evaluación

**Archivos:** `src/iam/{index.ts,types.ts,matching.ts,evaluate.ts,iam.spec.ts,iam.golden.spec.ts}` · `src/index.ts`.
**Fuentes:**
- Guía de usuario de IAM (PDF `https://docs.aws.amazon.com/pdfs/IAM/latest/UserGuide/iam-ug.pdf`): «Policy evaluation logic» (las mismas cuentas y entre cuentas), «Permissions boundaries», «Session policies», «Policy grammar» y comodines de `Action`/`Resource`;
- Guía de AWS Organizations (PDF `https://docs.aws.amazon.com/pdfs/organizations/latest/userguide/orgs-ug.pdf`): SCP y RCP.

**Contrato**

```ts
interface Statement { Sid?: string; Effect: "Allow" | "Deny"; Action?: string | string[]; NotAction?: string | string[];
  Resource?: string | string[]; NotResource?: string | string[]; Principal?: unknown; NotPrincipal?: unknown; Condition?: Record<string, Record<string, unknown>> }
interface PolicyDocument { Version?: string; Statement: Statement | Statement[] }
interface RequestContext { principal: { arn: string; accountId: string }; action: string; resource: { arn: string; accountId: string };
  context?: Record<string, string | string[] | number | boolean> }
interface EvaluationInput { request: RequestContext; identityPolicies?: PolicyDocument[]; resourcePolicy?: PolicyDocument | null;
  permissionsBoundary?: PolicyDocument | null; scps?: PolicyDocument[][]; rcps?: PolicyDocument[][]; sessionPolicies?: PolicyDocument[] }
// scps/rcps: un array por nivel (raíz → UO → cuenta); en cada nivel debe permitir al menos una
evaluate(input): { decision: "Allow" | "ExplicitDeny" | "ImplicitDeny"; reason: string; matched: { source: string; sid?: string }[] }
matchesAction(pattern: string, action: string): boolean     // insensible a mayúsculas, * y ?
matchesResource(pattern: string, arn: string): boolean      // sensible a mayúsculas, * y ?
validatePolicy(doc: unknown): string[]                      // gramática del subconjunto modelado
```

- En T3a, una sentencia con `Condition` se trata como **no evaluable**. `evaluate` devuelve `ImplicitDeny` con `reason` «La sentencia usa condiciones: requiere el evaluador de condiciones» si esa sentencia decide. T3b lo completa.

**Criterios**
- [ ] Hay casos dorados del diagrama y de los ejemplos de la lógica de evaluación: denegación explícita, permiso, denegación implícita, recurso de la misma cuenta frente a otra cuenta, límite de permisos, política de sesión, SCP que no permite y RCP. Cada uno con su URL.
- [ ] Casos de comodines de la gramática documentada.
- [ ] `notModeled` declara lo que la guía deja fuera del subconjunto: claves KMS, políticas de confianza de roles, ACL, `NotPrincipal` complejo, la cuenta de administración de Organizations…

---

### S16-T3b — `iam`: condiciones

**Archivos:** `src/iam/{conditions.ts,conditions.spec.ts,conditions.golden.spec.ts}` · `src/iam/evaluate.ts` (usar las condiciones).
**Fuentes:** guía de IAM, «IAM JSON policy elements: Condition operators», «Condition with multiple context keys or values» (`ForAnyValue`/`ForAllValues`) y «…IfExists».

**Subconjunto:**
- operadores `StringEquals`, `StringNotEquals`, `StringEqualsIgnoreCase`, `StringLike` y `StringNotLike`;
- `NumericEquals`, `NumericLessThan`, `NumericLessThanEquals`, `NumericGreaterThan` y `NumericGreaterThanEquals`;
- `Bool`, `IpAddress`, `NotIpAddress`, `ArnLike` y `ArnNotLike`;
- `DateLessThan` y `DateGreaterThan`, con la fecha en el contexto, nunca con el reloj;
- `Null`, `…IfExists`, `ForAnyValue` y `ForAllValues`.
- La semántica de **varias claves** es AND y la de **varios valores** es OR, según la guía.
- Un operador fuera del subconjunto hace que la sentencia no evalúe, con `reason` «Operador no modelado: X». Nunca se considera verdadero.

**Criterios:** hay casos dorados por familia de operadores, con URL, y los casos de T3a siguen pasando sin modificarlos.

---

### S16-T4 — Evaluador `network`

**Archivos:** `src/network/{index.ts,network.spec.ts,network.golden.spec.ts}` · `src/index.ts`.
**Fuentes:** guía de Amazon VPC, «Route tables» (prioridad de rutas y coincidencia por el prefijo más largo), «Security groups» (con estado) y «Network ACLs» (sin estado, orden por número de regla, regla `*` y puertos efímeros).

**Contrato**

```ts
routeFor(table: { destination: string; target: string }[], ip: string): string | null          // prefijo más largo
securityGroupAllows(rules: SgRule[], flow: { direction: "inbound" | "outbound"; protocol: "tcp" | "udp" | "icmp" | "-1"; port: number; peer: string }): boolean
naclAllows(rules: NaclRule[], flow: Flow): { allowed: boolean; ruleNumber: number | "*" }       // primera coincidencia por número
canConnect(model: VpcModel, flow: { from: Endpoint; to: Endpoint; protocol; port }): { allowed: boolean; reason: string; path: string[] }
// canConnect aplica: ruta de ida, SG de salida del origen (con estado), NACL de salida e entrada (sin estado),
// SG de entrada del destino y NACL del retorno con puerto efímero del cliente.
```

**Criterios:** hay casos dorados con URL de la guía (el ejemplo de NACL con puertos efímeros y el de SG con estado) y casos propios de solapes de rutas y del orden de reglas. `notModeled` declara Transit Gateway, peering, listas de prefijos, IPv6 y endpoints.

---

### S16-T5a — Sandbox: contrato, copia del arnés y preludio

**Archivos:** `packages/shared/src/schemas/sandbox.ts` (y su spec) · `apps/api/src/modules/sandbox/docker-sandbox.service.ts` · su spec unitario, si existe, o uno nuevo para el constructor del archivo de comprobación (`buildCheckFile`).
**Contrato**
- **Contrato del sandbox:** `sandboxRunRequestSchema` acepta `harness: z.enum(["aws"]).optional()`.
- **Copia del arnés:** con `harness === "aws"`, el adaptador copia `node_modules/@codeai/aws-harness/dist/**` (resuelto con `createRequire`) en `<ws>/.codeai/harness/` y escribe allí `package.json` con `{"type":"module"}`.
- **Preludio:** `buildCheckFile` antepone al código del estudiante `const aws = __codeaiDeepFreeze((await import("./harness/index.js")).aws);`, donde `__codeaiDeepFreeze` está definido en el propio archivo.
- **Canario:** después del código del estudiante y antes de las pruebas:
  - `if (!(await import("./harness/index.js")).selfTest()) { console.log("__CODEAI_HARNESS_TAMPERED__"); process.exit(3); }`;
  - el adaptador traduce esa salida a `outcome: "ERROR"`, con resultados vacíos y `stderr` «El arnés se alteró durante la ejecución».
- **Mock:** el adaptador `mock` ignora `harness`.

**Criterios:** hay pruebas unitarias de `buildCheckFile`, con y sin `harness`: el orden es arnés → estudiante → canario → pruebas. También de la traducción de `__CODEAI_HARNESS_TAMPERED__`. Las pruebas existentes del sandbox pasan sin cambios.

---

### S16-T5b — Sandbox con Docker real: arnés, congelado y canario

**Archivos:** `apps/api/src/modules/sandbox/docker-sandbox.integration.spec.ts` (modificar: añadir casos con `skipIf`, igual que los actuales).
**Criterios** (se ejecutan con `SANDBOX_DOCKER_TESTS=1` y, sin esa variable, se omiten)
- [ ] Una prueba que usa `aws.cidr.overlaps` pasa.
- [ ] El estudiante declara `const aws = …`: `ERROR`.
- [ ] El estudiante reasigna `aws.cidr = …` o muta una función: `ERROR`.
- [ ] El estudiante altera `Array.prototype.some` o `String.prototype.startsWith` de forma que un canario falla: `ERROR` con el mensaje del canario.
- [ ] El estudiante intenta escribir en `/work/.codeai/harness`: falla, porque el montaje es de solo lectura.
- [ ] El reporte pega la salida de `SANDBOX_DOCKER_TESTS=1 npx vitest run docker-sandbox.integration` (desde `apps/api`).

---

### S16-T6a — Semilla: `harness`

**Archivos:** `packages/shared/src/schemas/content.ts` y `content-exercise.spec.ts` · `apps/api/prisma/seed/seed-lib.mts`.
**Contrato**
- **Esquema:** `contentSeedExerciseSchema` gana `harness: z.enum(["aws"]).nullable().default(null)`.
- **Reglas** de `exerciseRuleViolations`:
  - «solo un LAB o DEBUG declara harness»;
  - «un ejercicio con harness se escribe en typescript o javascript».
- **Semilla:** `exerciseConfig` de un `LAB`/`DEBUG` con `harness` escribe `{ starterCode, harness: "aws" }`. Sin `harness`, la salida es **idéntica** a la de antes.

**Criterios:** hay una prueba por mensaje, y `db:seed` no cambia la huella de los quizzes. Este segundo criterio se comprueba solo con `typecheck:seed`, porque la tarea no siembra: la rama del quiz no cambia.

---

### S16-T6b — `ExercisesService` pasa `harness` al sandbox

**Archivos:** `apps/api/src/modules/exercises/exercises.service.ts` · el spec de envíos que ya prueba `execute`.
**Contrato:** en `submit`, si `exercise.config.harness === "aws"`, la petición al sandbox lleva `harness: "aws"`. Cualquier otro valor se ignora.
**Criterios:** prueba con `harness` y sin él (la petición no cambia).

---

### S16-T7 — Guarda: la solución pasa y el código inicial falla con el arnés

**Archivos:** `apps/api/src/modules/content/seed-course-quality.spec.ts`.
**Contrato**
- La guarda recorre los `LAB`/`DEBUG` de `aws/units/*.json`.
- Elimina los tipos del código con `stripTypeScriptTypes` (`node:module`).
- Ejecuta en el proceso el código y cada prueba con `aws` (el de `@codeai/aws-harness`) y `assert` a la vista, igual que la guarda de `fullstack-ia`.
- La solución debe pasar todas las pruebas, y el código inicial debe fallar al menos una visible.
- Una función pura `runLabInProcess(code, tests, { harness })` se prueba con ejemplos sintéticos.

**Criterios:**
- [ ] Con `aws/units` vacío, la guarda pasa.
- [ ] Hay ejemplos sintéticos malos (la solución falla, o el código inicial pasa todo) que la disparan.

---

### S16-T9a — `CLOUD_LAB`: enum, migración y exhaustividad

**Archivos (excepción declarada por el compilador):**
- `apps/api/prisma/schema.prisma`;
- la migración `<ts>_cloud_lab`, que contiene **solo** `ALTER TYPE "ExerciseType" ADD VALUE 'CLOUD_LAB'`;
- `packages/shared/src/enums/exercise.ts`;
- y cada archivo que falle el typecheck por exhaustividad. Se listan en el reporte y en cada uno se añade solo la rama mínima.

**Secuencia:** como S15-T2: puerto 5433, respaldo, `--create-only`, revisión del SQL, aplicar, `db:generate` con los puertos 3000 y 3001 libres, y huella de quizzes intacta.

**Criterios:** `migrate status` da 15 migraciones; la huella no cambia; `seed-exercise-quality.spec.ts` no publica `CLOUD_LAB`.

---

### S16-T9b — `CLOUD_LAB`: esquema de semilla

**Archivos:** `packages/shared/src/schemas/content.ts` y `content-exercise.spec.ts`.

```ts
export const contentSeedCloudLabSchema = z.object({
  region: z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d$/),
  tag: z.string().regex(/^codeai-lab=[a-z0-9-]+$/),
  cost: z.object({ expectedUsd: z.number().nonnegative(), freeTier: z.string().min(1), source: z.string().url(), checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  prerequisites: z.array(z.string().min(1)).min(1),
  steps: z.array(z.object({ title: z.string().min(1), instructions: z.string().min(1) })).min(1),
  checks: z.array(z.object({
    id: z.string().regex(/^c\d{1,2}$/), label: z.string().min(1), phase: z.enum(["build", "cleanup"]),
    command: z.string().regex(/^aws [a-z0-9-]+ (describe|get|list)-[a-z0-9-]+/),   // solo lectura
    expect: z.array(z.object({ path: z.string().min(1), op: z.enum(["equals", "exists", "absent", "matches", "lengthAtLeast", "lengthEquals"]), value: z.unknown().optional() })).min(1),
  })).min(1),
});
// contentSeedExerciseSchema: cloudLab: contentSeedCloudLabSchema.nullable().default(null)
```

Reglas, con sus mensajes:
- «un CLOUD_LAB requiere cloudLab» · «solo un CLOUD_LAB declara cloudLab»;
- «un CLOUD_LAB declara al menos una comprobación de limpieza»;
- «las comprobaciones repiten id»;
- «un CLOUD_LAB no lleva pistas ni pruebas»;
- «un CLOUD_LAB no es de nivel autónomo» (`ladder` ≠ `AUTONOMOUS`).

`path` es un camino tipo `Budgets[0].BudgetLimit.Amount`.

---

### S16-T9c — `CLOUD_LAB`: la semilla escribe `config` y `solution`

**Archivos:** `apps/api/prisma/seed/seed-lib.mts`.
**Contrato**
- `config` lleva `{ region, tag, cost, prerequisites, steps, checks: [{ id, label, phase, command }] }`, **sin** `expect`.
- `solution` lleva `{ checks: [{ id, expect }] }`.

**Criterios:** `typecheck:seed` en verde, y un script temporal fuera del repositorio que imprime `config` y `solution` de un ejemplo, sin `expect` en `config`.

---

### S16-T10a — Evidencia: contrato y evaluación pura

**Archivos:** `packages/shared/src/schemas/exercise.ts` y su spec · `apps/api/src/modules/exercises/cloud-evidence.ts` y su spec.

```ts
// shared
cloudEvidenceSchema = z.object({ evidence: z.array(z.object({ checkId: z.string(), output: z.string().min(2).max(200_000) })).min(1).max(20), cleanupConfirmed: z.boolean() }).strict();
cloudEvidenceResultSchema = z.object({ outcome: z.enum(["PASSED", "PARTIAL", "FAILED"]), checks: z.array(z.object({ checkId, label, passed: z.boolean(), problems: z.array(z.string()) })),
  cleanupConfirmed: z.boolean(), maskedSummary: z.string() });   // maskedSummary: sin números de cuenta ni ARN
// api, puro
evaluateCloudEvidence(solution: unknown, config: unknown, body): { status: "graded"; result; storedSummary: string } | { status: "invalid-answer"; message } | { status: "broken-content" }
maskIdentifiers(text: string): string   // 12 dígitos → ************ ; arn:aws:…:123456789012:… → arn:aws:…:************:… ; ids de acceso AKIA… → [credencial eliminada]
```

- Una salida que no es JSON da `invalid-answer` «La salida de la comprobación cX no es JSON válido».
- Si se detectan credenciales (`AKIA…`, `aws_secret_access_key`), el resultado es `invalid-answer` «La evidencia parece contener credenciales: no la envíes» y **no se evalúa ni se guarda**.
- `outcome` es `PASSED` solo si pasan todas las comprobaciones **y** `cleanupConfirmed` es verdadero.
- `storedSummary` es un JSON con `checkId`, `passed` y el número de problemas. **No incluye la salida.**

**Criterios:** hay pruebas de cada operador de `expect`, del enmascarado con una salida real anonimizada, de las credenciales y de que `storedSummary` no contiene ningún fragmento de la salida (prueba con un marcador).

---

### S16-T10b — `POST /api/exercises/:id/cloud-evidence`

**Archivos:** `exercises.service.ts` · `exercises.controller.ts` · `exercises.cloud-lab.spec.ts` (crear).
**Contrato**
- **Orden:** el mismo que en `answerAudit`.
- **Errores:** `400` «Este ejercicio no es un laboratorio en tu cuenta».
- **Envío guardado:**
  - `code` = `storedSummary` y `results: []`;
  - `score` = 100 · comprobaciones que pasan / total;
  - `achievedLevel: this.accreditedLevel(exercise, outcome === "PASSED" ? 2 : null)`. **Nunca vale 3.**
- **Repaso y progreso:** se programan igual que en los demás tipos.
- **Respuesta:** `{ result }`.

**Criterios**
- [ ] El nivel máximo es 2, con prueba.
- [ ] Hay una prueba de que ningún campo guardado contiene la salida en bruto (marcador).
- [ ] Credenciales → `400` sin crear envío.
- [ ] `getDetail` no expone `expect`.

---

### S16-T11a — Cliente web `submitCloudEvidence`

**Archivos:** `apps/web/src/lib/api-client.ts` y `api-client.spec.ts`. El patrón es `submitAudit`.

### S16-T11b — `CloudLabPlayer`

**Archivos:** `apps/web/src/features/lab/components/CloudLabPlayer.tsx` (crear) · `CloudLabPlayer.spec.tsx` (crear) · `ExercisePlayer.tsx` (despachar `CLOUD_LAB`) · `ExercisePlayer.spec.tsx`.
**Contrato**
- **Avisos fijos:**
  - el de costo, con la cantidad, la capa gratuita, la fuente y la fecha;
  - el de seguridad: «Nunca pegues claves ni secretos. Usa una cuenta de práctica con MFA y presupuesto»;
  - «Esta práctica no certifica nivel 3».
- **Contenido:** los prerrequisitos y los pasos.
- **Comprobaciones:** por cada una, su comando (copiable) y un `<textarea>` «Pega la salida JSON».
- **Limpieza:** las comprobaciones de limpieza y la casilla «He eliminado los recursos del laboratorio».
- **Envío y resultado:** el botón envía, y el resultado se muestra por comprobación, con sus problemas.

**Criterios:** hay pruebas de los avisos, del envío del cuerpo, del resultado y del despacho. El build de web pasa.

---

### S16-T12a…T12d — Pilotos (una sesión cada uno)

**Archivos:** `apps/api/prisma/seed/aws/units/<código>.json` (crear), que contiene la unidad completa según `courseUnitFileSchema`: una lección y su ejercicio.
- **Contenido:** se aplica la regla 4.0.5. La lección sigue los 7 pasos de [`metodo-aws.md`](../../02-contenido/metodo-aws.md) §3 que admite el esquema de lección. Las fuentes son solo oficiales.
- **T12a (`cidr`, AWS-U0.3.1):** un `LAB` en TypeScript donde el estudiante exporta un plan de subredes. Las pruebas ocultas usan `aws.cidr.validateSubnetPlan` y `usableAddresses`.
- **T12b (`iam`, AWS-U2.1.1):** un `LAB` donde el estudiante exporta una política de mínimo privilegio. Las pruebas usan `aws.iam.evaluate` con peticiones que deben permitirse y otras que deben denegarse.
- **T12c (`network`, AWS-U2.2.3):** un `DEBUG` con un SG y una NACL que bloquean el retorno (puertos efímeros). Las pruebas usan `aws.network.canConnect`.
- **T12d (`CLOUD_LAB`, AWS-U0.2.2):** un presupuesto mensual con alerta por correo:
  - la región es fija y la etiqueta, `codeai-lab=aws-u0-2-2-presupuesto`;
  - las comprobaciones son `aws budgets describe-budgets` y `aws budgets describe-notifications-for-budget`;
  - la limpieza se comprueba con `describe-budgets`, que ya no debe devolver el presupuesto;
  - el costo, con su fuente oficial de precios de AWS Budgets y la fecha.

**Criterios de cada piloto**
- [ ] `npm run db:seed:aws` da 1 ejercicio más y «Formas de simulacro: 0».
- [ ] La guarda T7 pasa: la solución pasa y el código inicial falla. En T12d, las reglas de `CLOUD_LAB`.
- [ ] El ejercicio lleva `isPublished: false` y `reviewedByHuman: false`.

---

### S16-T13 — Pilotos con arnés contra Docker real

**Archivos:** `apps/api/src/modules/sandbox/aws-pilots.docker.integration.spec.ts` (crear, con `skipIf` sin `SANDBOX_DOCKER_TESTS=1`).
**Contrato:** lee los tres `LAB`/`DEBUG` piloto de `aws/units/*.json` y los ejecuta con `DockerSandboxService` y `harness: "aws"`. La solución da `PASSED` y el código inicial, `FAILED` o `PARTIAL`.
**Criterios:** el reporte pega la ejecución con `SANDBOX_DOCKER_TESTS=1`.

---

### S16-T14a…T14f — Evaluadores restantes (una sesión cada uno)

Cada uno con los mismos archivos que T2 (`src/<evaluador>/*` y el registro en `index.ts`), las mismas reglas 4.0.1–4.0.3 y al menos 8 casos dorados con URL.

| ID | Evaluador | Contrato mínimo | Fuente (guía en PDF) |
|----|-----------|-----------------|----------------------|
| T14a | `events` | `matches(pattern, event): boolean` · `validatePattern(pattern): string[]`. Valores exactos, `prefix`, `suffix`, `anything-but`, `numeric`, `exists`, `equals-ignore-case`, `wildcard`, `cidr` y `$or`, según la guía leída | Guía de usuario de EventBridge, «Event patterns» |
| T14b | `cfn` | `validateTemplate(t): Issue[]` (estructura, `Ref`/`Fn::GetAtt`/`Fn::Sub` hacia recursos o parámetros existentes, pseudoparámetros y ciclos) · `dependencyOrder(t): string[] \| null` · `securityIssues(t, rules)` con reglas configurables (SG abierto a `0.0.0.0/0` en un puerto, bucket sin bloqueo público…) | Guía de usuario de CloudFormation: anatomía de la plantilla, funciones intrínsecas y `DependsOn` |
| T14c | `dynamodb` | `planAccessPatterns(table, patterns)`: cada patrón se resuelve con `GetItem`/`Query` sobre la tabla o un GSI, **nunca `Scan`**. También valida claves, proyecciones de GSI y condiciones de clave (`=`, `begins_with`, `between`) | Guía para desarrolladores de DynamoDB: claves, consultas e índices secundarios |
| T14d | `s3access` | `evaluateS3Access({ blockPublicAccess, bucketPolicy, objectOwnership, request })`. Decide el acceso y si es público. Usa `aws.iam` para la política del bucket y las cuatro opciones de BPA según la guía | Guía de usuario de S3: Block Public Access, «The meaning of public» y Object Ownership |
| T14e | `asl` | `validateStateMachine(def): Issue[]` (`StartAt`, transiciones existentes, estados terminales, reglas de `Choice`, `Retry`/`Catch`, `Map`/`Parallel` anidados y estados inalcanzables) | Guía para desarrolladores de Step Functions: Amazon States Language |
| T14f | `cost` | `estimate({ priceTable, usage }): { lines, totalUsd }`. Aritmética con la tabla de precios **del enunciado**, unidades, nivel gratuito y redondeo a céntimos. Las pruebas doradas usan ejemplos de cálculo publicados en páginas oficiales de precios | Páginas oficiales de precios de AWS citadas en el ejemplo |

---

### S16-T8 — Revisión humana (persona) · S16-T15 — Documentación (Orquestador)

- **T8:** una persona revisa cada evaluador frente a sus fuentes y firma [`arnes-aws.md`](../../03-arquitectura/arnes-aws.md) §4. Hasta entonces, nada que use el arnés se publica.
- **T15:** `sandbox-ejecucion.md` (arnés y canario), `banco-ejercicios.md` (`harness` y `CLOUD_LAB`), `metodo-aws.md` §4, `contratos-api.md` (`cloud-evidence`), `modelo-datos.md` (el enum) y el estado del sprint.

## 5. Criterios de cierre

- [ ] Cada evaluador declara su alcance y tiene pruebas doradas con la URL oficial. T8 queda registrado como diferido o firmado.
- [ ] Los tres pilotos con arnés pasan contra el sandbox `docker` (T13): la solución pasa y el código inicial falla.
- [ ] El arnés no se puede sustituir: declararlo, reasignarlo, mutarlo o alterar los prototipos da `ERROR` (T5b).
- [ ] La evidencia de `CLOUD_LAB` nunca se guarda en bruto y enmascara identificadores (T10a y T10b).
- [ ] Ningún `CLOUD_LAB` concede nivel 3 (T10b).
- [ ] La suite completa, el typecheck, el lint y el build pasan.

## 6. Documentos relacionados

- [`../../03-arquitectura/arnes-aws.md`](../../03-arquitectura/arnes-aws.md) (ADR y registro de revisión)
- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §4.1–§4.2
- [`../../03-arquitectura/sandbox-ejecucion.md`](../../03-arquitectura/sandbox-ejecucion.md) §10
