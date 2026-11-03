import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { SandboxRunRequest } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import type { DockerCliPort, DockerCommandResult } from "./docker-sandbox.service";
import { DockerSandboxService } from "./docker-sandbox.service";

interface ExecuteInput {
  readonly args: readonly string[];
  readonly timeoutMs: number;
  readonly workspace: string;
}

/** Sandbox guionizado: recibe el argv real y responde lo que diga la prueba. */
class FakeCli implements DockerCliPort {
  readonly calls: ExecuteInput[] = [];
  readonly removed: string[] = [];

  constructor(
    private readonly respond: (
      input: ExecuteInput,
    ) => DockerCommandResult | Promise<DockerCommandResult> = () => ok(),
  ) {}

  async execute(
    args: readonly string[],
    options: { readonly timeoutMs: number },
  ): Promise<DockerCommandResult> {
    const input = { args, timeoutMs: options.timeoutMs, workspace: workspaceOf(args) };

    this.calls.push(input);

    return this.respond(input);
  }

  async forceRemove(containerName: string): Promise<void> {
    this.removed.push(containerName);
  }
}

function workspaceOf(args: readonly string[]): string {
  const volume = args.find((arg) => arg.endsWith(":/work:ro")) ?? "";

  return volume.slice(0, -":/work:ro".length);
}

function ok(stdout = ""): DockerCommandResult {
  return { stdout, stderr: "", exitCode: 0, timedOut: false };
}

function marked(results: readonly unknown[]): DockerCommandResult {
  return ok(`ruido del estudiante\n__CODEAI_RESULTS__${JSON.stringify(results)}\n`);
}

function request(overrides: Partial<SandboxRunRequest> = {}): SandboxRunRequest {
  return {
    language: "javascript",
    files: [{ path: "index.js", content: "function isAdult(age) { return age >= 18; }" }],
    tests: [],
    limits: { timeoutMs: 5_000, memoryMb: 256 },
    ...overrides,
  };
}

describe("DockerSandboxService: límites del contenedor", () => {
  it("lanza el contenedor con los límites del §4 y sin red", async () => {
    const cli = new FakeCli();
    const sandbox = new DockerSandboxService(cli);

    await sandbox.run(request());

    const args = cli.calls[0]?.args ?? [];
    const value = (flag: string): string | undefined => args[args.indexOf(flag) + 1];

    expect(args.slice(0, 2)).toEqual(["run", "--rm"]);
    expect(value("--network")).toBe("none");
    expect(value("--user")).toBe("10001:10001");
    expect(args).toContain("--read-only");
    expect(value("--cap-drop")).toBe("ALL");
    expect(value("--security-opt")).toBe("no-new-privileges");
    expect(value("--pids-limit")).toBe("64");
    expect(value("--cpus")).toBe("0.5");
    expect(value("--memory")).toBe("256m");
    expect(value("--memory-swap")).toBe("256m");
    expect(value("--tmpfs")).toBe("/tmp:size=16m,noexec,nosuid");
    expect(value("--workdir")).toBe("/work");
    expect(value("--name")).toMatch(/^codeai-sbx-[0-9a-f]{16}$/);
    expect(args.at(-1)).toBe("/work/index.js");
  });

  it("acota memoria y tiempo aunque la petición pida más", async () => {
    const cli = new FakeCli();
    const sandbox = new DockerSandboxService(cli);

    await sandbox.run(request({ limits: { timeoutMs: 60_000, memoryMb: 4_096 } }));

    const args = cli.calls[0]?.args ?? [];

    expect(args[args.indexOf("--memory") + 1]).toBe("512m");
    expect(cli.calls[0]?.timeoutMs).toBe(5_000);
  });
});

