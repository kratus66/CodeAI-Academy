# Flujo operativo

> **Empieza aquí si eres un agente.** Este documento describe el recorrido obligatorio desde que recibes una tarea hasta que se cierra.

---

## 0. Regla de oro

**Una tarea atómica por sesión.** Al terminarla, se reporta y se detiene. No se continúa con la siguiente, no se "aprovecha" para refactorizar.

---

## 1. Orden de lectura

| Paso | Documento | Para qué |
|------|-----------|----------|
| 1 | [`README.md`](../README.md) | Contexto del producto y estado |
| 2 | Este documento | Cómo se trabaja |
| 3 | [`04-plan-ejecucion/roadmap-sprints.md`](04-plan-ejecucion/roadmap-sprints.md) | Sprint actual y criterio de cierre |
| 4 | `04-plan-ejecucion/sprints/sprint-XX-*.md` | Alcance del sprint |
| 5 | Tu ficha de tarea | Qué construir exactamente |
| 6 | [`04-plan-ejecucion/convenciones-codigo.md`](04-plan-ejecucion/convenciones-codigo.md) | Cómo escribirlo |
| 7 | Documento de arquitectura del área | Contrato que debes respetar |

Nada más. Si necesitas más contexto del que ofrece la ficha, **la ficha está mal escrita**: se corrige antes de implementar.

---

## 2. Ciclo de una tarea

```
┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ 1. LEER FICHA │──►│ 2. VERIFICAR  │──►│ 3. IMPLEMENTAR│──►│ 4. VERIFICAR  │
│   y contratos │   │  estado base  │   │ solo archivos │   │ typecheck/lint│
└───────────────┘   └───────────────┘   └───────────────┘   │ test/build    │
                                                            └───────┬───────┘
                                                                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ 7. COMMIT +   │◄──│ 6. REVISIÓN   │◄──│ 5. REPORTE    │◄──│  ¿TODO VERDE? │
│    docs       │   │  Orquestador  │   │  plantilla    │   │  no → corregir│
└───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘
```

---

## 3. Paso a paso

### Paso 0 — Confirmar el modo de trabajo

- **Plan:** explorar, proponer y acordar. No se edita ni se ejecuta nada que cambie el estado.
- **Act:** implementar la tarea aprobada, con verificación al final.

### Paso 1 — Leer la ficha completa

Comprueba antes de escribir una línea:

- [ ] Sé qué archivos tocar (y cuáles no).
- [ ] Conozco tipos de entrada y salida.
- [ ] Entiendo cada criterio de aceptación.
- [ ] Sé cuál es el comando de verificación.
- [ ] No necesito dependencias nuevas.

Si algo no cuadra: detente y pregunta (formato en §5).

### Paso 2 — Verificar el estado base

```bash
git status                # no debe haber cambios ajenos sin explicar
npm run typecheck -w <workspace>
npm run test -w <workspace>
```

Si la base ya está en rojo por algo ajeno a la tarea, **se reporta antes de tocar código**.

### Paso 3 — Implementar

- Solo los archivos de la ficha, en el orden indicado.
- Código completo, sin placeholders.
- Respetar el contrato al pie de la letra.
- Sin `any`, `TODO` ni `console.log`.

### Paso 4 — Verificar

```bash
npm run typecheck -w <workspace>
npm run lint -w <workspace>
npm run test -w <workspace>
```

Y además `npm run build` cuando la tarea toca la web, la API o `shared`.

### Paso 5 — Reportar

Usa la plantilla de [`05-orquestacion/guia-constructor-deepseek.md`](05-orquestacion/guia-constructor-deepseek.md) §4: archivos creados/modificados, verificación, decisiones, dudas y qué **no** se hizo.

### Paso 6 — Revisión

El Orquestador ejecuta la verificación por su cuenta y lee el código real. No aprueba por informe.

### Paso 7 — Cierre

Commit atómico + actualización de documentación afectada + casilla marcada en la ficha del sprint.

---

## 4. Comandos por workspace

| Necesidad | Comando |
|-----------|---------|
| Instalar todo | `npm install` |
| Levantar web + API | `npm run dev` |
| Solo web / solo API | `npm run dev:web` · `npm run dev:api` |
| Tipos de un workspace | `npm run typecheck -w apps/api` |
| Lint de un workspace | `npm run lint -w apps/web` |
| Pruebas de un workspace | `npm run test -w packages/shared` |
| Suite completa | `npm run typecheck && npm run lint && npm test && npm run build` |
| Postgres local | `npm run db:up` (operativo desde S2) |

---

## 5. Bloqueos

Detente y pregunta si:

- La ficha contradice un contrato de `shared`.
- Faltan archivos que la ficha asume existentes.
- Falla algo ajeno a tu cambio.
- Hay dos interpretaciones razonables.
- Necesitas una dependencia no declarada.
- Detectas un riesgo de seguridad en el enfoque.

Formato:

```
BLOQUEO EN SX-TY

Contexto: ...
Opciones:
A) ...
B) ...

¿Cuál corresponde?
```

---

## 6. Registro de avance

| Artefacto | Quién lo actualiza | Cuándo |
|-----------|--------------------|--------|
| Ficha del sprint (casillas) | Orquestador | Al aprobar cada tarea |
| [`roadmap-sprints.md`](04-plan-ejecucion/roadmap-sprints.md) | Orquestador | Al cerrar el sprint |
| `docs/03-arquitectura/*` | Orquestador | Si cambió un contrato |
| `README.md` | Orquestador | Si cambió el estado global |

---

## 7. Reglas permanentes (no negociables)

1. Ningún concepto del currículo sin ejercicios prácticos asociados.
2. Ningún módulo del currículo sin entregable o proyecto.
3. La IA es herramienta **y** objeto de estudio.
4. Habrá pruebas acumulativas: los fundamentos se reevalúan.
5. El curso termina con una demostración defendible de competencias.
6. Documentación y código se actualizan en el mismo commit.

---

## Documentos relacionados

- [`04-plan-ejecucion/roadmap-sprints.md`](04-plan-ejecucion/roadmap-sprints.md)
- [`04-plan-ejecucion/convenciones-codigo.md`](04-plan-ejecucion/convenciones-codigo.md)
- [`05-orquestacion/guia-orquestador-claude.md`](05-orquestacion/guia-orquestador-claude.md)
- [`05-orquestacion/guia-constructor-deepseek.md`](05-orquestacion/guia-constructor-deepseek.md)
- [`05-orquestacion/plantilla-tarea.md`](05-orquestacion/plantilla-tarea.md)
