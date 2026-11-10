export interface EvaluatorCapabilities {
  readonly name: string;
  readonly version: string;
  readonly modeled: readonly string[];
  readonly notModeled: readonly string[];
  readonly sources: readonly string[];
}

export interface RegisteredEvaluator {
  readonly capabilities: EvaluatorCapabilities;
  readonly canary: () => boolean;
}

export const HARNESS_VERSION = "0.1.0";

const registry: RegisteredEvaluator[] = [];

export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return value;
}

export function registerEvaluator(evaluator: RegisteredEvaluator): void {
  registry.push(evaluator);
}

export function selfTest(): boolean {
  for (const evaluator of registry) {
    try {
      if (evaluator.canary() !== true) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

export function listCapabilities(): readonly EvaluatorCapabilities[] {
  return registry.map((evaluator) => evaluator.capabilities);
}