describe("DockerSandboxService: ejecución libre", () => {
  it("aprueba cuando el proceso termina con éxito", async () => {
    const cli = new FakeCli(() => ok("18\n"));
    const sandbox = new DockerSandboxService(cli);

    const run = await sandbox.run(request());

    expect(run.outcome).toBe("PASSED");
    expect(run.score).toBe(100);
    expect(run.results).toEqual([]);
    expect(run.stdout).toBe("18\n");
  });

  it("devuelve ERROR con el stderr del contenedor cuando el código falla", async () => {
    const cli = new FakeCli(() => ({
      stdout: "",
      stderr: "ReferenceError: isAdult is not defined",
      exitCode: 1,
      timedOut: false,
    }));
    const sandbox = new DockerSandboxService(cli);

    const run = await sandbox.run(request());

    expect(run.outcome).toBe("ERROR");
    expect(run.score).toBe(0);
    expect(run.stderr).toBe("ReferenceError: isAdult is not defined");
  });

  it("trunca la salida a 64 KB", async () => {
    const cli = new FakeCli(() => ok("a".repeat(70_000)));
    const sandbox = new DockerSandboxService(cli);

    const run = await sandbox.run(request());

    expect(run.stdout).toHaveLength(65_536);
  });
});

describe("DockerSandboxService: ejecución con pruebas", () => {
  it("puntúa por peso: una de dos con peso 3 vale 25", async () => {
    const cli = new FakeCli(() =>
      marked([
        { testId: "t1", passed: true, durationMs: 1 },
        { testId: "t2", passed: false, message: "esperaba 404", durationMs: 1 },
      ]),
    );
    const sandbox = new DockerSandboxService(cli);

    const run = await sandbox.run(
      request({
        tests: [
          { id: "t1", code: "assert.strictEqual(isAdult(18), true);", weight: 1 },
          { id: "t2", code: "assert.strictEqual(isAdult(17), false);", weight: 3 },
        ],
      }),
    );

    expect(run.outcome).toBe("PARTIAL");
    expect(run.score).toBe(25);
    expect(run.results).toEqual([
      { testId: "t1", passed: true, durationMs: 1 },
      { testId: "t2", passed: false, message: "esperaba 404", durationMs: 1 },
    ]);
    expect(run.stdout).toBe("ruido del estudiante");
  });

  it("aprueba al 100 cuando pasan todas y falla cuando no pasa ninguna", async () => {
    const passed = new DockerSandboxService(
      new FakeCli(() => marked([{ testId: "t1", passed: true }])),
    );
    const failed = new DockerSandboxService(
      new FakeCli(() => marked([{ testId: "t1", passed: false, message: "boom" }])),
    );
    const tests = [{ id: "t1", code: "assert.ok(true);", weight: 1 }];

    expect((await passed.run(request({ tests }))).outcome).toBe("PASSED");
    expect((await passed.run(request({ tests }))).score).toBe(100);
    expect((await failed.run(request({ tests }))).outcome).toBe("FAILED");
    expect((await failed.run(request({ tests }))).score).toBe(0);
  });

  it("devuelve ERROR si la ejecución no llega a emitir resultados", async () => {
    const cli = new FakeCli(() => ({
      stdout: "",
      stderr: "SyntaxError: Unexpected token",
      exitCode: 1,
      timedOut: false,
    }));
    const sandbox = new DockerSandboxService(cli);

    const run = await sandbox.run(
      request({ tests: [{ id: "t1", code: "assert.ok(true);", weight: 1 }] }),
    );

    expect(run.outcome).toBe("ERROR");
    expect(run.stderr).toBe("SyntaxError: Unexpected token");
  });

  it("escribe el arnés con la solución y las pruebas en un archivo aparte", async () => {
    let check = "";

    const cli = new FakeCli(({ workspace }) => {
      check = readFileSync(join(workspace, ".codeai", "check.mjs"), "utf8");

      return marked([{ testId: "t1", passed: true }]);
    });
    const sandbox = new DockerSandboxService(cli);

    await sandbox.run(
      request({
        files: [
          { path: "index.js", content: "function isAdult(age) { return age >= 18; }" },
          { path: "lib/helpers.js", content: "const uno = 1;" },
        ],
        tests: [{ id: "t1", code: "assert.strictEqual(isAdult(18), true);", weight: 1 }],
      }),
    );

    expect(check).toContain("function isAdult(age) { return age >= 18; }");
    expect(check).toContain("assert.strictEqual(isAdult(18), true);");
    expect(check).toContain('require("node:assert")');
    expect(cli.calls[0]?.args.at(-1)).toBe("/work/.codeai/check.mjs");
  });

  it("acepta la aserción serializada del contrato y el código suelto", async () => {
    let check = "";
    const cli = new FakeCli(({ workspace }) => {
      check = readFileSync(join(workspace, ".codeai", "check.mjs"), "utf8");

      return marked([{ testId: "t1", passed: true }]);
    });
    const sandbox = new DockerSandboxService(cli);

    await sandbox.run(
      request({
        tests: [
          { id: "t1", code: JSON.stringify({ code: "assert.ok(true);" }), weight: 1 },
          { id: "t2", code: "assert.ok(false);", weight: 1 },
        ],
      }),
    );

    expect(check).toContain("assert.ok(true);");
    expect(check).toContain("assert.ok(false);");
  });

  it("ejecuta TypeScript con el arnés en .ts (Node 22 quita los tipos)", async () => {
    const cli = new FakeCli(() => marked([{ testId: "t1", passed: true }]));
    const sandbox = new DockerSandboxService(cli);

    await sandbox.run(
      request({
        language: "typescript",
        files: [{ path: "index.ts", content: "function n(a: number): number { return a; }" }],
        tests: [{ id: "t1", code: "assert.strictEqual(n(1), 1);", weight: 1 }],
      }),
    );

    expect(cli.calls[0]?.args.at(-1)).toBe("/work/.codeai/check.mts");
  });
});

