import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import {
  DEFAULT_CLIENT_PORT,
  canConnect,
  canary,
  capabilities,
  naclAllows,
  routeFor,
  securityGroupAllows,
  type ConnectionRequest,
  type NaclRule,
  type SgRule,
  type VpcModel,
} from "./index.js";

const allow = (
  number: number,
  direction: "inbound" | "outbound",
  protocol: "tcp" | "udp" | "icmp" | "-1",
  fromPort: number | undefined,
  toPort: number | undefined,
  cidr: string,
  action: "allow" | "deny" = "allow",
): NaclRule => ({ direction, number, action, protocol, fromPort, toPort, cidr });

function openNacl(): NaclRule[] {
  return [
    allow(100, "inbound", "-1", undefined, undefined, "0.0.0.0/0"),
    allow(100, "outbound", "-1", undefined, undefined, "0.0.0.0/0"),
  ];
}

function model(): VpcModel {
  return {
    cidr: "10.0.0.0/16",
    subnets: [
      {
        id: "pub",
        cidr: "10.0.0.0/24",
        routes: [
          { destination: "10.0.0.0/16", target: "local" },
          { destination: "0.0.0.0/0", target: "igw-1" },
        ],
        nacl: openNacl(),
      },
      {
        id: "app",
        cidr: "10.0.1.0/24",
        routes: [
          { destination: "10.0.0.0/16", target: "local" },
          { destination: "0.0.0.0/0", target: "nat-1" },
        ],
        nacl: openNacl(),
      },
      {
        id: "db",
        cidr: "10.0.2.0/24",
        routes: [{ destination: "10.0.0.0/16", target: "local" }],
        nacl: openNacl(),
      },
    ],
    securityGroups: [
      {
        id: "sg-web",
        rules: [
          { direction: "inbound", protocol: "tcp", fromPort: 443, toPort: 443, cidr: "0.0.0.0/0" },
          { direction: "outbound", protocol: "-1", cidr: "0.0.0.0/0" },
        ],
      },
      {
        id: "sg-app",
        rules: [
          { direction: "inbound", protocol: "tcp", fromPort: 8080, toPort: 8080, cidr: "10.0.0.0/24" },
          { direction: "outbound", protocol: "-1", cidr: "0.0.0.0/0" },
        ],
      },
      {
        id: "sg-db",
        rules: [
          { direction: "inbound", protocol: "tcp", fromPort: 5432, toPort: 5432, cidr: "10.0.1.0/24" },
        ],
      },
    ],
  };
}

const webToApp: ConnectionRequest = {
  from: { ip: "10.0.0.10", securityGroups: ["sg-web"] },
  to: { ip: "10.0.1.20", securityGroups: ["sg-app"] },
  protocol: "tcp",
  port: 8080,
};

describe("network: registro y canario", () => {
  it("aws expone network y el arnés lo registra", () => {
    expect(aws.network.capabilities).toBe(capabilities);
    expect(listCapabilities().map((item) => item.name)).toContain("network");
    expect(selfTest()).toBe(true);
    expect(canary()).toBe(true);
  });

  it("declara lo que no modela", () => {
    const text = capabilities.notModeled.join(" ");
    for (const word of ["Transit Gateway", "Peering", "Listas de prefijos", "IPv6", "Endpoints"]) {
      expect(text).toContain(word);
    }
    expect(capabilities.sources.every((url) => url.startsWith("https://docs.aws.amazon.com/"))).toBe(
      true,
    );
  });
});

