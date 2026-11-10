import * as cidr from "./cidr/index.js";
import {
  HARNESS_VERSION,
  listCapabilities,
  registerEvaluator,
  selfTest,
} from "./core.js";

export type { EvaluatorCapabilities, RegisteredEvaluator } from "./core.js";

registerEvaluator({ capabilities: cidr.capabilities, canary: cidr.canary });

export const aws = { cidr };

export { HARNESS_VERSION, listCapabilities, selfTest };