describe("DockerSandboxService: tiempo agotado y limpieza", () => {
  it("responde TIMEOUT cuando el contenedor excede el tiempo", async () => {
    const cli = new FakeCli(() => ({ stdout: "", stderr: "", exitCode: -1, timedOut: true }));
    const sandbox = new DockerSandboxService(cli);
    const run = await sandbox.run(
      request({ files: [{ path: "index.js", content: "while (true) {}" }] }),
    );

    expect(run.outcome).toBe("TIMEOUT");
    expect(run.score).toBe(0);
    expect(run.stderr).toContain("5 s");
  });

  it("destruye el contenedor y borra el directorio aunque la ejecución lance", async () => {
    let workspace = "";
    const cli = new FakeCli((input) => {
      workspace = input.workspace;

      throw new Error("daemon caído");
    });
    const sandbox = new DockerSandboxService(cli);

    const run = await sandbox.run(request());

    expect(run.outcome).toBe("ERROR");
    expect(run.stderr).toContain("no está disponible");
    expect(cli.removed).toHaveLength(1);
    expect(cli.removed[0]).toMatch(/^codeai-sbx-/);
    expect(existsSync(workspace)).toBe(false);
  });

  it("destruye el contenedor también cuando todo va bien", async () => {
    const cli = new FakeCli(() => ok());
    const sandbox = new DockerSandboxService(cli);

    await sandbox.run(request());

    expect(cli.removed).toHaveLength(1);
    expect(cli.removed[0]).toBe(cli.calls[0]?.args[cli.calls[0].args.indexOf("--name") + 1]);
  });

  it("publica su estado como adaptador docker", () => {
    expect(new DockerSandboxService(new FakeCli()).status()).toEqual({
      provider: "docker",
      mode: "docker",
    });
  });
});

describe("DockerSandboxService: peticiones rechazadas sin contenedor", () => {
  it("rechaza rutas que se salen del directorio temporal", async () => {
    const cli = new FakeCli();
    const sandbox = new DockerSandboxService(cli);

    const run = await sandbox.run(
      request({ files: [{ path: "../../etc/passwd", content: "root" }] }),
    );

    expect(run.outcome).toBe("ERROR");
    expect(run.stderr).toContain("ruta");
    expect(cli.calls).toHaveLength(0);
  });

  it("rechaza rutas absolutas y de unidad de Windows", async () => {
    const sandbox = new DockerSandboxService(new FakeCli());

    for (const path of ["/etc/passwd", "C:\\Windows\\win.ini"]) {
      const run = await sandbox.run(request({ files: [{ path, content: "x" }] }));

      expect(run.outcome).toBe("ERROR");
    }
  });

  it("no ejecuta SQL: no hay motor de base de datos sin red", async () => {
    const cli = new FakeCli();
    const sandbox = new DockerSandboxService(cli);

    const run = await sandbox.run(
      request({ language: "sql", files: [{ path: "query.sql", content: "select 1" }] }),
    );

    expect(run.outcome).toBe("ERROR");
    expect(run.stderr).toContain("SQL");
    expect(cli.calls).toHaveLength(0);
  });
});
