import { describe, expect, it } from "vitest";

import { ContentCache } from "./content-cache";

function clockFrom(start = 0): { now: () => number; advance: (ms: number) => void } {
  let current = start;

  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("ContentCache", () => {
  it("sirve la segunda lectura desde memoria sin llamar al cargador", async () => {
    const cache = new ContentCache();
    let loads = 0;
    const load = async (): Promise<string> => {
      loads += 1;
      return "catálogo";
    };

    await expect(cache.getOrLoad("stages:1", load)).resolves.toBe("catálogo");
    await expect(cache.getOrLoad("stages:1", load)).resolves.toBe("catálogo");

    expect(loads).toBe(1);
    expect(cache.stats).toEqual({ version: 0, hits: 1, misses: 1, size: 1 });
  });

  it("separa claves distintas y vuelve a cargar al caducar el TTL", async () => {
    const clock = clockFrom();
    const cache = new ContentCache(60_000, clock.now);
    let loads = 0;
    const load = async (): Promise<number> => {
      loads += 1;
      return loads;
    };

    await cache.getOrLoad("a", load);
    await cache.getOrLoad("b", load);
    expect(loads).toBe(2);

    clock.advance(59_999);
    await expect(cache.getOrLoad("a", load)).resolves.toBe(1);
    expect(loads).toBe(2);

    clock.advance(1);
    await expect(cache.getOrLoad("a", load)).resolves.toBe(3);
    expect(loads).toBe(3);
  });

  it("invalida por versión y fuerza una consulta nueva", async () => {
    const cache = new ContentCache();
    let loads = 0;
    const load = async (): Promise<string> => {
      loads += 1;
      return `v${loads}`;
    };

    await expect(cache.getOrLoad("stage:1", load)).resolves.toBe("v1");
    expect(cache.invalidate()).toBe(1);
    await expect(cache.getOrLoad("stage:1", load)).resolves.toBe("v2");

    expect(loads).toBe(2);
    expect(cache.stats.version).toBe(1);
    expect(cache.stats.size).toBe(1);
  });

  it("no publica como vigente un resultado que terminó tras la invalidación", async () => {
    const cache = new ContentCache();
    let release!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    let loads = 0;

    const first = cache.getOrLoad("unit:U1", async () => {
      loads += 1;
      return pending;
    });

    cache.invalidate();
    release("obsoleto");

    await expect(first).resolves.toBe("obsoleto");
    await expect(
      cache.getOrLoad("unit:U1", async () => {
        loads += 1;
        return "vigente";
      }),
    ).resolves.toBe("vigente");

    expect(loads).toBe(2);
  });

  it("no cachea un cargador que lanza", async () => {
    const cache = new ContentCache();
    let loads = 0;

    await expect(
      cache.getOrLoad("lesson:no-existe", async () => {
        loads += 1;
        throw new Error("404");
      }),
    ).rejects.toThrow("404");

    expect(cache.stats.size).toBe(0);
    expect(loads).toBe(1);
  });
});
