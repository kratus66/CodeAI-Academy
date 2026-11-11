import { describe, expect, it } from "vitest";
import {
  canConnect,
  naclAllows,
  routeFor,
  securityGroupAllows,
  type NaclRule,
  type SgRule,
  type VpcModel,
} from "./index.js";

const tcp = (
  number: number,
  direction: "inbound" | "outbound",
  fromPort: number,
  toPort: number,
  cidr: string,
  action: "allow" | "deny" = "allow",
): NaclRule => ({ direction, number, action, protocol: "tcp", fromPort, toPort, cidr });

describe("network: casos dorados de la guía de usuario de Amazon VPC", () => {
  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/route-tables-priority.html
  it("la ruta más específica gana: 172.31.0.0/16 va por el peering y el resto por el internet gateway", () => {
    const table = [
      { destination: "10.0.0.0/16", target: "local" },
      { destination: "172.31.0.0/16", target: "pcx-11223344556677889" },
      { destination: "0.0.0.0/0", target: "igw-12345678901234567" },
    ];
    expect(routeFor(table, "172.31.4.4")).toBe("pcx-11223344556677889");
    expect(routeFor(table, "10.0.9.9")).toBe("local");
    expect(routeFor(table, "93.184.216.34")).toBe("igw-12345678901234567");
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/route-tables-priority.html
  it("10.10.2.15/32 tiene prioridad sobre 10.10.2.0/24", () => {
    const table = [
      { destination: "10.10.2.0/24", target: "nat-aaaa" },
      { destination: "10.10.2.15/32", target: "igw-bbbb" },
    ];
    expect(routeFor(table, "10.10.2.15")).toBe("igw-bbbb");
    expect(routeFor(table, "10.10.2.16")).toBe("nat-aaaa");
  });

  const inbound: NaclRule[] = [
    tcp(100, "inbound", 80, 80, "0.0.0.0/0"),
    tcp(110, "inbound", 443, 443, "0.0.0.0/0"),
    tcp(120, "inbound", 22, 22, "192.0.2.0/24"),
    tcp(140, "inbound", 32768, 65535, "0.0.0.0/0"),
  ];

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html
  it("el tráfico al puerto 443 coincide con la regla 110 y el puerto 139 (NetBIOS) lo deniega la regla *", () => {
    expect(
      naclAllows(inbound, { direction: "inbound", protocol: "tcp", port: 443, peer: "198.51.100.5" }),
    ).toEqual({ allowed: true, ruleNumber: 110 });
    expect(
      naclAllows(inbound, { direction: "inbound", protocol: "tcp", port: 139, peer: "198.51.100.5" }),
    ).toEqual({ allowed: false, ruleNumber: "*" });
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html
  it("SSH solo entra desde el rango 192.0.2.0/24 de la red de casa", () => {
    expect(
      naclAllows(inbound, { direction: "inbound", protocol: "tcp", port: 22, peer: "192.0.2.77" }),
    ).toEqual({ allowed: true, ruleNumber: 120 });
    expect(
      naclAllows(inbound, { direction: "inbound", protocol: "tcp", port: 22, peer: "198.51.100.5" }),
    ).toEqual({ allowed: false, ruleNumber: "*" });
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html
  it("puertos efímeros: la regla 140 (32768-65535) deja volver las respuestas de Internet", () => {
    const flow = { direction: "inbound", protocol: "tcp", peer: "198.51.100.5" } as const;
    expect(naclAllows(inbound, { ...flow, port: 32768 }).ruleNumber).toBe(140);
    expect(naclAllows(inbound, { ...flow, port: 65535 }).allowed).toBe(true);
    expect(naclAllows(inbound, { ...flow, port: 32767 })).toEqual({ allowed: false, ruleNumber: "*" });
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html
  it("la regla de salida 120 (1024-65535 hacia 192.0.2.0/24) responde al SSH de la red de casa", () => {
    const outbound = [
      tcp(100, "outbound", 80, 80, "0.0.0.0/0"),
      tcp(110, "outbound", 443, 443, "0.0.0.0/0"),
      tcp(120, "outbound", 1024, 65535, "192.0.2.0/24"),
    ];
    expect(
      naclAllows(outbound, { direction: "outbound", protocol: "tcp", port: 52000, peer: "192.0.2.77" }),
    ).toEqual({ allowed: true, ruleNumber: 120 });
    expect(
      naclAllows(outbound, { direction: "outbound", protocol: "tcp", port: 52000, peer: "198.51.100.5" }),
    ).toEqual({ allowed: false, ruleNumber: "*" });
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html
  it("un cliente Windows 10 de Internet exige una regla de salida para 49152-65535", () => {
    const withWindows = [tcp(140, "outbound", 49152, 65535, "0.0.0.0/0")];
    const withoutWindows = [tcp(140, "outbound", 32768, 61000, "0.0.0.0/0")];
    const flow = { direction: "outbound", protocol: "tcp", port: 60000, peer: "198.51.100.5" } as const;
    expect(naclAllows(withWindows, flow).allowed).toBe(true);
    expect(naclAllows(withoutWindows, flow).allowed).toBe(true);
    expect(naclAllows(withoutWindows, { ...flow, port: 62000 })).toEqual({
      allowed: false,
      ruleNumber: "*",
    });
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/nacl-basics.html
  it("las reglas se evalúan por número ascendente y la primera coincidencia decide", () => {
    const rules = [
      tcp(200, "inbound", 0, 65535, "0.0.0.0/0", "allow"),
      tcp(100, "inbound", 3389, 3389, "0.0.0.0/0", "deny"),
    ];
    expect(
      naclAllows(rules, { direction: "inbound", protocol: "tcp", port: 3389, peer: "1.2.3.4" }),
    ).toEqual({ allowed: false, ruleNumber: 100 });
    expect(
      naclAllows(rules, { direction: "inbound", protocol: "tcp", port: 80, peer: "1.2.3.4" }),
    ).toEqual({ allowed: true, ruleNumber: 200 });
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html
  it("un security group sin reglas no permite tráfico y la regla de salida total lo permite todo", () => {
    const flow = { direction: "outbound", protocol: "tcp", port: 443, peer: "93.184.216.34" } as const;
    expect(securityGroupAllows([], flow)).toBe(false);
    const all: SgRule[] = [{ direction: "outbound", protocol: "-1", cidr: "0.0.0.0/0" }];
    expect(securityGroupAllows(all, flow)).toBe(true);
    expect(securityGroupAllows(all, { ...flow, direction: "inbound" })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html
  it("un puerto o un rango (22 y 7000-8000) y un host con /32 se evalúan como en la guía", () => {
    const rules: SgRule[] = [
      { direction: "inbound", protocol: "tcp", fromPort: 22, toPort: 22, cidr: "203.0.113.1/32" },
      { direction: "inbound", protocol: "tcp", fromPort: 7000, toPort: 8000, cidr: "203.0.113.0/24" },
    ];
    const base = { direction: "inbound", protocol: "tcp" } as const;
    expect(securityGroupAllows(rules, { ...base, port: 22, peer: "203.0.113.1" })).toBe(true);
    expect(securityGroupAllows(rules, { ...base, port: 22, peer: "203.0.113.2" })).toBe(false);
    expect(securityGroupAllows(rules, { ...base, port: 7500, peer: "203.0.113.2" })).toBe(true);
    expect(securityGroupAllows(rules, { ...base, port: 8001, peer: "203.0.113.2" })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs-records-examples.html
  describe("ping desde 203.0.113.12 a la instancia 172.31.16.139", () => {
    const build = (naclOutboundIcmp: boolean): VpcModel => ({
      cidr: "172.31.0.0/16",
      subnets: [
        {
          id: "subnet-a",
          cidr: "172.31.16.0/20",
          routes: [
            { destination: "172.31.0.0/16", target: "local" },
            { destination: "0.0.0.0/0", target: "igw-1" },
          ],
          nacl: [
            { direction: "inbound", number: 100, action: "allow", protocol: "icmp", cidr: "0.0.0.0/0" },
            ...(naclOutboundIcmp
              ? [
                  {
                    direction: "outbound",
                    number: 100,
                    action: "allow",
                    protocol: "icmp",
                    cidr: "0.0.0.0/0",
                  } satisfies NaclRule,
                ]
              : []),
          ],
        },
      ],
      securityGroups: [
        {
          id: "sg-1",
          rules: [{ direction: "inbound", protocol: "icmp", cidr: "0.0.0.0/0" }],
        },
      ],
    });
    const ping = {
      from: { ip: "203.0.113.12" },
      to: { ip: "172.31.16.139", securityGroups: ["sg-1"] },
      protocol: "icmp",
      port: 0,
    } as const;

    it("el SG tiene estado (la respuesta sale sin regla de salida) pero la NACL sin estado la descarta", () => {
      const result = canConnect(build(false), ping);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("La NACL de salida de subnet-a deniega la respuesta");
      expect(result.path).toContain("SG de entrada del destino");
    });

    it("si la NACL permite el ICMP de salida, se aceptan el ping y su respuesta", () => {
      const result = canConnect(build(true), ping);
      expect(result.allowed).toBe(true);
      expect(result.path).toHaveLength(4);
    });

    it("si el SG deniega el ICMP de entrada, no llega a la instancia", () => {
      const model = build(true);
      model.securityGroups[0]!.rules = [];
      const result = canConnect(model, ping);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("security group de entrada del destino");
    });
  });
});
