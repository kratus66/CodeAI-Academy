import * as cidr from "./cidr/index.js";
import * as cfn from "./cfn/index.js";
import {
  HARNESS_VERSION,
  listCapabilities,
  registerEvaluator,
  selfTest,
} from "./core.js";
import * as dynamodb from "./dynamodb/index.js";
import * as events from "./events/index.js";
import * as iam from "./iam/index.js";
import * as network from "./network/index.js";

export type { EvaluatorCapabilities, RegisteredEvaluator } from "./core.js";

registerEvaluator({ capabilities: cidr.capabilities, canary: cidr.canary });
registerEvaluator({ capabilities: cfn.capabilities, canary: cfn.canary });
registerEvaluator({ capabilities: dynamodb.capabilities, canary: dynamodb.canary });
registerEvaluator({ capabilities: events.capabilities, canary: events.canary });
registerEvaluator({ capabilities: iam.capabilities, canary: iam.canary });
registerEvaluator({ capabilities: network.capabilities, canary: network.canary });

export const aws = { cidr, cfn, dynamodb, events, iam, network };

export { HARNESS_VERSION, listCapabilities, selfTest };
