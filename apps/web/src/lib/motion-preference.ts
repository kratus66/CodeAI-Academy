import { useSyncExternalStore } from "react";

const STORAGE_KEY = "codeai:background-paused";

type Listener = () => void;

const listeners = new Set<Listener>();
let override: boolean | null | undefined;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function readStored(): boolean | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}

/** Estado actual: la elección guardada manda; sin ella, se respeta el sistema. */
export function isMotionPaused(): boolean {
  if (override === undefined) {
    // Quien pide reducir movimiento arranca en pausa y solo la quita a propósito.
    override = prefersReducedMotion() ? null : readStored();
  }
  return override ?? prefersReducedMotion();
}

export function setMotionPaused(paused: boolean): void {
  override = paused;
  try {
    window.localStorage.setItem(STORAGE_KEY, paused ? "1" : "0");
  } catch {
    // Sin almacenamiento: la preferencia dura solo la sesión.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeMotion(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `true` en servidor para que el primer render coincida con el de hidratación. */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribeMotion, isMotionPaused, () => true);
}
