import { describe, expect, expectTypeOf, it } from "vitest";

import {
  HINT_TEXT_MAX_CHARS,
  hintLevelSchema,
  hintRequestSchema,
  hintResponseEnvelopeSchema,
  hintResponseSchema,
  type HintLevel,
  type HintRequestInput,
} from "./hint";

const HINT = {
  level: 1,
  text: "Revisa qué devuelve la función cuando el status no es 200.",
  nextLevelAvailable: true,
} as const;

describe("hintLevelSchema", () => {
  it("acepta los niveles 1, 2 y 3", () => {
    for (const level of [1, 2, 3]) {
      expect(hintLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  it("rechaza niveles fuera de 1–3 con mensaje en español", () => {
    const result = hintLevelSchema.safeParse(4);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("El nivel de pista debe ser 1, 2 o 3");
    }
  });
});

describe("hintRequestSchema", () => {
  it("acepta { level: 1 } y su tipo inferido es { level: HintLevel }", () => {
    const result = hintRequestSchema.safeParse({ level: 1 });
    expect(result.success).toBe(true);
    expectTypeOf<HintRequestInput>().toEqualTypeOf<{ level: HintLevel }>();
  });

  it("rechaza level 4, 0 y 2 como cadena", () => {
    expect(hintRequestSchema.safeParse({ level: 4 }).success).toBe(false);
    expect(hintRequestSchema.safeParse({ level: 0 }).success).toBe(false);
    expect(hintRequestSchema.safeParse({ level: "2" }).success).toBe(false);
  });

  it("rechaza el cuerpo vacío", () => {
    expect(hintRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rechaza campos extra", () => {
    expect(hintRequestSchema.safeParse({ level: 1, extra: true }).success).toBe(false);
  });
});

describe("hintResponseSchema", () => {
  it("acepta una pista válida", () => {
    const result = hintResponseSchema.safeParse(HINT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(HINT);
    }
  });

  it("rechaza texto vacío", () => {
    expect(hintResponseSchema.safeParse({ ...HINT, text: "" }).success).toBe(false);
  });

  it("rechaza texto por encima del máximo", () => {
    const text = "a".repeat(HINT_TEXT_MAX_CHARS + 1);
    expect(hintResponseSchema.safeParse({ ...HINT, text }).success).toBe(false);
  });

  it("rechaza level 0", () => {
    expect(hintResponseSchema.safeParse({ ...HINT, level: 0 }).success).toBe(false);
  });

  it("rechaza la ausencia de nextLevelAvailable", () => {
    const { text, level } = HINT;
    expect(hintResponseSchema.safeParse({ level, text }).success).toBe(false);
  });

  it("no admite propiedades desconocidas (strict)", () => {
    expect(hintResponseSchema.safeParse({ ...HINT, solution: "return 1;" }).success).toBe(false);
    expect(hintResponseSchema.safeParse({ ...HINT, hintsUsed: 1 }).success).toBe(false);
  });
});

describe("hintResponseEnvelopeSchema", () => {
  it("acepta { hint: {...} }", () => {
    expect(hintResponseEnvelopeSchema.safeParse({ hint: HINT }).success).toBe(true);
  });

  it("rechaza la pista sin envolver", () => {
    expect(hintResponseEnvelopeSchema.safeParse(HINT).success).toBe(false);
  });

  it("rechaza campos extra en el sobre", () => {
    expect(hintResponseEnvelopeSchema.safeParse({ hint: HINT, extra: 1 }).success).toBe(false);
  });
});
