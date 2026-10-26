# Sandbox de ejecución de código

> El componente de mayor riesgo del sistema. Un fallo aquí significa ejecución arbitraria en infraestructura propia.

---

## 1. Requisito de seguridad fundamental

> **Ningún código enviado por un estudiante puede ejecutarse en el proceso de la API, en el host, ni con acceso a la red interna.**

El sandbox es un servicio **separado**, con su propio ciclo de vida, límites y superficie de ataque reducida.

---

## 2. Modelo de amenazas

| Amenaza | Ejemplo | Mitigación |
|---------|---------|-----------|
| Consumo de recursos | `while(true){}` | Límite de tiempo de CPU y wall-clock |
| Consumo de memoria | `const a = []; while(1) a.push(...)` | Límite de memoria por proceso |
| Escritura en disco | Llenar el disco con archivos | Filesystem efímero con cuota y raíz `read-only` |
| Acceso a red externa | Exfiltrar datos o atacar servicios | Red deshabilitada por defecto |
| Acceso a la red interna | Escanear Postgres o la API | Sin ruta a la red interna; namespace aislado |
| Escalada de privilegios | Explotar el runtime | Usuario sin privilegios, capabilities eliminadas |
| Fork bomb | Crear procesos sin límite | Límite de procesos por contenedor |
| Persistencia entre ejecuciones | Dejar un proceso vivo | Contenedor efímero, destruido tras cada ejecución |
| Lectura de secretos | Leer variables de entorno | Sin variables de entorno sensibles dentro del sandbox |

---

## 3. Niveles de aislamiento

| Modo | Uso | Aislamiento |
|------|-----|-------------|
| `mock` | Desarrollo y CI | Simulado, sin ejecución real |
| `subprocess` | Desarrollo local | Proceso hijo con `timeout` **solo para desarrollo** |
| `docker` | Staging y producción | Contenedor efímero con límites estrictos |

**Regla:** `subprocess` **nunca** se habilita en producción. La configuración se valida al arrancar y el servicio falla si el modo no es `docker` con `NODE_ENV=production`.

---

## 4. Especificación del contenedor

```yaml
# Configuración aplicada en cada ejecución
image: codeai/sandbox-node:20-alpine
user: "10001:10001"           # sin privilegios
read_only: true                # filesystem raíz inmutable
network_mode: none             # sin red
mem_limit: 256m
memswap_limit: 256m
pids_limit: 64
cpus: 0.5
cap_drop: ["ALL"]
security_opt:
  - no-new-privileges:true
tmpfs:
  - /tmp:size=16m,noexec,nosuid
  - /work:size=32m,exec
timeout_seconds: 5
```

### Límites por defecto

| Recurso | Límite |
|---------|--------|
| Tiempo de ejecución | 5 s |
| Memoria | 256 MB |
| Procesos | 64 |
| CPU | 0.5 núcleos |
| Tamaño de salida | 64 KB (se trunca) |
| Archivos en `/work` | 32 MB |

---

## 5. Flujo de una ejecución

```
[api] POST /exercises/:id/submissions
   │
   ▼
SandboxService.run(request)
   │
   ├─ 1. Validar tamaño del código (máx. 100 KB)
   ├─ 2. Validar que el lenguaje esté permitido
   ├─ 3. Verificar cuota del usuario (ejecuciones/minuto)
   ├─ 4. Crear contenedor efímero con el código montado en /work
   ├─ 5. Ejecutar pruebas dentro del contenedor
   ├─ 6. Recolectar resultados (stdout, exit code, fallos por test)
   ├─ 7. Destruir el contenedor SIEMPRE (finally)
   └─ 8. Registrar ejecución (duración, uso, resultado)
   │
   ▼
[api] Devuelve resultados al usuario
```

### Estructura del contrato

