import { describe, expect, it } from "vitest";
import { evaluateConditions } from "./conditions.js";

type Context = Record<string, string | string[] | number | boolean>;

function outcome(condition: unknown, context?: Context): string {
  const result = evaluateConditions(condition, context);
  return result.result === "unmodeled" ? `unmodeled:${result.operator}` : result.result;
}

describe("conditions: forma y operadores no modelados", () => {
  it("sin Condition o con un objeto vacío la sentencia aplica", () => {
    expect(outcome(undefined)).toBe("true");
    expect(outcome({})).toBe("true");
  });

  it("formas inválidas no lanzan y no se cumplen", () => {
    expect(outcome("x")).toBe("false");
    expect(outcome([])).toBe("false");
    expect(outcome({ StringEquals: "x" })).toBe("false");
    expect(outcome({ StringEquals: { k: { a: 1 } } }, { k: "a" })).toBe("false");
    expect(outcome({ StringEquals: { k: [] } }, { k: "a" })).toBe("false");
    expect(outcome({ StringEquals: { k: "a" } }, { k: { a: 1 } } as unknown as Context)).toBe("false");
  });

  it("un operador fuera del subconjunto devuelve su nombre y nunca es verdadero", () => {
    for (const name of [
      "NumericNotEquals",
      "DateEquals",
      "ArnEquals",
      "BinaryEquals",
      "StringNotEqualsIgnoreCase",
      "NullIfExists",
      "ForAllValues:Null",
      "ForAnyValue:NumericEquals",
      "ForAllValues:IpAddress",
      "Inventado",
      "toString",
    ]) {
      expect(outcome({ [name]: { k: "v" } }, { k: "v" }), name).toBe(`unmodeled:${name}`);
    }
  });

  it("si otra condición es falsa la sentencia no aplica aunque haya un operador no modelado", () => {
    expect(outcome({ DateEquals: { k: "x" }, StringEquals: { a: "1" } }, { a: "2" })).toBe("false");
    expect(outcome({ DateEquals: { k: "x" }, StringEquals: { a: "1" } }, { a: "1" })).toBe(
      "unmodeled:DateEquals",
    );
  });
});

describe("conditions: cadenas y clave ausente", () => {
  it("StringEquals distingue mayúsculas, StringEqualsIgnoreCase no", () => {
    expect(outcome({ StringEquals: { k: "Ana" } }, { k: "ana" })).toBe("false");
    expect(outcome({ StringEqualsIgnoreCase: { k: "Ana" } }, { k: "ana" })).toBe("true");
  });

  it("StringLike admite * y ? y distingue mayúsculas; StringNotLike es su negación", () => {
    expect(outcome({ StringLike: { k: "ho?e/*" } }, { k: "home/ana" })).toBe("true");
    expect(outcome({ StringLike: { k: "home/*" } }, { k: "HOME/ana" })).toBe("false");
    expect(outcome({ StringNotLike: { k: "home/*" } }, { k: "home/ana" })).toBe("false");
    expect(outcome({ StringNotLike: { k: "home/*" } }, { k: "otro" })).toBe("true");
  });

  it("StringEquals no interpreta comodines", () => {
    expect(outcome({ StringEquals: { k: "a*" } }, { k: "abc" })).toBe("false");
  });

  it("varios valores en la política: O; en operadores negados: ninguno debe coincidir", () => {
    expect(outcome({ StringEquals: { k: ["a", "b"] } }, { k: "b" })).toBe("true");
    expect(outcome({ StringNotEquals: { k: ["a", "b"] } }, { k: "b" })).toBe("false");
    expect(outcome({ StringNotEquals: { k: ["a", "b"] } }, { k: "c" })).toBe("true");
  });

  it("la clave ausente: falsa, salvo negados e IfExists; un arreglo vacío cuenta como ausente", () => {
    expect(outcome({ StringEquals: { k: "a" } }, {})).toBe("false");
    expect(outcome({ StringEquals: { k: "a" } })).toBe("false");
    expect(outcome({ StringNotEquals: { k: "a" } }, {})).toBe("true");
    expect(outcome({ StringEqualsIfExists: { k: "a" } }, {})).toBe("true");
    expect(outcome({ StringEqualsIfExists: { k: "a" } }, { k: "b" })).toBe("false");
    expect(outcome({ StringEquals: { k: "a" } }, { k: [] })).toBe("false");
  });

  it("una clave de contexto con varios valores sin ForAnyValue ni ForAllValues no se cumple", () => {
    expect(outcome({ StringEquals: { k: "a" } }, { k: ["a", "b"] })).toBe("false");
    expect(outcome({ StringEquals: { k: "a" } }, { k: ["a"] })).toBe("true");
  });

  it("los nombres de clave no se heredan del prototipo", () => {
    expect(outcome({ StringEquals: { toString: "x" } }, {})).toBe("false");
  });
});

