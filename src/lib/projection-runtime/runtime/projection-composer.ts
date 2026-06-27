// ProjectionComposer — orchestrates every engine to turn metadata + contexts
// into a serializable RenderPlan. This is where field binding, layout, permission
// gating, policy posture, validation flattening, and lifecycle defaulting are
// combined. The composer owns the business logic; the renderer owns none of it.

import type {
  EnterpriseObjectDefinition,
  IntentDefinition,
} from "../contracts/enterprise-object";
import type { ProjectionDefinition } from "../contracts/projection-definition";
import type {
  UserContext,
  PermissionContext,
  PolicyContext,
  RuntimeContext,
} from "../contracts/context";
import type {
  RenderPlan,
  ResolvedField,
  ResolvedIntent,
  ResolvedPostAction,
} from "../contracts/universal-projection";
import type { FieldDefinition, FieldValidationRule } from "../contracts/field";

import { readFieldValue, bindingPath } from "../engines/binding-engine";
import { composeSections } from "../engines/layout-engine";
import { canEmitIntent } from "../engines/permission-engine";
import { evaluateIntentPolicy } from "../engines/policy-engine";
import { initialState } from "../engines/lifecycle-engine";
import { NOOP_TELEMETRY } from "../engines/telemetry-emitter";

export interface ComposeInput {
  enterpriseObject: EnterpriseObjectDefinition;
  projectionDefinition: ProjectionDefinition;
  userContext: UserContext;
  permissionContext: PermissionContext;
  policyContext: PolicyContext;
  runtimeContext: RuntimeContext;
}

/** Flatten a field's declared validations, injecting a lifecycle/required default
 *  when appropriate. Returns required flag + the effective rule list. */
function resolveValidations(field: FieldDefinition): { required: boolean; rules: FieldValidationRule[] } {
  const rules = field.validations ?? [];
  const required = rules.some((r) => r.kind === "required");
  return { required, rules };
}

function resolveField(
  field: FieldDefinition,
  input: ComposeInput,
): ResolvedField {
  const { projectionDefinition, runtimeContext } = input;
  const mode = projectionDefinition.mode;
  const { required, rules } = resolveValidations(field);

  // Status fields in a create projection are seeded from the lifecycle initial
  // state when not otherwise defaulted.
  let value = readFieldValue(field, runtimeContext.instance, mode);
  if (
    field.binding.target === "status" &&
    mode === "create" &&
    (value === "" || value == null)
  ) {
    value = initialState(input.enterpriseObject) ?? value;
  }

  const editable = mode !== "view" && !field.readOnly;

  return {
    key: field.key,
    label: field.label,
    type: field.type,
    placeholder: field.placeholder,
    helpText: field.helpText,
    options: field.options,
    value,
    required,
    validations: rules,
    visible: true,
    editable,
    binding: { target: field.binding.target, path: bindingPath(field.binding, field.key) },
  };
}

function resolveIntent(
  intent: IntentDefinition,
  input: ComposeInput,
): ResolvedIntent {
  const perm = canEmitIntent(input.permissionContext, intent);
  const policy = evaluateIntentPolicy(input.policyContext, intent);
  const enabled = perm.enabled && !policy.blocked;
  const reason = !perm.enabled ? perm.reason : policy.blocked ? policy.reason : undefined;
  return {
    name: intent.name,
    operation: intent.operation,
    actionKey: intent.actionKey,
    label: intent.label,
    variant: intent.variant ?? "secondary",
    requiresApproval: policy.requiresApproval,
    enabled,
    disabledReason: reason,
  };
}

function resolvePostActions(input: ComposeInput): ResolvedPostAction[] {
  return (input.enterpriseObject.postActions ?? []).map((p) => ({
    kind: p.kind,
    href: p.href,
    message: p.message,
    intent: p.intent,
    forOperations: p.forOperations,
  }));
}

export function compose(input: ComposeInput): RenderPlan {
  const { enterpriseObject, projectionDefinition, runtimeContext } = input;
  const telemetry = runtimeContext.telemetry ?? NOOP_TELEMETRY;
  telemetry.emit({
    name: "projection.resolving",
    at: runtimeContext.now,
    data: { projectionId: projectionDefinition.id, objectType: enterpriseObject.objectType },
  });

  // Resolve every field once, key it, then place into the layout.
  const resolvedByKey = new Map<string, ResolvedField>();
  for (const field of enterpriseObject.fields) {
    resolvedByKey.set(field.key, resolveField(field, input));
  }
  const sections = composeSections(
    enterpriseObject,
    projectionDefinition,
    resolvedByKey,
    projectionDefinition.mode,
  );

  // Resolve intents. The primary submit + the declared secondary intents are
  // matched by name against the object's intent catalog.
  const intentByName = new Map(enterpriseObject.intents.map((i) => [i.name, i]));
  const primaryDef = projectionDefinition.primaryIntent
    ? intentByName.get(projectionDefinition.primaryIntent)
    : undefined;
  const primaryIntent = primaryDef ? resolveIntent(primaryDef, input) : undefined;
  const secondaryIntents = (projectionDefinition.secondaryIntents ?? [])
    .map((name) => intentByName.get(name))
    .filter((i): i is IntentDefinition => Boolean(i))
    .map((i) => resolveIntent(i, input));

  const plan: RenderPlan = {
    projectionId: projectionDefinition.id,
    objectType: enterpriseObject.objectType,
    surface: runtimeContext.surfaceOverride ?? projectionDefinition.surface,
    mode: projectionDefinition.mode,
    title: projectionDefinition.title,
    description: projectionDefinition.description,
    sections,
    objectValidations: enterpriseObject.objectValidations ?? [],
    primaryIntent,
    secondaryIntents,
    postActions: resolvePostActions(input),
    display: projectionDefinition.display,
    telemetry: {
      projectionId: projectionDefinition.id,
      objectType: enterpriseObject.objectType,
      surface: runtimeContext.surfaceOverride ?? projectionDefinition.surface,
      resolvedAt: runtimeContext.now,
    },
  };

  telemetry.emit({
    name: "projection.resolved",
    at: runtimeContext.now,
    data: {
      projectionId: plan.projectionId,
      surface: plan.surface,
      fieldCount: sections.reduce((n, s) => n + s.fields.length, 0),
    },
  });

  return plan;
}
