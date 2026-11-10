import * as cidr from "./cidr/index.js";
import {
  HARNESS_VERSION,
  listCapabilities,
  registerEvaluator,
  selfTest,
} from "./core.js";
import * as iam from "./iam/index.js";

export type { EvaluatorCapabilities, RegisteredEvaluator } from "./core.js";

registerEvaluator({ capabilities: cidr.capabilities, canary: cidr.canary });
registerEvaluator({ capabilities: iam.capabilities, canary: iam.canary });

export const aws = { cidr, iam };

export { HARNESS_VERSION, listCapabilities, selfTest };