describe("conditions: calificadores", () => {
  it("ForAllValues exige que todos coincidan con alguno; ForAnyValue, que alguno coincida", () => {
    const all = { "ForAllValues:StringEquals": { k: ["a", "b"] } };
    const any = { "ForAnyValue:StringEquals": { k: ["a", "b"] } };
    expect(outcome(all, { k: ["a", "b"] })).toBe("true");
    expect(outcome(all, { k: ["a", "c"] })).toBe("false");
    expect(outcome(any, { k: ["a", "c"] })).toBe("true");
    expect(outcome(any, { k: ["c"] })).toBe("false");
  });

  it("calificadores con operadores negados", () => {
    const all = { "ForAllValues:StringNotLike": { k: ["x*"] } };
    const any = { "ForAnyValue:StringNotLike": { k: ["x*"] } };
    expect(outcome(all, { k: ["a", "b"] })).toBe("true");
    expect(outcome(all, { k: ["a", "xb"] })).toBe("false");
    expect(outcome(any, { k: ["a", "xb"] })).toBe("true");
    expect(outcome(any, { k: ["xa", "xb"] })).toBe("false");
    expect(outcome(all, {})).toBe("false");
    expect(outcome(any, {})).toBe("false");
  });

  it("ForAnyValue con IfExists y la clave ausente es verdadero", () => {
    expect(outcome({ "ForAnyValue:StringEqualsIfExists": { k: "a" } }, {})).toBe("true");
  });

  it("los calificadores valen con Bool y ArnLike", () => {
    expect(outcome({ "ForAllValues:Bool": { k: "true" } }, { k: ["true", "true"] })).toBe("true");
    expect(outcome({ "ForAnyValue:Bool": { k: "true" } }, { k: ["false", "true"] })).toBe("true");
    expect(
      outcome({ "ForAnyValue:ArnLike": { k: "arn:aws:s3:::*" } }, { k: ["arn:aws:s3:::b"] }),
    ).toBe("true");
  });
});

describe("conditions: Null", () => {
  it("true exige ausencia, false exige presencia y varios valores son O", () => {
    expect(outcome({ Null: { k: "true" } }, {})).toBe("true");
    expect(outcome({ Null: { k: "true" } }, { k: "a" })).toBe("false");
    expect(outcome({ Null: { k: "false" } }, { k: "a" })).toBe("true");
    expect(outcome({ Null: { k: ["true", "false"] } }, {})).toBe("true");
    expect(outcome({ Null: { k: "quizá" } }, {})).toBe("false");
  });
});

describe("conditions: numéricos y fechas", () => {
  it("valores no numéricos no se cumplen", () => {
    expect(outcome({ NumericEquals: { k: "10" } }, { k: "diez" })).toBe("false");
    expect(outcome({ NumericEquals: { k: "diez" } }, { k: 10 })).toBe("false");
    expect(outcome({ NumericEquals: { k: "" } }, { k: "" })).toBe("false");
    expect(outcome({ NumericLessThan: { k: 5.5 } }, { k: "5.25" })).toBe("true");
  });

  it("las fechas inválidas no se cumplen y las fechas sin hora valen a medianoche UTC", () => {
    expect(outcome({ DateLessThan: { k: "ayer" } }, { k: "2020-01-01" })).toBe("false");
    expect(outcome({ DateLessThan: { k: "2020-01-02" } }, { k: "2020-01-01" })).toBe("true");
    expect(
      outcome({ DateGreaterThan: { k: "2020-01-01T00:00:00Z" } }, { k: "2020-01-01T00:00:01+00:00" }),
    ).toBe("true");
    expect(
      outcome({ DateGreaterThan: { k: "2020-01-01T00:00:00Z" } }, { k: "2020-01-01T01:00:00+02:00" }),
    ).toBe("false");
    expect(outcome({ DateGreaterThan: { k: "2020-13-45" } }, { k: "2021-01-01" })).toBe("false");
  });
});

