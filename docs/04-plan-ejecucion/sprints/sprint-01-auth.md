# Sprint 01 — Identidad y acceso

> **Estado:** 🔄 en curso · **Inicio:** 2026-10-26 · **Depende de:** S0 ✅
> **Avance:** backend de identidad completo y verificado (S1-T1…S1-T13); pantallas web pendientes (S1-T14…S1-T16).
> **Terminal por tarea:** cada tarea se implementa y verifica en un terminal propio (no se mezclan verificaciones).

---

## 1. Objetivo

Una persona puede crear su cuenta, iniciar sesión, mantener la sesión entre recargas y cerrarla, con roles aplicados desde el primer día.

Al cerrar el sprint, el resto de la plataforma puede asumir:

1. Existe un usuario persistido con rol (`STUDENT`, `INSTRUCTOR`, `ADMIN`) y contraseña hasheada.
2. Toda ruta protegida conoce la identidad del solicitante sin volver a consultar la base de datos.
3. Hay un patrón reutilizable de validación (Zod), errores (envelope único), rate limiting y cookies que S2–S11 heredan sin reinventar.

---

## 2. Alcance

| Incluye | No incluye (queda para otro sprint) |
|---------|-------------------------------------|
| Prisma + PostgreSQL + migración de identidad | Modelo de contenido (S2) |
| Registro, login, refresh con rotación, logout, `me` | Recuperación de contraseña por correo |
| Cookies httpOnly + `Authorization: Bearer` | Verificación de email |
| Guard JWT + guard de roles | Permisos por recurso (S4) |
| Rate limiting de `/auth/login` y `/auth/register` | Rate limiting distribuido (Redis, S11) |
| Pantallas de registro y login | Panel de perfil completo (S3) |

---

## 3. Decisiones de arquitectura

| Decisión | Motivo | Alternativa descartada |
|----------|--------|------------------------|
| **Prisma entra en S1** (no en S2) | Sin persistencia no hay usuarios; S0 dejó `db:*` como deuda explícita | Usuarios en memoria (se perderían al reiniciar) |
| Solo modelos `User` y `RefreshToken` en la migración inicial | Las relaciones de contenido aún no existen; añadirlas ahora obligaría a inventar modelos de S2 | Copiar el esquema completo de `modelo-datos.md` |
| `bcryptjs` (JS puro) | Mismo formato bcrypt (coste 12) sin compilación nativa en Windows/Node 24 | `bcrypt` (node-gyp), `argon2` (binario) |
| `process.loadEnvFile()` de Node 24 | Carga `.env` sin añadir dependencia | `dotenv`, `@nestjs/config` |
| Validación con `ZodValidationPipe` sobre esquemas de `@codeai/shared` | Una sola fuente de verdad de las reglas | DTOs con `class-validator` duplicando reglas |
| Rate limiting en memoria | Suficiente para una instancia y pruebas deterministas | `@nestjs/throttler` (no resuelve la clave IP+email) |
| Refresh token opaco + hash SHA-256 en base de datos | Robo de base de datos no permite reutilizar sesiones | Guardar el token en claro |
| Rotación con detección de reutilización | Un refresh revocado que reaparece revoca toda la familia | Rotación silenciosa |

**Contrato de cookies**

| Cookie | Contenido | `Path` | TTL | Flags |
|--------|-----------|--------|-----|-------|
| `access_token` | JWT HS256 (`sub`, `role`, `email`) | `/` | 15 min | `httpOnly`, `sameSite=lax`, `secure` en producción |
| `refresh_token` | 48 bytes aleatorios base64url | `/api/auth` | 7 días | `httpOnly`, `sameSite=lax`, `secure` en producción |

`sameSite=lax` funciona entre `localhost:3000` y `localhost:3001` (mismo sitio, distinto origen) con CORS `credentials: true`.

---

## 4. Tareas

Cada tarea se ejecuta y verifica en **un terminal distinto** (`Terminal 1`, `Terminal 2`, …). Ninguna tarea se da por cerrada sin su comando de verificación y su salida real.

