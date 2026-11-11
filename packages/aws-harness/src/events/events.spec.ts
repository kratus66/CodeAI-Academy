import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import { canary, capabilities, matches, validatePattern } from "./index.js";

describe("events: registro y capacidades", () => {
  it("se registra en el arnés y pasa su canario", () => {
    expect(canary()).toBe(true);
    expect(aws.events.capabilities).toBe(capabilities);
    expect(listCapabilities().map((item) => item.name)).toContain("events");
    expect(selfTest()).toBe(true);
  });

  it("declara lo que no modela y solo cita fuentes oficiales", () => {
    expect(capabilities.name).toBe("events");
    expect(capabilities.notModeled.some((item) => item.includes("IPv6"))).toBe(true);
    expect(capabilities.sources.every((url) => url.startsWith("https://docs.aws.amazon.com/eventbridge/"))).toBe(
      true,
    );
  });
});

describe("events: validatePattern", () => {
  it("acepta patrones válidos", () => {
    expect(validatePattern({})).toEqual([]);
    expect(validatePattern({ source: ["aws.ec2"], detail: { state: [{ exists: true }] } })).toEqual([]);
  });

  it("explica los patrones inválidos en español", () => {
    expect(validatePattern("texto")[0]).toContain("objeto");
    expect(validatePattern(null)).toHaveLength(1);
    expect(validatePattern([])).toHaveLength(1);
    expect(validatePattern({ source: "aws.ec2" })[0]).toContain("arreglo");
    expect(validatePattern({ source: [] })[0]).toContain("vacía");
    expect(validatePattern({ source: [[1]] })).toHaveLength(1);
    expect(validatePattern({ source: [{ nope: "x" }] })[0]).toContain("no está modelado");
    expect(validatePattern({ source: [{ prefix: "a", suffix: "b" }] })[0]).toContain("exactamente un operador");
    expect(validatePattern({ source: [{ prefix: 1 }] })).toHaveLength(1);
    expect(validatePattern({ source: [{ "equals-ignore-case": 1 }] })).toHaveLength(1);
    expect(validatePattern({ source: [{ exists: "si" }] })).toHaveLength(1);
  });

  it("valida numeric, anything-but, cidr y $or", () => {
    expect(validatePattern({ n: [{ numeric: [">=", 1] }] })[0]).toContain("no está modelado");
    expect(validatePattern({ n: [{ numeric: ["=", "uno"] }] })).toHaveLength(1);
    expect(validatePattern({ n: [{ numeric: [">", 0] }] })).toEqual([]);
    expect(validatePattern({ n: [{ numeric: ["<", 0, ">", 5] }] })).toHaveLength(1);
    expect(validatePattern({ n: [{ numeric: [">", 1, "<=", 5, "<", 9] }] })).toHaveLength(1);
    expect(validatePattern({ n: [{ numeric: ["=", 2 ** 60] }] })[0]).toContain("2^53");
    expect(validatePattern({ n: [{ "anything-but": ["a", 1] }] })).toHaveLength(1);
    expect(validatePattern({ n: [{ "anything-but": [] }] })).toHaveLength(1);
    expect(validatePattern({ n: [{ "anything-but": { prefix: 1 } }] })).toHaveLength(1);
    expect(validatePattern({ n: [{ "anything-but": { wildcard: "a**" } }] })).toHaveLength(1);
    expect(validatePattern({ n: [{ "anything-but": { nope: "a" } }] })).toHaveLength(1);
    expect(validatePattern({ ip: [{ cidr: "2001:db8::/32" }] })[0]).toContain("IPv6");
    expect(validatePattern({ ip: [{ cidr: "10.0.0.0/99" }] })).toHaveLength(1);
    expect(validatePattern({ $or: "x" })).toHaveLength(1);
    expect(validatePattern({ $or: [] })).toHaveLength(1);
    expect(validatePattern({ $or: [{ a: ["1"] }], b: ["2"] })[0]).toContain("no está modelado");
  });

  it("nunca lanza ante entradas raras", () => {
    const circular: Record<string, unknown> = {};
    circular.self = [circular];
    for (const input of [undefined, 1, true, circular, { a: undefined }, { a: [undefined] }, { a: [() => 1] }]) {
      expect(() => validatePattern(input)).not.toThrow();
    }
  });
});

