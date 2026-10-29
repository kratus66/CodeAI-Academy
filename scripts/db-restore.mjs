// Restaura un respaldo `.sql.gz` en una base DESECHABLE (nunca en la de trabajo).
// Uso: npm run db:restore -- backups/<fecha>.sql.gz [codeai_restore_test]
import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";

const [file, target = "codeai_restore_test"] = process.argv.slice(2);
const container = process.env.PG_CONTAINER ?? "codeai-postgres";
const user = process.env.PG_USER ?? "codeai";
const workDb = process.env.PG_DATABASE ?? "codeai";

if (!file) {
  console.error("Uso: npm run db:restore -- <archivo.sql.gz> [base_desechable]");
  process.exit(1);
}
if (target === workDb || !/^[a-z0-9_]+$/.test(target)) {
  console.error(`Base destino no válida o igual a la de trabajo: ${target}`);
  process.exit(1);
}

const psql = (database, args, input) =>
  spawnSync("docker", ["exec", "-i", container, "psql", "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", ...args], {
    input,
    encoding: "utf8",
  });

for (const sql of [`DROP DATABASE IF EXISTS ${target}`, `CREATE DATABASE ${target}`]) {
  const res = psql("postgres", ["-c", sql]);
  if (res.status !== 0) {
    console.error(res.stderr);
    process.exit(1);
  }
}

const restore = spawn(
  "docker",
  ["exec", "-i", container, "psql", "-q", "-U", user, "-d", target, "-v", "ON_ERROR_STOP=1"],
  { stdio: ["pipe", "ignore", "inherit"] },
);
createReadStream(file).pipe(createGunzip()).pipe(restore.stdin);
const code = await new Promise((resolve) => restore.on("close", resolve));
if (code !== 0) {
  console.error(`Restauración fallida (psql código ${code}).`);
  process.exit(1);
}

const tables = ["User", "Unit", "Lesson"];
for (const table of tables) {
  const count = (db) => psql(db, ["-t", "-A", "-c", `SELECT count(*) FROM "${table}"`]).stdout.trim();
  const [original, restored] = [count(workDb), count(target)];
  console.log(`${table}: original=${original} restaurada=${restored} ${original === restored ? "OK" : "DIFIERE"}`);
}
console.log(`Restaurado en ${target}.`);
