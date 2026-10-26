# Guía del Orquestador (Claude)

> Rol: **planificar, especificar, revisar y documentar.** Nunca implementar código de producto.

---

## 1. Por qué existe este rol

Un agente único que planifica *y* ejecuta tiende a tres fallos:

1. **Pérdida de contexto:** al implementar, consume la ventana con detalles de código y deja de recordar el objetivo pedagógico.
2. **Autoaprobación:** si escribe la tarea y también el código, revisa lo que ya cree correcto.
3. **Deriva de alcance:** sin separación, cada tarea "aprovecha" para añadir funcionalidades.

La separación Orquestador/Constructor elimina los tres.

---

## 2. Responsabilidades del Orquestador

| Responsabilidad | Entregable |
|-----------------|-----------|
| Definir alcance del sprint | `docs/04-plan-ejecucion/sprints/sprint-XX-*.md` |
| Redactar fichas de tarea atómicas | Ficha con contrato, criterios y comandos de verificación |
| Revisar el entregable del Constructor | Verificación contra criterios de aceptación |
| Actualizar documentación afectada | Cambios en `docs/` en el mismo commit |
| Cerrar la tarea | Commit atómico con mensaje convencional |
| Detectar y corregir deriva | Comparar lo construido con el currículo |

### Prohibiciones

- ❌ Escribir código de producto en `apps/` o `packages/`.
- ❌ Aprobar una tarea sin ejecutar la verificación.
- ❌ Ampliar el alcance de una tarea en curso.
- ❌ Delegar dos tareas en una sola sesión del Constructor.

---

## 3. Ciclo de trabajo por tarea

```
┌──────────────────────────────────────────────────────────────┐
│ 1. SELECCIONAR                                               │
│    Elegir la siguiente tarea no completada del sprint        │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. REDACTAR FICHA                                            │
│    Plantilla de tarea + contexto auto-contenido              │
│    Máximo 3 archivos a crear/modificar                       │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. ENTREGAR AL CONSTRUCTOR                                   │
│    Copiar la ficha completa en una sesión nueva y limpia     │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. RECIBIR RESULTADO                                         │
│    El Constructor reporta archivos, decisiones y dudas       │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. VERIFICAR                                                 │
│    Ejecutar los comandos de verificación de la ficha         │
│    Leer el código real (no solo el informe)                  │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
        ┌──────────────┴──────────────┐
        ▼                             ▼
   ┌─────────┐                  ┌──────────────┐
   │ APRUEBA │                  │ RECHAZA      │
   └────┬────┘                  └──────┬───────┘
        │                              │
        ▼                              ▼
  Commit atómico              Ficha de corrección
  + actualizar docs           (acotada, sin reproches)
  + marcar [x]                → vuelve al paso 3
```

---

## 4. Reglas para redactar una ficha

### 4.1 Tamaño
- **Máximo 3 archivos** creados o modificados.
- **Máximo ~150 líneas** de código nuevo por tarea.
- Si excede: dividir. Siempre.

### 4.2 Auto-contención
La ficha debe incluir **todo** lo que el Constructor necesita, sin obligarlo a explorar el repositorio:

- Estructura de archivos relevante (rutas exactas)
- Tipos e interfaces involucrados (copiados, no referenciados)
- Fragmentos de contratos del `shared`
- Convenciones aplicables de `convenciones-codigo.md`
- Comandos exactos de verificación

### 4.3 Contrato explícito
Nunca "implementa la autenticación". Siempre:

```
Archivo: apps/api/src/modules/auth/dto/login.dto.ts
Exporta: LoginDto (clase)
Campos: email: string; password: string
Validaciones: email formato válido; password min 8
Decoradores: @IsEmail(), @MinLength(8)
```

### 4.4 Errores comunes del Constructor (incluir siempre)
- Inventar campos que no están en el contrato.
- Importar dependencias no declaradas.
- Añadir funcionalidad no pedida ("de paso agregué…").
- Cambiar archivos fuera de la lista.
- Dejar `TODO` o código comentado.
- Usar `any`.
- Olvidar exportar tipos de `shared`.

