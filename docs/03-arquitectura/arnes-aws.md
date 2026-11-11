# Arnés AWS: evaluadores puros dentro del sandbox

> **Estado:** ADR aceptado (S16-T0, 2026-11-10). Los nueve evaluadores están construidos (S16, 2026-11-11): 465 pruebas, con casos dorados que citan su URL oficial. La revisión humana de cada evaluador (S16-T8) está **pendiente** y se registra en §4.
> **Por qué existe:** el sandbox no tiene ni tendrá acceso a AWS (`--network none`). Los laboratorios de la ruta AWS se corrigen con **evaluadores puros y fieles**, que modelan un subconjunto declarado del comportamiento de AWS y se prueban contra ejemplos de la documentación oficial ([`../02-contenido/metodo-aws.md`](../02-contenido/metodo-aws.md) §4.1).

---

## 1. ADR-S16-T0 — Dónde vive el arnés y cómo llega al sandbox

### Contexto (comprobado en el código el 2026-11-10)

- `DockerSandboxService` usa la imagen `node:22-alpine` sin modificar. Escribe los archivos en un directorio temporal del host y lo monta **en solo lectura** en `/work`. El código del estudiante y las pruebas se combinan en un único módulo ESM, `/work/.codeai/check.mjs` (o `.mts` en TypeScript, con eliminación de tipos), con un `await __codeaiCheck(id, async () => { … })` por prueba ([`sandbox-ejecucion.md`](sandbox-ejecucion.md) §10).
- El código del estudiante se pega en el mismo ámbito que las pruebas. Solo se inlinea el archivo de entrada.
- `SANDBOX_MODE` vale `mock` por defecto y en producción se exige `docker`. El despliegue del modo `docker` en producción (binario y socket en la imagen de la API) sigue pendiente desde S11 y **no es alcance de S16**.
- La guarda de calidad que ejecuta la solución y el código inicial corre **dentro del proceso** de Vitest, sin sandbox.

### Opciones

- **(a) Paquete del monorepo `packages/aws-harness`**, compilado a JavaScript ESM y montado como módulo importable.
- **(b) Preludio de texto** que el adaptador antepone al código del estudiante.

### Decisión: (a), montado en el espacio de trabajo

1. **El paquete.** `packages/aws-harness` (`@codeai/aws-harness`) es TypeScript estricto, **sin dependencias de ejecución**, y compila a ESM (`dist/*.js` + `.d.ts`). Cada evaluador es un módulo puro: no hace E/S, es determinista y no lanza ante entradas inválidas, sino que devuelve problemas.
2. **Inyección.** Cuando `SandboxRunRequest.harness === "aws"`, el adaptador `docker` copia `dist/` en `<ws>/.codeai/harness/` y escribe allí un `package.json` con `{"type":"module"}`. El montaje sigue siendo de solo lectura, así que el estudiante no puede modificar los archivos del arnés.
3. **Enlace.** El archivo de comprobación declara `const aws = await import("./harness/index.js")` **antes** del código del estudiante, con el espacio de nombres congelado en profundidad.
   - Si el estudiante declara `aws`, se produce un `SyntaxError`, y si lo reasigna, un `TypeError`. En los dos casos el resultado es `ERROR`, nunca `PASSED`.
   - Mutar el objeto congelado lanza un error, porque el módulo está en modo estricto.
4. **Canario.** Después del código del estudiante y antes de las pruebas se ejecuta `aws.selfTest()`, que evalúa casos dorados conocidos de cada evaluador.
   - Si falla o lanza, el archivo de comprobación imprime `__CODEAI_HARNESS_TAMPERED__` y sale.
   - El adaptador lo traduce a `ERROR` con el mensaje «El arnés se alteró durante la ejecución».
   - Así se detecta la manipulación de prototipos, como `Array.prototype.some = …`, que el congelado no impide.
5. **Misma versión en todas partes.** Las pruebas de la API, la guarda de la semilla y el sandbox importan el mismo `@codeai/aws-harness`.

### Consecuencias y límites aceptados

- **Misma ejecución, mismo riesgo.** El estudiante y el arnés comparten realm, como ya ocurre hoy con `assert` y con las pruebas ocultas, que son legibles en `/work/.codeai`. El canario reduce el riesgo, pero no lo elimina. El modelo de amenaza es el de un laboratorio de práctica, no el de un examen.
- **Mock.** En modo `mock` el arnés no se ejecuta, igual que el resto de laboratorios: ningún resultado en `mock` certifica nada.
- **Producción.** La imagen de la API deberá incluir `packages/aws-harness/dist` cuando se cierre el despliegue del modo `docker` (deuda de S11).
- **TypeScript.** Los laboratorios AWS se escriben en TypeScript (`check.mts`), y el arnés llega ya compilado a JavaScript. La guarda de la semilla elimina los tipos con `stripTypeScriptTypes` de `node:module`.

