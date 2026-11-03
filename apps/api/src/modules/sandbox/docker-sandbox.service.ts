import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import type {
  SandboxRunRequest,
  SandboxRunResponse,
  SandboxTestResult,
} from "@codeai/shared";
import { Injectable } from "@nestjs/common";

import type { SandboxService, SandboxStatus } from "./sandbox.service";

/**
 * Adaptador `docker` del sandbox (`sandbox-ejecucion.md` §4 y §5).
 *
 * Ejecuta en un contenedor efímero con los límites del §4 y destruye el
 * contenedor **siempre**, también cuando la ejecución se pasa de tiempo o falla.
 * La única dependencia externa es el binario `docker` del host: este adaptador no
 * importa ningún SDK, así que una caída del daemon se traduce en `ERROR` y no en
 * una excepción que tumbe la API.
 *
 * El código del estudiante nunca se evalúa en el proceso de la API: se escribe en
 * un directorio temporal que se monta **de sólo lectura** en `/work` (más
 * estricto que el `tmpfs` del §4) y sólo lo lee `node` dentro del contenedor.
 *
 * Las pruebas ocultas viajan en `/work/.codeai`, un archivo que el código del
 * estudiante podría leer: el camino de fuga está cerrado en `exercises`, que sólo
 * mapea `results` y nunca publica el `stdout` de un envío. Exponer ese `stdout`
 * exigiría mover el arnés fuera del alcance del contenedor antes de hacerlo.
 */
@Injectable()
export class DockerSandboxService implements SandboxService {
  constructor(private readonly cli: DockerCliPort = new DockerCli()) {}

  status(): SandboxStatus {
    return { provider: "docker", mode: "docker" };
  }

