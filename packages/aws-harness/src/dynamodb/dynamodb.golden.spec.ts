import { describe, expect, it } from "vitest";
import { planAccessPatterns, validateTable } from "./index.js";
import type { IndexProjection, TableModel } from "./index.js";

const people: TableModel = { partitionKey: "PersonID" };
const music: TableModel = { partitionKey: "Artist", sortKey: "SongTitle" };
const thread: TableModel = { partitionKey: "ForumName", sortKey: "Subject" };
const reply: TableModel = { partitionKey: "Id", sortKey: "ReplyDateTime" };

function gameScores(projection: IndexProjection): TableModel {
  return {
    partitionKey: "UserId",
    sortKey: "GameTitle",
    gsis: [{ name: "GameTitleIndex", partitionKey: "GameTitle", sortKey: "TopScore", projection }],
  };
}

function threadWithLsi(projection: IndexProjection): TableModel {
  return {
    partitionKey: "ForumName",
    sortKey: "Subject",
    lsis: [{ name: "LastPostIndex", sortKey: "LastPostDateTime", projection }],
  };
}

describe("dynamodb: casos dorados de la guía para desarrolladores de Amazon DynamoDB", () => {
  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
  it("clave primaria simple: se accede a cualquier elemento dando el valor de la clave de partición", () => {
    const [plan] = planAccessPatterns(people, [
      { name: "persona", keyCondition: [{ attribute: "PersonID", operator: "=" }] },
    ]);
    expect(plan).toEqual({ operation: "GetItem", index: null, problems: [] });
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
  it("clave compuesta: con Artist y SongTitle se accede directamente a la canción", () => {
    const [plan] = planAccessPatterns(music, [
      {
        name: "cancion",
        keyCondition: [
          { attribute: "Artist", operator: "=" },
          { attribute: "SongTitle", operator: "=" },
        ],
      },
    ]);
    expect(plan).toEqual({ operation: "GetItem", index: null, problems: [] });
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
  it("clave compuesta: solo con Artist se recuperan todas sus canciones", () => {
    const [plan] = planAccessPatterns(music, [
      { name: "canciones", keyCondition: [{ attribute: "Artist", operator: "=" }] },
    ]);
    expect(plan).toEqual({ operation: "Query", index: null, problems: [] });
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
  it("clave compuesta: Artist con un rango de SongTitle recupera un subconjunto de canciones", () => {
    const [plan] = planAccessPatterns(music, [
      {
        name: "subconjunto",
        keyCondition: [
          { attribute: "Artist", operator: "=" },
          { attribute: "SongTitle", operator: "between" },
        ],
      },
    ]);
    expect(plan).toEqual({ operation: "Query", index: null, problems: [] });
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html
  it("GetItem exige la clave primaria completa: con una clave de ordenación, la igualdad de las dos claves", () => {
    const [completa, parcial] = planAccessPatterns(thread, [
      {
        name: "completa",
        keyCondition: [
          { attribute: "ForumName", operator: "=" },
          { attribute: "Subject", operator: "=" },
        ],
      },
      { name: "parcial", keyCondition: [{ attribute: "ForumName", operator: "=" }] },
    ]);
    expect(completa?.operation).toBe("GetItem");
    expect(parcial?.operation).toBe("Query");
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html
  it("la clave de partición va en igualdad y la de ordenación admite <, <=, >, >=, between y begins_with", () => {
    for (const operator of ["<", "<=", ">", ">=", "between", "begins_with"] as const) {
      const [plan] = planAccessPatterns(reply, [
        {
          name: operator,
          keyCondition: [
            { attribute: "Id", operator: "=" },
            { attribute: "ReplyDateTime", operator },
          ],
        },
      ]);
      expect(plan).toEqual({ operation: "Query", index: null, problems: [] });
    }
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html
  it("Reply: Id en igualdad y ReplyDateTime con begins_with es una Query", () => {
    const [plan] = planAccessPatterns(reply, [
      {
        name: "respuestasDeSeptiembre",
        keyCondition: [
          { attribute: "Id", operator: "=" },
          { attribute: "ReplyDateTime", operator: "begins_with" },
        ],
      },
    ]);
    expect(plan?.operation).toBe("Query");
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html
  it("no se puede usar un atributo que no es clave en la condición de clave", () => {
    const [plan] = planAccessPatterns(thread, [
      {
        name: "porVistas",
        keyCondition: [
          { attribute: "ForumName", operator: "=" },
          { attribute: "Views", operator: ">=" },
        ],
      },
    ]);
    expect(plan?.operation).toBeNull();
    expect(plan?.problems.join(" ")).toContain("«Views» no es una clave");
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html
  it("la clave de partición solo admite igualdad", () => {
    const [plan] = planAccessPatterns(thread, [
      { name: "prefijo", keyCondition: [{ attribute: "ForumName", operator: "begins_with" }] },
    ]);
    expect(plan?.operation).toBeNull();
    expect(plan?.problems.join(" ")).toContain("solo admite igualdad");
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html
  it("la condición de la clave de ordenación usa un único operador", () => {
    const [plan] = planAccessPatterns(thread, [
      {
        name: "dos",
        keyCondition: [
          { attribute: "ForumName", operator: "=" },
          { attribute: "Subject", operator: ">=" },
          { attribute: "Subject", operator: "<" },
        ],
      },
    ]);
    expect(plan?.operation).toBeNull();
    expect(plan?.problems.join(" ")).toContain("un único operador");
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
  it("GameScores: consultar solo por GameTitle sin índice exigiría un Scan; con GameTitleIndex es una Query", () => {
    const sinIndice: TableModel = { partitionKey: "UserId", sortKey: "GameTitle" };
    const pattern = {
      name: "rankingPorJuego",
      keyCondition: [{ attribute: "GameTitle", operator: "=" as const }],
    };
    const [scan] = planAccessPatterns(sinIndice, [pattern]);
    expect(scan?.operation).toBeNull();
    expect(scan?.problems[0]).toContain("Scan");
    const [conIndice] = planAccessPatterns(gameScores({ type: "KEYS_ONLY" }), [pattern]);
    expect(conIndice).toEqual({ operation: "Query", index: "GameTitleIndex", problems: [] });
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
  it("GetItem no se puede usar en un índice global: aunque se den las dos claves del índice, es Query", () => {
    const [plan] = planAccessPatterns(gameScores({ type: "ALL" }), [
      {
        name: "puntuacionExacta",
        index: "GameTitleIndex",
        keyCondition: [
          { attribute: "GameTitle", operator: "=" },
          { attribute: "TopScore", operator: "=" },
        ],
      },
    ]);
    expect(plan).toEqual({ operation: "Query", index: "GameTitleIndex", problems: [] });
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
  it("las claves de la tabla siempre están proyectadas: UserId y TopScore bastan con KEYS_ONLY", () => {
    const [plan] = planAccessPatterns(gameScores({ type: "KEYS_ONLY" }), [
      {
        name: "mejoresJugadores",
        index: "GameTitleIndex",
        keyCondition: [{ attribute: "GameTitle", operator: "=" }],
        requiredAttributes: ["UserId", "TopScore"],
      },
    ]);
    expect(plan?.problems).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
  it("Wins y Losses solo se obtienen del índice si se proyectan con INCLUDE", () => {
    const pattern = {
      name: "proporcion",
      index: "GameTitleIndex",
      keyCondition: [{ attribute: "GameTitle", operator: "=" as const }],
      requiredAttributes: ["UserId", "Wins", "Losses"],
    };
    const [sinProyectar] = planAccessPatterns(gameScores({ type: "KEYS_ONLY" }), [pattern]);
    expect(sinProyectar?.problems.join(" ")).toContain("«Wins», «Losses»");
    const [proyectados] = planAccessPatterns(gameScores({ type: "INCLUDE", attributes: ["Wins", "Losses"] }), [
      pattern,
    ]);
    expect(proyectados?.problems).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html
  it("LastPostIndex: ForumName y un rango de LastPostDateTime se resuelven con Query sobre el índice local", () => {
    const [plan] = planAccessPatterns(threadWithLsi({ type: "INCLUDE", attributes: ["Replies"] }), [
      {
        name: "hilosRecientes",
        keyCondition: [
          { attribute: "ForumName", operator: "=" },
          { attribute: "LastPostDateTime", operator: "between" },
        ],
        requiredAttributes: ["Subject", "LastPostDateTime", "Replies"],
      },
    ]);
    expect(plan).toEqual({ operation: "Query", index: "LastPostIndex", problems: [] });
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html
  it("un atributo no proyectado en el índice local (Tags) obliga a leer la tabla y se señala", () => {
    const [plan] = planAccessPatterns(threadWithLsi({ type: "INCLUDE", attributes: ["Replies"] }), [
      {
        name: "hilosConEtiquetas",
        index: "LastPostIndex",
        keyCondition: [{ attribute: "ForumName", operator: "=" }],
        requiredAttributes: ["Subject", "LastPostDateTime", "Replies", "Tags"],
      },
    ]);
    expect(plan?.operation).toBe("Query");
    expect(plan?.problems.join(" ")).toContain("«Tags»");
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html
  it("un índice local comparte la clave de partición de la tabla y su ordenación es un atributo que no es clave", () => {
    expect(validateTable(threadWithLsi({ type: "ALL" }))).toEqual([]);
    const mal: TableModel = {
      partitionKey: "ForumName",
      sortKey: "Subject",
      lsis: [{ name: "Repetido", sortKey: "Subject", projection: { type: "ALL" } }],
    };
    expect(validateTable(mal).join(" ")).toContain("que no sea clave de la tabla");
  });

  // Fuente: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html
  it("una tabla admite hasta cinco índices secundarios locales", () => {
    const lsis = ["a", "b", "c", "d", "e", "f"].map((name) => ({
      name: `Idx${name}`,
      sortKey: `Attr${name}`,
      projection: { type: "ALL" as const },
    }));
    expect(validateTable({ partitionKey: "ForumName", sortKey: "Subject", lsis: lsis.slice(0, 5) })).toEqual([]);
    expect(validateTable({ partitionKey: "ForumName", sortKey: "Subject", lsis }).join(" ")).toContain("como máximo 5");
  });
});