---

## 2. Contrato común de un evaluador

```ts
export interface EvaluatorCapabilities {
  readonly name: string;               // "cidr", "iam", …
  readonly version: string;            // semver del evaluador
  readonly modeled: readonly string[];     // lo que modela, en frases cortas
  readonly notModeled: readonly string[];  // lo que NO modela; ningún ejercicio puede depender de ello
  readonly sources: readonly string[];     // URL oficiales de docs.aws.amazon.com
}
// Cada evaluador exporta: capabilities, sus funciones puras y canary(): boolean (casos dorados mínimos).
```

- Las **pruebas doradas** van en `<evaluador>.golden.spec.ts`. Cada caso lleva un comentario `// Fuente: <URL oficial>` y reproduce un ejemplo documentado. Nunca se escriben de memoria.
- Las entradas inválidas devuelven problemas (`string[]`) o un resultado con `reason`, nunca una excepción.

## 3. Evaluadores

| Evaluador | Uso | Sprint |
|-----------|-----|--------|
| `cidr` | Planes de direccionamiento IPv4 en VPC | S16 (piloto AWS-U0.3.1) |
| `iam` | Lógica de evaluación de políticas | S16 (piloto AWS-U2.1.1) |
| `network` | Rutas, security groups y NACL | S16 (piloto AWS-U2.2.3) |
| `events` | Patrones de EventBridge | S16 |
| `cfn` | Plantillas de CloudFormation | S16 |
| `dynamodb` | Patrones de acceso sin `Scan` | S16 |
| `s3access` | Block Public Access y política de bucket | S16 |
| `asl` | Estructura de Step Functions | S16 |
| `cost` | Cálculo con la tabla de precios del enunciado | S16 |

## 4. Registro de revisión humana (S16-T8)

Ningún evaluador se usa en contenido **publicado** sin una revisión humana registrada aquí. Los pilotos de S16 se siembran sin publicar.

| Evaluador | Versión | Revisado por | Fecha | Resultado |
|-----------|---------|--------------|-------|-----------|
| cidr | 0.1.0 | — | — | Pendiente |
| iam | 0.2.0 | — | — | Pendiente |
| network | 0.1.0 | — | — | Pendiente |
| events | 0.1.0 | — | — | Pendiente |
| cfn | 0.1.0 | — | — | Pendiente |
| dynamodb | 0.1.0 | — | — | Pendiente |
| s3access | 0.1.0 | — | — | Pendiente |
| asl | 0.1.0 | — | — | Pendiente |
| cost | 0.1.0 | — | — | Pendiente |

**Qué revisar en cada evaluador (T8):**
- Que cada URL citada corresponde a la sección del PDF de la que salió el ejemplo. El PDF no trae las URL HTML y se dedujeron por el título.
- Que `notModeled` cubre lo que la guía deja abierto.
- Las decisiones propias declaradas:
  - `iam`: clave ausente → condición falsa salvo `…IfExists`/`Null`; `ForAllValues` negado con clave ausente → falso;
  - `s3access`: el principal anónimo se evalúa como una cuenta ajena; solo cuentan como restrictivos ciertos operadores;
  - `cost`: redondeo por línea, como los ejemplos oficiales de Lambda. Dos ejemplos de la página se excluyeron porque no cuadran con su propia tabla;
  - `cfn`: `requireAll` opcional en la regla de bloqueo público;
  - `dynamodb`: `GetItem` cuando hay igualdad en las dos claves.

**Fuentes en PDF que funcionan** (2026-11-11):
- `vpc/latest/userguide/vpc-ug.pdf`;
- `IAM/latest/UserGuide/iam-ug.pdf`;
- `organizations/latest/userguide/organizations-userguide.pdf`;
- `eventbridge/latest/userguide/user-guide.pdf`;
- `AWSCloudFormation/latest/UserGuide/cfn-ug.pdf`;
- `amazondynamodb/latest/developerguide/dynamodb-dg.pdf`;
- `AmazonS3/latest/userguide/s3-userguide.pdf`;
- `step-functions/latest/dg/step-functions-dg.pdf`.

Todas cuelgan de `https://docs.aws.amazon.com/pdfs/`. Las páginas HTML **sí** se leen con `curl`, pero una página inexistente devuelve 200: hay que comparar el `<title>`.