  async run(request: SandboxRunRequest): Promise<SandboxRunResponse> {
    const startedAt = Date.now();
    const entry = plan(request);

    if ("error" in entry) {
      return failure(entry.error, startedAt);
    }

    let workspace: string;

    try {
      workspace = await mkdtemp(join(tmpdir(), WORKSPACE_PREFIX));
    } catch {
      return failure(SERVICE_DOWN_MESSAGE, startedAt);
    }

    const containerName = `${CONTAINER_PREFIX}${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    let launched = false;

    try {
      const command = await this.prepare(workspace, entry);

      launched = true;

      const result = await this.cli.execute(
        dockerArgs({
          containerName,
          workspace,
          command,
          memoryMb: clampMemory(request.limits.memoryMb),
        }),
        { timeoutMs: clampTimeout(request.limits.timeoutMs) },
      );

      return this.interpret(request, result, startedAt);
    } catch {
      return failure(SERVICE_DOWN_MESSAGE, startedAt);
    } finally {
      if (launched) {
        await this.cli.forceRemove(containerName);
      }

      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * Escribe la solicitud en el directorio que verá el contenedor y devuelve el
   * comando que debe ejecutar `node` dentro de `/work`.
   */
  private async prepare(
    workspace: string,
    entry: PlannedRun,
  ): Promise<readonly string[]> {
    for (const file of entry.files) {
      const target = join(workspace, file.path);

      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }

    if (entry.tests.length === 0) {
      return [containerPath(entry.entryPath)];
    }

    const patch = join(workspace, PATCH_DIR);
    const checkName = entry.language === "typescript" ? CHECK_TS : CHECK_JS;

    await mkdir(patch, { recursive: true });
    await writeFile(
      join(patch, checkName),
      buildCheckFile(entry.entryContent, entry.tests),
      "utf8",
    );

    return [containerPath(PATCH_DIR, checkName)];
  }

  /** Traduce la salida del contenedor al contrato (`sandbox-ejecucion.md` §6). */
  private interpret(
    request: SandboxRunRequest,
    result: DockerCommandResult,
    startedAt: number,
  ): SandboxRunResponse {
    const stdout = truncate(result.stdout);
    const stderr = truncate(result.stderr);
    const durationMs = Date.now() - startedAt;

    if (result.timedOut) {
      return {
        outcome: "TIMEOUT",
        score: 0,
        results: [],
        stdout,
        stderr: TIMEOUT_MESSAGE,
        durationMs,
      };
    }

    if (request.tests.length === 0) {
      return result.exitCode === 0
        ? { outcome: "PASSED", score: 100, results: [], stdout, stderr, durationMs }
        : {
            outcome: "ERROR",
            score: 0,
            results: [],
            stdout,
            stderr: stderr === "" ? RUN_FAILED_MESSAGE : stderr,
            durationMs,
          };
    }

    const results = readResults(stdout);

    if (results === null) {
      return {
        outcome: "ERROR",
        score: 0,
        results: [],
        stdout,
        stderr: stderr === "" ? CHECK_FAILED_MESSAGE : stderr,
        durationMs,
      };
    }

    return {
      outcome: outcomeOf(results),
      score: scoreOf(results, request.tests),
      results,
      stdout: stripMarker(stdout),
      stderr,
      durationMs,
    };
  }
}

/** Imagen del contenedor. Requiere Node ≥ 22 para ejecutar TypeScript sin `tsc`. */
const SANDBOX_IMAGE = "node:22-alpine";
const DOCKER_BINARY = "docker";
const CONTAINER_PREFIX = "codeai-sbx-";
const WORKSPACE_PREFIX = "codeai-sbx-";
const CONTAINER_WORKDIR = "/work";
/** Subdirectorio del arnés de pruebas; no lo ve el estudiante. */
const PATCH_DIR = ".codeai";
/** El arnés es ESM (`.mjs`/`.mts`): admite `export` en la solución y `require` simulado. */
const CHECK_JS = "check.mjs";
const CHECK_TS = "check.mts";
/** Prefijo de la línea con los resultados; el resto de `stdout` es del estudiante. */
const RESULT_MARKER = "__CODEAI_RESULTS__";
/** §4: usuario sin privilegios, procesos, CPU y `/tmp` acotados. */
const CONTAINER_USER = "10001:10001";
const PIDS_LIMIT = "64";
const CPU_LIMIT = "0.5";
const TMPFS = "/tmp:size=16m,noexec,nosuid";
/** §4 y §7: salida truncada a 64 KB. */
const OUTPUT_LIMIT_BYTES = 65_536;
const MESSAGE_MAX_CHARS = 500;
const MAX_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 500;
const MAX_MEMORY_MB = 512;
const MIN_MEMORY_MB = 64;
const REMOVE_TIMEOUT_MS = 15_000;
/** Igual que `sandboxFileSchema`: una ruta más larga no vino ofrecida al sandbox. */
const FILE_PATH_MAX_CHARS = 200;

const SERVICE_DOWN_MESSAGE =
  "El servicio de ejecución no está disponible. Inténtalo en un minuto.";
const TIMEOUT_MESSAGE =
  "Tu solución tardó más de 5 s. Revisa bucles y llamadas repetidas.";
const RUN_FAILED_MESSAGE = "Tu solución no terminó correctamente.";
const CHECK_FAILED_MESSAGE =
  "No se pudo ejecutar la comprobación: revisa la sintaxis de tu solución.";

/** Ficheros ya validados y el punto de entrada que ejecuta el contenedor. */
interface PlannedRun {
  readonly files: readonly { readonly path: string; readonly content: string }[];
  readonly tests: readonly { readonly id: string; readonly code: string }[];
  readonly language: SandboxRunRequest["language"];
  readonly entryPath: string;
  readonly entryContent: string;
}

/**
 * Valida las rutas antes de escribirlas en el host: un `path` con `..` o
 * absoluto escribiría fuera del directorio temporal (§1 y §7).
 */
function plan(request: SandboxRunRequest): PlannedRun | { readonly error: string } {
  if (request.language === "sql") {
    return {
      error:
        "El sandbox todavía no ejecuta SQL: sus pruebas se escriben en JavaScript.",
    };
  }

  const files: { path: string; content: string }[] = [];

  for (const file of request.files) {
    const path = safeRelativePath(file.path);

    if (path === null) {
      return { error: "La ruta de un archivo no es válida." };
    }

    files.push({ path, content: file.content });
  }

  const entry =
    files.find((file) => ENTRY_FILE.test(file.path)) ??
    files[0];

  if (entry === undefined) {
    return { error: "La solicitud no incluye ningún archivo." };
  }

  return {
    files,
    language: request.language,
    tests: request.tests.map((test) => ({ id: test.id, code: testCode(test.code) })),
    entryPath: entry.path,
    entryContent: entry.content,
  };
}

const ENTRY_FILE = /(^|\/)index\.(js|cjs|mjs|ts)$/i;

/** Normaliza la ruta y rechaza lo que se salga del directorio temporal. */
function safeRelativePath(rawPath: string): string | null {
  const normalized = rawPath.replace(/\\/g, "/").trim();

  if (normalized === "" || normalized.length > FILE_PATH_MAX_CHARS) {
    return null;
  }

  if (normalized.startsWith("/") || isAbsolute(rawPath) || DRIVE_PATH.test(normalized)) {
    return null;
  }

  const segments = normalized.split("/");

  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }

  return segments.join("/");
}

const DRIVE_PATH = /^[a-z]:/i;

/**
 * El contrato envía la aserción serializada (`{ code }`); se acepta también el
 * código suelto para no atar el adaptador a una única forma.
 */
function testCode(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "code" in parsed &&
      typeof parsed.code === "string"
    ) {
      return parsed.code;
    }
  } catch {
    return raw;
  }

  return raw;
}

/**
 * Rutas de dentro del contenedor: siempre POSIX. `path.join` usaría `\` en un
 * host Windows y el contenedor (Linux) no encontraría el archivo.
 */
function containerPath(...segments: readonly string[]): string {
  return [CONTAINER_WORKDIR, ...segments].join("/");
}

/** Argumentos del contenedor efímero: límites del §4, sin red y sin privilegios. */
function dockerArgs(input: {
  readonly containerName: string;
  readonly workspace: string;
  readonly command: readonly string[];
  readonly memoryMb: number;
}): readonly string[] {
  return [
    "run",
    "--rm",
    "--name",
    input.containerName,
    "--network",
    "none",
    "--user",
    CONTAINER_USER,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    PIDS_LIMIT,
    "--cpus",
    CPU_LIMIT,
    "--memory",
    `${input.memoryMb}m`,
    "--memory-swap",
    `${input.memoryMb}m`,
    "--tmpfs",
    TMPFS,
    "--volume",
    `${input.workspace}:${CONTAINER_WORKDIR}:ro`,
    "--workdir",
    CONTAINER_WORKDIR,
    SANDBOX_IMAGE,
    "node",
    ...input.command,
  ];
}

/**
 * Arnés de pruebas: la solución y las aserciones conviven en el mismo módulo, así
 * que las funciones del estudiante quedan a la vista de su prueba sin `export`.
 * Cada prueba se evalúa en su propio `try` para que un fallo no oculte los demás.
 */
function buildCheckFile(
  entryContent: string,
  tests: readonly { readonly id: string; readonly code: string }[],
): string {
  const lines: string[] = [
    "// Arnés del sandbox de CodeAI: solución del estudiante + sus pruebas.",
    'import { createRequire } from "node:module";',
    "const require = createRequire(import.meta.url);",
    "const module = { exports: {} };",
    "const exports = module.exports;",
    'const assert = require("node:assert");',
    "",
    entryContent,
    "",
    "const __codeaiResults = [];",
    "async function __codeaiCheck(testId, body) {",
    "  const startedAt = Date.now();",
    "",
    "  try {",
    "    await body();",
    "    __codeaiResults.push({ testId, passed: true, durationMs: Date.now() - startedAt });",
    "  } catch (error) {",
    "    const message = error instanceof Error ? error.message : String(error);",
    "    __codeaiResults.push({",
    "      testId,",
    "      passed: false,",
    `      message: message.slice(0, ${MESSAGE_MAX_CHARS}),`,
    "      durationMs: Date.now() - startedAt,",
    "    });",
    "  }",
    "}",
    "",
    "async function __codeaiMain() {",
  ];

  for (const test of tests) {
    lines.push(
      `  await __codeaiCheck(${JSON.stringify(test.id)}, async () => {`,
      test.code,
      "  });",
    );
  }

  lines.push(
    `  console.log(${JSON.stringify(RESULT_MARKER)} + JSON.stringify(__codeaiResults));`,
    "}",
    "",
    "__codeaiMain().catch((error) => {",
    "  console.error(error instanceof Error ? error.message : String(error));",
    "  process.exitCode = 1;",
    "});",
  );

  return `${lines.join("\n")}\n`;
}

/** Lee la línea de resultados del arnés; `null` si la ejecución no llegó a emitirla. */
function readResults(stdout: string): SandboxTestResult[] | null {
  const lines = stdout.split(/\r?\n/);
  let payload: string | null = null;

  for (const line of lines) {
    if (line.startsWith(RESULT_MARKER)) {
      payload = line.slice(RESULT_MARKER.length);
    }
  }

  if (payload === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(payload);

    return Array.isArray(parsed) ? parsed.filter(isTestResult) : null;
  } catch {
    return null;
  }
}

function isTestResult(value: unknown): value is SandboxTestResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { testId?: unknown; passed?: unknown; message?: unknown };

  return (
    typeof candidate.testId === "string" &&
    typeof candidate.passed === "boolean" &&
    (candidate.message === undefined || typeof candidate.message === "string")
  );
}

/** §6: todas pasan → `PASSED`, algunas → `PARTIAL`, ninguna → `FAILED`. */
function outcomeOf(results: readonly SandboxTestResult[]): SandboxRunResponse["outcome"] {
  const passed = results.filter((result) => result.passed).length;

  if (results.length === 0) {
    return "ERROR";
  }

  if (passed === results.length) {
    return "PASSED";
  }

  return passed === 0 ? "FAILED" : "PARTIAL";
}

/** Nota ponderada por `weight`: una prueba que no se ejecutó no suma. */
function scoreOf(
  results: readonly SandboxTestResult[],
  tests: SandboxRunRequest["tests"],
): number {
  const passed = new Set(
    results.filter((result) => result.passed).map((result) => result.testId),
  );
  let total = 0;
  let earned = 0;

  for (const test of tests) {
    const weight = test.weight > 0 ? test.weight : 1;

    total += weight;

    if (passed.has(test.id)) {
      earned += weight;
    }
  }

  return total === 0 ? 0 : Math.round((earned / total) * 100);
}

/** El marcador es interno: el estudiante sólo ve la salida de su propio código. */
function stripMarker(stdout: string): string {
  return stdout
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(RESULT_MARKER))
    .join("\n")
    .trimEnd();
}

function truncate(text: string): string {
  return text.length > OUTPUT_LIMIT_BYTES ? text.slice(0, OUTPUT_LIMIT_BYTES) : text;
}

function clampTimeout(value: number): number {
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(value)));
}

function clampMemory(value: number): number {
  return Math.min(MAX_MEMORY_MB, Math.max(MIN_MEMORY_MB, Math.round(value)));
}

function failure(message: string, startedAt: number): SandboxRunResponse {
  return {
    outcome: "ERROR",
    score: 0,
    results: [],
    stderr: message,
    durationMs: Date.now() - startedAt,
  };
}

/** Resultado de una invocación del binario `docker`. */
export interface DockerCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly timedOut: boolean;
}

/**
 * Puerto de proceso del adaptador. Existe para poder probar los límites, el
 * tiempo agotado y la limpieza sin un daemon de Docker en el CI.
 */
export interface DockerCliPort {
  execute(
    args: readonly string[],
    options: { readonly timeoutMs: number },
  ): Promise<DockerCommandResult>;
  /** Destruye el contenedor; no lanza nunca, para que el `finally` sea seguro. */
  forceRemove(containerName: string): Promise<void>;
}

/** Implementación real: el binario `docker` del host, sin SDK intermedio. */
export class DockerCli implements DockerCliPort {
  execute(
    args: readonly string[],
    options: { readonly timeoutMs: number },
  ): Promise<DockerCommandResult> {
    return new Promise<DockerCommandResult>((done) => {
      const child = spawn(DOCKER_BINARY, [...args], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout = new ByteCollector(OUTPUT_LIMIT_BYTES);
      const stderr = new ByteCollector(OUTPUT_LIMIT_BYTES);
      let timedOut = false;
      let settled = false;

      const settle = (result: DockerCommandResult): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        done(result);
      };

      // Matar al cliente no mata al contenedor: de eso se encarga `forceRemove`.
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.on("error", () =>
        settle({ stdout: stdout.text(), stderr: stderr.text(), exitCode: -1, timedOut }),
      );
      child.on("close", (code) =>
        settle({ stdout: stdout.text(), stderr: stderr.text(), exitCode: code ?? -1, timedOut }),
      );
    });
  }

  forceRemove(containerName: string): Promise<void> {
    return new Promise<void>((done) => {
      const child = spawn(DOCKER_BINARY, ["rm", "--force", containerName], {
        windowsHide: true,
        stdio: "ignore",
      });
      let settled = false;

      const settle = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        done();
      };

      const timer = setTimeout(settle, REMOVE_TIMEOUT_MS);

      child.on("error", settle);
      child.on("close", settle);
    });
  }
}

/** Acumula hasta `limit` bytes: una salida infinita no puede agotar la memoria. */
class ByteCollector {
  private readonly chunks: Buffer[] = [];
  private size = 0;

  constructor(private readonly limit: number) {}

  push(chunk: Buffer): void {
    if (this.size >= this.limit) {
      return;
    }

    const room = this.limit - this.size;
    const slice = chunk.length > room ? chunk.subarray(0, room) : chunk;

    this.chunks.push(slice);
    this.size += slice.length;
  }

  text(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

