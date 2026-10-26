import { describe, expect, it } from "vitest";

import {
  DEFAULT_ERROR_MESSAGE_BY_CODE,
  ERROR_CODE_BY_HTTP_STATUS,
  ERROR_CODES,
} from "./error-codes";

describe("catálogo de errores", () => {
  it("cubre todos los estados HTTP documentados", () => {
    const documentedStatuses = [400, 401, 403, 404, 409, 422, 429, 500, 503];

    for (const status of documentedStatuses) {
      const code = ERROR_CODE_BY_HTTP_STATUS[status];
      expect(code, `falta el código para HTTP ${status}`).toBeDefined();
      expect(ERROR_CODES).toContain(code);
    }
  });

  it("mapea un fallo inesperado a INTERNAL_ERROR", () => {
    expect(ERROR_CODE_BY_HTTP_STATUS[500]).toBe("INTERNAL_ERROR");
  });

  it("tiene mensaje por defecto para cada código", () => {
    for (const code of ERROR_CODES) {
      expect(DEFAULT_ERROR_MESSAGE_BY_CODE[code].length).toBeGreaterThan(0);
    }
  });
});