```ts
// packages/shared/src/schemas/sandbox.ts
import { z } from "zod";

export const sandboxRunRequestSchema = z.object({
  language: z.enum(["typescript", "javascript", "sql"]),
  files: z
    .array(z.object({ path: z.string().max(200), content: z.string().max(100_000) }))
    .min(1)
    .max(10),
  tests: z
    .array(
      z.object({
        id: z.string(),
        code: z.string().max(20_000),
        weight: z.number().default(1),
      }),
    )
    .max(30),
  limits: z
    .object({
      timeoutMs: z.number().min(500).max(5000).default(5000),
      memoryMb: z.number().min(64).max(512).default(256),
    })
    .default({}),
});

export const sandboxRunResponseSchema = z.object({
  outcome: z.enum(["PASSED", "FAILED", "PARTIAL", "ERROR", "TIMEOUT"]),
  score: z.number().min(0).max(100),
  results: z.array(
    z.object({
      testId: z.string(),
      passed: z.boolean(),
      message: z.string().max(500).optional(),
      durationMs: z.number().optional(),
    }),
  ),
  stdout: z.string().max(65_536).optional(),
  stderr: z.string().max(65_536).optional(),
  durationMs: z.number(),
});
```

---

## 6. Tratamiento de errores

| Situación | `outcome` | Mensaje al estudiante |
|-----------|-----------|----------------------|
| Todas las pruebas pasan | `PASSED` | Éxito con resumen |
| Algunas pasan | `PARTIAL` | Qué falló y por qué (sin revelar tests ocultos) |
| Ninguna pasa | `FAILED` | Primer error visible y pista sugerida |
| Error de compilación | `ERROR` | Mensaje del compilador (truncado) |
| Excede el tiempo | `TIMEOUT` | "Tu solución tardó más de 5 s. Revisa bucles y llamadas repetidas." |
| Excede la memoria | `ERROR` | "Tu solución consumió demasiada memoria." |
| Servicio caído | 503 | "El servicio de ejecución no está disponible. Inténtalo en un minuto." |

> Nunca se expone al estudiante el stack interno, ni rutas del host, ni nombres de contenedores.

---

## 7. Cuotas y abuso

| Límite | Valor |
|--------|-------|
| Ejecuciones por minuto (usuario) | 20 |
| Ejecuciones por hora (usuario) | 200 |
| Ejecuciones concurrentes (sistema) | 20 |
| Tamaño de código | 100 KB |

Al exceder: `429 RATE_LIMITED`.

**Detección de abuso:**
- Código que intenta abrir sockets → bloqueado por falta de red.
- Patrones de `child_process` → bloqueados por lista de módulos permitidos.
- Intentos repetidos de acceder a `/etc` → registrados y marcados.

---

## 8. Modo `mock` (desarrollo y CI)

```ts
export class MockSandboxService implements SandboxService {
  async run(req: SandboxRunRequest): Promise<SandboxRunResponse> {
    // Heurística determinista: busca marcadores en el código
    const passed = !req.files.some((f) => f.content.includes("TODO"));
    return {
      outcome: passed ? "PASSED" : "FAILED",
      score: passed ? 100 : 0,
      results: req.tests.map((t) => ({ testId: t.id, passed })),
      durationMs: 12,
    };
  }
}
```

**Importante:** el modo `mock` permite construir y probar toda la aplicación **antes** de tener el sandbox real. Es lo que desbloquea los sprints S5–S6 sin infraestructura pesada.

---

## 9. Checklist antes de habilitar `docker` en producción

- [ ] Red deshabilitada (`network_mode: none`).
- [ ] Usuario sin privilegios (`user: 10001`).
- [ ] `cap_drop: ALL` y `no-new-privileges`.
- [ ] Filesystem raíz `read_only`.
- [ ] Límites de memoria, CPU y procesos verificados.
- [ ] Destrucción garantizada del contenedor en `finally`.
- [ ] Prueba de `while(true)` → termina por timeout.
- [ ] Prueba de consumo de memoria → termina por límite.
- [ ] Prueba de acceso a red → falla.
- [ ] Prueba de escritura fuera de `/work` → falla.
- [ ] Logs sin datos sensibles.
- [ ] Cuotas activas y probadas.

---

## Documentos relacionados

- [`arquitectura-general.md`](arquitectura-general.md)
- [`capa-ia.md`](capa-ia.md)
- [`../04-plan-ejecucion/roadmap-sprints.md`](../04-plan-ejecucion/roadmap-sprints.md) — sprint S5 (ficha pendiente de redacción al abrir el sprint)