describe("network: routeFor", () => {
  it("devuelve null sin rutas, sin coincidencia o con entradas inválidas, sin lanzar", () => {
    expect(routeFor([], "10.0.0.1")).toBeNull();
    expect(routeFor([{ destination: "10.0.0.0/16", target: "local" }], "192.168.0.1")).toBeNull();
    expect(routeFor([{ destination: "10.0.0.0/16", target: "local" }], "mal")).toBeNull();
    expect(routeFor([{ destination: "10.0.0.0/16", target: "local" }], "10.0.0.1/24")).toBeNull();
    expect(routeFor(undefined as unknown as [], "10.0.0.1")).toBeNull();
    expect(routeFor([null, 5, { destination: "x", target: "y" }] as unknown as [], "10.0.0.1")).toBeNull();
  });

  it("el orden de la tabla no cambia el resultado", () => {
    const table = [
      { destination: "0.0.0.0/0", target: "igw-1" },
      { destination: "10.0.0.0/8", target: "vgw-1" },
      { destination: "10.1.0.0/16", target: "pcx-1" },
      { destination: "10.1.2.0/24", target: "nat-1" },
    ];
    expect(routeFor(table, "10.1.2.3")).toBe("nat-1");
    expect(routeFor([...table].reverse(), "10.1.2.3")).toBe("nat-1");
    expect(routeFor(table, "10.1.3.3")).toBe("pcx-1");
    expect(routeFor(table, "10.9.9.9")).toBe("vgw-1");
    expect(routeFor(table, "11.0.0.1")).toBe("igw-1");
  });

  it("los solapes de /32, /24 y /16 se resuelven por el prefijo más largo", () => {
    const table = [
      { destination: "10.0.0.0/16", target: "a" },
      { destination: "10.0.0.0/24", target: "b" },
      { destination: "10.0.0.5/32", target: "c" },
    ];
    expect(routeFor(table, "10.0.0.5")).toBe("c");
    expect(routeFor(table, "10.0.0.6")).toBe("b");
    expect(routeFor(table, "10.0.1.6")).toBe("a");
  });

  it("con destinos idénticos gana la primera de la lista", () => {
    const table = [
      { destination: "0.0.0.0/0", target: "igw-1" },
      { destination: "0.0.0.0/0", target: "nat-1" },
    ];
    expect(routeFor(table, "8.8.8.8")).toBe("igw-1");
  });
});

describe("network: securityGroupAllows", () => {
  const rules: SgRule[] = [
    { direction: "inbound", protocol: "tcp", fromPort: 80, toPort: 90, cidr: "10.0.0.0/8" },
    { direction: "inbound", protocol: "udp", fromPort: 53, toPort: 53, cidr: "10.0.0.0/8" },
    { direction: "inbound", protocol: "icmp", cidr: "10.0.0.0/8" },
  ];
  const base = { direction: "inbound", peer: "10.1.1.1" } as const;

  it("respeta protocolo, puertos, origen y dirección", () => {
    expect(securityGroupAllows(rules, { ...base, protocol: "tcp", port: 80 })).toBe(true);
    expect(securityGroupAllows(rules, { ...base, protocol: "tcp", port: 90 })).toBe(true);
    expect(securityGroupAllows(rules, { ...base, protocol: "tcp", port: 91 })).toBe(false);
    expect(securityGroupAllows(rules, { ...base, protocol: "udp", port: 80 })).toBe(false);
    expect(securityGroupAllows(rules, { ...base, protocol: "icmp", port: 0 })).toBe(true);
    expect(securityGroupAllows(rules, { ...base, protocol: "tcp", port: 80, peer: "11.0.0.1" })).toBe(
      false,
    );
    expect(securityGroupAllows(rules, { ...base, direction: "outbound", protocol: "tcp", port: 80 })).toBe(
      false,
    );
  });

  it("una regla con protocolo -1 permite cualquier protocolo y puerto", () => {
    const all: SgRule[] = [{ direction: "inbound", protocol: "-1", cidr: "0.0.0.0/0" }];
    expect(securityGroupAllows(all, { ...base, protocol: "udp", port: 1234 })).toBe(true);
  });

  it("ignora reglas mal formadas y devuelve falso con entradas inválidas, sin lanzar", () => {
    const bad = [
      { direction: "inbound", protocol: "tcp", cidr: "0.0.0.0/0" },
      { direction: "inbound", protocol: "tcp", fromPort: 90, toPort: 80, cidr: "0.0.0.0/0" },
      { direction: "inbound", protocol: "tcp", fromPort: 1, toPort: 70000, cidr: "0.0.0.0/0" },
      { direction: "inbound", protocol: "tcp", fromPort: 1, toPort: 100, cidr: "mal" },
      { direction: "inbound", protocol: "gre", cidr: "0.0.0.0/0" },
      null,
    ] as unknown as SgRule[];
    expect(securityGroupAllows(bad, { ...base, protocol: "tcp", port: 80 })).toBe(false);
    expect(securityGroupAllows(undefined as unknown as SgRule[], { ...base, protocol: "tcp", port: 80 })).toBe(
      false,
    );
    expect(securityGroupAllows(rules, null as unknown as never)).toBe(false);
    expect(securityGroupAllows(rules, { ...base, protocol: "tcp", port: Number.NaN })).toBe(false);
    expect(securityGroupAllows(rules, { ...base, protocol: "tcp", port: 80, peer: "10.0.0.0/8" })).toBe(
      false,
    );
  });
});

