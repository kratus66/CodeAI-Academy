# Plantilla de ficha de tarea

> Copiar esta plantilla por cada tarea atómica. La ficha debe ser **auto-contenida**: el Constructor no recibe el repositorio completo, solo este documento, los archivos implicados y los tipos de `shared` necesarios.

---

## Metadatos

| Campo | Valor |
|-------|-------|
| **ID** | `SX-TY` |
| **Sprint** | `SX — nombre` |
| **Estado** | ⬜ pendiente / 🔄 en curso / ✅ aprobada / ❌ rechazada |
| **Depende de** | `SX-TZ` o `—` |
| **Archivos** | máximo 3 (si hay más, dividir la tarea) |
| **Estimación** | 1 sesión de Constructor |

---

## 1. Contexto mínimo

Qué existe ya, qué falta y por qué esta tarea es la siguiente. Sin historia del proyecto ni enlaces a "explora el repo".

```text
Ejemplo: el módulo health ya expone GET /api/health. Esta tarea añade
GET /api/health/ready para verificar dependencias.
```

---

## 2. Contrato

Todo lo que el Constructor debe copiar literalmente: tipos, firmas, rutas, cuerpos JSON, nombres de campo.

```ts
// Tipos de entrada y salida (de @codeai/shared si cruzan la frontera)
export interface ExampleContract {
  id: string;
}
```

```json
// Petición / respuesta esperada
{ "example": true }
```

**Reglas del contrato:**

- Los nombres de campo son exactos; no se traducen ni se reordenan.
- Si el contrato contradice `packages/shared`, la tarea se detiene y se pregunta.

---

## 3. Archivos

| Ruta | Acción | Propósito |
|------|--------|-----------|
| `apps/api/src/modules/x/x.service.ts` | crear | Lógica |
| `apps/api/src/modules/x/x.controller.ts` | modificar | Endpoint |
| `apps/api/src/modules/x/x.spec.ts` | crear | Pruebas |

**Solo estos archivos.** Crear o modificar otro es un fallo de la tarea.

---

## 4. Criterios de aceptación

Cada criterio debe ser verificable con un comando o una observación binaria.

- [ ] `GET /api/x` responde 200 con el contrato de §2.
- [ ] Entrada inválida responde 400 con `{ error: { code: "VALIDATION_ERROR", …, traceId } }`.
- [ ] La respuesta incluye cabecera `x-trace-id`.
- [ ] Existe prueba para el camino feliz y para el error.
- [ ] `npm run typecheck -w apps/api` termina con código 0.
- [ ] `npm run lint -w apps/api` termina con 0 warnings.
- [ ] `npm run test -w apps/api` pasa al 100 %.

---

## 5. Verificación

```bash
npm run typecheck -w apps/api
npm run lint -w apps/api
npm run test -w apps/api
# si la tarea toca la web o contratos compartidos:
npm run build -w apps/web
```

**Resultado esperado:** los tres comandos con código de salida 0 y ninguna advertencia.

---

## 6. Qué NO hacer

- No añadir endpoints, campos ni validaciones no pedidos.
- No refactorizar archivos ajenos a la lista.
- No instalar dependencias (reportar si falta alguna).
- No usar `any`, `TODO`, `console.log` ni código comentado.
- No modificar `docs/` (lo hace el Orquestador al cerrar).
- No tocar la configuración de build, lint o test salvo que la ficha lo indique.

---

## 7. Notas de revisión (solo Orquestador)

| Campo | Valor |
|-------|-------|
| Verificación ejecutada | comandos + resultado |
| Decisión | ✅ aprobada / ❌ rechazada |
| Motivo del rechazo | criterio incumplido, sin reproches |
| Commit | `tipo(alcance): descripción` + `Tarea: SX-TY` |
| Docs actualizados | rutas modificadas |

---

## Ejemplo de criterio bien escrito

- ✅ `POST /api/auth/register` con email duplicado responde `409 CONFLICT` y no crea usuario.
- ❌ "El registro funciona correctamente".

---

## Documentos relacionados

- [`guia-orquestador-claude.md`](guia-orquestador-claude.md)
- [`guia-constructor-deepseek.md`](guia-constructor-deepseek.md)
- [`../04-plan-ejecucion/convenciones-codigo.md`](../04-plan-ejecucion/convenciones-codigo.md)
- [`../07-flujo-operativo.md`](../07-flujo-operativo.md)
