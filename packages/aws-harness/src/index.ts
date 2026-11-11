import * as asl from "./asl/index.js";
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
import * as s3access from "./s3access/index.js";

export type { EvaluatorCapabilities, RegisteredEvaluator } from "./core.js";

registerEvaluator({ capabilities: asl.capabilities, canary: asl.canary });
registerEvaluator({ capabilities: cidr.capabilities, canary: cidr.canary });
registerEvaluator({ capabilities: cfn.capabilities, canary: cfn.canary });
registerEvaluator({ capabilities: dynamodb.capabilities, canary: dynamodb.canary });
registerEvaluator({ capabilities: events.capabilities, canary: events.canary });
registerEvaluator({ capabilities: iam.capabilities, canary: iam.canary });
registerEvaluator({ capabilities: network.capabilities, canary: network.canary });
registerEvaluator({ capabilities: s3access.capabilities, canary: s3access.canary });

export const aws = { asl, cidr, cfn, dynamodb, events, iam, network, s3access };

export { HARNESS_VERSION, listCapabilities, selfTest };
