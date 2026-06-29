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
import type { SurfaceKind, ProjectionMode } from "../contracts/projection-definition";
import type { ObjectInstanceSnapshot } from "../contracts/context";

import { readFieldValue, bindingPath } from "../engines/binding-engine";
import { composeSections } from "../engines/layout-engine";
import { canEmitIntent } from "../engines/permission-engine";
import { evaluateIntentPolicy } from "../engines/policy-engine";
import { initialState } from "../engines/lifecycle-engine";
import { NOOP_TELEMETRY } from "../engines/telemetry-emitter";
import type { PrincipalKind } from "@/lib/constitution";
import type { Permission } from "@/types/platform";
// L3 → L0: the projection runtime obtains an ExecutionAuthority from the kernel
// and a RuntimeSnapshot, then composes a deterministic plan. It never evaluates
// the constitution itself — it consumes the issued token.
import {
  Kernel,
  createSnapshot,
  currentRuntimeGraph,
  nodeVersion,
  stableHash,
  appendJournal,
  type KernelContext,
  type RuntimeSnapshot,
  type CapturedRuntimeState,
} from "@/lib/kernel";

export interface ComposeInput {
  enterpriseObject: EnterpriseObjectDefinition;
  projectionDefinition: ProjectionDefinition;
  userContext: UserContext;
  permissionContext: PermissionContext;
  policyContext: PolicyContext;
  runtimeContext: RuntimeContext;
  /** The constitutionally-significant principal resolving the projection.
   *  Defaults to `human` when a userId is present, else `system`. */
  principalKind?: PrincipalKind;
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

/** Reconstruct a ComposeInput from a snapshot + kernel context. The snapshot is
 *  the immutable capture of everything the resolution helpers need, so this
 *  rebuild is the bridge between the deterministic inputs and the existing
 *  field/intent engines. No ambient state, no clock, no services. */
function inputFromSnapshot(
  projectionDefinition: ProjectionDefinition,
  enterpriseObject: EnterpriseObjectDefinition,
  snapshot: RuntimeSnapshot,
): ComposeInput {
  const rs = snapshot.runtimeState;
  return {
    enterpriseObject,
    projectionDefinition,
    userContext: { tenantId: rs.user.tenantId, userId: rs.user.userId, displayName: rs.user.displayName },
    permissionContext: { permissions: rs.permissions as Permission[] },
    policyContext: {
      requireApprovalFor: rs.policy.requireApprovalFor,
      blockedIntents: rs.policy.blockedIntents,
    },
    runtimeContext: {
      now: snapshot.host.now,
      surfaceOverride: rs.surface as SurfaceKind,
      instance: rs.instance as unknown as ObjectInstanceSnapshot | null,
      telemetry: NOOP_TELEMETRY,
      locale: rs.locale ?? undefined,
    },
  };
}

/**
 * The deterministic core: a PURE function of the projection definition, the
 * enterprise object, the kernel context (carrying the issued authority), and the
 * runtime snapshot. No Kernel calls, no journal writes, no clock, no telemetry.
 *
 *   RenderPlan = composeRenderPlan(ProjectionDefinition, EnterpriseObject,
 *                                  KernelContext, RuntimeSnapshot)
 *
 * Given identical inputs it always produces an identical RenderPlan — which is
 * what makes replay, caching, snapshot comparison, and AI reasoning sound.
 */
export function composeRenderPlan(args: {
  projectionDefinition: ProjectionDefinition;
  enterpriseObject: EnterpriseObjectDefinition;
  kernelContext: KernelContext;
  snapshot: RuntimeSnapshot;
}): RenderPlan {
  const { projectionDefinition, enterpriseObject, kernelContext, snapshot } = args;
  const authority = kernelContext.authority;
  const input = inputFromSnapshot(projectionDefinition, enterpriseObject, snapshot);
  const surface = (snapshot.runtimeState.surface as SurfaceKind) ?? projectionDefinition.surface;
  const mode = projectionDefinition.mode as ProjectionMode;

  // Resolve every field once, key it, then place into the layout.
  const resolvedByKey = new Map<string, ResolvedField>();
  for (const field of enterpriseObject.fields) {
    resolvedByKey.set(field.key, resolveField(field, input));
  }
  const sections = composeSections(enterpriseObject, projectionDefinition, resolvedByKey, mode);

  // Resolve intents, matched by name against the object's intent catalog.
  const intentByName = new Map(enterpriseObject.intents.map((i) => [i.name, i]));
  const primaryDef = projectionDefinition.primaryIntent
    ? intentByName.get(projectionDefinition.primaryIntent)
    : undefined;
  // When authority is withheld, no intent may be emitted from this surface —
  // authority flows from the issued token, not from the button.
  const constitutionalReason = authority.granted
    ? undefined
    : `Execution authority denied: ${authority.restrictions.join(", ") || "constitution withheld authority"}`;
  const gate = (intent: ResolvedIntent): ResolvedIntent =>
    authority.granted ? intent : { ...intent, enabled: false, disabledReason: constitutionalReason };

  const primaryDefResolved = primaryDef ? resolveIntent(primaryDef, input) : undefined;
  const primaryIntent = primaryDefResolved ? gate(primaryDefResolved) : undefined;
  const secondaryIntents = (projectionDefinition.secondaryIntents ?? [])
    .map((name) => intentByName.get(name))
    .filter((i): i is IntentDefinition => Boolean(i))
    .map((i) => gate(resolveIntent(i, input)));

  // Build the plan body (everything except provenance), fingerprint it, then
  // attach provenance. The fingerprint is over the body, so identical inputs
  // produce an identical fingerprint.
  const body = {
    projectionId: projectionDefinition.id,
    objectType: enterpriseObject.objectType,
    surface,
    mode,
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
      surface,
      resolvedAt: snapshot.host.now,
    },
    authority: {
      authorityId: authority.authorityId,
      decisionId: authority.decisionId,
      outcome:
        authority.outcome === "granted"
          ? ("authorized" as const)
          : authority.outcome === "denied"
            ? ("denied" as const)
            : ("authorized_with_advice" as const),
      authorized: authority.granted,
      constitutionVersion: authority.constitutionVersion,
      capabilities: authority.capabilities,
      missionObjective: authority.mission?.title,
      advisories: authority.restrictions,
    },
  };