describe("events: matches", () => {
  it("un patrón inválido o un evento que no es un objeto devuelve false", () => {
    expect(matches({ source: "aws.ec2" }, { source: "aws.ec2" })).toBe(false);
    expect(matches({ source: ["aws.ec2"] }, "aws.ec2")).toBe(false);
    expect(matches({ source: ["aws.ec2"] }, null)).toBe(false);
    expect(matches({ source: ["aws.ec2"] }, [{ source: "aws.ec2" }])).toBe(false);
    expect(matches(undefined, {})).toBe(false);
  });

  it("el patrón vacío coincide con cualquier objeto", () => {
    expect(matches({}, { cualquier: "cosa" })).toBe(true);
  });

  it("los valores exactos distinguen mayúsculas, tipos y booleanos", () => {
    expect(matches({ s: ["Alice"] }, { s: "alice" })).toBe(false);
    expect(matches({ b: [true] }, { b: true })).toBe(true);
    expect(matches({ b: [true] }, { b: "true" })).toBe(false);
    expect(matches({ n: [1] }, { n: "1" })).toBe(false);
  });

  it("un campo ausente solo coincide con exists false", () => {
    expect(matches({ a: ["x"] }, {})).toBe(false);
    expect(matches({ a: [{ "anything-but": "x" }] }, {})).toBe(false);
    expect(matches({ a: [{ exists: false }] }, {})).toBe(true);
    expect(matches({ a: { b: [{ exists: false }] } }, {})).toBe(true);
    expect(matches({ a: { b: ["x"] } }, {})).toBe(false);
  });

  it("la estructura anidada del evento debe ser la del patrón", () => {
    expect(matches({ a: { b: ["x"] } }, { a: "x" })).toBe(false);
    expect(matches({ a: ["x"] }, { a: { b: "x" } })).toBe(false);
    expect(matches({ a: { b: ["x"] } }, { a: { b: "x", c: 1 }, otro: 2 })).toBe(true);
  });

  it("exists true se cumple con null y los demás operadores no coinciden con objetos", () => {
    expect(matches({ a: [{ exists: true }] }, { a: null })).toBe(true);
    expect(matches({ a: [{ prefix: "x" }] }, { a: { b: "x" } })).toBe(false);
    expect(matches({ a: [{ prefix: "x" }] }, { a: 5 })).toBe(false);
  });

  it("los operadores de texto exigen cadenas y los de número exigen números", () => {
    expect(matches({ a: [{ numeric: ["=", 5] }] }, { a: "5" })).toBe(false);
    expect(matches({ a: [{ numeric: ["=", 5] }] }, { a: 5 })).toBe(true);
    expect(matches({ a: [{ wildcard: "*" }] }, { a: 5 })).toBe(false);
    expect(matches({ a: [{ "anything-but": "x" }] }, { a: null })).toBe(false);
    expect(matches({ a: [{ "equals-ignore-case": "x" }] }, { a: 1 })).toBe(false);
    expect(matches({ a: [{ numeric: ["=", 1] }] }, { a: 2 ** 60 })).toBe(false);
  });

  it("los rangos numéricos respetan los extremos abiertos y cerrados", () => {
    const range = { n: [{ numeric: [">", 0, "<", 5] }] };
    expect(matches(range, { n: 4.9 })).toBe(true);
    expect(matches(range, { n: 5 })).toBe(false);
    expect(matches(range, { n: 0 })).toBe(false);
    expect(matches({ n: [{ numeric: ["<=", 5] }] }, { n: 5 })).toBe(true);
    expect(matches({ n: [{ numeric: [">", 5] }] }, { n: 5 })).toBe(false);
  });

  it("wildcard: varios asteriscos, extremos y solapes", () => {
    expect(matches({ p: [{ wildcard: "*.txt" }] }, { p: "a.txt" })).toBe(true);
    expect(matches({ p: [{ wildcard: "a*" }] }, { p: "abc" })).toBe(true);
    expect(matches({ p: [{ wildcard: "a*b*c" }] }, { p: "a1b2c" })).toBe(true);
    expect(matches({ p: [{ wildcard: "a*b*c" }] }, { p: "a1c2b" })).toBe(false);
    expect(matches({ p: [{ wildcard: "ab*bc" }] }, { p: "abc" })).toBe(false);
    expect(matches({ p: [{ wildcard: "*" }] }, { p: "" })).toBe(true);
    expect(matches({ p: [{ wildcard: "exacto" }] }, { p: "exacto" })).toBe(true);
  });

  it("cidr no coincide con valores que no son una dirección IPv4", () => {
    const pattern = { ip: [{ cidr: "10.0.0.0/24" }] };
    expect(matches(pattern, { ip: "10.0.0.5/32" })).toBe(false);
    expect(matches(pattern, { ip: "no-es-ip" })).toBe(false);
    expect(matches(pattern, { ip: "2001:db8::1" })).toBe(false);
    expect(matches(pattern, { ip: 10 })).toBe(false);
  });

  it("los operadores se aplican a cada elemento de un arreglo del evento", () => {
    expect(matches({ r: [{ prefix: "arn:aws:s3" }] }, { r: ["x", "arn:aws:s3:::b"] })).toBe(true);
    expect(matches({ r: [{ prefix: "arn:aws:s3" }] }, { r: ["x", "y"] })).toBe(false);
    expect(matches({ r: [{ exists: true }] }, { r: [] })).toBe(true);
    expect(matches({ r: ["x"] }, { r: [] })).toBe(false);
  });

  it("un arreglo de objetos en el evento coincide si algún elemento cumple el patrón anidado", () => {
    const pattern = { detail: { eventSource: ["sns.amazonaws.com"] } };
    expect(matches(pattern, { detail: [{ eventSource: "sns.amazonaws.com" }] })).toBe(true);
    expect(matches(pattern, { detail: [{ eventSource: "s3.amazonaws.com" }] })).toBe(false);
  });

  it("$or anidado y varios $or a la vez", () => {
    const pattern = {
      a: { $or: [{ x: [1] }, { y: [2] }] },
      b: { $or: [{ z: [3] }, { w: [4] }] },
    };
    expect(matches(pattern, { a: { y: 2 }, b: { z: 3 } })).toBe(true);
    expect(matches(pattern, { a: { y: 2 }, b: { z: 9 } })).toBe(false);
  });

  it("nunca lanza con eventos hostiles", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error("no se debe leer");
        },
        has() {
          throw new Error("no se debe leer");
        },
        getOwnPropertyDescriptor() {
          throw new Error("no se debe leer");
        },
      },
    );
    for (const event of [circular, hostile, Object.create(null), { a: () => 1 }, { a: Symbol("s") }]) {
      expect(() => matches({ a: ["x"] }, event)).not.toThrow();
      expect(matches({ a: ["x"] }, event)).toBe(false);
    }
  });
});