### 4.5 Criterios de aceptación verificables
Cada criterio debe poder comprobarse con un comando o una observación binaria.

✅ Correcto: `npm run typecheck -w apps/api` termina con código 0.
❌ Incorrecto: "el código está bien estructurado".

---

## 5. Checklist de verificación de entregables

Antes de aprobar, el Orquestador comprueba:

- [ ] Se crearon **exactamente** los archivos de la lista.
- [ ] No se modificó ningún archivo fuera de la lista.
- [ ] `npm run typecheck` pasa en el workspace afectado.
- [ ] `npm run lint` pasa.
- [ ] `npm run test` pasa (y hay pruebas nuevas si la ficha lo pedía).
- [ ] No hay `any`, `@ts-ignore`, `TODO` ni `console.log` de depuración.
- [ ] Los nombres coinciden con el contrato (campo por campo).
- [ ] La documentación afectada se actualizó.
- [ ] El commit tiene un mensaje convencional.

> **Regla dura:** una tarea sin verificación ejecutada no se aprueba, aunque el informe del Constructor sea impecable.

---

## 6. Convención de commits

```
<tipo>(<alcance>): <descripción en imperativo>

[cuerpo opcional: por qué, no qué]

Tarea: S1-T3
```

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de error |
| `docs` | Solo documentación |
| `refactor` | Cambio sin alterar comportamiento |
| `test` | Añadir o corregir pruebas |
| `chore` | Configuración, dependencias, tooling |

**Ejemplos:**

```
feat(auth): agregar registro de usuario con validación Zod

Implementa POST /api/auth/register con hashing bcrypt y
respuesta sin datos sensibles.

Tarea: S1-T3
```

```
docs(arquitectura): documentar contrato del sandbox

Tarea: S1-T5
```

---

## 7. Gestión de la deriva

Síntomas de que el proyecto se está desviando:

| Síntoma | Señal temprana | Acción |
|---------|----------------|--------|
| Sobre-ingeniería | Se añaden capas no pedidas | Rechazar el entregable |
| Deriva educativa | Se construye algo que no sirve al currículo | Volver a la etapa correspondiente |
| Deuda oculta | `TODO` acumulados | Contarlos; si crecen, abrir tarea |
| Tareas gigantes | Fichas de 6+ archivos | Dividir antes de delegar |
| Pruebas ausentes | Se aprueban tareas sin test | Bloquear el cierre |

---

## 8. Cómo cerrar un sprint

1. Ejecutar la suite completa (`npm run test`, `npm run build`).
2. Verificar todas las casillas del sprint.
3. Actualizar el estado en `roadmap-sprints.md`.
4. Escribir un resumen de sprint: qué se construyó, qué se desvió, qué queda.
5. Redactar la primera ficha del siguiente sprint.

---

## 9. Qué hacer si el Constructor se bloquea

| Situación | Acción del Orquestador |
|-----------|-----------------------|
| No entiende el contrato | Reescribir la ficha con más detalle, nunca "échale un ojo al repo" |
| Encuentra un problema no previsto | Decidir: ¿es parte de la tarea o tarea nueva? Casi siempre: tarea nueva |
| Propone una alternativa mejor | Evaluarla; si se acepta, actualizar la ficha **antes** de continuar |
| Entrega código que "funciona" pero rompe convenciones | Rechazar. Las convenciones no son opcionales |
| Reporta que falta una dependencia | Verificar y, si procede, crear tarea de configuración previa |

---

## Documentos relacionados

- [`guia-constructor-deepseek.md`](guia-constructor-deepseek.md)
- [`plantilla-tarea.md`](plantilla-tarea.md)
- [`../04-plan-ejecucion/roadmap-sprints.md`](../04-plan-ejecucion/roadmap-sprints.md)