  const planFingerprint = stableHash(body);

  return {
    ...body,
    provenance: {
      snapshotId: snapshot.snapshotId,
      runtimeGraphHash: snapshot.runtimeGraphHash,
      projectionVersion: nodeVersion(snapshot.versions, "projection-runtime") ?? "?",
      composerVersion: nodeVersion(snapshot.versions, "projection-composer") ?? "?",
      authorityId: authority.authorityId,
      evidenceHash: stableHash(authority.evidence),
      generatedAt: snapshot.host.now,
      planFingerprint,
    },
  };
}

/**
 * The impure adapter that the runtime facade calls. It performs the side effects
 * — requesting authority from the kernel, reading the host, capturing a snapshot,
 * journaling — then delegates the actual plan construction to the pure
 * `composeRenderPlan`. All non-determinism lives here, never in the core.
 */
export function compose(input: ComposeInput): RenderPlan {
  const { enterpriseObject, projectionDefinition, runtimeContext, userContext, permissionContext, policyContext } = input;
  const telemetry = runtimeContext.telemetry ?? NOOP_TELEMETRY;
  telemetry.emit({
    name: "projection.resolving",
    at: runtimeContext.now,
    data: { projectionId: projectionDefinition.id, objectType: enterpriseObject.objectType },
  });

  // L0 — obtain an ExecutionAuthority from the kernel (which journals the grant).
  const principalKind: PrincipalKind =
    input.principalKind ?? (userContext.userId ? "human" : "system");
  const surface = runtimeContext.surfaceOverride ?? projectionDefinition.surface;
  const nowMs = Date.parse(runtimeContext.now) || Date.now();
  const authority = Kernel.requestAuthority(
    {
      kind: "projection.resolve",
      actor: {
        kind: principalKind,
        id: userContext.userId,
        tenantId: userContext.tenantId,
        permissions: permissionContext.permissions as unknown as string[],
      },
      enterpriseId: userContext.tenantId,
      projection: {
        objectType: enterpriseObject.objectType,
        projectionId: projectionDefinition.id,
        surface,
      },
      audited: true,
    },
    nowMs,
  );

  // Capture the immutable RuntimeSnapshot — the reproduction context.
  const hostSurface: "server" | "client" = typeof window === "undefined" ? "server" : "client";
  const runtimeState: CapturedRuntimeState = {
    instance: (runtimeContext.instance ?? null) as unknown as Record<string, unknown> | null,
    surface,
    mode: projectionDefinition.mode,
    locale: runtimeContext.locale ?? null,
    user: {
      tenantId: userContext.tenantId,
      userId: userContext.userId,
      displayName: userContext.displayName ?? null,
    },
    permissions: permissionContext.permissions as unknown as string[],
    policy: {
      requireApprovalFor: policyContext.requireApprovalFor ?? [],
      blockedIntents: policyContext.blockedIntents ?? [],
    },
  };
  const snapshot = createSnapshot({
    authority,
    enterpriseId: userContext.tenantId,
    host: { surface: hostSurface, now: runtimeContext.now },
    runtimeState,
    versions: currentRuntimeGraph(),
  });
  appendJournal({
    kind: "SnapshotCreated",
    at: runtimeContext.now,
    snapshotId: snapshot.snapshotId,
    authorityId: authority.authorityId,
    decisionId: authority.decisionId,
    actorKind: principalKind,
    actorId: userContext.userId,
    enterpriseId: userContext.tenantId,
    summary: `Snapshot captured for ${projectionDefinition.id}`,
    detail: { runtimeGraphHash: snapshot.runtimeGraphHash },
  });

  // Delegate to the deterministic core.
  const kernelContext: KernelContext = {
    authority,
    enterpriseId: userContext.tenantId,
    host: { surface: hostSurface, now: runtimeContext.now },
    telemetry: { emit: () => {} },
  };
  const plan = composeRenderPlan({ projectionDefinition, enterpriseObject, kernelContext, snapshot });

  appendJournal({
    kind: "ProjectionRendered",
    at: runtimeContext.now,
    snapshotId: snapshot.snapshotId,
    authorityId: authority.authorityId,
    decisionId: authority.decisionId,
    actorKind: principalKind,
    actorId: userContext.userId,
    enterpriseId: userContext.tenantId,
    summary: `Rendered ${projectionDefinition.id} (${plan.surface})`,
    detail: { planFingerprint: plan.provenance.planFingerprint },
  });

  telemetry.emit({
    name: "projection.resolved",
    at: runtimeContext.now,
    data: {
      projectionId: plan.projectionId,
      surface: plan.surface,
      fieldCount: plan.sections.reduce((n, s) => n + s.fields.length, 0),
    },
  });

  return plan;
}
