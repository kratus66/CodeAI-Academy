// Respaldo de PostgreSQL: `pg_dump` dentro del contenedor, comprimido en el host.
// Uso: npm run db:backup  →  backups/<fecha>.sql.gz
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createGzip } from "node:zlib";

const container = process.env.PG_CONTAINER ?? "codeai-postgres";
const user = process.env.PG_USER ?? "codeai";
const database = process.env.PG_DATABASE ?? "codeai";
const dir = process.env.BACKUP_DIR ?? "backups";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = join(dir, `${stamp}.sql.gz`);
mkdirSync(dir, { recursive: true });

const dump = spawn(
  "docker",
  ["exec", container, "pg_dump", "-U", user, "--no-owner", "--clean", "--if-exists", database],
  { stdio: ["ignore", "pipe", "inherit"] },
);
const out = createWriteStream(file);
dump.stdout.pipe(createGzip()).pipe(out);

const [code] = await Promise.all([
  new Promise((resolve) => dump.on("close", resolve)),
  new Promise((resolve) => out.on("close", resolve)),
]);

const size = statSync(file).size;
if (code !== 0 || size === 0) {
  console.error(`Respaldo fallido (pg_dump código ${code}, ${size} bytes).`);
  process.exit(1);
}
console.log(`Respaldo creado: ${file} (${size} bytes)`);
