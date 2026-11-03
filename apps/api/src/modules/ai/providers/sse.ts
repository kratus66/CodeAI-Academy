/**
 * Lee un cuerpo `text/event-stream` y entrega el contenido de cada línea `data:`.
 * Es el único lugar que conoce el framing SSE de los proveedores; ignora
 * comentarios, otros campos y el centinela `[DONE]`.
 */
export async function* readSseData(response: Response): AsyncIterable<string> {
  const body = response.body;

  if (body === null) {
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");

      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");

        buffer = buffer.slice(newline + 1);

        const data = dataOf(line);

        if (data !== null) {
          yield data;
        }

        newline = buffer.indexOf("\n");
      }
    }

    const rest = dataOf(buffer.replace(/\r$/, ""));

    if (rest !== null) {
      yield rest;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function dataOf(line: string): string | null {
  if (!line.startsWith("data:")) {
    return null;
  }

  const data = line.slice(5).trim();

  return data === "" || data === "[DONE]" ? null : data;
}
