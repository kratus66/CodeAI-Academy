"use client";

import { useCallback, useEffect, useState } from "react";

/** Estado de una vista que depende de la API de contenido. */
export type ContentState<T> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly error: unknown }
  | { readonly status: "ready"; readonly data: T };

export interface ContentLoader<T> {
  readonly state: ContentState<T>;
  /** Vuelve a pedir el contenido conservando el loader actual. */
  readonly reload: () => void;
}

/**
 * Carga un recurso de contenido y publica carga, error o dato. La petición se
 * aborta al desmontar y al cambiar el loader, así que no hay respuestas viejas
 * pisando a las nuevas.
 *
 * `load` debe ser **estable** (referencia de módulo o `useCallback`): un lambda
 * nuevo en cada render repetiría la petición en bucle.
 */
export function useContentLoader<T>(
  load: (signal: AbortSignal) => Promise<T>,
): ContentLoader<T> {
  const [state, setState] = useState<ContentState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setState({ status: "loading" });

    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", data });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", error });
        }
      });

    return () => {
      controller.abort();
    };
  }, [attempt, load]);

  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  return { state, reload };
}
