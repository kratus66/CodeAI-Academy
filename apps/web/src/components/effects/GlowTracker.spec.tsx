import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** jsdom no implementa `PointerEvent`: basta con uno que porte las coordenadas. */
class PointerEventPolyfill extends MouseEvent {}

/** `matchMedia` mínimo: solo nos importa `prefers-reduced-motion`. */
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal("matchMedia", ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia);
}

/**
 * El estado de movimiento vive a nivel de módulo, así que cada caso monta el
 * componente recién importado para leer la preferencia actual.
 */
async function mountTracker() {
  vi.resetModules();
  const { GlowTracker } = await import("./GlowTracker");
  return render(<GlowTracker />);
}

function glassCard(): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "glass";
  card.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 5,
      width: 100,
      height: 100,
      right: 110,
      bottom: 105,
      x: 10,
      y: 5,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.append(card);
  return card;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("PointerEvent", PointerEventPolyfill);
  stubReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("GlowTracker", () => {
  it("publica la posición del cursor relativa a la tarjeta bajo el puntero", async () => {
    const card = glassCard();
    await mountTracker();

    fireEvent.pointerMove(card, { clientX: 40, clientY: 30 });

    expect(card.style.getPropertyValue("--mx")).toBe("30px");
    expect(card.style.getPropertyValue("--my")).toBe("25px");
  });

  it("ignora los punteros que no caen sobre una tarjeta", async () => {
    const card = glassCard();
    const outside = document.createElement("p");
    document.body.append(outside);
    await mountTracker();

    fireEvent.pointerMove(outside, { clientX: 40, clientY: 30 });

    expect(card.style.getPropertyValue("--mx")).toBe("");
    expect(outside.style.getPropertyValue("--mx")).toBe("");
  });

  it("no registra el rastreador si se pidió reducir movimiento", async () => {
    stubReducedMotion(true);
    const card = glassCard();
    await mountTracker();

    fireEvent.pointerMove(card, { clientX: 40, clientY: 30 });

    expect(card.style.getPropertyValue("--mx")).toBe("");
  });

  it("retira el listener al desmontarse", async () => {
    const card = glassCard();
    const view = await mountTracker();

    view.unmount();
    fireEvent.pointerMove(card, { clientX: 40, clientY: 30 });

    expect(card.style.getPropertyValue("--mx")).toBe("");
  });
});