| ID | Tarea | Archivos principales | Terminal | Estado |
|----|-------|----------------------|----------|--------|
| S1-T1 | Persistencia: esquema Prisma de identidad, `PrismaService` y migración `init_identity` | `apps/api/prisma/schema.prisma`, `src/database/*` | 1 | ✅ |
| S1-T2 | Configuración: `DATABASE_URL`, `JWT_SECRET`, TTLs y carga de `.env` sin dependencias | `src/config/env.ts`, `env.spec.ts`, `env.module.ts`, `src/main.ts` | 2 | ✅ |
| S1-T3 | Hash de contraseñas (bcrypt, coste 12) | `src/common/security/password.service.ts` + spec | 3 | ✅ |
| S1-T4 | `ZodValidationPipe`: valida con los esquemas de `@codeai/shared` | `src/common/pipes/zod-validation.pipe.ts` + spec | 4 | ✅ |
| S1-T5 | Detalles de error con `field` (envelope §2 completo) | `all-exceptions.filter.ts` + spec | 5 | ✅ |
| S1-T6 | Emisión y verificación de tokens (JWT + refresh opaco con hash) | `src/modules/auth/token.service.ts` + spec | 6 | ✅ |
| S1-T7 | Repositorio de identidad (interfaz + adaptador Prisma + mapper público) | `src/modules/auth/{auth.repository,prisma-auth.repository,auth.mapper}` | 7 | ✅ |
| S1-T8 | `AuthService`: registro, login, refresh con rotación, logout | `auth.service.ts`, spec e implementación en memoria | 8 | ✅ |
| S1-T9 | Guard JWT, cookies de sesión y decorador `@CurrentUser` | `src/modules/auth/guards/*`, `decorators/*`, `auth.cookies.ts` | 9 | ✅ |
| S1-T10 | Rate limiting de auth (5/15 min login, 3/h registro) con `Retry-After` | `src/common/security/rate-limit.*` | 10 | ✅ |
| S1-T11 | Controlador, módulo `auth` conectado a `AppModule` | `auth.controller.ts`, `auth.module.ts`, `app.module.ts` | 11 | ✅ |
| S1-T12 | Verificación HTTP real del flujo completo (registro → me → refresh → logout) | — (guion de comandos) | 12 | ✅ |
| S1-T13 | Cierre documental: contrato, `modelo-datos.md`, README y roadmap | docs | 13 | ✅ |
| S1-T14 | Web: cliente de API con `credentials: include` y manejo del envelope de error | `apps/web/src/lib/api-client.ts` | 14 | ⬜ |
| S1-T15 | Web: pantallas de registro y login con esquemas compartidos | `apps/web/src/app/(auth)/*` | 15 | ⬜ |
| S1-T16 | Web: estado de sesión (`/auth/me`) y cabecera con usuario | `apps/web/src/components/*` | 16 | ⬜ |

> **Nota de alcance:** el guard de roles y `@Public` se posponen a S3, cuando exista navegación autenticada que los use; hoy `JwtAuthGuard` se aplica por ruta y no hay código muerto.

> **Regla de tamaño:** ninguna tarea toca más de 3 archivos de código. Si una tarea necesita más, se parte antes de empezar.

---

## 5. Criterios de aceptación

1. `POST /api/auth/register` devuelve `201` con `{ user }` (sin `passwordHash`), crea al usuario en PostgreSQL y deja ambas cookies.
2. Registro con email repetido → `409 CONFLICT`; cuerpo inválido → `400 VALIDATION_ERROR` con `details[].field`.
3. `POST /api/auth/login` correcto → `200` con cookies; credenciales erróneas → `401 UNAUTHENTICATED` sin revelar si el email existe.
4. `POST /api/auth/refresh` rota el refresh token; reutilizar uno revocado revoca toda la familia y devuelve `401`.
5. `GET /api/auth/me` con cookie o `Bearer` devuelve el usuario; sin credenciales → `401`.
6. `POST /api/auth/logout` → `204` e invalida el refresh token (idempotente).
7. Contraseñas guardadas como hash bcrypt (nunca en claro, nunca en respuestas ni logs).
8. Límites de auth aplicados con `429 RATE_LIMITED` y cabecera `Retry-After`.
9. Suite del monorepo verde: typecheck, lint, test y build.
10. `docs/03-arquitectura/contratos-api.md` y `modelo-datos.md` actualizados en el mismo commit.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Postgres no disponible en la máquina | `npm run db:up` documentado; las tareas de dominio se prueban con el repositorio en memoria |
| Diferencias entre esquema Prisma y `modelo-datos.md` | El documento es la fuente de verdad; la migración inicial solo cubre identidad y se anota el resto |
| npm 11 bloquea *install scripts* | `prisma generate` descarga motores explícitamente y se ejecuta en la tarea S1-T1 |
| Cookies bloqueadas por CORS | `credentials: true` + `sameSite=lax` verificados en S1-T12 con `curl` y navegador |