describe("network: naclAllows", () => {
  it("la primera coincidencia por número gana, aunque aparezca después en la lista", () => {
    const rules = [
      allow(120, "inbound", "tcp", 0, 65535, "0.0.0.0/0", "allow"),
      allow(110, "inbound", "tcp", 22, 22, "10.0.0.0/8", "deny"),
    ];
    const flow = { direction: "inbound", protocol: "tcp", port: 22, peer: "10.2.2.2" } as const;
    expect(naclAllows(rules, flow)).toEqual({ allowed: false, ruleNumber: 110 });
    expect(naclAllows(rules, { ...flow, peer: "11.2.2.2" })).toEqual({ allowed: true, ruleNumber: 120 });
  });

  it("una regla de denegar antes de una de permitir con el mismo alcance tiene prioridad", () => {
    const rules = [
      allow(90, "inbound", "tcp", 3000, 3010, "0.0.0.0/0", "deny"),
      allow(100, "inbound", "tcp", 1024, 65535, "0.0.0.0/0", "allow"),
    ];
    const flow = { direction: "inbound", protocol: "tcp", peer: "9.9.9.9" } as const;
    expect(naclAllows(rules, { ...flow, port: 3005 })).toEqual({ allowed: false, ruleNumber: 90 });
    expect(naclAllows(rules, { ...flow, port: 4000 })).toEqual({ allowed: true, ruleNumber: 100 });
  });

  it("solo cuentan las reglas de la dirección del flujo", () => {
    const rules = [allow(100, "outbound", "-1", undefined, undefined, "0.0.0.0/0")];
    expect(
      naclAllows(rules, { direction: "inbound", protocol: "tcp", port: 80, peer: "1.1.1.1" }),
    ).toEqual({ allowed: false, ruleNumber: "*" });
  });

  it("la regla * explícita deniega y no se puede sobrescribir con permitir", () => {
    const rules: NaclRule[] = [
      { direction: "inbound", number: "*", action: "allow", protocol: "-1", cidr: "0.0.0.0/0" },
    ];
    expect(
      naclAllows(rules, { direction: "inbound", protocol: "tcp", port: 80, peer: "1.1.1.1" }),
    ).toEqual({ allowed: false, ruleNumber: "*" });
  });

  it("descarta números fuera de 1 a 32766 y reglas mal formadas, sin lanzar", () => {
    const rules = [
      allow(0, "inbound", "-1", undefined, undefined, "0.0.0.0/0"),
      allow(32767, "inbound", "-1", undefined, undefined, "0.0.0.0/0"),
      allow(1.5, "inbound", "-1", undefined, undefined, "0.0.0.0/0"),
      null,
      { direction: "inbound", number: 5, action: "maybe", protocol: "-1", cidr: "0.0.0.0/0" },
    ] as unknown as NaclRule[];
    const flow = { direction: "inbound", protocol: "tcp", port: 80, peer: "1.1.1.1" } as const;
    expect(naclAllows(rules, flow)).toEqual({ allowed: false, ruleNumber: "*" });
    expect(naclAllows(undefined as unknown as NaclRule[], flow)).toEqual({
      allowed: false,
      ruleNumber: "*",
    });
    expect(
      naclAllows([allow(1, "inbound", "-1", undefined, undefined, "0.0.0.0/0")], null as unknown as never),
    ).toEqual({ allowed: false, ruleNumber: "*" });
    expect(naclAllows([allow(32766, "inbound", "-1", undefined, undefined, "0.0.0.0/0")], flow)).toEqual({
      allowed: true,
      ruleNumber: 32766,
    });
  });
});

