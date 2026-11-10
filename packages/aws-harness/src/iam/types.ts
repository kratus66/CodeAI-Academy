export interface Statement {
  Sid?: string;
  Effect: "Allow" | "Deny";
  Action?: string | string[];
  NotAction?: string | string[];
  Resource?: string | string[];
  NotResource?: string | string[];
  Principal?: unknown;
  NotPrincipal?: unknown;
  Condition?: Record<string, Record<string, unknown>>;
}

export interface PolicyDocument {
  Version?: string;
  Statement: Statement | Statement[];
}

export interface RequestContext {
  principal: { arn: string; accountId: string };
  action: string;
  resource: { arn: string; accountId: string };
  context?: Record<string, string | string[] | number | boolean>;
}

export interface EvaluationInput {
  request: RequestContext;
  identityPolicies?: PolicyDocument[];
  resourcePolicy?: PolicyDocument | null;
  permissionsBoundary?: PolicyDocument | null;
  scps?: PolicyDocument[][];
  rcps?: PolicyDocument[][];
  sessionPolicies?: PolicyDocument[];
}

export interface MatchedStatement {
  source: string;
  sid?: string;
}

export interface EvaluationResult {
  decision: "Allow" | "ExplicitDeny" | "ImplicitDeny";
  reason: string;
  matched: MatchedStatement[];
}
