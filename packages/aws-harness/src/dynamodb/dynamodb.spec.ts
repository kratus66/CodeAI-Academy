import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import { canary, capabilities, planAccessPatterns, validateTable } from "./index.js";
import type { AccessPattern, TableModel } from "./index.js";

const table: TableModel = {
  partitionKey: "pk",
  sortKey: "sk",
  gsis: [
    { name: "porEstado", partitionKey: "estado", sortKey: "fecha", projection: { type: "KEYS_ONLY" } },
    { name: "porEmail", partitionKey: "email", projection: { type: "ALL" } },
  ],
  lsis: [{ name: "porTotal", sortKey: "total", projection: { type: "INCLUDE", attributes: ["moneda"] } }],
};

function plan(pattern: AccessPattern) {
  const [result] = planAccessPatterns(table, [pattern]);
  if (result === undefined) {
    throw new Error("sin plan");
  }
  return result;
}

describe("dynamodb: registro y capacidades", () => {
  it("se registra en el arnés y pasa su canario", () => {
    expect(canary()).toBe(true);
    expect(aws.dynamodb.capabilities).toBe(capabilities);
    expect(listCapabilities().map((item) => item.name)).toContain("dynamodb");
    expect(selfTest()).toBe(true);
  });

  it("declara que no modela Scan y solo cita fuentes oficiales de DynamoDB", () => {
    expect(capabilities.name).toBe("dynamodb");
    expect(capabilities.notModeled.some((item) => item.includes("Scan"))).toBe(true);
    expect(
      capabilities.sources.every((url) => url.startsWith("https://docs.aws.amazon.com/amazondynamodb/")),
    ).toBe(true);
  });
});

describe("dynamodb: validateTable", () => {
  it("acepta una tabla válida y rechaza entradas inválidas sin lanzar", () => {
    expect(validateTable(table)).toEqual([]);
    expect(validateTable(null)).toHaveLength(1);
    expect(validateTable("tabla")[0]).toContain("objeto");
    expect(validateTable({})[0]).toContain("clave de partición");
  });

  it("detecta claves repetidas, nombres de índice duplicados y proyecciones incompletas", () => {
    expect(validateTable({ partitionKey: "a", sortKey: "a" })[0]).toContain("mismo atributo");
    const duplicados = validateTable({
      partitionKey: "a",
      gsis: [
        { name: "x", partitionKey: "b", projection: { type: "ALL" } },
        { name: "x", partitionKey: "c", projection: { type: "ALL" } },
      ],
    });
    expect(duplicados.join(" ")).toContain("repetido");
    const incluir = validateTable({
      partitionKey: "a",
      gsis: [{ name: "x", partitionKey: "b", projection: { type: "INCLUDE" } }],
    });
    expect(incluir.join(" ")).toContain("INCLUDE");
    const rara = validateTable({
      partitionKey: "a",
      gsis: [{ name: "x", partitionKey: "b", projection: { type: "ALGUNOS" } }],
    });
    expect(rara.join(" ")).toContain("KEYS_ONLY, INCLUDE o ALL");
  });

  it("un índice local comparte la clave de partición de la tabla", () => {
    const problems = validateTable({
      partitionKey: "a",
      sortKey: "b",
      lsis: [{ name: "x", partitionKey: "otra", sortKey: "c", projection: { type: "ALL" } }],
    });
    expect(problems.join(" ")).toContain("comparte la clave de partición");
  });
});

