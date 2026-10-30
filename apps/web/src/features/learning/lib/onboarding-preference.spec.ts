import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ONBOARDING_STORAGE_KEY,
  readOnboardingChoice,
  saveOnboardingChoice,
  subscribeOnboarding,
} from "./onboarding-preference";

const COMPLETED = {
  status: "completed",
  answers: { goal: "career-change", level: "beginner", pace: "steady" },
} as const;

function store(raw: string): void {
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, raw);
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("onboarding-preference", () => {
  it("no tiene elección mientras no haya nada guardado", () => {
    expect(readOnboardingChoice()).toBeNull();
  });

  it("guarda y recupera las tres respuestas", () => {
    saveOnboardingChoice(COMPLETED);

    expect(readOnboardingChoice()).toEqual(COMPLETED);
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe(
      JSON.stringify(COMPLETED),
    );
  });

  it("recuerda también el salto explícito", () => {
    saveOnboardingChoice({ status: "skipped" });

    expect(readOnboardingChoice()).toEqual({ status: "skipped" });
  });

  it("devuelve la misma referencia entre lecturas y cambia al guardar", () => {
    const first = readOnboardingChoice();
    expect(readOnboardingChoice()).toBe(first);

    saveOnboardingChoice({ status: "skipped" });

    expect(readOnboardingChoice()).not.toBe(first);
  });

  it("ignora un valor corrupto o de otra versión", () => {
    store("{no es json");
    expect(readOnboardingChoice()).toBeNull();

    store(JSON.stringify({ status: "completed", answers: { goal: "marte" } }));
    expect(readOnboardingChoice()).toBeNull();

    store(JSON.stringify({ status: "pendiente" }));
    expect(readOnboardingChoice()).toBeNull();
  });

  it("sigue funcionando si el navegador no deja escribir", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("almacenamiento lleno");
    });

    saveOnboardingChoice({ status: "skipped" });

    expect(readOnboardingChoice()).toEqual({ status: "skipped" });
  });

  it("avisa a los suscriptores al guardar y deja de hacerlo al desuscribirse", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOnboarding(listener);

    saveOnboardingChoice({ status: "skipped" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    saveOnboardingChoice(COMPLETED);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("se entera de los cambios hechos en otra pestaña", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOnboarding(listener);

    window.dispatchEvent(
      new StorageEvent("storage", { key: ONBOARDING_STORAGE_KEY }),
    );
    expect(listener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent("storage", { key: "otra-clave" }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
