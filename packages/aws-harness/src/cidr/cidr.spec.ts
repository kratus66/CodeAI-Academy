import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import {
  canary,
  capabilities,
  contains,
  overlaps,
  parse,
  reservedAddresses,
  split,
  usableAddresses,
  validateSubnetPlan,
  validateVpcCidr,
} from "./index.js";

const MALFORMED = [
  "",
  "10.0.0.0",
  "10.0.0.0/",
  "/24",
  "10.0.0/24",
  "10.0.0.0.0/24",
  "10.0.0.256/24",
  "10.0.0.0/33",
  "10.0.0.0/-1",
  "10.0.0.0/2x",
  "10.0.0.0/024",
  "010.0.0.0/24",
  "a.b.c.d/24",
  "10.0.0.0/24/1",
  " 10.0.0.0/24",
  "2001:db8::/32",
];

describe("cidr: registro y canario", () => {
  it("aws expone cidr y el arnés lo registra", () => {
    expect(aws.cidr.capabilities).toBe(capabilities);
    expect(listCapabilities().map((item) => item.name)).toContain("cidr");
    expect(selfTest()).toBe(true);
    expect(canary()).toBe(true);
  });

  it("declara lo que no modela", () => {
    const text = capabilities.notModeled.join(" ");
    expect(text).toContain("IPv6");
    expect(text).toContain("CIDR secundarios");
    expect(text).toContain("Restricciones de rangos");
    expect(capabilities.sources.every((url) => url.startsWith("https://docs.aws.amazon.com/"))).toBe(
      true,
    );
  });
});

describe("cidr: parse", () => {
  it("analiza un bloque alineado", () => {
    expect(parse("192.168.1.0/24")).toEqual({
      network: "192.168.1.0",
      prefix: 24,
      first: "192.168.1.0",
      last: "192.168.1.255",
      size: 256,
    });
  });

  it("normaliza una base no alineada", () => {
    expect(parse("10.1.2.3/16")?.network).toBe("10.1.0.0");
  });

  it("admite los extremos /0 y /32", () => {
    expect(parse("0.0.0.0/0")).toMatchObject({ last: "255.255.255.255", size: 4294967296 });
    expect(parse("1.2.3.4/32")).toMatchObject({ first: "1.2.3.4", last: "1.2.3.4", size: 1 });
  });

  it("devuelve null con entradas mal formadas, sin lanzar", () => {
    for (const bad of MALFORMED) {
      expect(parse(bad), bad).toBeNull();
    }
    expect(parse(undefined as unknown as string)).toBeNull();
    expect(parse(5 as unknown as string)).toBeNull();
  });
});

describe("cidr: contains y overlaps", () => {
  it("contención total, igualdad y exclusión", () => {
    expect(contains("10.0.0.0/16", "10.0.5.0/24")).toBe(true);
    expect(contains("10.0.0.0/24", "10.0.0.0/24")).toBe(true);
    expect(contains("10.0.5.0/24", "10.0.0.0/16")).toBe(false);
    expect(contains("10.0.0.0/24", "10.0.1.0/24")).toBe(false);
  });

  it("solape total, parcial y nulo", () => {
    expect(overlaps("10.0.0.0/16", "10.0.1.0/24")).toBe(true);
    expect(overlaps("10.0.1.0/24", "10.0.0.0/16")).toBe(true);
    expect(overlaps("10.0.0.0/24", "10.0.0.0/24")).toBe(true);
    expect(overlaps("10.0.0.0/25", "10.0.0.128/25")).toBe(false);
    expect(overlaps("10.0.0.0/24", "10.0.1.0/24")).toBe(false);
  });

  it("el solape de bloques anidados es de contención en un solo sentido", () => {
    expect(overlaps("10.0.0.0/23", "10.0.1.0/22")).toBe(true);
    expect(contains("10.0.0.0/22", "10.0.1.0/23")).toBe(true);
    expect(contains("10.0.1.0/23", "10.0.0.0/22")).toBe(false);
  });

  it("devuelven falso con entradas inválidas", () => {
    for (const bad of MALFORMED) {
      expect(contains(bad, "10.0.0.0/24"), bad).toBe(false);
      expect(contains("10.0.0.0/24", bad), bad).toBe(false);
      expect(overlaps(bad, "10.0.0.0/24"), bad).toBe(false);
      expect(overlaps("10.0.0.0/24", bad), bad).toBe(false);
    }
  });
});

describe("cidr: split", () => {
  it("divide en cuatro bloques", () => {
    expect(split("10.0.0.0/22", 24)).toEqual([
      "10.0.0.0/24",
      "10.0.1.0/24",
      "10.0.2.0/24",
      "10.0.3.0/24",
    ]);
  });

  it("con el mismo prefijo devuelve el bloque canónico", () => {
    expect(split("10.0.0.7/24", 24)).toEqual(["10.0.0.0/24"]);
  });

  it("devuelve [] si no se puede", () => {
    expect(split("10.0.0.0/24", 16)).toEqual([]);
    expect(split("10.0.0.0/24", 33)).toEqual([]);
    expect(split("10.0.0.0/24", 25.5)).toEqual([]);
    expect(split("10.0.0.0/24", Number.NaN)).toEqual([]);
    expect(split("10.0.0.0/24", "25" as unknown as number)).toEqual([]);
    expect(split("mal", 24)).toEqual([]);
    expect(split("0.0.0.0/0", 32)).toEqual([]);
  });
});

