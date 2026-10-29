import { Inject, Injectable, Optional } from "@nestjs/common";

/** TTL de seguridad: un cambio externo (semilla, SQL) se ve como máximo en 60 s. */
export const DEFAULT_CONTENT_CACHE_TTL_MS = 60_000;

/** Token opcional para acortar el TTL en pruebas. */
export const CONTENT_CACHE_TTL_MS = Symbol("CONTENT_CACHE_TTL_MS");

/** Token opcional para sustituir el reloj en pruebas. */
export const CONTENT_CACHE_CLOCK = Symbol("CONTENT_CACHE_CLOCK");

export type ContentCacheClock = () => number;

/** Límite de claves para que un paginador curioso no crezca sin control. */
const MAX_ENTRIES = 500;

export interface ContentCacheStats {
  version: number;
  hits: number;
  misses: number;
  size: number;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  version: number;
}

/**
 * Caché de lectura del catálogo (`T10`).
 *
 * La invalidación es por **versión**, no sólo por reloj: cada mutación de
 * contenido llama a `invalidate()` y sube `version`; las entradas guardadas con
 * una versión anterior dejan de servirse aunque su TTL siga vivo. El TTL de
 * 60 s es la red de seguridad para cambios hechos fuera del proceso (semillas o
 * SQL manual), que no pueden avisar a esta instancia.
 *
 * Sólo guarda resultados correctos: si el cargador lanza (por ejemplo un `404`),
 * nada queda cacheado y la siguiente petición vuelve a consultar.
 */
@Injectable()
export class ContentCache {
  private readonly entries = new Map<string, CacheEntry>();
  private version = 0;
  private hits = 0;
  private misses = 0;

  constructor(
    @Optional()
    @Inject(CONTENT_CACHE_TTL_MS)
    private readonly ttlMs: number = DEFAULT_CONTENT_CACHE_TTL_MS,
    @Optional()
    @Inject(CONTENT_CACHE_CLOCK)
    private readonly now: ContentCacheClock = Date.now,
  ) {}

  async getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    const at = this.now();
    const entry = this.entries.get(key);

    if (
      entry !== undefined &&
      entry.version === this.version &&
      at < entry.expiresAt
    ) {
      this.hits += 1;
      return entry.value as T;
    }

    this.misses += 1;
    // Se captura antes del `await`: si una mutación invalida mientras se
    // consulta, el resultado obsoleto no se guarda con la versión nueva.
    const version = this.version;
    const value = await load();

    this.prune(at);
    this.entries.set(key, { value, expiresAt: at + this.ttlMs, version });

    return value;
  }

  /**
   * Sube la versión y descarta lo cacheado. Devuelve la versión nueva para que
   * la mutación pueda registrarla en el log sin leer estado interno.
   */
  invalidate(): number {
    this.version += 1;
    this.entries.clear();

    return this.version;
  }

  get stats(): ContentCacheStats {
    return {
      version: this.version,
      hits: this.hits,
      misses: this.misses,
      size: this.entries.size,
    };
  }

  /** Descarta entradas caducadas y, si aun así sobra, las más antiguas. */
  private prune(at: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= at) {
        this.entries.delete(key);
      }
    }

    while (this.entries.size >= MAX_ENTRIES) {
      const oldest = this.entries.keys().next();

      if (oldest.done === true) {
        return;
      }

      this.entries.delete(oldest.value);
    }
  }
}
