// Action execution engine (§34–§35). Turns AI output / operational signals into
// controlled enterprise actions. Pipeline per execution:
//   idempotency -> permission -> precondition -> approval routing -> run -> audit
// Per §56 hard rule #5, customer-affecting actions require review or an explicit
// policy exemption (requiresApproval=false).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { hasPermission } from "@/lib/lawrence-core/permissions/permissions";
import { openReviewCase } from "../review-queue/review-service";
import { isKilled } from "../runtime/kill-switch-guard";
import {
  countRecentFailures,
  maybeRaiseFailureIncident,
} from "../runtime/failure-threshold";
import { createApprovalForSubject } from "../approvals/approval-request-service";
import type { ActorContext, Permission } from "@/types/platform";
import type { ActionDefinition, ActionExecution } from "@/types/mission-control";

export interface ActionHandler {
  key: string;
  /** Permission required to execute. */
  requiredPermission?: Permission;
  /** If true, executions are gated by a review case unless exempted. */
  requiresApproval?: boolean;
  /**
   * Policy-engine approval key (Phase 6 hardened path). When set, the action is
   * gated by an approval request evaluated against this policy before any side
   * effect. Fail-closed: a missing policy still requires approval.
   */
  approvalPolicyKey?: string;
  /** Marks a customer-affecting / external / destructive action (§56 #5). */
  dangerous?: boolean;
  /** Returns null if preconditions pass, otherwise a block reason. */
  precondition?(ctx: ActorContext, input: Record<string, unknown>): string | null;
  run(ctx: ActorContext, input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** Stable hash of an input payload for derived idempotency keys. */
function hashInput(input: Record<string, unknown>): string {
  const json = JSON.stringify(input ?? {});
  let h = 5381;
  for (let i = 0; i < json.length; i += 1) h = ((h << 5) + h + json.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const handlers = new Map<string, ActionHandler>();

export function registerAction(handler: ActionHandler): void {
  handlers.set(handler.key, handler);
}

export function resolveAction(key: string): ActionHandler | undefined {
  return handlers.get(key);
}

export interface ExecuteActionInput {
  actionKey: string;
  input: Record<string, unknown>;
  object?: { type: string; id: string };
  idempotencyKey?: string;
  /** Explicit policy exemption from approval (§56 #5). */
  approvalExempt?: boolean;
  /** Force re-execution despite a matching prior in-progress/completed run. */
  force?: boolean;
}

export async function executeAction(
  ctx: ActorContext,
  input: ExecuteActionInput,
): Promise<ActionExecution> {
  const handler = handlers.get(input.actionKey);
  if (!handler) throw new Error(`Unknown action: ${input.actionKey}`);

  // Idempotency: an explicit key, or a key derived from
  // action + object + hash(input). A matching in-progress/completed run is
  // returned instead of re-executing (unless force=true). Failed/blocked runs
  // do not dedupe, so retries are allowed.
  const effectiveKey =
    input.idempotencyKey ??
    `${input.actionKey}:${input.object?.type ?? ""}:${input.object?.id ?? ""}:${hashInput(input.input)}`;
  if (!input.force) {
    const prior = await db.actionExecutions.find(
      ctx.tenantId,
      (e) =>
        e.idempotencyKey === effectiveKey &&
        ["queued", "running", "completed", "awaiting_approval"].includes(e.status),
    );
    if (prior) return prior;
  }

  const exec = await db.actionExecutions.insert({
    id: id("aexec"),
    tenantId: ctx.tenantId,
    actionId: input.actionKey,
    objectType: input.object?.type ?? null,
    objectId: input.object?.id ?? null,
    input: input.input,
    result: null,
    status: "queued",
    idempotencyKey: effectiveKey,
    blockedReason: null,
    reviewCaseId: null,
    createdAt: now(),
  });

  // Kill switch: fail-closed refuse to run a disabled action.
  if (await isKilled({ tenantId: ctx.tenantId, componentType: "action", componentKey: input.actionKey })) {
    return await block(ctx, exec.id, `action ${input.actionKey} is disabled by kill switch`);
  }

  // Permission check.
  if (handler.requiredPermission && !hasPermission(ctx, handler.requiredPermission)) {
    return await block(ctx, exec.id, `missing permission: ${handler.requiredPermission}`);
  }

  // Precondition check.
  const reason = handler.precondition?.(ctx, input.input) ?? null;
  if (reason) return await block(ctx, exec.id, reason);

  // Hardened approval path (policy engine). Dangerous actions with a policy key
  // create an approval request and pause until approved — fail-closed.
  if (handler.approvalPolicyKey && !input.approvalExempt) {
    const decision = await createApprovalForSubject(ctx, {
      subjectType: "action_execution",
      subjectId: exec.id,
      policyKey: handler.approvalPolicyKey,
      subjectPayload: { actionKey: input.actionKey, ...input.input },
      reason: `Approval required for action ${input.actionKey}`,
    });
    if (decision.approvalRequired) {
      const awaiting = await db.actionExecutions.update(exec.id, {
        status: "awaiting_approval",
        blockedReason: null,
      });
      await emitAudit(
        ctx,
        "action.awaiting_approval",
        { type: "action_execution", id: exec.id },
        { approvalRequestId: decision.request?.id ?? null },
      );
      return awaiting;
    }
  }

  // Legacy review-case approval routing: open a review case and pause in
  // awaiting_approval until approved. A human gate, NOT a failure.
  if (handler.requiresApproval && !input.approvalExempt) {
    const rc = await openReviewCase(ctx, {
      caseType: `action:${input.actionKey}`,
      subject: input.object,
      severity: "medium",
      summary: `Approval required for action ${input.actionKey}`,
      gatedActionExecutionId: exec.id,
    });
    const awaiting = await db.actionExecutions.update(exec.id, {
      status: "awaiting_approval",
      blockedReason: null,
      reviewCaseId: rc.id,
    });
    await emitAudit(
      ctx,
      "action.awaiting_approval",
      { type: "action_execution", id: exec.id },
      { reviewCaseId: rc.id },
    );
    return awaiting;
  }

  return await runHandler(ctx, handler, exec.id, input.input);
}

/** Release a previously approved, review-gated action and run it. */
export async function releaseApprovedAction(
  ctx: ActorContext,
  reviewCaseId: string,
): Promise<ActionExecution | null> {
  const exec = await db.actionExecutions.find(ctx.tenantId, (e) => e.reviewCaseId === reviewCaseId);
  if (!exec || exec.status !== "awaiting_approval") return null;
  const handler = handlers.get(exec.actionId);
  if (!handler) return null;
  return await runHandler(ctx, handler, exec.id, exec.input);
}

/**
 * Continue an action execution that was gated by the hardened approval-request
 * path, once its approval has been granted. Called by the approval decision
 * service. No-op (returns null) if the execution isn't awaiting approval.
 */
export async function continueApprovedAction(
  ctx: ActorContext,
  executionId: string,
): Promise<ActionExecution | null> {
  const exec = await db.actionExecutions.get(ctx.tenantId, executionId);
  if (!exec || exec.status !== "awaiting_approval") return null;
  const handler = handlers.get(exec.actionId);
  if (!handler) return null;
  return await runHandler(ctx, handler, exec.id, exec.input);
}

async function runHandler(
  ctx: ActorContext,
  handler: ActionHandler,
  execId: string,
  actionInput: Record<string, unknown>,
): Promise<ActionExecution> {
  await db.actionExecutions.update(execId, { status: "running" });
  try {
    const result = await handler.run(ctx, actionInput);
    const completed = await db.actionExecutions.update(execId, { status: "completed", result });
    await emitAudit(ctx, "action.completed", { type: "action_execution", id: execId }, { actionKey: handler.key });
    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await db.actionExecutions.update(execId, { status: "failed", result: { error: message } });
    await emitAudit(ctx, "action.failed", { type: "action_execution", id: execId }, { error: message });
    // Failure-threshold → incident (3 in 15m = high, 5 = critical).
    const execs = await db.actionExecutions.list(ctx.tenantId, (e) => e.actionId === handler.key);
    const recentFailures = countRecentFailures(execs, (e) => e.status === "failed");
    await maybeRaiseFailureIncident(ctx, {
      componentType: "action",
      componentKey: handler.key,
      recentFailures,
    });
    return failed;
  }
}

async function block(ctx: ActorContext, execId: string, reason: string): Promise<ActionExecution> {
  const blocked = await db.actionExecutions.update(execId, { status: "blocked", blockedReason: reason });
  await emitAudit(ctx, "action.blocked", { type: "action_execution", id: execId }, { reason });
  return blocked;
}

/** Register an action definition row (metadata for Studio/API surfaces). */
export async function defineAction(
  ctx: ActorContext,
  input: { key: string; name: string; objectType?: string; requiredPermission?: string },
): Promise<ActionDefinition> {
  return await db.actionDefinitions.insert({
    id: id("adef"),
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    objectType: input.objectType ?? null,
    inputSchema: {},
    approvalPolicyId: null,
    requiredPermission: input.requiredPermission ?? null,
    createdAt: now(),
  });
}