---

## 7. Fuera de alcance (a propósito)

- Recuperación de contraseña, verificación de email y MFA (requieren proveedor de correo).
- Rate limiting distribuido: la implementación es en memoria y se sustituye en S11.
- Perfil editable y avatar: `users` se completa en S3, cuando exista navegación autenticada.

---

## 8. Bitácora de ejecución (2026-10-26)

| Tarea | Terminal | Verificación ejecutada | Resultado |
|-------|----------|------------------------|-----------|
| S1-T1 | 1 | `prisma migrate dev` + `\dt` | `User`, `RefreshToken` y `_prisma_migrations` creadas |
| S1-T2 | 2 | 15 pruebas de API | Defaults de persistencia/sesión, rechazo de URL no-PostgreSQL y de secreto de desarrollo en producción |
| S1-T3 | 3 | 5 pruebas | Hash `$2b$12$`, sal distinta por hash, hash corrupto → `false` |
| S1-T4 | 4 | 4 pruebas | Cuerpo válido normalizado, `role` extra rechazado, `details[].field` |
| S1-T5 | 5 | 5 pruebas del filtro | Detalles `{ field, message }` conservados en el envelope |
| S1-T6 | 6 | 6 pruebas | Token manipulado, expirado o con rol inventado → `401` |
| S1-T7 | 7 | 8 pruebas de auth | Mapper sin `passwordHash`; `P2002` traducido a error de dominio |
| S1-T8 | 8 | 10 pruebas | Rotación, detección de reutilización y login con mensaje uniforme |
| S1-T9 | 9 | 5 pruebas del guard | Cookie y `Bearer`; `Basic` ignorado; sin credenciales → `401` |
| S1-T10 | 10 | 5 pruebas | `429` con `Retry-After`; claves por IP y por email; ventana reiniciada |
| S1-T11 | 11 | 53 pruebas + build | Módulo conectado a `AppModule` sin errores de DI |
| S1-T12 | 12 | HTTP real con `curl` + PostgreSQL | `201 → 200 → 200 → 204 → 401`, `409` en duplicado, `400` con campos, `429 Retry-After: 899`, hash `$2b$12$` y refresh de 64 hex en la base |
| S1-T13 | 13 | Suite completa del monorepo | Documentación sincronizada y verificación final |

**Desviaciones registradas**

1. **Prisma 6.19.3 fijado.** El tag `latest` de npm apunta a `8.0.0-rc` y la 7 cambia el generador; se fija una versión estable en lugar de arrastrar una release candidate.
2. **PostgreSQL en `localhost:5433`.** El 5432 estaba ocupado por un contenedor de otro proyecto (`aguazul-postgres`); no se detuvo nada ajeno. Actualizado `docker-compose.yml`, `.env.example` y el README.
3. **`bcryptjs` en lugar de `bcrypt`.** Mismo formato bcrypt con coste 12 y sin compilación nativa en Windows/Node 24.
4. **`process.loadEnvFile()` en lugar de `dotenv`.** Node 24 lo incluye; se evita una dependencia.
5. **Reloj del rate limiter por herencia.** Un parámetro de constructor hacía que Nest intentara inyectar `Function`; las pruebas usan una subclase con `override now()`.
6. **`ZodValidationPipe` sin `instanceof`.** La comprobación por comportamiento (`strict`) evita el problema de doble instancia ESM/CJS de Zod entre `shared` y `api`.

---

## Documentos relacionados

- [`../roadmap-sprints.md`](../roadmap-sprints.md)
- [`sprint-00-fundacion.md`](sprint-00-fundacion.md)
- [`../../03-arquitectura/contratos-api.md`](../../03-arquitectura/contratos-api.md)
- [`../../03-arquitectura/modelo-datos.md`](../../03-arquitectura/modelo-datos.md)
- [`../../05-orquestacion/plantilla-tarea.md`](../../05-orquestacion/plantilla-tarea.md)
