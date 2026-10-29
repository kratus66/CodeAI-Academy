# Runbook de operación

> Respaldos, restauración, despliegue y comprobaciones de salud. Creado en S11-T14.

---

## 1. Salud del servicio

| Ruta | Pregunta que responde | Qué hacer si falla |
|------|----------------------|--------------------|
| `GET /api/health` | ¿Vive el proceso? | Reiniciar el contenedor |
| `GET /api/health/ready` | ¿Puede atender (base disponible)? | **No** reiniciar: revisar PostgreSQL. Reiniciar un proceso vivo sin base solo empeora la caída |

`ready` responde `503` con `status: "degraded"` y nunca incluye cadena de conexión, host ni usuario.

Logs: una línea por petición con `traceId`, método, ruta normalizada, estado y `durationMs`. `SLOW_REQUEST` aparece por encima de 500 ms (1500 ms en rutas de IA). Para seguir una petición, enviar `x-trace-id: <id>` y filtrar el log por ese valor. `LOG_LEVEL=warn` silencia las líneas informativas pero no los `SLOW_REQUEST`.

---

## 2. Respaldos

```bash
npm run db:backup
# → backups/<fecha>.sql.gz   (carpeta ignorada por git)
```

Ejecuta `pg_dump` dentro del contenedor `codeai-postgres` y comprime en el host. Variables opcionales: `PG_CONTAINER`, `PG_USER`, `PG_DATABASE`, `BACKUP_DIR`. El script falla si el archivo queda vacío.

**Objetivo declarado (modesto, una instancia):** RPO = 24 h (un respaldo diario), RTO = 30 min. Programar `npm run db:backup` diario y copiar `backups/` fuera del servidor.

## 3. Restauración y simulacro

```bash
npm run db:restore -- backups/<fecha>.sql.gz            # destino: codeai_restore_test
npm run db:restore -- backups/<fecha>.sql.gz otra_base   # destino explícito
```

Restaura **solo en una base desechable** (se recrea) y rechaza la base de trabajo. Al terminar compara el conteo de `User`, `Unit` y `Lesson` entre origen y destino. Un respaldo que no se ha restaurado no es un respaldo: repetir el simulacro tras cada cambio de esquema.

**Restaurar en producción tras una pérdida:** detener `api`, crear la base vacía, volcar el `.sql.gz` con `gunzip -c <archivo> | docker exec -i <contenedor> psql -U <usuario> -d <base>`, comprobar conteos y levantar `api`.

### Simulacro registrado

| Fecha | Archivo | Tamaño | Duración restauración | `User` | `Unit` | `Lesson` |
|-------|---------|--------|----------------------|--------|--------|----------|
| 2026-10-29 | `backups/2026-10-29T17-30-39-558Z.sql.gz` | 1 215 378 B | ~4 s | 32 = 32 | 207 = 207 | 207 = 207 |

---

## 4. Despliegue

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

`.env.prod` vive fuera del repositorio. Variables obligatorias (el compose falla si faltan): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `WEB_ORIGIN`, `AI_API_KEY`, `NEXT_PUBLIC_API_URL`. `NEXT_PUBLIC_API_URL` se incrusta al **compilar** la web: cambiarla exige reconstruir la imagen.

Migraciones tras desplegar una versión con cambios de esquema: `npm run db:deploy -w @codeai/api` con `DATABASE_URL` de producción.

### Checklist de producción

- [ ] `JWT_SECRET` propio de al menos 32 caracteres (la API rechaza el de desarrollo).
- [ ] `WEB_ORIGIN` y `NEXT_PUBLIC_API_URL` con `https://`; las cookies de sesión son `Secure` y no viajan sin TLS.
- [ ] `AI_PROVIDER=openai` con `AI_API_KEY` y `AI_MONTHLY_BUDGET_USD` definidos (la API rechaza `mock`).
- [ ] `SANDBOX_MODE=docker` (la API rechaza cualquier otro valor en producción).
- [ ] `POSTGRES_PASSWORD` fuerte; el puerto 5432 no se publica.
- [ ] `db:backup` programado y simulacro de restauración hecho.
- [ ] `GET /api/health/ready` devuelve `200` tras el arranque.

> **Bloqueo conocido (2026-10-29):** `SANDBOX_MODE=docker` aún no tiene adaptador: `SandboxModule` solo implementa `mock` y lanza al arrancar con cualquier otro valor. Hasta construir el adaptador aislado (`sandbox-ejecucion.md`), la API no arranca con `NODE_ENV=production`. El checklist no puede firmarse.