describe("dynamodb: planAccessPatterns", () => {
  it("elige GetItem con la clave primaria completa y Query con la clave de partición sola", () => {
    expect(
      plan({
        name: "a",
        keyCondition: [
          { attribute: "pk", operator: "=" },
          { attribute: "sk", operator: "=" },
        ],
      }),
    ).toEqual({ operation: "GetItem", index: null, problems: [] });
    expect(plan({ name: "b", keyCondition: [{ attribute: "pk", operator: "=" }] }).operation).toBe("Query");
    expect(
      plan({
        name: "c",
        keyCondition: [
          { attribute: "pk", operator: "=" },
          { attribute: "sk", operator: "begins_with" },
        ],
      }).operation,
    ).toBe("Query");
  });

  it("elige el índice cuyas claves encajan y nunca devuelve Scan", () => {
    expect(plan({ name: "d", keyCondition: [{ attribute: "email", operator: "=" }] })).toEqual({
      operation: "Query",
      index: "porEmail",
      problems: [],
    });
    expect(
      plan({
        name: "e",
        keyCondition: [
          { attribute: "estado", operator: "=" },
          { attribute: "fecha", operator: ">" },
        ],
      }).index,
    ).toBe("porEstado");
    expect(
      plan({
        name: "f",
        keyCondition: [
          { attribute: "pk", operator: "=" },
          { attribute: "total", operator: ">=" },
        ],
      }).index,
    ).toBe("porTotal");
    const scan = plan({ name: "g", keyCondition: [{ attribute: "nombre", operator: "=" }] });
    expect(scan.operation).toBeNull();
    expect(scan.index).toBeNull();
    expect(scan.problems[0]).toContain("Scan");
  });

  it("prefiere un índice cuya proyección cubre los atributos requeridos", () => {
    const tabla: TableModel = {
      partitionKey: "pk",
      gsis: [
        { name: "corto", partitionKey: "tipo", projection: { type: "KEYS_ONLY" } },
        { name: "completo", partitionKey: "tipo", projection: { type: "ALL" } },
      ],
    };
    const [resultado] = planAccessPatterns(tabla, [
      { name: "h", keyCondition: [{ attribute: "tipo", operator: "=" }], requiredAttributes: ["precio"] },
    ]);
    expect(resultado).toEqual({ operation: "Query", index: "completo", problems: [] });
  });

  it("con índice explícito: inexistente o con condición que no encaja", () => {
    const inexistente = plan({ name: "i", index: "nada", keyCondition: [{ attribute: "pk", operator: "=" }] });
    expect(inexistente.operation).toBeNull();
    expect(inexistente.problems[0]).toContain("«nada»");
    const noEncaja = plan({ name: "j", index: "porEmail", keyCondition: [{ attribute: "pk", operator: "=" }] });
    expect(noEncaja.operation).toBeNull();
    expect(noEncaja.problems.join(" ")).toContain("«email»");
  });

  it("explica la proyección incompleta de un GSI y de un LSI", () => {
    const gsi = plan({
      name: "k",
      index: "porEstado",
      keyCondition: [{ attribute: "estado", operator: "=" }],
      requiredAttributes: ["pk", "fecha", "nombre"],
    });
    expect(gsi.operation).toBe("Query");
    expect(gsi.problems[0]).toContain("«nombre»");
    expect(gsi.problems[0]).toContain("tabla base");
    const lsi = plan({
      name: "l",
      index: "porTotal",
      keyCondition: [{ attribute: "pk", operator: "=" }],
      requiredAttributes: ["moneda", "sk", "nombre"],
    });
    expect(lsi.problems[0]).toContain("mayor latencia");
    expect(lsi.problems[0]).not.toContain("«moneda»");
  });

  it("repite o malforma las condiciones sin lanzar", () => {
    expect(
      plan({
        name: "m",
        keyCondition: [
          { attribute: "pk", operator: "=" },
          { attribute: "pk", operator: "=" },
        ],
      }).problems.join(" "),
    ).toContain("una única condición");
    const sinCondicion = plan({ name: "n", keyCondition: [] });
    expect(sinCondicion.operation).toBeNull();
    expect(sinCondicion.problems[0]).toContain("condición de clave");
    const operadorRaro = plan({
      name: "o",
      keyCondition: [{ attribute: "pk", operator: "contains" as unknown as "=" }],
    });
    expect(operadorRaro.problems[0]).toContain("no válido");
  });

  it("devuelve los problemas de la tabla para cada patrón y no lanza ante entradas inválidas", () => {
    const resultados = planAccessPatterns({ partitionKey: "" }, [
      { name: "p", keyCondition: [{ attribute: "x", operator: "=" }] },
      { name: "q", keyCondition: [{ attribute: "x", operator: "=" }] },
    ]);
    expect(resultados).toHaveLength(2);
    expect(resultados[0]?.operation).toBeNull();
    expect(resultados[0]?.problems[0]).toContain("clave de partición");
    expect(planAccessPatterns(table, null as unknown as AccessPattern[])).toEqual([]);
    const [basura] = planAccessPatterns(table, [42 as unknown as AccessPattern]);
    expect(basura?.operation).toBeNull();
    expect(basura?.problems[0]).toContain("objeto");
  });

  it("es determinista y no modifica las entradas", () => {
    const pattern: AccessPattern = { name: "z", keyCondition: [{ attribute: "email", operator: "=" }] };
    const copia = JSON.stringify([table, pattern]);
    expect(planAccessPatterns(table, [pattern])).toEqual(planAccessPatterns(table, [pattern]));
    expect(JSON.stringify([table, pattern])).toBe(copia);
  });
});
