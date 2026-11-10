import { describe, expect, it } from "vitest";
import {
  parse,
  reservedAddresses,
  split,
  usableAddresses,
  validateSubnetPlan,
  validateVpcCidr,
} from "./index.js";

describe("cidr: casos dorados de la guía de usuario de Amazon VPC", () => {
  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html
  it("el tamaño de una VPC va de /16 (65 536 direcciones) a /28 (16 direcciones)", () => {
    expect(parse("10.0.0.0/16")?.size).toBe(65536);
    expect(parse("10.0.0.0/28")?.size).toBe(16);
    expect(validateVpcCidr("10.0.0.0/16")).toEqual([]);
    expect(validateVpcCidr("10.0.0.0/28")).toEqual([]);
    expect(validateVpcCidr("10.0.0.0/15")).toHaveLength(1);
    expect(validateVpcCidr("10.0.0.0/29")).toHaveLength(1);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html
  it("acepta los CIDR de ejemplo de RFC 1918: 10.0.0.0/16, 172.31.0.0/16 y 192.168.0.0/20", () => {
    expect(validateVpcCidr("10.0.0.0/16")).toEqual([]);
    expect(validateVpcCidr("172.31.0.0/16")).toEqual([]);
    expect(validateVpcCidr("192.168.0.0/20")).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html
  it("rechaza 0.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16 y 224.0.0.0/4 como CIDR de VPC", () => {
    for (const forbidden of ["0.0.0.0/8", "127.0.0.0/8", "169.254.0.0/16", "224.0.0.0/4"]) {
      const problems = validateVpcCidr(forbidden);
      expect(problems.length, forbidden).toBeGreaterThan(0);
      expect(problems.some((problem) => problem.includes("no se puede usar")), forbidden).toBe(
        true,
      );
    }
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html
  it("la forma canónica de 100.68.0.18/18 es 100.68.0.0/18", () => {
    expect(parse("100.68.0.18/18")).toEqual({
      network: "100.68.0.0",
      prefix: 18,
      first: "100.68.0.0",
      last: "100.68.63.255",
      size: 16384,
    });
    expect(validateVpcCidr("100.68.0.18/18")).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html
  it("en la subred 10.0.0.0/24 se reservan 10.0.0.0, .1, .2, .3 y 10.0.0.255", () => {
    expect(reservedAddresses("10.0.0.0/24")).toEqual([
      "10.0.0.0",
      "10.0.0.1",
      "10.0.0.2",
      "10.0.0.3",
      "10.0.0.255",
    ]);
    expect(usableAddresses("10.0.0.0/24")).toBe(251);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html
  it("el tamaño de una subred IPv4 va de /28 a /16", () => {
    expect(reservedAddresses("10.0.0.0/28")).toHaveLength(5);
    expect(usableAddresses("10.0.0.0/28")).toBe(11);
    expect(usableAddresses("10.0.0.0/16")).toBe(65531);
    const plan = (cidr: string) =>
      validateSubnetPlan({ vpc: "10.0.0.0/16", subnets: [{ name: "a", cidr }] });
    expect(plan("10.0.0.0/28")).toEqual([]);
    expect(plan("10.0.0.0/29")).toHaveLength(1);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html
  it("una VPC 10.0.0.0/24 se divide en 10.0.0.0/25 (10.0.0.0 - 10.0.0.127) y 10.0.0.128/25 (10.0.0.128 - 10.0.0.255)", () => {
    expect(split("10.0.0.0/24", 25)).toEqual(["10.0.0.0/25", "10.0.0.128/25"]);
    expect(parse("10.0.0.0/25")).toMatchObject({ first: "10.0.0.0", last: "10.0.0.127", size: 128 });
    expect(parse("10.0.0.128/25")).toMatchObject({
      first: "10.0.0.128",
      last: "10.0.0.255",
      size: 128,
    });
    expect(
      validateSubnetPlan({
        vpc: "10.0.0.0/24",
        subnets: [
          { name: "a", cidr: "10.0.0.0/25" },
          { name: "b", cidr: "10.0.0.128/25" },
        ],
      }),
    ).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html
  it("el CIDR de una subred puede coincidir con el de la VPC (una sola subred)", () => {
    expect(
      validateSubnetPlan({ vpc: "10.0.0.0/24", subnets: [{ name: "única", cidr: "10.0.0.0/24" }] }),
    ).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html
  it("los CIDR de varias subredes de una VPC no pueden solaparse", () => {
    const problems = validateSubnetPlan({
      vpc: "10.0.0.0/16",
      subnets: [
        { name: "pública", cidr: "10.0.0.0/24" },
        { name: "privada", cidr: "10.0.0.128/25" },
      ],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("se solapan");
  });
});