describe("conditions: IP y ARN", () => {
  it("sin prefijo se usa /32 y /128, y las familias no se mezclan", () => {
    expect(outcome({ IpAddress: { k: "203.0.113.5" } }, { k: "203.0.113.5" })).toBe("true");
    expect(outcome({ IpAddress: { k: "203.0.113.5" } }, { k: "203.0.113.6" })).toBe("false");
    expect(outcome({ IpAddress: { k: "2001:db8::1" } }, { k: "2001:DB8:0:0:0:0:0:1" })).toBe("true");
    expect(outcome({ IpAddress: { k: "0.0.0.0/0" } }, { k: "2001:db8::1" })).toBe("false");
    expect(outcome({ IpAddress: { k: "0.0.0.0/0" } }, { k: "8.8.8.8" })).toBe("true");
  });

  it("direcciones o prefijos inválidos no se cumplen, tampoco con NotIpAddress", () => {
    expect(outcome({ IpAddress: { k: "203.0.113.0/33" } }, { k: "203.0.113.1" })).toBe("false");
    expect(outcome({ NotIpAddress: { k: "203.0.113.0/33" } }, { k: "203.0.113.1" })).toBe("false");
    expect(outcome({ IpAddress: { k: "203.0.113.0/24" } }, { k: "999.1.1.1" })).toBe("false");
    expect(outcome({ IpAddress: { k: "1::2::3" } }, { k: "1::3" })).toBe("false");
  });

  it("NotIpAddress excluye el rango y se cumple sin la clave", () => {
    expect(outcome({ NotIpAddress: { k: "203.0.113.0/24" } }, { k: "203.0.113.9" })).toBe("false");
    expect(outcome({ NotIpAddress: { k: "203.0.113.0/24" } }, {})).toBe("true");
  });

  it("ArnLike compara los seis componentes por separado y distingue mayúsculas", () => {
    expect(
      outcome({ ArnLike: { k: "arn:aws:s3:::bucket/*" } }, { k: "arn:aws:s3:::bucket/a:b" }),
    ).toBe("true");
    expect(
      outcome(
        { ArnLike: { k: "arn:aws:*:*:123456789012:*" } },
        { k: "arn:aws:sqs:us-east-1:123456789012:q" },
      ),
    ).toBe("true");
    expect(
      outcome(
        { ArnLike: { k: "arn:aws:sqs:*:1234:q" } },
        { k: "arn:aws:sqs:us-east-1:123456789012:q" },
      ),
    ).toBe("false");
    expect(outcome({ ArnLike: { k: "arn:aws:s3:::Bucket" } }, { k: "arn:aws:s3:::bucket" })).toBe(
      "false",
    );
    expect(outcome({ ArnLike: { k: "arn:aws:s3" } }, { k: "arn:aws:s3" })).toBe("false");
    expect(outcome({ ArnNotLike: { k: "arn:aws:s3:::*" } }, { k: "arn:aws:s3:::b" })).toBe("false");
    expect(outcome({ ArnNotLike: { k: "arn:aws:s3:::*" } }, {})).toBe("true");
  });
});

describe("conditions: determinismo", () => {
  it("el mismo resultado en llamadas repetidas y sin modificar las entradas", () => {
    const condition = { StringEquals: { k: ["a", "b"] }, Null: { k: "false" } };
    const context: Context = { k: "a" };
    const before = JSON.stringify([condition, context]);
    const first = evaluateConditions(condition, context);
    expect(evaluateConditions(condition, context)).toEqual(first);
    expect(JSON.stringify([condition, context])).toBe(before);
  });
});
