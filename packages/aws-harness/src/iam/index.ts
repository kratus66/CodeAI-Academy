import type { EvaluatorCapabilities } from "../core.js";
import { evaluate, validatePolicy } from "./evaluate.js";
import { matchesAction, matchesResource } from "./matching.js";
import type { PolicyDocument } from "./types.js";

export { evaluate, validatePolicy } from "./evaluate.js";
export { matchesAction, matchesResource } from "./matching.js";
export type {
  EvaluationInput,
  EvaluationResult,
  MatchedStatement,
  PolicyDocument,
  RequestContext,
  Statement,
} from "./types.js";

export const capabilities: EvaluatorCapabilities = {
  name: "iam",
  version: "0.1.0",
  modeled: [
    "Lógica de evaluación de la misma cuenta: una denegación explícita prevalece, y la denegación implícita es el valor por defecto",
    "Unión de políticas de identidad y de recurso en la misma cuenta",
    "Política de recurso que concede el permiso directamente a un usuario IAM o a una sesión de rol: no la limita una denegación implícita de identidad, límite o sesión",
    "Política de recurso que nombra el ARN del rol (o la cuenta, o *): la limitan el límite de permisos y las políticas de sesión",
    "Solicitudes entre cuentas: la cuenta del principal (identidad, límite y sesión) y la cuenta del recurso (política de recurso) deben permitir",
    "Límite de permisos: intersección con las políticas de identidad",
    "Políticas de sesión de sesiones de rol: intersección con las políticas de identidad",
    "SCP del principal y RCP del recurso: un Allow aplicable en cada nivel (raíz, UO, cuenta) y un Deny en cualquier nivel",
    "Elementos Action, NotAction, Resource y NotResource, con comodines * y ?",
    "Acciones insensibles a mayúsculas y recursos sensibles a mayúsculas",
    "Validación de la gramática de políticas de este subconjunto",
  ],
  notModeled: [
    "Condition (hasta S16-T3b): una sentencia con condiciones no se evalúa y, si decide, el resultado es ImplicitDeny",
    "NotPrincipal: una sentencia que lo usa no se evalúa y, si decide, el resultado es ImplicitDeny",
    "Principales de tipo Service, Federated y CanonicalUser en las políticas de recurso",
    "Políticas de confianza de roles y claves de AWS KMS, que exigen un Allow explícito para el principal",
    "ACL de Amazon S3 y otras ACL",
    "Usuario raíz de la cuenta (la guía le da acceso total por defecto) y usuarios federados de GetFederationToken",
    "Roles con ruta en el ARN: el ARN de la sesión no incluye la ruta y no se reconstruye el ARN del rol",
    "Excepciones de Organizations: la cuenta de administración, los roles vinculados a servicios y las tareas que las SCP no restringen",
    "Servicios que admiten RCP y la sintaxis restringida de SCP y RCP",
    "Políticas declarativas, políticas de punto de enlace de VPC y fragmentos de AWS RAM",
    "Variables de política como ${aws:username} (se comparan como texto literal) y ARN incompletos",
    "Políticas de recurso con Principal * o con el ID de la cuenta en la misma cuenta: la guía solo detalla usuario, rol y sesión, y aquí se tratan como limitadas por el límite y la sesión",
    "El comodín * que no cierra un segmento del ARN: la guía recomienda no cruzar los dos puntos y aquí cruza cualquier carácter",
    "Decidir qué SCP y RCP se aplican: lo decide quien llama (scps son las de la cuenta del principal y rcps las de la cuenta del recurso)",
  ],
  sources: [
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-reqcontext.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-basics.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic-cross-account.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_AccessPolicyLanguage_Interplay.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_grammar.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_action.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notaction.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notresource.html",
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html",
    "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html",
    "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html",
    "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html",
    "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps_evaluation.html",
  ],
};

const CANARY_ID_POLICY: PolicyDocument = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "AllowS3Self",
      Effect: "Allow",
      Action: "s3:*",
      Resource: "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/*",
    },
    { Sid: "DenyS3Logs", Effect: "Deny", Action: "s3:*", Resource: "arn:aws:s3:::*log*" },
  ],
};

export function canary(): boolean {
  const user = { arn: "arn:aws:iam::123456789012:user/carlossalazar", accountId: "123456789012" };
  const own = evaluate({
    request: {
      principal: user,
      action: "s3:PutObject",
      resource: {
        arn: "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/a.txt",
        accountId: "123456789012",
      },
    },
    identityPolicies: [CANARY_ID_POLICY],
  });
  const logs = evaluate({
    request: {
      principal: user,
      action: "s3:PutObject",
      resource: {
        arn: "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar-logs",
        accountId: "123456789012",
      },
    },
    identityPolicies: [CANARY_ID_POLICY],
  });
  const none = evaluate({
    request: {
      principal: user,
      action: "iam:CreatePolicy",
      resource: { arn: "arn:aws:iam::123456789012:policy/x", accountId: "123456789012" },
    },
  });
  return (
    own.decision === "Allow" &&
    logs.decision === "ExplicitDeny" &&
    none.decision === "ImplicitDeny" &&
    matchesAction("IAM:listaccesskeys", "iam:ListAccessKeys") &&
    matchesAction("iam:*AccessKey*", "iam:DeleteAccessKey") &&
    !matchesResource("arn:aws:iam::123456789012:user/Bob", "arn:aws:iam::123456789012:user/bob") &&
    validatePolicy(CANARY_ID_POLICY).length === 0
  );
}