describe("cidr: direcciones reservadas y utilizables", () => {
  it("las reservadas siguen el orden de la guía", () => {
    expect(reservedAddresses("192.168.4.64/26")).toEqual([
      "192.168.4.64",
      "192.168.4.65",
      "192.168.4.66",
      "192.168.4.67",
      "192.168.4.127",
    ]);
  });

  it("parte de una base no alineada", () => {
    expect(reservedAddresses("10.0.0.77/24")[0]).toBe("10.0.0.0");
  });

  it("devuelve [] fuera de /16 a /28 o con entradas inválidas", () => {
    expect(reservedAddresses("10.0.0.0/29")).toEqual([]);
    expect(reservedAddresses("10.0.0.0/15")).toEqual([]);
    expect(reservedAddresses("mal")).toEqual([]);
  });

  it("las utilizables son el tamaño menos 5, sin bajar de 0", () => {
    expect(usableAddresses("10.0.0.0/25")).toBe(123);
    expect(usableAddresses("10.0.0.0/30")).toBe(0);
    expect(usableAddresses("10.0.0.0/32")).toBe(0);
    expect(usableAddresses("mal")).toBe(0);
  });
});

describe("cidr: validateVpcCidr", () => {
  it("informa del formato inválido sin lanzar", () => {
    for (const bad of MALFORMED) {
      expect(validateVpcCidr(bad), bad).toHaveLength(1);
    }
    expect(validateVpcCidr(undefined as unknown as string)).toHaveLength(1);
  });

  it("acepta una base no alineada porque AWS la pasa a forma canónica", () => {
    expect(validateVpcCidr("10.0.7.9/16")).toEqual([]);
  });

  it("combina problemas de tamaño y de rango prohibido", () => {
    expect(validateVpcCidr("127.0.0.0/8")).toHaveLength(2);
    expect(validateVpcCidr("127.0.0.0/16")).toHaveLength(1);
  });

  it("los textos van en español", () => {
    expect(validateVpcCidr("10.0.0.0/8")[0]).toContain("no está permitido");
  });
});

describe("cidr: validateSubnetPlan", () => {
  const vpc = "10.0.0.0/16";

  it("acepta un plan correcto", () => {
    expect(
      validateSubnetPlan({
        vpc,
        subnets: [
          { name: "a", cidr: "10.0.0.0/24" },
          { name: "b", cidr: "10.0.1.0/24" },
        ],
      }),
    ).toEqual([]);
  });

  it("informa de una VPC inválida", () => {
    const problems = validateSubnetPlan({ vpc: "mal", subnets: [] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^VPC: /);
  });

  it("informa de una subred mal formada", () => {
    const problems = validateSubnetPlan({ vpc, subnets: [{ name: "a", cidr: "10.0.0.0/99" }] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Subred a");
  });

  it("informa de una subred fuera de la VPC", () => {
    const problems = validateSubnetPlan({ vpc, subnets: [{ name: "a", cidr: "10.1.0.0/24" }] });
    expect(problems).toEqual(["Subred a: «10.1.0.0/24» queda fuera del CIDR de la VPC."]);
  });

  it("informa de una subred mayor que la VPC", () => {
    const problems = validateSubnetPlan({ vpc: "10.0.0.0/24", subnets: [{ name: "a", cidr: "10.0.0.0/16" }] });
    expect(problems.some((problem) => problem.includes("queda fuera"))).toBe(true);
  });

  it("detecta solapes parciales y totales", () => {
    const partial = validateSubnetPlan({
      vpc,
      subnets: [
        { name: "a", cidr: "10.0.0.0/23" },
        { name: "b", cidr: "10.0.1.0/24" },
      ],
    });
    expect(partial).toHaveLength(1);
    const total = validateSubnetPlan({
      vpc,
      subnets: [
        { name: "a", cidr: "10.0.0.0/24" },
        { name: "b", cidr: "10.0.0.0/24" },
      ],
    });
    expect(total).toHaveLength(1);
  });

  it("no lanza con planes que no tienen la forma esperada", () => {
    const bad: unknown[] = [
      null,
      undefined,
      "plan",
      [],
      {},
      { vpc },
      { vpc, subnets: "x" },
      { vpc: 5, subnets: [] },
      { vpc, subnets: [null, 3, {}, { name: 7, cidr: 9 }] },
    ];
    for (const plan of bad) {
      const problems = validateSubnetPlan(plan as never);
      expect(Array.isArray(problems)).toBe(true);
      expect(problems.length).toBeGreaterThan(0);
    }
  });
});