describe("network: canConnect", () => {
  it("permite web a app por el puerto 8080 dentro de la VPC", () => {
    const result = canConnect(model(), webToApp);
    expect(result.allowed).toBe(true);
    expect(result.path[0]).toContain("Ruta de ida en pub");
    expect(result.path).toContain("SG de entrada del destino");
  });

  it("deniega un puerto que el SG de entrada no abre", () => {
    const result = canConnect(model(), { ...webToApp, port: 22 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("security group de entrada del destino");
  });

  it("deniega si el SG de salida del origen no tiene reglas", () => {
    const m = model();
    m.securityGroups[0]!.rules = m.securityGroups[0]!.rules.filter((r) => r.direction === "inbound");
    const result = canConnect(m, webToApp);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("security group de salida del origen");
  });

  it("agrega las reglas de varios security groups del mismo extremo", () => {
    const m = model();
    const result = canConnect(m, {
      ...webToApp,
      from: { ip: "10.0.0.10", securityGroups: ["sg-db", "sg-web"] },
    });
    expect(result.allowed).toBe(true);
  });

  it("informa de un security group inexistente", () => {
    const result = canConnect(model(), { ...webToApp, to: { ip: "10.0.1.20", securityGroups: ["sg-x"] } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("sg-x");
  });

  it("la NACL de entrada del destino puede denegar aunque el SG permita", () => {
    const m = model();
    m.subnets[1]!.nacl = [
      allow(50, "inbound", "tcp", 8080, 8080, "10.0.0.0/24", "deny"),
      ...openNacl(),
    ];
    const result = canConnect(m, webToApp);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("NACL de entrada de app");
    expect(result.reason).toContain("regla 50");
  });

  it("la NACL de salida del origen puede denegar", () => {
    const m = model();
    m.subnets[0]!.nacl = [allow(100, "inbound", "-1", undefined, undefined, "0.0.0.0/0")];
    const result = canConnect(m, webToApp);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("NACL de salida de pub");
    expect(result.reason).toContain("regla *");
  });

  it("la NACL sin estado exige el puerto efímero de vuelta (49152 por defecto) y se puede cambiar", () => {
    const m = model();
    m.subnets[1]!.nacl = [
      allow(100, "inbound", "tcp", 8080, 8080, "10.0.0.0/24"),
      allow(100, "outbound", "tcp", 1024, 5000, "10.0.0.0/24"),
    ];
    m.subnets[0]!.nacl = [
      allow(100, "outbound", "tcp", 8080, 8080, "10.0.1.0/24"),
      allow(100, "inbound", "tcp", 1024, 5000, "10.0.1.0/24"),
    ];
    expect(DEFAULT_CLIENT_PORT).toBe(49152);
    const denied = canConnect(m, webToApp);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toContain("puerto efímero 49152");
    expect(canConnect(m, { ...webToApp, clientPort: 3000 }).allowed).toBe(true);
    expect(canConnect(m, { ...webToApp, clientPort: 70000 }).allowed).toBe(false);
  });

  it("en la misma subred no se evalúan las NACL", () => {
    const m = model();
    m.subnets[1]!.nacl = [];
    const result = canConnect(m, {
      ...webToApp,
      from: { ip: "10.0.1.5", securityGroups: ["sg-app"] },
      to: { ip: "10.0.1.20", securityGroups: ["sg-app"] },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("security group de entrada");
    m.securityGroups[1]!.rules.push({
      direction: "inbound",
      protocol: "tcp",
      fromPort: 8080,
      toPort: 8080,
      cidr: "10.0.1.0/24",
    });
    expect(
      canConnect(m, {
        ...webToApp,
        from: { ip: "10.0.1.5", securityGroups: ["sg-app"] },
        to: { ip: "10.0.1.20", securityGroups: ["sg-app"] },
      }).allowed,
    ).toBe(true);
  });

  it("Internet entra a la subred pública por el IGW y no a la privada con NAT", () => {
    const internet: ConnectionRequest = {
      from: { ip: "198.51.100.9" },
      to: { ip: "10.0.0.10", securityGroups: ["sg-web"] },
      protocol: "tcp",
      port: 443,
    };
    expect(canConnect(model(), internet).allowed).toBe(true);
    const viaNat = canConnect(model(), {
      ...internet,
      to: { ip: "10.0.1.20", securityGroups: ["sg-web"] },
    });
    expect(viaNat.allowed).toBe(false);
    expect(viaNat.reason).toContain("Sin acceso desde Internet");
    const noRoute = canConnect(model(), {
      ...internet,
      to: { ip: "10.0.2.20", securityGroups: ["sg-web"] },
    });
    expect(noRoute.allowed).toBe(false);
    expect(noRoute.reason).toContain("Sin acceso desde Internet");
  });

  it("la subred privada sale a Internet por el NAT y la aislada no tiene ruta", () => {
    const outbound: ConnectionRequest = {
      from: { ip: "10.0.1.20", securityGroups: ["sg-app"] },
      to: { ip: "93.184.216.34" },
      protocol: "tcp",
      port: 443,
    };
    const ok = canConnect(model(), outbound);
    expect(ok.allowed).toBe(true);
    expect(ok.path[0]).toContain("nat-1");
    const isolated = canConnect(model(), {
      ...outbound,
      from: { ip: "10.0.2.20", securityGroups: ["sg-app"] },
    });
    expect(isolated.allowed).toBe(false);
    expect(isolated.reason).toContain("Sin ruta");
  });

  it("rechaza destinos de ruta no modelados y rutas más específicas que la local", () => {
    const m = model();
    m.subnets[0]!.routes.push({ destination: "93.184.0.0/16", target: "pcx-1" });
    const pcx = canConnect(m, {
      from: { ip: "10.0.0.10", securityGroups: ["sg-web"] },
      to: { ip: "93.184.216.34" },
      protocol: "tcp",
      port: 443,
    });
    expect(pcx.allowed).toBe(false);
    expect(pcx.reason).toContain("no modelado");
    const m2 = model();
    m2.subnets[0]!.routes.push({ destination: "10.0.1.0/24", target: "vgw-1" });
    const override = canConnect(m2, webToApp);
    expect(override.allowed).toBe(false);
    expect(override.reason).toContain("no por la ruta local");
  });

  it("devuelve un motivo, sin lanzar, ante entradas inválidas", () => {
    const flowBad = { ...webToApp, from: { ip: "mal" } };
    expect(canConnect(model(), flowBad).allowed).toBe(false);
    expect(canConnect(null as unknown as VpcModel, webToApp).allowed).toBe(false);
    expect(canConnect(model(), null as unknown as ConnectionRequest).allowed).toBe(false);
    expect(canConnect(model(), { ...webToApp, protocol: "gre" as "tcp" }).allowed).toBe(false);
    expect(canConnect(model(), { ...webToApp, port: -1 }).reason).toContain("puerto");
    const outside = canConnect(model(), { ...webToApp, from: { ip: "1.1.1.1" }, to: { ip: "2.2.2.2" } });
    expect(outside.reason).toContain("Ningún extremo");
    const unknownSubnet = canConnect(model(), { ...webToApp, to: { ip: "10.0.9.9" } });
    expect(unknownSubnet.reason).toContain("no pertenece a ninguna subred");
  });

  it("es determinista y no modifica el modelo", () => {
    const m = model();
    const copy = JSON.stringify(m);
    expect(canConnect(m, webToApp)).toEqual(canConnect(m, webToApp));
    expect(JSON.stringify(m)).toBe(copy);
  });
});
